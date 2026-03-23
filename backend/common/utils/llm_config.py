"""
Centralized LLM configuration service.

Provides:
- Model registry with available LLMs
- Task-based model selection with fallbacks
- LLM client creation for direct OpenRouter API calls
"""
import logging
import os
from typing import Dict, List, Optional, Any
from django.conf import settings
from asgiref.sync import sync_to_async

logger = logging.getLogger(__name__)


class LLMConfigService:
    """
    Centralized service for LLM configuration.
    
    Usage:
        # Get appropriate model for a task
        model = LLMConfigService.get_model_for_task(site, 'agent_qa')
        
        # Create an LLMClient for direct API calls (preferred path)
        client, model_name, temp, max_tok = LLMConfigService.create_llm_client_for_task(
            site=site, task_type='agent_qa'
        )
        response = client.complete(prompt="...", system_prompt="...")
    """
    
    # Model registry - defines available models
    # All models use OpenRouter for unified API access
    #
    # NOTE: Use provider/tier references (e.g., 'openai/flagship') instead of
    # hardcoding model names. See get_model() and resolve_model() methods.
    AVAILABLE_MODELS = {
        # === OpenAI Models ===
        'gpt-5-1': {
            'provider': 'openrouter',
            'openrouter_model': 'openai/gpt-5.1',
            'context_window': 128000,
            'description': 'OpenAI GPT-5.1 via OpenRouter (latest flagship model)',
            'cost_tier': 'premium',
            'supports_vision': True,
            'supports_reasoning': True,
            'reasoning_style': 'effort',
        },
        'gpt-4o': {
            'provider': 'openrouter',
            'openrouter_model': 'openai/gpt-4o',
            'context_window': 128000,
            'description': 'OpenAI GPT-4o via OpenRouter (legacy, use openai/flagship)',
            'cost_tier': 'premium',
            'supports_vision': True,
            'supports_reasoning': False,
            'reasoning_style': None,
        },
        'gpt-4o-mini': {
            'provider': 'openrouter',
            'openrouter_model': 'openai/gpt-4o-mini',
            'context_window': 128000,
            'description': 'OpenAI GPT-4o Mini (fast and cheap)',
            'cost_tier': 'budget',
            'supports_vision': True,
            'supports_reasoning': False,
            'reasoning_style': None,
        },
        # === Anthropic Models ===
        'claude-opus-4.6': {
            'provider': 'openrouter',
            'openrouter_model': 'anthropic/claude-opus-4.6',
            'context_window': 1000000,
            'description': 'Anthropic Claude Opus 4.6 via OpenRouter (flagship model)',
            'cost_tier': 'premium',
            'supports_vision': True,
            'supports_reasoning': True,
            'reasoning_style': 'adaptive',  # Model auto-decides thinking depth
        },
        'claude-sonnet-4.6': {
            'provider': 'openrouter',
            'openrouter_model': 'anthropic/claude-sonnet-4.6',
            'context_window': 200000,
            'description': 'Anthropic Claude Sonnet 4.6 via OpenRouter',
            'cost_tier': 'standard',
            'supports_vision': True,
            'supports_reasoning': True,
            'reasoning_style': 'effort',
        },
        'claude-sonnet-4.5': {
            'provider': 'openrouter',
            'openrouter_model': 'anthropic/claude-sonnet-4.5',
            'context_window': 200000,
            'description': 'Anthropic Claude Sonnet 4.5 via OpenRouter',
            'cost_tier': 'standard',
            'supports_vision': True,
            'supports_reasoning': True,
            'reasoning_style': 'effort',  # OpenRouter converts effort to budget_tokens
        },
        'claude-sonnet-4-5-20250929': {
            'provider': 'openrouter',
            'openrouter_model': 'anthropic/claude-sonnet-4.5',
            'context_window': 200000,
            'description': 'Anthropic Claude Sonnet 4.5 via OpenRouter (legacy alias)',
            'cost_tier': 'premium',
            'supports_vision': True,
            'supports_reasoning': True,
            'reasoning_style': 'effort',
        },
        'claude-haiku-4-5': {
            'provider': 'openrouter',
            'openrouter_model': 'anthropic/claude-haiku-4.5',
            'context_window': 200000,
            'description': 'Anthropic Claude 4.5 Haiku (fast and cheap)',
            'cost_tier': 'budget',
            'supports_vision': True,
            'supports_reasoning': True,
            'reasoning_style': 'effort',  # OpenRouter converts effort to budget_tokens
        },
        'claude-haiku-3-5': {
            'provider': 'openrouter',
            'openrouter_model': 'anthropic/claude-3.5-haiku',
            'context_window': 200000,
            'description': 'Anthropic Claude 3.5 Haiku (legacy alias)',
            'cost_tier': 'budget',
            'supports_vision': True,
            'supports_reasoning': False,
            'reasoning_style': None,
        },
        # === Google Models ===
        'gemini-3-pro': {
            'provider': 'openrouter',
            'openrouter_model': 'google/gemini-3-pro-preview',
            'context_window': 1000000,
            'description': 'Google Gemini 3.0 Pro Preview via OpenRouter (latest flagship)',
            'cost_tier': 'premium',
            'supports_vision': True,
            'supports_reasoning': True,
            'reasoning_style': 'effort',  # OpenRouter maps effort to thinkingLevel
        },
        'gemini-2.5-pro': {
            'provider': 'openrouter',
            'openrouter_model': 'google/gemini-2.5-pro',
            'context_window': 1000000,
            'description': 'Google Gemini 2.5 Pro via OpenRouter (legacy alias)',
            'cost_tier': 'premium',
            'supports_vision': True,
            'supports_reasoning': True,
            'reasoning_style': 'budget',  # Uses thinkingBudget via reasoning.max_tokens
        },
        'gemini-flash-2-5': {
            'provider': 'openrouter',
            'openrouter_model': 'google/gemini-2.5-flash',
            'context_window': 1000000,
            'description': 'Google Gemini 2.5 Flash (fast and cheap)',
            'cost_tier': 'budget',
            'supports_vision': True,
            'supports_reasoning': True,
            'reasoning_style': 'budget',  # Uses thinkingBudget via reasoning.max_tokens
        },
        'gemini-3-flash-preview': {
            'provider': 'openrouter',
            'openrouter_model': 'google/gemini-3-flash-preview',
            'context_window': 1000000,
            'description': 'Google Gemini 3 Flash Preview (fast and cheap)',
            'cost_tier': 'budget',
            'supports_vision': True,
            'supports_reasoning': True,
            'reasoning_style': 'effort',  # OpenRouter maps effort to thinkingLevel
        },
        'gemini-3.1-flash-lite': {
            'provider': 'openrouter',
            'openrouter_model': 'google/gemini-3.1-flash-lite-preview',
            'context_window': 1000000,
            'description': 'Google Gemini 3.1 Flash Lite Preview (fastest, cheapest)',
            'cost_tier': 'budget',
            'supports_vision': True,
            'supports_reasoning': False,
        },
        # === xAI Models ===
        'grok-4': {
            'provider': 'openrouter',
            'openrouter_model': 'x-ai/grok-4',
            'context_window': 131072,
            'description': 'xAI Grok 4 via OpenRouter (flagship)',
            'cost_tier': 'premium',
            'supports_vision': False,
            'supports_reasoning': True,
            'reasoning_style': None,  # Always-on reasoning, not configurable
        },
        'grok-4-1-fast': {
            'provider': 'openrouter',
            'openrouter_model': 'x-ai/grok-4.1-fast',
            'context_window': 131072,
            'description': 'xAI Grok 4.1 Fast via OpenRouter (budget)',
            'cost_tier': 'budget',
            'supports_vision': False,
            'supports_reasoning': True,
            'reasoning_style': 'effort',
        },
        'grok-beta': {
            'provider': 'openrouter',
            'openrouter_model': 'x-ai/grok-beta',
            'context_window': 131072,
            'description': 'xAI Grok Beta via OpenRouter (legacy alias)',
            'cost_tier': 'premium',
            'supports_vision': False,
            'supports_reasoning': False,
            'reasoning_style': None,
        },
    }
    
    # Provider tier mapping - update here when new models launch
    # Use get_model('openai', 'flagship') or resolve_model('openai/flagship')
    PROVIDER_TIERS = {
        'openai': {
            'flagship': 'gpt-5-1',
            'budget': 'gpt-4o-mini',
        },
        'anthropic': {
            'flagship': 'claude-opus-4.6',
            'standard': 'claude-sonnet-4.6',
            'budget': 'claude-haiku-4-5',
        },
        'google': {
            'flagship': 'gemini-3-pro',
            'standard': 'gemini-3-flash-preview',
            'budget': 'gemini-3.1-flash-lite',
        },
        'xai': {
            'flagship': 'grok-4',
            'budget': 'grok-4-1-fast',
        },
    }
    
    # Task type constants
    TASK_AGENT_QA = 'agent_qa'
    TASK_CONTENT_OPTIMIZATION = 'content_optimization'
    TASK_COMPETITOR_DISCOVERY = 'competitor_discovery'
    TASK_COMPETITOR_ANALYSIS = 'competitor_analysis'
    TASK_COMPETITOR_CATEGORY = 'competitor_category'
    TASK_COMPETITOR_RANKING = 'competitor_ranking'
    TASK_SEMANTIC_CATEGORIZATION = 'semantic_categorization'
    TASK_QUESTION_SUGGESTIONS = 'question_suggestions'
    
    @classmethod
    def get_available_models(cls) -> Dict[str, Dict[str, Any]]:
        """
        Get dictionary of available models.
        
        Returns:
            Dict mapping model name to model metadata
        """
        return cls.AVAILABLE_MODELS.copy()
    
    @classmethod
    def get_models_by_tier(cls, cost_tier: str) -> List[str]:
        """
        Get list of model names filtered by cost tier.
        
        Args:
            cost_tier: 'premium' or 'budget'
        
        Returns:
            List of model names in that tier
        """
        return [
            name for name, info in cls.AVAILABLE_MODELS.items()
            if info.get('cost_tier') == cost_tier
        ]
    
    @classmethod
    def get_premium_models(cls) -> List[str]:
        """
        Get list of premium tier model names.
        
        These are high-quality models suitable for:
        - Production QA tasks
        - Judging/evaluation tasks
        - Model comparison candidates
        
        Returns:
            List of premium model names
        """
        return cls.get_models_by_tier('premium')
    
    @classmethod
    def get_budget_models(cls) -> List[str]:
        """
        Get list of budget tier model names.
        
        These are fast/cheap models suitable for:
        - High-volume tasks
        - Question generation
        - Auxiliary tasks
        
        Returns:
            List of budget model names
        """
        return cls.get_models_by_tier('budget')
    
    @classmethod
    def get_model(cls, provider: str, tier: str) -> str:
        """
        Get model name by provider and tier.
        
        This is the preferred way to reference models as it abstracts away
        specific model versions. When new models launch, only PROVIDER_TIERS
        needs to be updated.
        
        Args:
            provider: Provider name ('openai', 'anthropic', 'google', 'xai')
            tier: Tier name ('flagship', 'budget')
        
        Returns:
            Model name (e.g., 'gpt-5-1')
        
        Raises:
            KeyError: If provider or tier not found
        
        Example:
            model = LLMConfigService.get_model('openai', 'flagship')  # 'gpt-5-1'
            model = LLMConfigService.get_model('google', 'budget')    # 'gemini-flash-2-5'
        """
        if provider not in cls.PROVIDER_TIERS:
            raise KeyError(f"Unknown provider: {provider}. Available: {list(cls.PROVIDER_TIERS.keys())}")
        if tier not in cls.PROVIDER_TIERS[provider]:
            raise KeyError(f"Unknown tier '{tier}' for provider '{provider}'. Available: {list(cls.PROVIDER_TIERS[provider].keys())}")
        return cls.PROVIDER_TIERS[provider][tier]
    
    @classmethod
    def resolve_model(cls, reference: str) -> str:
        """
        Resolve a model reference to actual model name.
        
        Accepts multiple formats:
        - 'openai/flagship' -> 'gpt-5-1' (provider/tier format)
        - 'google/budget' -> 'gemini-flash-2-5'
        - 'gpt-4o' -> 'gpt-4o' (direct model name, returned as-is)
        
        Args:
            reference: Model reference in provider/tier format or direct model name
        
        Returns:
            Resolved model name
        
        Example:
            model = LLMConfigService.resolve_model('openai/flagship')  # 'gpt-5-1'
            model = LLMConfigService.resolve_model('gpt-4o')           # 'gpt-4o'
        """
        if '/' in reference:
            parts = reference.split('/', 1)
            provider, tier = parts[0], parts[1]
            if provider in cls.PROVIDER_TIERS and tier in cls.PROVIDER_TIERS[provider]:
                return cls.PROVIDER_TIERS[provider][tier]
        # Return as-is if not a provider/tier format or not found
        return reference
    
    @classmethod
    def get_openrouter_model(cls, reference: str) -> str:
        """
        Get OpenRouter model path from any reference format.
        
        This is useful when you need the actual OpenRouter API model path
        (e.g., 'openai/gpt-5.1') from a provider/tier reference or model name.
        
        Args:
            reference: Model reference ('openai/flagship', 'gpt-5-1', etc.)
        
        Returns:
            OpenRouter model path (e.g., 'openai/gpt-5.1')
        
        Example:
            path = LLMConfigService.get_openrouter_model('openai/flagship')
            # Returns 'openai/gpt-5.1'
            
            path = LLMConfigService.get_openrouter_model('gpt-4o-mini')
            # Returns 'openai/gpt-4o-mini'
        """
        model_name = cls.resolve_model(reference)
        model_info = cls.AVAILABLE_MODELS.get(model_name, {})
        return model_info.get('openrouter_model', model_name)
    
    @classmethod
    def get_all_flagship_models(cls) -> List[str]:
        """
        Get list of all flagship model names across providers.
        
        Returns:
            List of flagship model names
        """
        return [
            cls.PROVIDER_TIERS[provider]['flagship']
            for provider in cls.PROVIDER_TIERS
        ]
    
    @classmethod
    def get_all_budget_models_by_provider(cls) -> List[str]:
        """
        Get list of all budget model names across providers.
        
        Returns:
            List of budget model names from PROVIDER_TIERS
        """
        return [
            cls.PROVIDER_TIERS[provider]['budget']
            for provider in cls.PROVIDER_TIERS
        ]
    
    @classmethod
    def get_provider_tier_for_model(cls, model_name: str) -> Optional[str]:
        """
        Get provider/tier reference for a model name (reverse of resolve_model).
        
        This is useful for converting legacy model names to the new provider/tier
        format during migrations or serializer validation.
        
        Args:
            model_name: Specific model name (e.g., 'gemini-flash-2-5')
        
        Returns:
            Provider/tier reference (e.g., 'google/budget') or None if not found
        
        Example:
            LLMConfigService.get_provider_tier_for_model('gemini-flash-2-5')
            # Returns 'google/budget'
            
            LLMConfigService.get_provider_tier_for_model('gpt-5-1')
            # Returns 'openai/flagship'
        """
        for provider, tiers in cls.PROVIDER_TIERS.items():
            for tier, name in tiers.items():
                if name == model_name:
                    return f"{provider}/{tier}"
        return None
    
    @classmethod
    def is_valid_model(cls, model_name: str) -> bool:
        """
        Check if a model name is valid.
        
        Accepts both direct model names and provider/tier format.
        
        Args:
            model_name: Model name or provider/tier reference to validate
        
        Returns:
            True if model is valid
        
        Example:
            LLMConfigService.is_valid_model('gpt-5-1')        # True
            LLMConfigService.is_valid_model('openai/flagship') # True
            LLMConfigService.is_valid_model('invalid-model')   # False
        """
        # Check direct model name
        if model_name in cls.AVAILABLE_MODELS:
            return True
        # Check provider/tier format
        if '/' in model_name:
            resolved = cls.resolve_model(model_name)
            return resolved in cls.AVAILABLE_MODELS
        return False
    
    @classmethod
    def get_model_info(cls, model_name: str) -> Optional[Dict[str, Any]]:
        """
        Get metadata for a specific model.
        
        Accepts multiple formats:
        - Direct model name: 'claude-opus-4.6'
        - Provider/tier reference: 'anthropic/flagship'
        - OpenRouter model path: 'anthropic/claude-opus-4.6'
        
        Args:
            model_name: Name of the model, provider/tier reference,
                        or OpenRouter model path
        
        Returns:
            Model metadata dict or None if not found
        """
        # Try resolving via provider/tier or direct name first
        resolved = cls.resolve_model(model_name)
        result = cls.AVAILABLE_MODELS.get(resolved)
        if result:
            return result
        
        # Fallback: check if model_name matches an openrouter_model path
        # e.g., 'anthropic/claude-opus-4.6' -> look up by openrouter_model value
        for info in cls.AVAILABLE_MODELS.values():
            if info.get('openrouter_model') == model_name:
                return info
        
        return None
    
    @classmethod
    def supports_vision(cls, model_name: str) -> bool:
        """
        Check if a model supports vision/multimodal inputs.
        
        Args:
            model_name: Name of the model to check
        
        Returns:
            True if model supports vision, False otherwise
        """
        model_info = cls.get_model_info(model_name)
        if not model_info:
            return False
        return model_info.get('supports_vision', False)
    
    @classmethod
    def supports_reasoning(cls, model_name: str) -> bool:
        """
        Check if a model supports configurable reasoning/thinking tokens.
        
        Note: Some models (e.g., Grok 4) have always-on reasoning that cannot
        be configured. This returns True for those models, but
        get_reasoning_config() will return an empty dict since there's
        nothing to configure.
        
        Args:
            model_name: Name of the model to check
        
        Returns:
            True if model supports reasoning, False otherwise
        """
        model_info = cls.get_model_info(model_name)
        if not model_info:
            return False
        return model_info.get('supports_reasoning', False)
    
    @classmethod
    def get_reasoning_config(
        cls,
        model_name: str,
        effort: str = "medium",
        max_tokens: Optional[int] = None,
    ) -> dict:
        """
        Build the correct reasoning config for a model.
        
        Different models support different reasoning styles via OpenRouter:
        - 'adaptive': Model auto-decides thinking depth (Claude Opus 4.6).
          Sends {"reasoning": {"enabled": True}}.
        - 'effort': Effort-based levels (GPT-5, Gemini 3, Grok 4.1 Fast,
          Claude Sonnet/Haiku 4.5). Sends {"reasoning": {"effort": level}}.
          OpenRouter converts to provider-specific format (e.g., budget_tokens
          for Anthropic, thinkingLevel for Gemini 3).
        - 'budget': Direct token budget (Gemini 2.5 series).
          Sends {"reasoning": {"max_tokens": N}}.
        - None with supports_reasoning=True: Always-on, not configurable
          (Grok 4). Returns empty dict.
        - None with supports_reasoning=False: No reasoning support.
          Returns empty dict.
        
        Args:
            model_name: Name of the model (or provider/tier reference)
            effort: Reasoning effort level (minimal, low, medium, high).
                    Used for effort-based models.
            max_tokens: Token budget for budget-based models. Defaults to 2000.
        
        Returns:
            Dict suitable for passing as extra_body to OpenRouter API
        
        Example:
            config = LLMConfigService.get_reasoning_config('claude-opus-4.6')
            # Returns {"reasoning": {"enabled": True}}
            
            config = LLMConfigService.get_reasoning_config('gpt-5-1', effort='high')
            # Returns {"reasoning": {"effort": "high"}}
            
            config = LLMConfigService.get_reasoning_config('gemini-2.5-pro', max_tokens=4000)
            # Returns {"reasoning": {"max_tokens": 4000}}
            
            config = LLMConfigService.get_reasoning_config('gpt-4o')
            # Returns {}
        """
        model_info = cls.get_model_info(model_name)
        if not model_info or not model_info.get('supports_reasoning'):
            return {}  # No reasoning for this model
        
        style = model_info.get('reasoning_style')
        if not style:
            return {}  # Always-on reasoning (e.g., Grok 4) -- nothing to configure
        
        if style == 'adaptive':
            return {"reasoning": {"enabled": True}}
        elif style == 'budget':
            budget = max_tokens or 2000
            return {"reasoning": {"max_tokens": budget}}
        else:  # effort
            valid_efforts = {"minimal", "low", "medium", "high"}
            if effort not in valid_efforts:
                effort = "medium"
            return {"reasoning": {"effort": effort}}
    
    @classmethod
    def get_vision_model(cls, preferred_model: Optional[str] = None) -> str:
        """
        Get a vision-capable model, with fallback logic.
        
        If preferred_model supports vision, returns it.
        Otherwise, returns the default vision model.
        
        Args:
            preferred_model: Optional preferred model name
        
        Returns:
            Model name that supports vision
        """
        # Check if preferred model supports vision
        if preferred_model and cls.supports_vision(preferred_model):
            logger.debug(f"Using preferred vision model: {preferred_model}")
            return preferred_model
        
        # Try default vision model from settings (supports provider/tier format)
        default_vision = getattr(settings, 'DEFAULT_VISION_MODEL', 'anthropic/flagship')
        default_vision = cls.resolve_model(default_vision)
        if cls.supports_vision(default_vision):
            if preferred_model:
                logger.info(f"Model '{preferred_model}' doesn't support vision, using {default_vision}")
            return default_vision
        
        # Fallback: find any vision-capable model
        for model_name, model_info in cls.AVAILABLE_MODELS.items():
            if model_info.get('supports_vision', False):
                logger.warning(f"Default vision model not available, using {model_name}")
                return model_name
        
        # Should never reach here if registry is properly configured
        raise ValueError("No vision-capable models found in registry")
    
    @classmethod
    def _get_site_config_sync(cls, site):
        """
        Extract site LLM config in a sync-safe way.
        
        This is a helper to avoid Django's SynchronousOnlyOperation error
        when accessing model fields from async contexts.
        
        Args:
            site: Site model instance
            
        Returns:
            Tuple of (llm_config dict, default_llm_model str)
        """
        try:
            llm_config = getattr(site, 'llm_config', None) or {}
            default_llm_model = getattr(site, 'default_llm_model', None) or ''
            return llm_config, default_llm_model
        except Exception as e:
            logger.warning(f"Error accessing site config: {e}")
            return {}, ''
    
    @classmethod
    def get_model_for_task(
        cls,
        site,
        task_type: str,
        agent_config=None
    ) -> str:
        """
        Get the appropriate model for a task, with fallback chain.
        
        Fallback chain:
        1. AgentConfig.llm_model (if agent_config provided and task is agent_qa)
        2. Site.llm_config[task_type] (task-specific override)
        3. Site.default_llm_model (site-wide default)
        4. System default from settings
        
        Args:
            site: Site model instance
            task_type: Type of task (agent_qa, content_optimization, etc.)
            agent_config: Optional AgentConfig instance (for agent_qa tasks)
        
        Returns:
            Model name to use
        """
        # Special case: question suggestions always use cheap/fast model
        if task_type == cls.TASK_QUESTION_SUGGESTIONS:
            budget_model = cls.get_model('openai', 'budget')
            logger.debug(f"Using budget model for question suggestions: {budget_model}")
            return budget_model
        
        # 1. Check AgentConfig for agent_qa tasks
        if task_type == cls.TASK_AGENT_QA and agent_config:
            agent_llm_model = getattr(agent_config, 'llm_model', None)
            if agent_llm_model:
                model = agent_llm_model.strip()
                if cls.is_valid_model(model):
                    logger.debug(f"Using AgentConfig model: {model}")
                    return model
                else:
                    logger.warning(f"Invalid model in AgentConfig: {model}, falling back")
        
        # 2 & 3: Check site config (extracted safely to avoid async context issues)
        llm_config, default_llm_model = cls._get_site_config_sync(site)
        
        # 2. Check site task-specific override
        if llm_config:
            task_model = llm_config.get(task_type)
            if task_model:
                model = task_model.strip()
                if cls.is_valid_model(model):
                    logger.debug(f"Using site task override: {model} for {task_type}")
                    return model
                else:
                    logger.warning(f"Invalid task model in site config: {model}, falling back")
        
        # 3. Check site default
        if default_llm_model:
            model = default_llm_model.strip()
            if cls.is_valid_model(model):
                logger.debug(f"Using site default model: {model}")
                return model
            else:
                logger.warning(f"Invalid default model in site: {model}, falling back")
        
        # 4. Fall back to system default (supports provider/tier format)
        system_default = getattr(settings, 'DEFAULT_LLM_MODEL', 'anthropic/flagship')
        system_default = cls.resolve_model(system_default)
        logger.debug(f"Using system default model: {system_default}")
        return system_default
    
    @classmethod
    def create_llm_client_for_task(
        cls,
        site,
        task_type: str,
        agent_config=None,
        temperature: float = 1.0,
        max_tokens: int = 2000,
    ):
        """
        Create an LLMClient instance for a specific task with model fallback logic.
        
        This is the primary method for creating LLM clients. Uses direct
        OpenRouter API calls via LLMClient.
        
        Args:
            site: Site model instance
            task_type: Type of task (agent_qa, content_optimization, etc.)
            agent_config: Optional AgentConfig instance (for agent_qa tasks)
            temperature: Sampling temperature (may be overridden by model requirements)
            max_tokens: Maximum tokens (may be overridden by model requirements)
        
        Returns:
            Tuple of (LLMClient instance, model_name)
        
        Example:
            client, model_name = LLMConfigService.create_llm_client_for_task(
                site=site,
                task_type='agent_qa',
                agent_config=agent_config
            )
            response = client.complete(prompt="...", system_prompt="...")
        """
        from common.utils.llm_client import LLMClient
        
        # Use existing model selection logic
        model_ref = cls.get_model_for_task(
            site=site,
            task_type=task_type,
            agent_config=agent_config
        )
        
        # Resolve provider/tier format (e.g., 'google/budget' -> 'gemini-flash-2-5')
        model_name = cls.resolve_model(model_ref)
        
        # Get model info for OpenRouter path
        model_info = cls.AVAILABLE_MODELS.get(model_name)
        if not model_info:
            raise ValueError(
                f"Invalid model: {model_name}. "
                f"Available models: {list(cls.AVAILABLE_MODELS.keys())}"
            )
        
        # Get the OpenRouter model path
        openrouter_model = model_info.get('openrouter_model', model_name)
        
        # Enforce model-specific requirements
        if 'min_temperature' in model_info:
            min_temp = model_info['min_temperature']
            if temperature < min_temp:
                logger.info(
                    f"Model {model_name} requires temperature >= {min_temp}, "
                    f"adjusting from {temperature} to {min_temp}"
                )
                temperature = min_temp
        
        if 'min_max_tokens' in model_info:
            min_tokens = model_info['min_max_tokens']
            if max_tokens < min_tokens:
                logger.info(
                    f"Model {model_name} requires max_tokens >= {min_tokens}, "
                    f"adjusting from {max_tokens} to {min_tokens}"
                )
                max_tokens = min_tokens
        
        # Create LLMClient with OpenRouter model
        client = LLMClient(model=openrouter_model)
        
        logger.info(f"Created LLMClient for task '{task_type}' with model: {openrouter_model}")
        
        return client, model_name, temperature, max_tokens
    


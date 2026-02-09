"""
Centralized Prompt Template Service.

This service provides a unified way to manage and render prompt templates
across all apps. Templates are versioned and can be loaded from:
1. Python constants (default)
2. Database (future: for A/B testing)
3. External files (future: for open-source distribution)

Usage:
    from common.services.prompt_template_service import PromptTemplateService
    
    # Register a template (typically in app's prompts/templates.py)
    PromptTemplateService.register(
        name="my_app.analyze_content",
        template="Analyze this content: {content}\\n\\nReturn JSON...",
        version="1.0",
        description="Analyzes content and returns structured data"
    )
    
    # Render a template
    prompt = PromptTemplateService.get(
        "my_app.analyze_content",
        content="Some content to analyze"
    )
"""
import logging
from dataclasses import dataclass, field
from typing import Dict, Optional, Any

logger = logging.getLogger(__name__)


@dataclass
class PromptTemplate:
    """
    A versioned prompt template.
    
    Attributes:
        name: Unique identifier for the template (e.g., "product_capture.page_analysis")
        template: The template string with {placeholder} variables
        version: Version string for tracking changes
        description: Human-readable description of what the prompt does
        metadata: Additional metadata (e.g., expected response format, model hints)
    """
    name: str
    template: str
    version: str = "1.0"
    description: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def render(self, **kwargs) -> str:
        """
        Render the template with the provided variables.
        
        Args:
            **kwargs: Variables to substitute in the template
            
        Returns:
            Rendered prompt string
            
        Raises:
            KeyError: If a required variable is missing
        """
        try:
            return self.template.format(**kwargs)
        except KeyError as e:
            logger.error(
                f"Missing variable in prompt template '{self.name}': {e}. "
                f"Available variables: {list(kwargs.keys())}"
            )
            raise


class PromptTemplateService:
    """
    Centralized service for managing prompt templates.
    
    Templates are registered by apps and can be retrieved by name.
    This allows for:
    - Centralized prompt management
    - Version tracking
    - Easy A/B testing (future)
    - Open-source distribution with customizable prompts
    """
    
    _templates: Dict[str, PromptTemplate] = {}
    
    @classmethod
    def register(
        cls,
        name: str,
        template: str,
        version: str = "1.0",
        description: str = "",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> PromptTemplate:
        """
        Register a prompt template.
        
        Args:
            name: Unique identifier (e.g., "product_capture.page_analysis")
            template: The template string with {placeholder} variables
            version: Version string for tracking changes
            description: Human-readable description
            metadata: Additional metadata
            
        Returns:
            The registered PromptTemplate
            
        Note:
            If a template with the same name exists, it will be overwritten.
            This allows for easy overriding in tests or custom deployments.
        """
        prompt_template = PromptTemplate(
            name=name,
            template=template,
            version=version,
            description=description,
            metadata=metadata or {},
        )
        
        if name in cls._templates:
            existing = cls._templates[name]
            logger.debug(
                f"Overwriting prompt template '{name}' "
                f"(v{existing.version} -> v{version})"
            )
        
        cls._templates[name] = prompt_template
        logger.debug(f"Registered prompt template: {name} (v{version})")
        
        return prompt_template
    
    @classmethod
    def get(cls, name: str, **kwargs) -> str:
        """
        Get and render a prompt template.
        
        Args:
            name: Template identifier
            **kwargs: Variables to substitute in the template
            
        Returns:
            Rendered prompt string
            
        Raises:
            ValueError: If the template is not found
            KeyError: If a required variable is missing
        """
        template = cls._templates.get(name)
        
        if template is None:
            available = list(cls._templates.keys())
            raise ValueError(
                f"Unknown prompt template: '{name}'. "
                f"Available templates: {available}"
            )
        
        return template.render(**kwargs)
    
    @classmethod
    def get_template(cls, name: str) -> Optional[PromptTemplate]:
        """
        Get a prompt template object (without rendering).
        
        Args:
            name: Template identifier
            
        Returns:
            PromptTemplate or None if not found
        """
        return cls._templates.get(name)
    
    @classmethod
    def list_templates(cls, prefix: Optional[str] = None) -> Dict[str, PromptTemplate]:
        """
        List all registered templates.
        
        Args:
            prefix: Optional prefix to filter templates (e.g., "product_capture.")
            
        Returns:
            Dict of template name to PromptTemplate
        """
        if prefix:
            return {
                name: template
                for name, template in cls._templates.items()
                if name.startswith(prefix)
            }
        return dict(cls._templates)
    
    @classmethod
    def clear(cls):
        """
        Clear all registered templates.
        
        Primarily used for testing.
        """
        cls._templates.clear()
        logger.debug("Cleared all prompt templates")
    
    @classmethod
    def unregister(cls, name: str) -> bool:
        """
        Unregister a template by name.
        
        Args:
            name: Template identifier
            
        Returns:
            True if template was removed, False if not found
        """
        if name in cls._templates:
            del cls._templates[name]
            logger.debug(f"Unregistered prompt template: {name}")
            return True
        return False


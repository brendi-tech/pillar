"""
DeepEval LLM configuration for agent evaluation.

Wraps our existing LLMClient (OpenRouter) in DeepEval's DeepEvalBaseLLM
interface so all LLM-as-judge calls route through our existing infrastructure.
No separate OpenAI API key needed.
"""
import asyncio
import logging
from typing import Any

from deepeval.models import DeepEvalBaseLLM

logger = logging.getLogger(__name__)


class OpenRouterEvalLLM(DeepEvalBaseLLM):
    """Wraps our LLMClient for DeepEval's LLM-as-judge metrics."""

    def __init__(self):
        from common.utils.llm_config import LLMConfigService

        model = LLMConfigService.get_model('openai', 'budget')
        model_info = LLMConfigService.get_model_info(model)
        self._openrouter_model = (
            model_info.get('openrouter_model', model) if model_info else model
        )
        # Call parent init with model name (sets self.name)
        super().__init__(model=self._openrouter_model)

    def load_model(self) -> Any:
        """Lazy-load the LLMClient."""
        from common.utils.llm_client import LLMClient

        return LLMClient(model=self._openrouter_model)

    def get_model_name(self) -> str:
        return self._openrouter_model

    def generate(self, prompt: str, **kwargs) -> str:
        """Sync generation for DeepEval."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            # Already in an async context -- create a new thread to avoid
            # "cannot call asyncio.run() in a running loop" errors.
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(
                    asyncio.run, self.a_generate(prompt, **kwargs)
                ).result()
        else:
            return asyncio.run(self.a_generate(prompt, **kwargs))

    async def a_generate(self, prompt: str, **kwargs) -> str:
        """Async generation -- the primary path."""
        return await self.model.complete_async(
            prompt=prompt,
            temperature=0.0,
            max_tokens=1000,
        )


def get_eval_llm() -> OpenRouterEvalLLM:
    """Get or create the singleton eval LLM instance."""
    if not hasattr(get_eval_llm, '_instance'):
        get_eval_llm._instance = OpenRouterEvalLLM()
    return get_eval_llm._instance

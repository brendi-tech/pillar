"""
LLM API client wrapper using OpenRouter.

Copyright (C) 2025 Pillar Team

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""
import logging
import json
from typing import Optional, Dict, Any, List, AsyncGenerator, Generator
from django.conf import settings
from openai import OpenAI, AsyncOpenAI
from common.exceptions import LLMAPIError

logger = logging.getLogger(__name__)


class LLMClient:
    """
    Unified interface for LLM API calls via OpenRouter.
    
    OpenRouter provides a single API gateway for all major LLM providers,
    simplifying API management and ensuring consistent behavior.
    """

    def __init__(
        self,
        model: Optional[str] = None,
        api_key: Optional[str] = None
    ):
        """
        Initialize OpenRouter client.
        
        Args:
            model: OpenRouter model identifier (e.g., 'openai/gpt-4o', 'anthropic/claude-3.5-sonnet')
            api_key: OpenRouter API key (defaults to settings.OPENROUTER_API_KEY)
        """
        self.model = model
        self.api_key = api_key or settings.OPENROUTER_API_KEY
        
        # Initialize OpenAI client with OpenRouter base URL (sync)
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self.api_key
        )
        
        # Initialize async client for streaming
        self.async_client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self.api_key
        )

    def get_current_model(self) -> str:
        """Return the current model name for logging.
        
        Returns:
            The model identifier configured for this client, or 'unknown' if not set.
        """
        return self.model or 'unknown'

    @staticmethod
    def _build_reasoning_config(
        effort: str = "medium",
        model: Optional[str] = None,
    ) -> dict:
        """
        Build reasoning configuration for OpenRouter.
        
        When a model is provided, delegates to LLMConfigService to build the
        correct config based on the model's reasoning style (adaptive, effort,
        budget, or none). When no model is provided, falls back to effort-based
        reasoning for backward compatibility.
        
        See: https://openrouter.ai/docs/use-cases/reasoning-tokens
        
        Args:
            effort: Reasoning effort level (minimal, low, medium, high).
                    Used for effort-based models; ignored for adaptive models.
            model: Optional OpenRouter model identifier (e.g., 'anthropic/claude-opus-4.6').
                   When provided, uses model-aware reasoning config.
            
        Returns:
            Dict suitable for passing as extra_body to OpenRouter API
        """
        if model:
            from common.utils.llm_config import LLMConfigService
            # Resolve OpenRouter model path to our internal model name
            # e.g., 'anthropic/claude-opus-4.6' -> check registry
            return LLMConfigService.get_reasoning_config(
                model_name=model,
                effort=effort,
            )
        
        # Fallback: legacy behavior for when model is unknown
        valid_efforts = {"minimal", "low", "medium", "high"}
        if effort not in valid_efforts:
            effort = "medium"
        
        return {
            "reasoning": {
                "effort": effort,
            }
        }

    def complete(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2000,
        temperature: float = 0.7,
        model: Optional[str] = None,
        return_usage: bool = False,
        **kwargs
    ) -> str:
        """
        Generate a completion from the LLM via OpenRouter.

        Args:
            prompt: The user prompt
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0-1)
            model: OpenRouter model identifier (overrides instance model if provided)
            return_usage: If True, return dict with 'content' and 'usage' keys
            **kwargs: Additional arguments for the API

        Returns:
            The generated text response (or dict if return_usage=True)

        Raises:
            LLMAPIError: If the API call fails
        """
        try:
            return self._openrouter_complete(
                prompt, system_prompt, max_tokens, temperature, model, return_usage, **kwargs
            )
        except Exception as e:
            logger.error(f"LLM API error: {e}", exc_info=True)
            raise LLMAPIError(f"Failed to generate completion: {str(e)}")

    def _openrouter_complete(
        self,
        prompt: str,
        system_prompt: Optional[str],
        max_tokens: int,
        temperature: float,
        model: Optional[str],
        return_usage: bool = False,
        **kwargs
    ) -> str:
        """OpenRouter completion using OpenAI SDK."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        # Use provided model or fall back to instance model
        model_to_use = model or self.model
        if not model_to_use:
            raise ValueError("No model specified. Provide model in __init__ or complete()")

        response = self.client.chat.completions.create(
            model=model_to_use,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            **kwargs
        )

        # Check finish_reason to detect truncation
        finish_reason = response.choices[0].finish_reason
        content = response.choices[0].message.content
        
        # Raise error if response was truncated - this allows task retry
        if finish_reason == 'length':
            error_msg = (
                f"LLM response truncated due to max_tokens limit ({max_tokens}). "
                f"Model: {model_to_use}, Content length: {len(content) if content else 0} chars. "
                f"Response preview: {content[:200] if content else 'None'}..."
            )
            logger.error(error_msg)
            raise LLMAPIError(error_msg)
        elif finish_reason == 'content_filter':
            error_msg = f"LLM response filtered by content policy. Model: {model_to_use}"
            logger.error(error_msg)
            raise LLMAPIError(error_msg)
        elif finish_reason not in ['stop', 'end_turn']:
            # Some models use 'end_turn' instead of 'stop'
            logger.warning(
                f"Unexpected finish_reason: {finish_reason}. Model: {model_to_use}. "
                f"Proceeding with caution."
            )
        
        # Return usage info if requested
        if return_usage:
            usage = {
                'prompt_tokens': response.usage.prompt_tokens if response.usage else 0,
                'completion_tokens': response.usage.completion_tokens if response.usage else 0,
                'total_tokens': response.usage.total_tokens if response.usage else 0,
            }
            return {
                'content': content,
                'usage': usage,
                'finish_reason': finish_reason
            }
        
        return content

    def stream_complete(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2000,
        temperature: float = 0.7,
        model: Optional[str] = None,
        **kwargs
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Generate a streaming completion from the LLM via OpenRouter.
        
        Yields tokens as they arrive from the model. Based on OpenRouter streaming docs:
        https://openrouter.ai/docs/api-reference/streaming
        
        Args:
            prompt: The user prompt
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0-1)
            model: OpenRouter model identifier (overrides instance model if provided)
            **kwargs: Additional arguments for the API
        
        Yields:
            Dict chunks with:
                - {'type': 'token', 'content': '...'} - content tokens
                - {'type': 'error', 'error': {...}} - mid-stream errors
                - {'type': 'done', 'usage': {...}, 'finish_reason': '...'} - completion info
        
        Raises:
            LLMAPIError: If the API call fails before streaming starts
        """
        try:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            
            # Use provided model or fall back to instance model
            model_to_use = model or self.model
            if not model_to_use:
                raise ValueError("No model specified. Provide model in __init__ or stream_complete()")
            
            # Build reasoning config (model-aware)
            reasoning_config = self._build_reasoning_config(model=model_to_use)
            
            # Create streaming request
            stream = self.client.chat.completions.create(
                model=model_to_use,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                stream=True,
                extra_body=reasoning_config,
                **kwargs
            )
            
            # Track usage and finish reason
            usage_data = None
            finish_reason = None
            
            # Process stream chunks
            for chunk in stream:
                # Check for errors in chunk (mid-stream errors)
                if hasattr(chunk, 'error') and chunk.error:
                    logger.error(f"Mid-stream error from OpenRouter: {chunk.error}")
                    yield {
                        'type': 'error',
                        'error': chunk.error
                    }
                    break
                
                # Extract content delta
                if chunk.choices and len(chunk.choices) > 0:
                    choice = chunk.choices[0]
                    
                    # Get content from delta
                    if hasattr(choice, 'delta') and choice.delta:
                        # Extract reasoning/thinking content from OpenRouter's reasoning_details array
                        # See: https://openrouter.ai/docs/use-cases/reasoning-tokens
                        # NOTE: Only use 'text' and 'summary' fields. The 'data' field contains
                        # encrypted binary content (reasoning.encrypted type) meant for passing
                        # back to the model, NOT for display.
                        reasoning_details = getattr(choice.delta, 'reasoning_details', None)
                        yielded_reasoning = False
                        if reasoning_details:
                            for detail in reasoning_details:
                                if isinstance(detail, dict):
                                    reasoning_text = detail.get('text') or detail.get('summary')
                                else:
                                    reasoning_text = getattr(detail, 'text', None) or getattr(detail, 'summary', None)
                                if reasoning_text:
                                    yield {
                                        'type': 'thinking',
                                        'content': reasoning_text
                                    }
                                    yielded_reasoning = True
                        
                        # Legacy fallback: only if reasoning_details didn't yield (avoid duplicates)
                        if not yielded_reasoning:
                            reasoning = getattr(choice.delta, 'reasoning', None) or getattr(choice.delta, 'reasoning_content', None)
                            if reasoning:
                                yield {
                                    'type': 'thinking',
                                    'content': reasoning
                                }

                        delta_content = getattr(choice.delta, 'content', None)
                        if delta_content:
                            yield {
                                'type': 'token',
                                'content': delta_content
                            }
                    
                    # Check finish reason
                    if hasattr(choice, 'finish_reason') and choice.finish_reason:
                        finish_reason = choice.finish_reason
                
                # Extract usage information (usually in last chunk)
                if hasattr(chunk, 'usage') and chunk.usage:
                    usage_data = {
                        'prompt_tokens': getattr(chunk.usage, 'prompt_tokens', 0),
                        'completion_tokens': getattr(chunk.usage, 'completion_tokens', 0),
                        'total_tokens': getattr(chunk.usage, 'total_tokens', 0),
                    }
            
            # Yield completion info
            yield {
                'type': 'done',
                'usage': usage_data or {'prompt_tokens': 0, 'completion_tokens': 0, 'total_tokens': 0},
                'finish_reason': finish_reason or 'stop'
            }
            
        except Exception as e:
            logger.error(f"LLM streaming error: {e}", exc_info=True)
            # Pre-stream errors - raise as exception
            raise LLMAPIError(f"Failed to start streaming completion: {str(e)}")

    async def complete_async(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 500,
        temperature: float = 0.7,
        model: Optional[str] = None,
        images: Optional[List[Dict[str, str]]] = None,
        return_usage: bool = False,
        **kwargs
    ):
        """
        Generate a non-streaming async completion from the LLM via OpenRouter.
        
        Simpler than streaming - just waits for complete response.
        Useful for decision-making, classification, or short responses.
        
        Args:
            prompt: The user prompt
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens to generate (default: 500 for quick decisions)
            temperature: Sampling temperature (0-1)
            model: OpenRouter model identifier (overrides instance model)
            images: Optional list of image dicts with 'url' and optional 'detail' keys
            return_usage: If True, return dict with 'content' and 'usage' keys
            **kwargs: Additional arguments for the API
        
        Returns:
            Complete response text as string, or dict with 'content' and 'usage' if return_usage=True
        
        Raises:
            LLMAPIError: If the API call fails
        """
        try:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            
            # Build user message content - multimodal if images provided
            if images:
                content = [{"type": "text", "text": prompt}]
                for img in images:
                    content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": img['url'],
                            "detail": img.get('detail', 'low')
                        }
                    })
                logger.debug(f"[LLM] Complete async with {len(images)} image(s)")
                messages.append({"role": "user", "content": content})
            else:
                messages.append({"role": "user", "content": prompt})
            
            # Use provided model or fall back to instance model
            model_to_use = model or self.model
            if not model_to_use:
                raise ValueError("No model specified")
            
            logger.debug(f"[LLM] Complete async: {len(prompt)} chars, max_tokens: {max_tokens}")
            
            # Non-streaming completion
            response = await self.async_client.chat.completions.create(
                model=model_to_use,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                stream=False,
                **kwargs
            )
            
            # Extract response text
            if response.choices and len(response.choices) > 0:
                content = response.choices[0].message.content or ""
                logger.debug(f"[LLM] Complete async returned {len(content)} chars")
                
                if return_usage:
                    # Return dict with content and usage info
                    usage = None
                    if response.usage:
                        usage = {
                            'prompt_tokens': response.usage.prompt_tokens or 0,
                            'completion_tokens': response.usage.completion_tokens or 0,
                            'total_tokens': response.usage.total_tokens or 0,
                        }
                    return {
                        'content': content,
                        'usage': usage,
                    }
                
                return content
            else:
                logger.warning("[LLM] Complete async returned no choices")
                if return_usage:
                    return {'content': '', 'usage': None}
                return ""
            
        except Exception as e:
            logger.error(f"[LLM] Complete async error: {e}", exc_info=True)
            raise LLMAPIError(f"Failed to complete async: {str(e)}")
    
    async def stream_complete_async(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2000,
        temperature: float = 0.7,
        model: Optional[str] = None,
        cancel_event=None,
        **kwargs
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Generate an async streaming completion from the LLM via OpenRouter.
        
        This is a proper async implementation using AsyncOpenAI for true non-blocking streaming.
        
        Args:
            prompt: The user prompt
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0-1)
            model: OpenRouter model identifier (overrides instance model if provided)
            cancel_event: Optional asyncio.Event to signal cancellation
            **kwargs: Additional arguments for the API
        
        Yields:
            Dict chunks with:
                - {'type': 'token', 'content': '...'} - content tokens
                - {'type': 'error', 'error': {...}} - mid-stream errors
                - {'type': 'done', 'usage': {...}, 'finish_reason': '...'} - completion info
        
        Raises:
            LLMAPIError: If the API call fails before streaming starts
        """
        try:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            
            # Use provided model or fall back to instance model
            model_to_use = model or self.model
            if not model_to_use:
                raise ValueError("No model specified. Provide model in __init__ or stream_complete_async()")
            
            # Create async streaming request - this is truly non-blocking
            import time
            api_call_start = time.time()
            
            # Log prompt size for performance analysis
            total_chars = sum(len(msg["content"]) for msg in messages)
            prompt_chars = len(prompt)
            system_chars = len(system_prompt) if system_prompt else 0
            logger.info(f"[LLM_TIMING] Calling OpenRouter API (model: {model_to_use}, prompt: {prompt_chars:,} chars, system: {system_chars:,} chars, total: {total_chars:,} chars)")
            
            # Build reasoning config (model-aware)
            reasoning_config = self._build_reasoning_config(model=model_to_use)
            
            stream = await self.async_client.chat.completions.create(
                model=model_to_use,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                stream=True,
                extra_body=reasoning_config,
                **kwargs
            )
            
            api_call_complete = time.time()
            logger.info(f"[LLM_TIMING] API call returned stream object (+{(api_call_complete - api_call_start)*1000:.1f}ms)")
            
            # Track usage and finish reason
            usage_data = None
            finish_reason = None
            first_chunk_received = False
            first_content_received = False
            first_content_time = None
            last_chunk_time = api_call_complete
            
            # Process stream chunks asynchronously - tokens arrive as they're generated
            chunk_count = 0
            async for chunk in stream:
                # Check for cancellation at start of each chunk
                if cancel_event and cancel_event.is_set():
                    logger.info("[LLM] Cancellation detected, closing stream to stop billing")
                    try:
                        await stream.close()
                    except Exception as close_err:
                        logger.debug(f"[LLM] Stream close error (expected): {close_err}")
                    break
                chunk_count += 1
                current_chunk_time = time.time()
                chunk_interval = (current_chunk_time - last_chunk_time) * 1000
                
                if not first_chunk_received:
                    first_chunk_time = time.time()
                    logger.info(f"[LLM_TIMING] First chunk arrived from OpenRouter (+{(first_chunk_time - api_call_start)*1000:.1f}ms since API call)")
                    first_chunk_received = True
                
                last_chunk_time = current_chunk_time
                
                # Check for errors in chunk (mid-stream errors)
                if hasattr(chunk, 'error') and chunk.error:
                    logger.error(f"Mid-stream error from OpenRouter: {chunk.error}")
                    yield {
                        'type': 'error',
                        'error': chunk.error
                    }
                    break
                
                # Extract content delta
                has_choices = chunk.choices and len(chunk.choices) > 0
                if has_choices:
                    choice = chunk.choices[0]
                    
                    # Get content from delta
                    if hasattr(choice, 'delta') and choice.delta:
                        # Extract reasoning/thinking content from OpenRouter's reasoning_details array
                        # See: https://openrouter.ai/docs/use-cases/reasoning-tokens
                        # NOTE: Only use 'text' and 'summary' fields. The 'data' field contains
                        # encrypted binary content (reasoning.encrypted type) meant for passing
                        # back to the model, NOT for display.
                        reasoning_details = getattr(choice.delta, 'reasoning_details', None)
                        yielded_reasoning = False
                        if reasoning_details:
                            for detail in reasoning_details:
                                if isinstance(detail, dict):
                                    reasoning_text = detail.get('text') or detail.get('summary')
                                else:
                                    reasoning_text = getattr(detail, 'text', None) or getattr(detail, 'summary', None)
                                if reasoning_text:
                                    logger.debug(f"[LLM] Reasoning token: {reasoning_text[:100]}...")
                                    yield {
                                        'type': 'thinking',
                                        'content': reasoning_text
                                    }
                                    yielded_reasoning = True
                        
                        # Legacy fallback: only if reasoning_details didn't yield (avoid duplicates)
                        if not yielded_reasoning:
                            reasoning = getattr(choice.delta, 'reasoning', None) or getattr(choice.delta, 'reasoning_content', None)
                            if reasoning:
                                yield {
                                    'type': 'thinking',
                                    'content': reasoning
                                }

                        delta_content = getattr(choice.delta, 'content', None)
                        if delta_content:
                            # Track first actual content
                            if not first_content_received:
                                first_content_time = time.time()
                                time_since_call = (first_content_time - api_call_start) * 1000
                                time_since_first_chunk = (first_content_time - first_chunk_time) * 1000
                                logger.info(f"[LLM_TIMING] First CONTENT chunk #{chunk_count} (+{time_since_call:.1f}ms since API call, +{time_since_first_chunk:.1f}ms since first chunk, interval: {chunk_interval:.1f}ms)")
                                first_content_received = True
                            elif chunk_count <= 5:
                                logger.info(f"[LLM_TIMING] Content chunk #{chunk_count} (interval: {chunk_interval:.1f}ms): '{delta_content[:30]}...'")
                            yield {
                                'type': 'token',
                                'content': delta_content
                            }
                        elif chunk_count <= 5:
                            logger.info(f"[LLM_TIMING] Chunk #{chunk_count}: no content in delta (interval: {chunk_interval:.1f}ms)")
                    elif chunk_count <= 5:
                        logger.info(f"[LLM_TIMING] Chunk #{chunk_count}: no delta (interval: {chunk_interval:.1f}ms)")
                    
                    # Check finish reason
                    if hasattr(choice, 'finish_reason') and choice.finish_reason:
                        finish_reason = choice.finish_reason
                elif chunk_count <= 5:
                    logger.info(f"[LLM_TIMING] Chunk #{chunk_count}: no choices (interval: {chunk_interval:.1f}ms)")
                
                # Extract usage information (usually in last chunk)
                if hasattr(chunk, 'usage') and chunk.usage:
                    usage_data = {
                        'prompt_tokens': getattr(chunk.usage, 'prompt_tokens', 0),
                        'completion_tokens': getattr(chunk.usage, 'completion_tokens', 0),
                        'total_tokens': getattr(chunk.usage, 'total_tokens', 0),
                    }
            
            # Yield completion info
            yield {
                'type': 'done',
                'usage': usage_data or {'prompt_tokens': 0, 'completion_tokens': 0, 'total_tokens': 0},
                'finish_reason': finish_reason or 'stop'
            }
            
        except Exception as e:
            logger.error(f"LLM async streaming error: {e}", exc_info=True)
            # Pre-stream errors - raise as exception
            raise LLMAPIError(f"Failed to start async streaming completion: {str(e)}")
    
    async def stream_complete_messages_async(
        self,
        messages: List[Dict[str, Any]],
        reasoning_effort: str = "medium",
        temperature: float = 0.2,
        model: Optional[str] = None,
        cancel_event=None,
        **kwargs
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Generate an async streaming completion from a messages array.
        
        This method is designed for multi-turn conversations where the full
        conversation history is maintained across iterations. Unlike stream_complete_async
        which builds messages from prompt/system_prompt, this accepts the messages directly.
        
        Args:
            messages: List of message dicts with 'role' and 'content' keys.
                      Supports 'system', 'user', and 'assistant' roles.
            reasoning_effort: How hard the model should think (minimal, low, medium, high)
            temperature: Sampling temperature (0-1)
            model: OpenRouter model identifier (overrides instance model if provided)
            cancel_event: Optional asyncio.Event to signal cancellation
            **kwargs: Additional arguments for the API
        
        Yields:
            Dict chunks with:
                - {'type': 'thinking', 'content': '...'} - reasoning tokens
                - {'type': 'token', 'content': '...'} - content tokens
                - {'type': 'error', 'error': {...}} - mid-stream errors
                - {'type': 'done', 'usage': {...}, 'finish_reason': '...'} - completion info
        
        Raises:
            LLMAPIError: If the API call fails before streaming starts
        """
        import time
        
        try:
            # Use provided model or fall back to instance model
            model_to_use = model or self.model
            if not model_to_use:
                raise ValueError("No model specified. Provide model in __init__ or stream_complete_messages_async()")
            
            # Create async streaming request
            api_call_start = time.time()
            
            # Log prompt size for performance analysis
            total_chars = sum(len(msg.get("content", "")) if isinstance(msg.get("content"), str) else 0 for msg in messages)
            logger.info(f"[LLM_TIMING] Calling OpenRouter API (model: {model_to_use}, messages: {len(messages)}, total: {total_chars:,} chars, effort: {reasoning_effort})")
            
            # Build reasoning config (model-aware, with specified effort level)
            reasoning_config = self._build_reasoning_config(
                effort=reasoning_effort, model=model_to_use
            )
            
            stream = await self.async_client.chat.completions.create(
                model=model_to_use,
                messages=messages,
                temperature=temperature,
                stream=True,
                extra_body=reasoning_config,
                **kwargs
            )
            
            api_call_complete = time.time()
            logger.info(f"[LLM_TIMING] API call returned stream object (+{(api_call_complete - api_call_start)*1000:.1f}ms)")
            
            # Track usage and finish reason
            usage_data = None
            finish_reason = None
            first_chunk_received = False
            first_content_received = False
            first_chunk_time = None
            first_content_time = None
            last_chunk_time = api_call_complete
            
            # Process stream chunks asynchronously
            chunk_count = 0
            async for chunk in stream:
                # Check for cancellation at start of each chunk
                if cancel_event and cancel_event.is_set():
                    logger.info("[LLM] Cancellation detected, closing stream")
                    try:
                        await stream.close()
                    except Exception as close_err:
                        logger.debug(f"[LLM] Stream close error (expected): {close_err}")
                    break
                
                chunk_count += 1
                current_chunk_time = time.time()
                chunk_interval = (current_chunk_time - last_chunk_time) * 1000
                
                if not first_chunk_received:
                    first_chunk_time = time.time()
                    logger.info(f"[LLM_TIMING] First chunk arrived (+{(first_chunk_time - api_call_start)*1000:.1f}ms since API call)")
                    first_chunk_received = True
                
                last_chunk_time = current_chunk_time
                
                # Check for errors in chunk
                if hasattr(chunk, 'error') and chunk.error:
                    logger.error(f"Mid-stream error from OpenRouter: {chunk.error}")
                    yield {'type': 'error', 'error': chunk.error}
                    break
                
                # Extract content delta
                has_choices = chunk.choices and len(chunk.choices) > 0
                if has_choices:
                    choice = chunk.choices[0]
                    
                    if hasattr(choice, 'delta') and choice.delta:
                        # Extract reasoning/thinking content
                        # NOTE: Only use 'text' and 'summary' fields. The 'data' field contains
                        # encrypted binary content (reasoning.encrypted type) meant for passing
                        # back to the model, NOT for display.
                        reasoning_details = getattr(choice.delta, 'reasoning_details', None)
                        yielded_reasoning = False
                        if reasoning_details:
                            for detail in reasoning_details:
                                if isinstance(detail, dict):
                                    reasoning_text = detail.get('text') or detail.get('summary')
                                else:
                                    reasoning_text = getattr(detail, 'text', None) or getattr(detail, 'summary', None)
                                if reasoning_text:
                                    yield {'type': 'thinking', 'content': reasoning_text}
                                    yielded_reasoning = True
                        
                        # Legacy fallback for reasoning
                        if not yielded_reasoning:
                            reasoning = getattr(choice.delta, 'reasoning', None) or getattr(choice.delta, 'reasoning_content', None)
                            if reasoning:
                                yield {'type': 'thinking', 'content': reasoning}
                        
                        # Extract content tokens
                        delta_content = getattr(choice.delta, 'content', None)
                        if delta_content:
                            if not first_content_received:
                                first_content_time = time.time()
                                time_since_call = (first_content_time - api_call_start) * 1000
                                logger.info(f"[LLM_TIMING] First CONTENT chunk #{chunk_count} (+{time_since_call:.1f}ms since API call)")
                                first_content_received = True
                            yield {'type': 'token', 'content': delta_content}
                    
                    # Check finish reason
                    if hasattr(choice, 'finish_reason') and choice.finish_reason:
                        finish_reason = choice.finish_reason
                
                # Extract usage information (usually in last chunk)
                if hasattr(chunk, 'usage') and chunk.usage:
                    usage_data = {
                        'prompt_tokens': getattr(chunk.usage, 'prompt_tokens', 0),
                        'completion_tokens': getattr(chunk.usage, 'completion_tokens', 0),
                        'total_tokens': getattr(chunk.usage, 'total_tokens', 0),
                    }
            
            # Yield completion info
            yield {
                'type': 'done',
                'usage': usage_data or {'prompt_tokens': 0, 'completion_tokens': 0, 'total_tokens': 0},
                'finish_reason': finish_reason or 'stop'
            }
            
        except Exception as e:
            logger.error(f"LLM async streaming error: {e}", exc_info=True)
            raise LLMAPIError(f"Failed to start async streaming completion: {str(e)}")

    async def stream_complete_with_tools_async(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        tool_choice: str = "auto",
        reasoning_effort: str = "medium",
        temperature: float = 0.2,
        model: Optional[str] = None,
        cancel_event=None,
        **kwargs
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Generate an async streaming completion with native tool calling support.
        
        Uses OpenRouter's native tool calling API instead of prompt-based JSON extraction.
        This eliminates JSON parsing failures and provides structured tool calls directly.
        
        Args:
            messages: List of message dicts with 'role' and 'content' keys.
            tools: List of tool definitions in OpenAI function-calling format.
                   Each tool should have: {"type": "function", "function": {...}}
            tool_choice: Tool selection mode:
                        - "auto": Model decides whether to call tools
                        - "none": Don't call any tools
                        - {"type": "function", "function": {"name": "..."}}: Force specific tool
            reasoning_effort: How hard the model should think (minimal, low, medium, high)
            temperature: Sampling temperature (0-1)
            model: OpenRouter model identifier (overrides instance model if provided)
            cancel_event: Optional asyncio.Event to signal cancellation
            **kwargs: Additional arguments for the API
        
        Yields:
            Dict chunks with:
                - {'type': 'thinking', 'content': '...'} - reasoning tokens
                - {'type': 'token', 'content': '...'} - content tokens (for text responses)
                - {'type': 'tool_call', 'id': '...', 'name': '...', 'arguments': {...}} - completed tool calls
                - {'type': 'done', 'usage': {...}, 'finish_reason': '...'} - completion info
        
        Raises:
            LLMAPIError: If the API call fails before streaming starts
        """
        import time
        
        try:
            # Use provided model or fall back to instance model
            model_to_use = model or self.model
            if not model_to_use:
                raise ValueError("No model specified. Provide model in __init__ or stream_complete_with_tools_async()")
            
            # Create async streaming request with tools
            api_call_start = time.time()
            
            # Log request details
            total_chars = sum(
                len(msg.get("content", "")) if isinstance(msg.get("content"), str) else 0 
                for msg in messages
            )
            logger.info(
                f"[LLM_TIMING] Calling OpenRouter API with tools "
                f"(model: {model_to_use}, messages: {len(messages)}, "
                f"tools: {len(tools)}, total: {total_chars:,} chars, effort: {reasoning_effort})"
            )
            
            # Build reasoning config (model-aware)
            reasoning_config = self._build_reasoning_config(
                effort=reasoning_effort, model=model_to_use
            )
            
            # Build API request parameters
            api_params = {
                "model": model_to_use,
                "messages": messages,
                "tools": tools,
                "tool_choice": tool_choice,
                "temperature": temperature,
                "stream": True,
                "extra_body": reasoning_config,
                **kwargs
            }
            
            stream = await self.async_client.chat.completions.create(**api_params)
            
            api_call_complete = time.time()
            logger.info(f"[LLM_TIMING] API call with tools returned stream object (+{(api_call_complete - api_call_start)*1000:.1f}ms)")
            
            # Track usage and finish reason
            usage_data = None
            finish_reason = None
            first_chunk_received = False
            first_content_received = False
            first_chunk_time = None
            last_chunk_time = api_call_complete
            
            # Accumulate tool calls across chunks (they stream in pieces)
            # Format: {index: {"id": "...", "name": "...", "arguments": "..."}}
            tool_calls_in_progress: Dict[int, Dict[str, str]] = {}
            
            # Accumulate reasoning_details for storage and API replay.
            # OpenRouter requires these to be preserved on assistant messages
            # for reasoning continuity across tool-calling turns.
            #
            # Two types of blocks:
            # - thinking: Text for display. We accumulate fragments and store
            #   WITHOUT signature (signatures require byte-exact text which
            #   streaming can't guarantee).
            # - reasoning.encrypted etc: Opaque blocks for API continuity,
            #   passed through unchanged.
            accumulated_reasoning_details: list[dict] = []
            _thinking_text_accumulator: str = ""  # Accumulate thinking text fragments
            
            # Process stream chunks asynchronously
            chunk_count = 0
            async for chunk in stream:
                # Check for cancellation at start of each chunk
                if cancel_event and cancel_event.is_set():
                    logger.info("[LLM] Cancellation detected in tool calling stream, closing")
                    try:
                        await stream.close()
                    except Exception as close_err:
                        logger.debug(f"[LLM] Stream close error (expected): {close_err}")
                    break
                
                chunk_count += 1
                current_chunk_time = time.time()
                chunk_interval = (current_chunk_time - last_chunk_time) * 1000
                
                if not first_chunk_received:
                    first_chunk_time = time.time()
                    logger.info(f"[LLM_TIMING] First chunk arrived (+{(first_chunk_time - api_call_start)*1000:.1f}ms since API call)")
                    first_chunk_received = True
                
                last_chunk_time = current_chunk_time
                
                # Check for errors in chunk
                if hasattr(chunk, 'error') and chunk.error:
                    logger.error(f"Mid-stream error from OpenRouter: {chunk.error}")
                    yield {'type': 'error', 'error': chunk.error}
                    break
                
                # Extract content delta
                has_choices = chunk.choices and len(chunk.choices) > 0
                if has_choices:
                    choice = chunk.choices[0]
                    
                    if hasattr(choice, 'delta') and choice.delta:
                        delta = choice.delta
                        
                        # Extract reasoning/thinking content
                        # NOTE: Only use 'text' and 'summary' fields. The 'data' field contains
                        # encrypted binary content (reasoning.encrypted type) meant for passing
                        # back to the model, NOT for display.
                        reasoning_details = getattr(delta, 'reasoning_details', None)
                        yielded_reasoning = False
                        if reasoning_details:
                            for detail in reasoning_details:
                                if isinstance(detail, dict):
                                    reasoning_text = detail.get('text') or detail.get('summary')
                                else:
                                    reasoning_text = getattr(detail, 'text', None) or getattr(detail, 'summary', None)
                                if reasoning_text:
                                    yield {'type': 'thinking', 'content': reasoning_text}
                                    yielded_reasoning = True
                                # Accumulate reasoning_details for API replay.
                                # IMPORTANT: Only pass through opaque blocks (like
                                # reasoning.encrypted) that are meant to be replayed
                                # unchanged. Do NOT attempt to reconstruct thinking
                                # blocks with signatures - the signature is a
                                # cryptographic hash of the exact text, and any
                                # mismatch (encoding, whitespace, chunking order)
                                # causes "Invalid signature" errors from Anthropic.
                                # Thinking text is for display only; reasoning
                                # continuity is maintained by the encrypted blocks.
                                raw = dict(detail) if isinstance(detail, dict) else {
                                    k: getattr(detail, k, None)
                                    for k in ['type', 'text', 'summary', 'data', 'signature', 'format', 'index', 'id']
                                    if getattr(detail, k, None) is not None
                                }
                                if not raw:
                                    continue
                                detail_type = raw.get('type', '')
                                # Log what we're receiving for debugging
                                logger.debug(
                                    f"[LLM] reasoning_detail type={detail_type!r}, "
                                    f"has_text={bool(raw.get('text'))}, "
                                    f"has_signature={bool(raw.get('signature'))}, "
                                    f"has_data={bool(raw.get('data'))}"
                                )
                                # Handle different reasoning_detail types:
                                # - thinking: Has text fragments + signature at end.
                                #   Accumulate text for display, ignore signature
                                #   (signature requires byte-exact text which streaming
                                #   can't guarantee, causing API validation errors).
                                # - reasoning.text: Same as thinking - has text + signature.
                                #   Must NOT be replayed as signatures are cryptographically
                                #   tied to exact byte content and fail validation.
                                # - reasoning.encrypted and others: Opaque blocks meant
                                #   to be passed through unchanged for API continuity.
                                if detail_type == 'thinking' or detail_type == 'reasoning.text':
                                    # Accumulate thinking text (will flush at end)
                                    # Do NOT keep these for replay - signatures will fail
                                    if raw.get('text'):
                                        _thinking_text_accumulator += raw['text']
                                        logger.debug(f"[LLM] Accumulating {detail_type} text fragment ({len(raw['text'])} chars), NOT keeping for replay")
                                elif detail_type:
                                    # Opaque blocks (reasoning.encrypted, etc.) - keep as-is
                                    logger.debug(f"[LLM] Keeping reasoning_detail type={detail_type!r} for API replay")
                                    accumulated_reasoning_details.append(raw)
                        
                        # Legacy fallback for reasoning
                        if not yielded_reasoning:
                            reasoning = getattr(delta, 'reasoning', None) or getattr(delta, 'reasoning_content', None)
                            if reasoning:
                                yield {'type': 'thinking', 'content': reasoning}
                        
                        # Extract content tokens (for text responses like 'respond' tool)
                        delta_content = getattr(delta, 'content', None)
                        if delta_content:
                            if not first_content_received:
                                first_content_time = time.time()
                                time_since_call = (first_content_time - api_call_start) * 1000
                                logger.info(f"[LLM_TIMING] First CONTENT chunk #{chunk_count} (+{time_since_call:.1f}ms since API call)")
                                first_content_received = True
                            yield {'type': 'token', 'content': delta_content}
                        
                        # Extract tool calls (they stream in pieces)
                        delta_tool_calls = getattr(delta, 'tool_calls', None)
                        if delta_tool_calls:
                            for tc in delta_tool_calls:
                                idx = tc.index if hasattr(tc, 'index') else 0
                                
                                # Initialize if new tool call
                                if idx not in tool_calls_in_progress:
                                    tool_calls_in_progress[idx] = {
                                        "id": "",
                                        "name": "",
                                        "arguments": "",
                                    }
                                
                                # Accumulate pieces
                                if hasattr(tc, 'id') and tc.id:
                                    tool_calls_in_progress[idx]["id"] = tc.id
                                if hasattr(tc, 'function') and tc.function:
                                    if hasattr(tc.function, 'name') and tc.function.name:
                                        tool_calls_in_progress[idx]["name"] = tc.function.name
                                    if hasattr(tc.function, 'arguments') and tc.function.arguments:
                                        tool_calls_in_progress[idx]["arguments"] += tc.function.arguments
                                        # Yield argument deltas for streaming consumers
                                        # (enables token-by-token streaming of respond tool messages)
                                        if tool_calls_in_progress[idx]["name"]:
                                            yield {
                                                'type': 'tool_call_delta',
                                                'index': idx,
                                                'name': tool_calls_in_progress[idx]["name"],
                                                'arguments_delta': tc.function.arguments,
                                            }
                    
                    # Check finish reason
                    if hasattr(choice, 'finish_reason') and choice.finish_reason:
                        finish_reason = choice.finish_reason
                
                # Extract usage information (usually in last chunk)
                if hasattr(chunk, 'usage') and chunk.usage:
                    usage_data = {
                        'prompt_tokens': getattr(chunk.usage, 'prompt_tokens', 0),
                        'completion_tokens': getattr(chunk.usage, 'completion_tokens', 0),
                        'total_tokens': getattr(chunk.usage, 'total_tokens', 0),
                    }
            
            # After stream completes, yield any accumulated tool calls
            if tool_calls_in_progress:
                for idx in sorted(tool_calls_in_progress.keys()):
                    tc = tool_calls_in_progress[idx]
                    if tc["name"]:  # Only yield if we have a name
                        # Parse arguments JSON
                        try:
                            arguments = json.loads(tc["arguments"]) if tc["arguments"] else {}
                        except json.JSONDecodeError as e:
                            logger.warning(f"[LLM] Failed to parse tool call arguments: {e}")
                            arguments = {"_raw": tc["arguments"]}
                        
                        logger.info(f"[LLM] Tool call: {tc['name']}({list(arguments.keys())})")
                        yield {
                            'type': 'tool_call',
                            'id': tc["id"],
                            'name': tc["name"],
                            'arguments': arguments,
                        }
            
            # Yield completion info with separated data:
            # - reasoning_details: Only opaque blocks (reasoning.encrypted) for API replay
            # - thinking_text: Accumulated thinking text for display/storage
            if accumulated_reasoning_details:
                logger.info(
                    f"[LLM] Returning {len(accumulated_reasoning_details)} reasoning_details for API replay: "
                    f"{[d.get('type') for d in accumulated_reasoning_details]}"
                )
            if _thinking_text_accumulator:
                logger.info(
                    f"[LLM] Returning {len(_thinking_text_accumulator)} chars of thinking_text for display"
                )
            yield {
                'type': 'done',
                'usage': usage_data or {'prompt_tokens': 0, 'completion_tokens': 0, 'total_tokens': 0},
                'finish_reason': finish_reason or 'stop',
                'reasoning_details': accumulated_reasoning_details,
                'thinking_text': _thinking_text_accumulator,
            }
            
        except Exception as e:
            logger.error(f"LLM tool calling stream error: {e}", exc_info=True)
            raise LLMAPIError(f"Failed to stream with tools: {str(e)}")
    
    async def complete_stream_multimodal(
        self,
        prompt: str,
        images: Optional[List[Dict[str, str]]] = None,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2000,
        temperature: float = 0.7,
        model: Optional[str] = None,
        response_format: str = 'text',
        personality: str = 'professional',
        cancel_event=None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream completion with images - OpenRouter uses consistent format across all models.
        
        Builds multimodal message content with text + images, then streams response
        from vision-capable model (e.g., gemini-2.5-pro, gpt-4o).
        
        Args:
            prompt: Text prompt
            images: List of dicts with 'url' (required) and 'detail' (optional) keys
                    Example: [{'url': 'https://...', 'detail': 'low'}]
            system_prompt: System message
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0-1)
            model: Vision-capable model identifier
            response_format: 'text' or 'markdown'
            personality: Tone/style of response
            cancel_event: Optional asyncio.Event to signal cancellation
        
        Yields:
            Dict chunks with:
                - {'type': 'token', 'content': '...'} - content tokens
                - {'type': 'error', 'error': {...}} - mid-stream errors
                - {'type': 'done', 'usage': {...}, 'finish_reason': '...'} - completion info
        
        Raises:
            LLMAPIError: If API call fails
        """
        try:
            from django.conf import settings
            from common.utils.llm_config import LLMConfigService
            
            model_to_use = model or self.model or settings.DEFAULT_VISION_MODEL
            
            # Convert short model name to OpenRouter format if needed
            model_info = LLMConfigService.get_model_info(model_to_use)
            if model_info and 'openrouter_model' in model_info:
                model_to_use = model_info['openrouter_model']
            
            # Build multimodal content (OpenAI-compatible format works for all providers)
            content = [{"type": "text", "text": prompt}]
            
            if images:
                for img in images:
                    content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": img['url'],
                            "detail": img.get('detail', 'low')
                        }
                    })
                logger.info(f"Multimodal request with {len(images)} image(s), detail: {images[0].get('detail', 'low')}")
            
            messages = [
                {"role": "system", "content": system_prompt or "You are a helpful assistant."},
                {"role": "user", "content": content}
            ]
            
            # Stream from OpenRouter with vision model
            import time
            api_call_start = time.time()
            
            # Build reasoning config (model-aware)
            reasoning_config = self._build_reasoning_config(model=model_to_use)
            
            response = await self.async_client.chat.completions.create(
                model=model_to_use,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                stream=True,
                extra_body=reasoning_config,
            )
            
            # Stream chunks
            chunk_count = 0
            first_chunk_time = None
            first_content_received = False
            usage_data = None
            finish_reason = None
            
            async for chunk in response:
                # Check for cancellation at start of each chunk
                if cancel_event and cancel_event.is_set():
                    logger.info("[LLM] Cancellation detected in multimodal stream, closing to stop billing")
                    try:
                        await response.close()
                    except Exception as close_err:
                        logger.debug(f"[LLM] Multimodal stream close error (expected): {close_err}")
                    break
                
                chunk_count += 1
                chunk_time = time.time()
                chunk_interval = (chunk_time - first_chunk_time) * 1000 if first_chunk_time else 0
                
                if first_chunk_time is None:
                    first_chunk_time = chunk_time
                    logger.info(f"[LLM_TIMING] First chunk from vision model (+{(first_chunk_time - api_call_start)*1000:.1f}ms)")
                
                if chunk.choices and len(chunk.choices) > 0:
                    choice = chunk.choices[0]
                    if hasattr(choice, 'delta') and choice.delta:
                        # Extract reasoning/thinking content from OpenRouter's reasoning_details array
                        # See: https://openrouter.ai/docs/use-cases/reasoning-tokens
                        # NOTE: Only use 'text' and 'summary' fields. The 'data' field contains
                        # encrypted binary content (reasoning.encrypted type) meant for passing
                        # back to the model, NOT for display.
                        reasoning_details = getattr(choice.delta, 'reasoning_details', None)
                        yielded_reasoning = False
                        if reasoning_details:
                            for detail in reasoning_details:
                                # Handle dict or object
                                if isinstance(detail, dict):
                                    detail_type = detail.get('type', '')
                                    reasoning_text = detail.get('text') or detail.get('summary')
                                else:
                                    detail_type = getattr(detail, 'type', '')
                                    reasoning_text = getattr(detail, 'text', None) or getattr(detail, 'summary', None)
                                
                                if reasoning_text:
                                    logger.debug(f"[LLM] Reasoning token ({detail_type}): {reasoning_text[:100]}...")
                                    yield {
                                        'type': 'thinking',
                                        'content': reasoning_text
                                    }
                                    yielded_reasoning = True
                        
                        # Legacy fallback: check old field names for backwards compatibility
                        # Only use if reasoning_details didn't yield anything (avoid duplicates)
                        if not yielded_reasoning:
                            reasoning = getattr(choice.delta, 'reasoning', None) or getattr(choice.delta, 'reasoning_content', None)
                            if reasoning:
                                yield {
                                    'type': 'thinking',
                                    'content': reasoning
                                }

                        delta_content = getattr(choice.delta, 'content', None)
                        if delta_content:
                            if not first_content_received:
                                first_content_time = time.time()
                                logger.info(f"[LLM_TIMING] First content chunk from vision model (+{(first_content_time - api_call_start)*1000:.1f}ms)")
                                first_content_received = True
                            yield {
                                'type': 'token',
                                'content': delta_content
                            }
                    
                    if hasattr(choice, 'finish_reason') and choice.finish_reason:
                        finish_reason = choice.finish_reason
                
                # Extract usage information
                if hasattr(chunk, 'usage') and chunk.usage:
                    usage_data = {
                        'prompt_tokens': getattr(chunk.usage, 'prompt_tokens', 0),
                        'completion_tokens': getattr(chunk.usage, 'completion_tokens', 0),
                        'total_tokens': getattr(chunk.usage, 'total_tokens', 0),
                    }
            
            # Log completion details for debugging
            total_time = (time.time() - api_call_start) * 1000
            completion_tokens = usage_data.get('completion_tokens', 0) if usage_data else 0
            logger.info(
                f"[LLM_TIMING] Multimodal stream complete: "
                f"chunks={chunk_count}, finish_reason={finish_reason}, "
                f"completion_tokens={completion_tokens}, total_time={total_time:.1f}ms"
            )
            
            # Warn if finish_reason indicates truncation
            if finish_reason == 'length':
                logger.warning(
                    f"[LLM] Vision model response truncated (finish_reason=length). "
                    f"Consider increasing max_tokens."
                )
            elif finish_reason not in ['stop', 'end_turn', None]:
                logger.warning(f"[LLM] Unexpected finish_reason from vision model: {finish_reason}")
            
            # Yield completion info
            yield {
                'type': 'done',
                'usage': usage_data or {'prompt_tokens': 0, 'completion_tokens': 0, 'total_tokens': 0},
                'finish_reason': finish_reason or 'stop'
            }
            
        except Exception as e:
            logger.error(f"Multimodal streaming failed: {e}", exc_info=True)
            raise LLMAPIError(f"Vision model streaming failed: {str(e)}")

    def analyze_content(
        self,
        content: str,
        analysis_type: str = "general"
    ) -> Dict[str, Any]:
        """
        Analyze content and extract structured information.

        Args:
            content: The content to analyze
            analysis_type: Type of analysis (general, entities, facts, etc.)

        Returns:
            Structured analysis results
        """
        prompts = {
            "general": """Analyze the following content and provide a structured summary including:
- Main topic
- Key points (list)
- Target audience
- Content quality score (1-10)

Content:
{content}

Respond in JSON format.""",
            "entities": """Extract named entities from the following content:
- People
- Organizations
- Locations
- Products
- Technologies

Content:
{content}

Respond in JSON format.""",
            "facts": """Extract key facts and claims from the following content:

Content:
{content}

List each fact with a confidence score (1-10). Respond in JSON format.""",
        }

        prompt = prompts.get(analysis_type, prompts["general"]).format(content=content)

        try:
            response = self.complete(
                prompt=prompt,
                temperature=0.3,  # Lower temperature for more deterministic output
                max_tokens=1500
            )
            # Note: In production, you'd want to parse and validate the JSON response
            return {"raw_response": response}
        except Exception as e:
            logger.error(f"Content analysis failed: {e}")
            return {"error": str(e)}

    def generate_content(
        self,
        topic: str,
        context: Optional[str] = None,
        tone: str = "professional",
        length: str = "medium"
    ) -> str:
        """
        Generate content on a given topic.

        Args:
            topic: The topic to write about
            context: Additional context or requirements
            tone: Desired tone (professional, casual, technical)
            length: Desired length (short, medium, long)

        Returns:
            Generated content
        """
        length_tokens = {
            "short": 300,
            "medium": 800,
            "long": 1500
        }

        system_prompt = f"You are a professional content writer. Write in a {tone} tone."

        prompt = f"""Write content about: {topic}

{"Additional context: " + context if context else ""}

Provide well-structured, informative content."""

        return self.complete(
            prompt=prompt,
            system_prompt=system_prompt,
            max_tokens=length_tokens.get(length, 800),
            temperature=0.7
        )
    
    def generate_response(
        self,
        question: str,
        context: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2000,
        temperature: float = 0.7,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a response to a question using provided context.
        Returns structured data including the answer, model used, and tokens.

        Args:
            question: The user's question
            context: Retrieved context to use for answering
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            model: OpenRouter model identifier (overrides instance model if provided)

        Returns:
            Dict with keys: answer, model, tokens_used
        """
        try:
            prompt = f"""Context:
{context}

Question: {question}

Based on the context above, provide a helpful and accurate answer to the question."""

            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            # Use provided model or fall back to instance model
            model_to_use = model or self.model
            if not model_to_use:
                raise ValueError("No model specified. Provide model in __init__ or method call")

            response = self.client.chat.completions.create(
                model=model_to_use,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )

            return {
                'answer': response.choices[0].message.content,
                'model': response.model,
                'tokens_used': response.usage.total_tokens,
            }
            
        except Exception as e:
            logger.error(f"Failed to generate response: {e}", exc_info=True)
            raise LLMAPIError(f"Failed to generate response: {str(e)}")
    
    def analyze_image_for_brand_colors(
        self,
        image_url: str,
        model: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Analyze homepage screenshot and suggest primaryColor and secondaryColor.
        
        The secondary color is the text/icon color typically used ON TOP of the
        primary brand color (e.g., white text on a dark blue button).
        
        Args:
            image_url: Public URL to screenshot (GCS signed URL)
            model: Vision model (default: google/flagship via LLMConfigService)
        
        Returns:
            Dict with:
            {
                'primaryColor': '#hex',    # Main brand color from site
                'secondaryColor': '#hex',  # Text color on primary backgrounds
                'reasoning': 'explanation'
            }
        """
        system_prompt = """You are a web design color expert analyzing a website screenshot.

Identify TWO colors:
1. PRIMARY COLOR: The main brand color (from logo, header, or CTA buttons)
2. SECONDARY COLOR: The text/icon color typically used ON TOP of that brand color

Guidelines for secondary color:
- Look at text on buttons, icons in colored headers, or text on the primary brand color
- Common patterns: white text on dark colors, black/dark gray on light colors
- Can be off-white (#f5f5f5), cream, dark gray (#333333) - whatever the brand uses
- If you cannot clearly identify the secondary color, use #ffffff for dark primaries or #000000 for light primaries

Return ONLY a JSON object (no markdown, no explanation before/after):
{
  "primaryColor": "#RRGGBB",
  "secondaryColor": "#RRGGBB",
  "reasoning": "Brief explanation of both color choices"
}"""

        # Build multimodal message
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "What are the primary brand color and secondary text color for this website?"
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image_url,
                            "detail": "low"  # Faster and cheaper
                        }
                    }
                ]
            }
        ]

        # Use lazy import to avoid circular dependency with llm_config
        from common.utils.llm_config import LLMConfigService
        model_to_use = model or LLMConfigService.get_openrouter_model('google/flagship')
        
        try:
            response = self.client.chat.completions.create(
                model=model_to_use,
                messages=messages,
                max_tokens=20000,  # Very large limit to prevent truncation of reasoning
                temperature=0.3
            )
            
            content = response.choices[0].message.content
            finish_reason = response.choices[0].finish_reason
            
            # Log the raw response for debugging
            logger.info(f"Raw LLM response for color analysis ({len(content)} chars, finish_reason={finish_reason}): {content}")
            
            from common.utils.json_parser import parse_json_from_llm
            result = parse_json_from_llm(content)
            
            # Validate primaryColor (required)
            if 'primaryColor' not in result:
                raise ValueError("Missing primaryColor in LLM response")
            
            primary = result['primaryColor']
            if not primary.startswith('#') or len(primary) != 7:
                raise ValueError(f"Invalid primary hex color: {primary}")
            
            # Validate secondaryColor if present
            if 'secondaryColor' in result:
                secondary = result['secondaryColor']
                if not secondary.startswith('#') or len(secondary) != 7:
                    logger.warning(f"Invalid secondary hex color: {secondary}, will use fallback")
                    del result['secondaryColor']
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to analyze brand colors: {e}")
            raise LLMAPIError(f"Color analysis failed: {str(e)}")

    def analyze_image_for_theme(
        self,
        image_url: str,
        model: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Analyze homepage screenshot and recommend a Help Center theme preset + primary color.

        Analyzes:
        - Primary brand color (from logo, header, CTAs)
        - Visual style (modern, traditional, technical, friendly)
        - Industry/audience inference
        - Recommends one of 6 theme presets

        Args:
            image_url: Public URL to screenshot (Firecrawl temporary URL)
            model: Vision model (default: google/flagship via LLMConfigService)

        Returns:
            Dict with:
            {
                'primaryColor': '#hex',
                'recommendedTheme': 'compass|harbor|meridian|vector|anchor|terminal',
                'styleAnalysis': 'description of visual style',
                'industryInference': 'inferred industry/audience',
                'reasoning': 'explanation of theme choice'
            }
        """
        system_prompt = """You are a web design expert analyzing a website screenshot to recommend a Help Center theme.

Analyze the screenshot and identify:
1. PRIMARY COLOR: The main brand color (from logo, header, or primary CTA buttons)
2. VISUAL STYLE: Is it modern/sleek, traditional/classic, technical/minimal, or friendly/approachable?
3. INDUSTRY/AUDIENCE: What type of company is this? (enterprise B2B, consumer app, developer tool, etc.)

Based on your analysis, recommend ONE of these 6 theme presets:

COMPASS (Navy #1E3A5F) - Professional/enterprise. Best for: Enterprise SaaS, B2B, Fintech, Healthcare, Legal.
HARBOR (Coral #E57373) - Friendly/approachable. Best for: Consumer Apps, DTC Brands, Lifestyle, E-commerce.
MERIDIAN (Green #6B8E6B) - Calm/knowledgeable. Best for: Productivity Tools, Wellness, Education, Knowledge Bases.
VECTOR (Purple #7C3AED) - Modern/dynamic. Best for: Startups, AI Products, Modern SaaS, Creative Tools.
ANCHOR (Gold #8B6914) - Classic/trustworthy. Best for: Financial Services, Insurance, Professional Services.
TERMINAL (Teal #00BFA5) - Technical/precise. Best for: Developer Tools, APIs, Infrastructure, Technical Products.

Guidelines:
- Match theme to the brand's visual identity and likely audience
- Extract the ACTUAL primary brand color from the screenshot
- The theme recommendation is about style/personality match, not exact color match

Return ONLY a JSON object (no markdown, no explanation before/after):
{
  "primaryColor": "#RRGGBB",
  "recommendedTheme": "compass|harbor|meridian|vector|anchor|terminal",
  "styleAnalysis": "Brief description of the visual style",
  "industryInference": "Inferred industry/audience type",
  "reasoning": "Why this theme is the best match"
}"""

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Analyze this website homepage and recommend the best Help Center theme preset."
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image_url,
                            "detail": "low"  # Faster and cheaper
                        }
                    }
                ]
            }
        ]

        from common.utils.llm_config import LLMConfigService
        model_to_use = model or LLMConfigService.get_openrouter_model('google/flagship')

        try:
            response = self.client.chat.completions.create(
                model=model_to_use,
                messages=messages,
                max_tokens=2000,
                temperature=0.3
            )

            content = response.choices[0].message.content
            logger.info(f"Raw LLM response for theme analysis: {content}")

            from common.utils.json_parser import parse_json_from_llm
            result = parse_json_from_llm(content)

            # Validate required fields
            if 'primaryColor' not in result:
                raise ValueError("Missing primaryColor in LLM response")

            primary = result['primaryColor']
            if not primary.startswith('#') or len(primary) != 7:
                raise ValueError(f"Invalid primary hex color: {primary}")

            if 'recommendedTheme' not in result:
                raise ValueError("Missing recommendedTheme in LLM response")

            theme = result['recommendedTheme']
            valid_themes = ['compass', 'harbor', 'meridian', 'vector', 'anchor', 'terminal']
            if theme not in valid_themes:
                logger.warning(f"Invalid theme '{theme}', defaulting to 'compass'")
                result['recommendedTheme'] = 'compass'

            return result

        except Exception as e:
            logger.error(f"Failed to analyze theme: {e}")
            raise LLMAPIError(f"Theme analysis failed: {str(e)}")


# Singleton instance
_llm_client = None


def get_llm_client(model: Optional[str] = None) -> LLMClient:
    """
    Get or create an LLM client instance.
    
    Args:
        model: OpenRouter model identifier
    
    Returns:
        LLMClient instance
    """
    global _llm_client
    if _llm_client is None or model:
        _llm_client = LLMClient(model=model)
    return _llm_client


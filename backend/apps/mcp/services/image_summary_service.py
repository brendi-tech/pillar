"""
Image summary generation service.

Generates text summaries of images using vision models and caches them
for efficient use in ReAct iterations.

Copyright (C) 2025 Pillar Team
"""
import logging
from typing import Dict, List, Optional

from django.core.cache import cache

from common.cache_keys import CacheKeys
from common.utils.llm_client import LLMClient
from common.utils.llm_config import LLMConfigService

logger = logging.getLogger(__name__)

# Default TTL matches signed URL expiry (24 hours)
DEFAULT_SUMMARY_TTL = 86400


async def generate_image_summary(
    image_url: str,
    detail: str = 'low',
    ttl: int = DEFAULT_SUMMARY_TTL,
) -> str:
    """
    Generate and cache a text summary of an image.

    Args:
        image_url: Signed URL of the image
        detail: Vision detail level ('low' or 'high')
        ttl: Cache TTL in seconds

    Returns:
        Text summary of the image
    """
    cache_key = CacheKeys.image_summary(image_url)

    # Check cache first
    cached = cache.get(cache_key)
    if cached:
        logger.debug(f"[ImageSummary] Cache hit for {image_url[:50]}...")
        return cached

    # Generate summary using vision model
    summary_prompt = """Describe this image concisely in 2-3 sentences. Focus on:
- What type of content it shows (screenshot, error, chart, UI, etc.)
- Key visible text, numbers, or error messages
- The main subject or issue being shown

Be specific and factual."""

    from common.utils.llm_resilience import resilient_complete
    
    try:
        llm_client = LLMClient()
        vision_model = LLMConfigService.get_vision_model()

        # Use resilient completion with retry
        result = await resilient_complete(
            llm_client=llm_client,
            prompt=summary_prompt,
            system_prompt="You are an image description assistant. Be concise and factual.",
            max_tokens=150,
            temperature=0.2,
            max_retries=1,
            timeout=30.0,
            context={"question": "describe image"},
            model=vision_model,
            images=[{'url': image_url, 'detail': detail}],
        )

        if result.success and result.content:
            summary = result.content.strip()
            # Cache the summary
            cache.set(cache_key, summary, ttl)
            logger.info(f"[ImageSummary] Generated and cached summary: {summary[:100]}...")
            return summary
        else:
            logger.warning(
                f"[ImageSummary] LLM failed after retries: {result.original_error}",
                extra={"event_type": "image_summary_llm_failed"}
            )
            return "[Image attached - unable to generate description]"

    except Exception as e:
        logger.error(f"[ImageSummary] Failed to generate summary: {e}")
        return "[Image attached - unable to generate description]"


async def get_image_summaries(
    images: List[Dict[str, str]],
    ttl: int = DEFAULT_SUMMARY_TTL,
) -> str:
    """
    Get text summaries for multiple images.

    Fetches from cache if available, generates if not.

    Args:
        images: List of image dicts with 'url' and optional 'detail'
        ttl: Cache TTL in seconds

    Returns:
        Formatted string with all image summaries
    """
    if not images:
        return ""

    summaries = []
    for i, img in enumerate(images, 1):
        url = img.get('url', '')
        detail = img.get('detail', 'low')

        summary = await generate_image_summary(url, detail, ttl)
        summaries.append(f"Image {i}: {summary}")

    return "\n".join(summaries)


def get_cached_summary(image_url: str) -> Optional[str]:
    """
    Get cached summary for an image (sync, non-blocking).

    Returns None if not cached.
    """
    cache_key = CacheKeys.image_summary(image_url)
    return cache.get(cache_key)

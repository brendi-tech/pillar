"""
Action Search Service - Semantic search with smart selection and optional reranking.

Uses top-k + percentage-of-top strategy instead of hard thresholds.
Always returns actions to give LLM context about available capabilities.

Copyright (C) 2025 Pillar Team
"""
import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from asgiref.sync import sync_to_async
from django.conf import settings
from pgvector.django import CosineDistance

logger = logging.getLogger(__name__)


@dataclass
class ActionSearchResult:
    """Result from action search including metadata for debugging."""
    actions: List[Dict[str, Any]] = field(default_factory=list)
    # Metadata for reasoning trace
    rerank_enabled: bool = False
    rerank_time_ms: Optional[int] = None
    embedding_top_action: Optional[str] = None
    rerank_changed_top: bool = False


class ActionSearchService:
    """
    Action search using embedding similarity + optional Cohere re-ranking.

    Uses top-k + percentage-of-top strategy instead of hard thresholds.
    Always returns at least min_results actions (if available) to give LLM
    context about what actions are available, letting it decide relevance.
    """

    async def search(
        self,
        query: str,
        product,
        platform: str | None = None,
        version: str | None = None,
        max_results: int | None = None,
        min_results: int | None = None,
        context: dict | None = None,
    ) -> List[Dict[str, Any]]:
        """
        Search for matching actions using smart selection.

        Always returns at least min_results (if available) to give LLM context.
        Uses Cohere reranking for better relevance when enabled.

        Args:
            query: User query string
            product: Product instance
            platform: Optional platform filter (web, ios, android, desktop)
            version: Optional version filter (e.g., "1.2.3" or git SHA)
            max_results: Maximum number of actions to return (default from settings)
            min_results: Minimum actions to return even if low scores (default from settings)
            context: User context for filtering (currentPage, userRole, etc.)

        Returns:
            List of formatted action dictionaries with scores
        """
        result = await self.search_with_metadata(
            query=query,
            product=product,
            platform=platform,
            version=version,
            max_results=max_results,
            min_results=min_results,
            context=context,
        )
        return result.actions

    async def search_with_metadata(
        self,
        query: str,
        product,
        platform: str | None = None,
        version: str | None = None,
        max_results: int | None = None,
        min_results: int | None = None,
        context: dict | None = None,
    ) -> ActionSearchResult:
        """
        Search for matching actions with metadata for debugging/tracing.

        Same as search() but returns ActionSearchResult with additional metadata
        about the search process (reranking info, timing, etc).

        Args:
            query: User query string
            product: Product instance
            platform: Optional platform filter (web, ios, android, desktop)
            version: Optional version filter (e.g., "1.2.3" or git SHA)
            max_results: Maximum number of actions to return (default from settings)
            min_results: Minimum actions to return even if low scores (default from settings)
            context: User context for filtering by requiredContext (currentPage, userRole, etc.)

        Returns:
            ActionSearchResult with actions and metadata
        """
        from apps.products.models import Action, ActionDeployment
        from common.services.embedding_service import get_embedding_service

        # Use settings defaults if not specified
        max_results = max_results or settings.ACTION_SEARCH_TOP_N
        min_results = min_results or settings.ACTION_SEARCH_MIN
        candidates_limit = settings.ACTION_SEARCH_CANDIDATES

        # Initialize result with metadata
        search_result = ActionSearchResult(
            rerank_enabled=settings.ACTION_RERANK_ENABLED,
        )

        logger.info(
            f"[ActionSearch] Searching actions for query: '{query[:50]}...' "
            f"(product: {product.id}, platform: {platform}, version: {version})"
        )

        try:
            # Get actions based on platform/version or fallback to all published
            actions = await self._get_actions_queryset(
                product, platform, version, Action, ActionDeployment
            )

            action_count = await actions.acount()
            logger.info(f"[ActionSearch] Found {action_count} published actions with embeddings")

            if action_count == 0:
                # Debug logging for empty results
                total_actions = await Action.objects.filter(
                    product=product
                ).acount()
                published_actions = await Action.objects.filter(
                    product=product,
                    status=Action.Status.PUBLISHED
                ).acount()
                logger.info(
                    f"[ActionSearch] Debug: total={total_actions}, "
                    f"published={published_actions}, with_embedding={action_count}"
                )

                # ---------------------------------------------------------------
                # Keyword fallback: if actions exist but lack embeddings, use
                # simple keyword matching on name + description so the agent
                # can still discover tools.
                # ---------------------------------------------------------------
                if published_actions > 0:
                    logger.warning(
                        f"[ActionSearch] {published_actions} published action(s) have no "
                        "embeddings — falling back to keyword search"
                    )
                    keyword_results = await self._keyword_fallback(
                        query, product, Action, max_results
                    )
                    if keyword_results:
                        search_result.actions = keyword_results
                        logger.info(
                            f"[ActionSearch] Keyword fallback returned "
                            f"{len(keyword_results)} action(s)"
                        )

                return search_result

            # Get query embedding
            service = get_embedding_service()
            query_embedding = await service.embed_query_async(query)

            # 1. Score description embeddings in PostgreSQL via pgvector CosineDistance
            # Single DB roundtrip replaces the previous per-action numpy loop that
            # blocked the event loop for 15-20 seconds.
            desc_scored_actions = await sync_to_async(list)(
                actions.annotate(
                    desc_distance=CosineDistance('description_embedding', query_embedding)
                ).order_by('desc_distance')
            )

            # 2. Score example embeddings for top candidates in a thread pool
            # example_embeddings is a JSONField (list of vectors) so can't use pgvector.
            # Runs in a thread to avoid blocking the event loop.
            top_candidates = desc_scored_actions[:candidates_limit]

            def _score_with_examples(candidates, q_embedding):
                """Score example embeddings synchronously - runs in thread pool."""
                scored = []
                for action in candidates:
                    # CosineDistance: 0 = identical, 2 = opposite → similarity = 1 - distance
                    desc_score = 1.0 - action.desc_distance if action.desc_distance is not None else 0.0

                    example_score = 0.0
                    if action.example_embeddings:
                        for ex_embedding in action.example_embeddings:
                            if ex_embedding:
                                sim = service.calculate_similarity(q_embedding, ex_embedding)
                                example_score = max(example_score, sim)

                    final_score = max(desc_score, example_score)

                    if desc_score > 0 or example_score > 0:
                        logger.debug(
                            f"[ActionSearch] '{action.name}' desc={desc_score:.3f} "
                            f"example={example_score:.3f} final={final_score:.3f}"
                        )
                        scored.append((final_score, action))
                return scored

            all_scored = await asyncio.to_thread(
                _score_with_examples, top_candidates, query_embedding
            )

            # Sort by similarity descending
            all_scored.sort(key=lambda x: -x[0])

            # Filter by requiredContext if context is provided
            if context:
                filtered_scored = []
                for score, action in all_scored:
                    if action.matches_context(context):
                        filtered_scored.append((score, action))
                    else:
                        logger.debug(
                            f"[ActionSearch] Filtered out '{action.name}' - "
                            f"required_context {action.required_context} not met by {context}"
                        )
                all_scored = filtered_scored

            # Take top candidates for reranking
            candidates = all_scored[:candidates_limit]

            if not candidates:
                logger.info("[ActionSearch] No actions scored")
                return search_result

            # Track embedding top action before reranking
            embedding_top_action = candidates[0][1].name if candidates else None
            search_result.embedding_top_action = embedding_top_action

            logger.info(
                f"[ActionSearch] Top {len(candidates)} candidates by embedding similarity: "
                f"{[(a[1].name, f'{a[0]:.3f}') for a in candidates[:5]]}"
            )

            # Rerank with Cohere if enabled
            if settings.ACTION_RERANK_ENABLED and len(candidates) > 1:
                rerank_start = time.time()
                candidates = await self._rerank_actions(query, candidates)
                search_result.rerank_time_ms = int((time.time() - rerank_start) * 1000)
                
                # Check if reranking changed the top result
                reranked_top = candidates[0][1].name if candidates else None
                search_result.rerank_changed_top = (reranked_top != embedding_top_action)

            # Smart select using percentage-of-top strategy
            selected = self._smart_select_actions(
                candidates,
                min_actions=min_results,
                max_actions=max_results,
                quality_ratio=settings.ACTION_QUALITY_RATIO,
            )

            # Format actions for response
            # Only the highest-scoring action should auto-run to prevent multiple navigations
            formatted_actions = []
            auto_run_action = None  # Track the auto_run action for execution recording
            for i, (score, action) in enumerate(selected):
                is_best_match = (i == 0)
                formatted = self._format_action(action, score, allow_auto_run=is_best_match)
                formatted_actions.append(formatted)
                # Track the auto_run action (first one only)
                if formatted.get('auto_run') and auto_run_action is None:
                    auto_run_action = action

            # Record execution for auto_run action (runs immediately on SDK)
            if auto_run_action:
                try:
                    from django.utils import timezone
                    from django.db.models import F
                    # Use async-safe update to avoid threading issues
                    await auto_run_action.__class__.objects.filter(pk=auto_run_action.pk).aupdate(
                        execution_count=F('execution_count') + 1,
                        last_executed_at=timezone.now(),
                    )
                    logger.info(f"[ActionSearch] Recorded execution for auto_run action: {auto_run_action.name}")
                except Exception as e:
                    logger.warning(f"[ActionSearch] Failed to record action execution: {e}")

            search_result.actions = formatted_actions

            if formatted_actions:
                logger.info(
                    f"[ActionSearch] Returning {len(formatted_actions)} actions: "
                    f"{[a['name'] for a in formatted_actions]} "
                    f"(auto_run: {formatted_actions[0]['name'] if formatted_actions[0].get('auto_run') else 'none'})"
                )

            return search_result

        except Exception as e:
            logger.warning(f"[ActionSearch] Error searching actions: {e}", exc_info=True)
            return search_result

    async def _keyword_fallback(
        self,
        query: str,
        product,
        Action,
        max_results: int,
    ) -> List[Dict[str, Any]]:
        """
        Keyword-based fallback when no actions have embeddings.

        Uses Django's icontains on name and description to find relevant
        actions.  Splits the query into words and scores each action by
        how many distinct words match.

        Args:
            query: User query string
            product: Product instance
            Action: Action model class
            max_results: Maximum results to return

        Returns:
            Formatted action dicts (same shape as _format_action output).
        """
        all_actions = Action.objects.filter(
            product=product,
            status=Action.Status.PUBLISHED,
        )

        # Tokenize query into lowercase words (ignore very short words)
        words = [w.lower() for w in query.split() if len(w) >= 3]

        scored = []
        async for action in all_actions.aiterator():
            hits = 0
            searchable = f"{action.name} {action.description or ''}".lower()
            for word in words:
                if word in searchable:
                    hits += 1

            if hits > 0:
                # Normalize 0..1 with a small keyword_score for sorting
                keyword_score = hits / max(len(words), 1)
                scored.append((keyword_score, action))

        # Sort descending
        scored.sort(key=lambda t: t[0], reverse=True)
        selected = scored[:max_results]

        return [
            self._format_action(action, score, allow_auto_run=(i == 0))
            for i, (score, action) in enumerate(selected)
        ]

    async def _get_actions_queryset(
        self,
        product,
        platform: str | None,
        version: str | None,
        Action,
        ActionDeployment,
    ):
        """
        Get the actions queryset based on platform/version or fallback to all published.

        Args:
            product: Product instance
            platform: Optional platform filter
            version: Optional version filter
            Action: Action model class
            ActionDeployment: ActionDeployment model class

        Returns:
            QuerySet of Action objects
        """
        if platform and version:
            # Try to find exact deployment match
            deployment = await ActionDeployment.objects.filter(
                product=product,
                platform=platform,
                version=version,
                is_active=True,
            ).afirst()

            if not deployment:
                # Fall back to latest deployment for this platform
                deployment = await ActionDeployment.objects.filter(
                    product=product,
                    platform=platform,
                    is_active=True,
                ).order_by('-deployed_at').afirst()

                if deployment:
                    logger.info(
                        f"[ActionSearch] No exact match for {platform}@{version}, "
                        f"falling back to {platform}@{deployment.version}"
                    )

            if deployment:
                # Get actions from this deployment
                logger.info(
                    f"[ActionSearch] Using deployment {deployment.platform}@{deployment.version} "
                    f"(id: {deployment.id})"
                )
                return deployment.actions.filter(
                    status=Action.Status.PUBLISHED,
                    description_embedding__isnull=False
                )
            else:
                logger.info(
                    f"[ActionSearch] No deployment found for platform {platform}, "
                    f"falling back to all published actions"
                )

        # Fallback: return all published actions for this product
        return Action.objects.filter(
            product=product,
            status=Action.Status.PUBLISHED,
            description_embedding__isnull=False
        )

    async def _rerank_actions(
        self,
        query: str,
        candidates: List[Tuple[float, Any]],
    ) -> List[Tuple[float, Any]]:
        """
        Rerank action candidates using Cohere's cross-encoder.

        Args:
            query: User query string
            candidates: List of (score, action) tuples

        Returns:
            Reranked list of (score, action) tuples
        """
        from common.utils.reranker_service import get_reranker

        reranker = get_reranker()

        if not reranker.enabled:
            logger.debug("[ActionSearch] Reranker not enabled, skipping")
            return candidates

        logger.info(f"[ActionSearch] Reranking {len(candidates)} action candidates")

        # Format for reranker: combine name, description, and examples for better matching
        rerank_docs = []
        for score, action in candidates:
            # Use name, description, and examples for reranking context
            text = f"{action.name.replace('_', ' ')}: {action.description}"
            if action.examples:
                examples_text = ", ".join(action.examples[:5])  # Limit to first 5
                text = f"{text}\nExamples: {examples_text}"
            rerank_docs.append({
                'chunk_text': text,
                'score': score,
                '_action': action,  # Keep reference to original action
            })

        try:
            reranked = await reranker.rerank_async(
                query=query,
                documents=rerank_docs,
                top_n=len(candidates),  # Rerank all candidates, smart_select will filter
            )

            # Convert back to (score, action) format
            result = []
            for doc in reranked:
                action = doc['_action']
                rerank_score = doc.get('rerank_score', doc.get('score', 0))
                result.append((rerank_score, action))

            logger.info(
                f"[ActionSearch] After reranking: "
                f"{[(a[1].name, f'{a[0]:.3f}') for a in result[:5]]}"
            )

            return result

        except Exception as e:
            logger.warning(f"[ActionSearch] Reranking failed, using embedding scores: {e}")
            return candidates

    def _smart_select_actions(
        self,
        scored_actions: List[Tuple[float, Any]],
        min_actions: int = 5,
        max_actions: int = 8,
        quality_ratio: float = 0.75,
    ) -> List[Tuple[float, Any]]:
        """
        Select actions using percentage-of-top-score strategy.

        Mirrors _smart_select_sources from the old backend.
        Keeps all actions that score at least quality_ratio of the top result's score,
        with min/max bounds to ensure we always return something useful.

        Args:
            scored_actions: List of (score, action) tuples, sorted by score descending
            min_actions: Minimum actions to return (even if below threshold)
            max_actions: Maximum actions to return
            quality_ratio: Keep actions within this % of top score

        Returns:
            Selected list of (score, action) tuples
        """
        if not scored_actions:
            return []

        top_score = scored_actions[0][0]

        if top_score == 0:
            # No meaningful scores, return min_actions
            return scored_actions[:min_actions]

        threshold = top_score * quality_ratio

        # Select actions above threshold
        selected = [
            (score, action)
            for score, action in scored_actions
            if score >= threshold
        ]

        # Enforce min/max bounds
        if len(selected) < min_actions:
            # Ensure we return at least min_actions (if available)
            selected = scored_actions[:min_actions]
        elif len(selected) > max_actions:
            selected = selected[:max_actions]

        logger.info(
            f"[ActionSearch] Smart selection: {len(scored_actions)} candidates → "
            f"{len(selected)} selected (threshold: {threshold:.3f}, "
            f"top: {top_score:.3f}, ratio: {quality_ratio:.0%})"
        )

        return selected

    def _format_action(
        self, action, score: float, allow_auto_run: bool = True
    ) -> Dict[str, Any]:
        """
        Format an action for the response.

        Only includes server-side fields. SDK derives presentation (label, icon)
        from name and action_type.

        Args:
            action: The Action model instance
            score: Similarity/rerank score for this action
            allow_auto_run: Whether this action is allowed to auto-run
        """
        # Get execution behavior (with smart defaults based on action_type)
        behavior = action.get_execution_behavior()

        # Only allow auto-run if this is the best match
        should_auto_run = behavior['auto_run'] and allow_auto_run

        result = {
            'id': str(action.id),
            'name': action.name,
            'description': action.description,
            'guidance': action.guidance or '',
            'action_type': action.action_type,
            'auto_run': should_auto_run,
            'auto_complete': behavior['auto_complete'],
            'returns_data': action.returns_data,
            'score': round(score, 3),
        }

        # Include type-specific data payload
        if action.action_type == 'navigate' and action.path_template:
            result['data'] = {'path': action.path_template}
        elif action.action_type == 'external_link' and action.external_url:
            result['data'] = {'url': action.external_url}
        elif action.default_data:
            result['data'] = action.default_data
        else:
            result['data'] = {}

        # Include data_schema for actions that need LLM data extraction
        if action.data_schema:
            result['data_schema'] = action.data_schema

        if action.output_schema:
            result['output_schema'] = action.output_schema

        # Include parameter_examples for get_action_details tool
        if action.parameter_examples:
            result['parameter_examples'] = action.parameter_examples

        return result


# Global singleton instance
_action_search_service = None


def get_action_search_service() -> ActionSearchService:
    """Get or create singleton ActionSearchService instance."""
    global _action_search_service
    if _action_search_service is None:
        _action_search_service = ActionSearchService()
    return _action_search_service


# Convenience instance
action_search_service = ActionSearchService()

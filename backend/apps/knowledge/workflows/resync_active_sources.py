"""
Weekly resync of active knowledge sources.

Cron that finds all active URL-based KnowledgeSources (help_center,
marketing_site, website_crawl) and triggers knowledge-sync-source for each,
keeping docs content fresh without manual intervention.

Products with zero conversations in the past week are skipped to avoid
burning Firecrawl credits on inactive deployments.
"""

import logging
import time
from datetime import timedelta

from hatchet_sdk import Context

from common.hatchet_client import task_with_conditional_cron

logger = logging.getLogger(__name__)

SYNCABLE_TYPES = ('help_center', 'marketing_site', 'website_crawl')
DELAY_BETWEEN_SYNCS = 2.0
ACTIVITY_LOOKBACK = timedelta(days=7)


@task_with_conditional_cron(
    name="knowledge-resync-active-sources",
    on_crons=["0 3 * * 0"],  # 3 AM UTC every Sunday
    retries=1,
    execution_timeout=timedelta(minutes=30),
)
def resync_active_sources_workflow(workflow_input: dict, context: Context) -> dict:
    """Trigger a resync for every active URL-based knowledge source."""
    from django.utils import timezone

    from apps.analytics.models import ChatConversation
    from apps.knowledge.models import KnowledgeSource, KnowledgeSyncHistory
    from common.task_router import TaskRouter

    now = timezone.now()
    cutoff = now - ACTIVITY_LOOKBACK

    active_product_ids = set(
        ChatConversation.objects.filter(
            started_at__gte=cutoff,
        )
        .values_list('product_id', flat=True)
        .distinct()
    )

    context.log(
        f"{len(active_product_ids)} product(s) had conversations in the past week."
    )

    sources = list(
        KnowledgeSource.objects.filter(
            source_type__in=SYNCABLE_TYPES,
            status=KnowledgeSource.Status.ACTIVE,
            url__gt='',
            product_id__in=active_product_ids,
        )
        .select_related('organization', 'product')
        .order_by('name')
    )

    if not sources:
        context.log("No active sources with recent product activity — nothing to resync.")
        return {"triggered": 0, "skipped": 0, "errors": 0}

    context.log(f"Found {len(sources)} active source(s) to resync.")

    triggered = 0
    skipped = 0
    errors = 0

    for source in sources:
        try:
            if source.status == KnowledgeSource.Status.SYNCING:
                context.log(f"Skipping {source.name} — already syncing.")
                skipped += 1
                continue

            sync_history = KnowledgeSyncHistory.objects.create(
                organization=source.organization,
                source=source,
                sync_type=KnowledgeSyncHistory.SyncType.FULL,
                status=KnowledgeSyncHistory.Status.RUNNING,
                started_at=now,
            )

            TaskRouter.execute(
                'knowledge-sync-source',
                source_id=str(source.id),
                organization_id=str(source.organization_id),
                sync_history_id=str(sync_history.id),
            )

            source.status = KnowledgeSource.Status.SYNCING
            source.save(update_fields=['status'])

            triggered += 1
            context.log(
                f"Triggered resync for '{source.name}' "
                f"(product={source.product.name if source.product else '?'}, "
                f"org={source.organization.name})"
            )

            if triggered < len(sources):
                time.sleep(DELAY_BETWEEN_SYNCS)

        except Exception as e:
            errors += 1
            logger.exception(
                "Failed to trigger resync for source %s: %s", source.id, e
            )
            context.log(f"ERROR resyncing '{source.name}': {e}")

    context.log(
        f"Weekly resync complete: {triggered} triggered, "
        f"{skipped} skipped, {errors} errors"
    )

    return {"triggered": triggered, "skipped": skipped, "errors": errors}

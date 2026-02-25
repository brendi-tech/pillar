"""
Re-sync knowledge sources that have zero chunks.

Finds all syncable sources (website crawl, help center, marketing site) where
no KnowledgeChunks exist across any of their items, and triggers the
knowledge-sync-source workflow for each.

Usage:
    uv run python manage.py resync_empty_sources
    uv run python manage.py resync_empty_sources --dry-run
    uv run python manage.py resync_empty_sources --product-id <uuid>
    uv run python manage.py resync_empty_sources --include-errored
"""
import time

from django.core.management.base import BaseCommand
from django.db.models import Exists, OuterRef
from django.utils import timezone

from apps.knowledge.models import (
    KnowledgeChunk,
    KnowledgeSource,
    KnowledgeSyncHistory,
)


SYNCABLE_TYPES = (
    KnowledgeSource.SourceType.HELP_CENTER,
    KnowledgeSource.SourceType.MARKETING_SITE,
    KnowledgeSource.SourceType.WEBSITE_CRAWL,
)


class Command(BaseCommand):
    help = 'Re-sync all knowledge sources that have zero indexed chunks'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='List sources that would be synced without triggering anything',
        )
        parser.add_argument(
            '--product-id',
            type=str,
            help='Only resync sources for a specific product',
        )
        parser.add_argument(
            '--include-errored',
            action='store_true',
            help='Also resync sources currently in error status',
        )
        parser.add_argument(
            '--delay',
            type=float,
            default=1.0,
            help='Seconds to wait between triggering syncs (default: 1.0)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        product_id = options.get('product_id')
        include_errored = options['include_errored']
        delay = options['delay']

        allowed_statuses = [KnowledgeSource.Status.ACTIVE]
        if include_errored:
            allowed_statuses.append(KnowledgeSource.Status.ERROR)

        qs = KnowledgeSource.objects.filter(
            source_type__in=SYNCABLE_TYPES,
            status__in=allowed_statuses,
        ).exclude(
            Exists(
                KnowledgeChunk.objects.filter(
                    knowledge_item__source=OuterRef('pk')
                )
            )
        )

        if product_id:
            qs = qs.filter(product_id=product_id)

        sources = list(qs.select_related('organization', 'product').order_by('name'))

        if not sources:
            self.stdout.write(self.style.SUCCESS('No sources with zero chunks found.'))
            return

        self.stdout.write(f'\nFound {len(sources)} source(s) with zero chunks:\n')
        for src in sources:
            org_name = src.organization.name if src.organization else '?'
            product_name = src.product.name if src.product else '?'
            self.stdout.write(
                f'  [{src.source_type}] {src.name}\n'
                f'    id: {src.id}  org: {org_name}  product: {product_name}\n'
                f'    url: {src.url}  status: {src.status}\n'
            )

        if dry_run:
            self.stdout.write(self.style.WARNING('\nDry run — no syncs triggered.'))
            return

        self.stdout.write(f'\nTriggering syncs (delay={delay}s between each)...\n')
        from common.task_router import TaskRouter

        triggered = 0
        for src in sources:
            try:
                sync_history = KnowledgeSyncHistory.objects.create(
                    organization=src.organization,
                    source=src,
                    sync_type=KnowledgeSyncHistory.SyncType.FULL,
                    status=KnowledgeSyncHistory.Status.RUNNING,
                    started_at=timezone.now(),
                )

                TaskRouter.execute(
                    'knowledge-sync-source',
                    source_id=str(src.id),
                    organization_id=str(src.organization_id),
                    sync_history_id=str(sync_history.id),
                )

                src.status = KnowledgeSource.Status.SYNCING
                src.save(update_fields=['status'])

                triggered += 1
                self.stdout.write(self.style.SUCCESS(f'  ✓ {src.name} ({src.id})'))

                if delay > 0 and triggered < len(sources):
                    time.sleep(delay)

            except Exception as e:
                self.stderr.write(self.style.ERROR(f'  ✗ {src.name} ({src.id}): {e}'))

        self.stdout.write(f'\nTriggered {triggered}/{len(sources)} syncs.')

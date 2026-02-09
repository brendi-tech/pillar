"""
Report knowledge item status counts and failed item details.

Usage:
    uv run python manage.py report_knowledge_status --product-id <uuid>
    uv run python manage.py report_knowledge_status --source-id <uuid>
    uv run python manage.py report_knowledge_status --product-id <uuid> --failed-only
"""
from django.core.management.base import BaseCommand
from django.db.models import Count

from apps.knowledge.models import KnowledgeItem


class Command(BaseCommand):
    help = 'Report knowledge item status by product or source (counts and failed details)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--product-id',
            type=str,
            help='Product UUID to filter items',
        )
        parser.add_argument(
            '--source-id',
            type=str,
            help='Source UUID to filter items (e.g. Pillar Docs website source)',
        )
        parser.add_argument(
            '--failed-only',
            action='store_true',
            help='Only list failed items with processing_error',
        )

    def handle(self, *args, **options):
        product_id = options.get('product_id')
        source_id = options.get('source_id')
        failed_only = options.get('failed_only')

        if not product_id and not source_id:
            self.stderr.write(self.style.ERROR('Provide --product-id or --source-id'))
            return

        qs = KnowledgeItem.objects.all()
        if product_id:
            qs = qs.filter(product_id=product_id)
        if source_id:
            qs = qs.filter(source_id=source_id)

        # Counts by status (skip when --failed-only)
        if not failed_only:
            counts = qs.values('status').annotate(count=Count('id')).order_by('status')
            total = sum(c['count'] for c in counts)
            self.stdout.write(f'\nKnowledge items: {total} total\n')
            for row in counts:
                self.stdout.write(f"  {row['status']}: {row['count']}")
            self.stdout.write('')

        failed = qs.filter(status=KnowledgeItem.Status.FAILED).order_by('title')
        if failed.exists():
            self.stdout.write('Failed items (title, id, processing_error):\n')
            for item in failed:
                err = (item.processing_error or '')[:200]
                if err and len(item.processing_error or '') > 200:
                    err += '...'
                self.stdout.write(f"  {item.title}")
                self.stdout.write(f"    id: {item.id}")
                if err:
                    self.stdout.write(f"    error: {err}")
                self.stdout.write('')
        elif not failed_only and not qs.exists():
            self.stdout.write('No items found for the given filter.')

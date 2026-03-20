"""
Export a product and its related data from the dev database to a local fixture.

Connects to the 'dev_readonly' database alias (Cloud SQL via proxy) and
serializes a product's dependency graph into a Django-loadable JSON fixture.

Usage:
    # 1. Start Cloud SQL proxy
    ./.vscode/scripts/start-cloud-sql-proxy.sh dev

    # 2. Set env vars
    export DEV_DB_HOST=localhost DEV_DB_PORT=5433
    export DEV_DB_NAME=help_center_dev DEV_DB_USER=help_center_user
    export DEV_DB_PASSWORD='...'

    # 3. Export
    uv run python manage.py export_dev_product --subdomain pillar-help

    # 4. Load into local DB
    uv run python manage.py loaddata fixtures/dev_pillar-help.json
"""
import json
import os

from django.core.management.base import BaseCommand, CommandError
from django.db import connections, models


DB_ALIAS = 'dev_readonly'


def _get_dev_columns(table_name):
    """Return the set of column names that actually exist in the dev DB, or None if table missing."""
    with connections[DB_ALIAS].cursor() as cursor:
        cursor.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name = %s",
            [table_name],
        )
        cols = {row[0] for row in cursor.fetchall()}
        return cols if cols else None


def _safe_query(model, dev_columns, **filter_kwargs):
    """
    Query a model against the dev DB, deferring any fields whose columns
    don't exist in the remote schema yet.  Returns ([], info) if the
    table is missing or the query fails due to schema mismatch.
    """
    if dev_columns is None:
        return [], {'__table_missing__'}

    local_fields = {}
    for f in model._meta.get_fields():
        col = getattr(f, 'column', None) or getattr(f, 'attname', None)
        if col:
            local_fields[f.name] = col

    missing_cols = {
        name for name, col in local_fields.items()
        if col not in dev_columns
    }

    try:
        qs = model.objects.using(DB_ALIAS).filter(**filter_kwargs)
        if missing_cols:
            qs = qs.defer(*missing_cols)
        rows = list(qs)
    except Exception as exc:
        return [], {f'__query_error__: {exc}'}

    if missing_cols:
        from django.db.models.fields import NOT_PROVIDED
        for obj in rows:
            for field_name in missing_cols:
                field = model._meta.get_field(field_name)
                if field.has_default():
                    default = field.default
                    if callable(default):
                        default = default()
                elif field.null:
                    default = None
                elif isinstance(field, (models.CharField, models.TextField)):
                    default = ''
                elif isinstance(field, models.BooleanField):
                    default = False
                elif isinstance(field, models.IntegerField):
                    default = 0
                else:
                    default = None
                obj.__dict__.setdefault(field.attname, default)

    return rows, missing_cols


def _serialize_objects(objects):
    """Serialize model instances into Django fixture format."""
    from django.core.serializers import serialize
    return json.loads(serialize('json', objects))


class Command(BaseCommand):
    help = 'Export a product and related data from the dev database to a fixture file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--subdomain',
            help='Product subdomain to export (e.g. "pillar-help")',
        )
        parser.add_argument(
            '--product-id',
            help='Product UUID to export',
        )
        parser.add_argument(
            '--output',
            help='Output file path (default: fixtures/dev_{subdomain}.json)',
        )
        parser.add_argument(
            '--list',
            action='store_true',
            dest='list_products',
            help='List all products in the dev database and exit',
        )

    def handle(self, *args, **options):
        from django.conf import settings
        if 'dev_readonly' not in settings.DATABASES:
            raise CommandError(
                'dev_readonly database not configured. '
                'Set DEV_DB_HOST, DEV_DB_PORT, DEV_DB_NAME, DEV_DB_USER, DEV_DB_PASSWORD env vars.'
            )

        from apps.products.models import Product

        if options['list_products']:
            self._list_products(Product)
            return

        if not options['subdomain'] and not options['product_id']:
            raise CommandError('Provide --subdomain or --product-id (or use --list)')

        product = self._resolve_product(Product, options)
        objects = self._collect_objects(product)

        output_path = options['output'] or f'fixtures/dev_{product.subdomain or product.pk}.json'
        os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)

        data = _serialize_objects(objects)
        self._strip_vectors(data)

        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)

        self.stdout.write(self.style.SUCCESS(
            f'Exported {len(data)} objects to {output_path}'
        ))

    def _list_products(self, Product):
        self.stdout.write('\nProducts in dev database:')
        self.stdout.write('-' * 70)
        for p in Product.objects.using(DB_ALIAS).select_related('organization').all():
            self.stdout.write(
                f'  {p.subdomain or "(no subdomain)":<25} '
                f'{p.name:<30} org={p.organization.name}'
            )
        self.stdout.write('')

    def _resolve_product(self, Product, options):
        try:
            if options['subdomain']:
                return (
                    Product.objects.using(DB_ALIAS)
                    .select_related('organization')
                    .get(subdomain=options['subdomain'])
                )
            else:
                return (
                    Product.objects.using(DB_ALIAS)
                    .select_related('organization')
                    .get(pk=options['product_id'])
                )
        except Product.DoesNotExist:
            raise CommandError(
                'Product not found. Run with --list to see available products.'
            )

    def _collect_objects(self, product):
        """Collect all related objects in FK-dependency order."""
        from apps.users.models import User, OrganizationMembership
        from apps.knowledge.models import KnowledgeSource, KnowledgeItem
        from apps.products.models import Action, SyncSecret, Platform
        from apps.tools.models import ToolEndpoint

        org = product.organization
        objects = []

        # Pre-fetch column info for tables with potential schema drift
        col_cache = {}
        for model in [Action, SyncSecret, ToolEndpoint, Platform, KnowledgeSource, KnowledgeItem]:
            col_cache[model] = _get_dev_columns(model._meta.db_table)

        # 1. Organization
        objects.append(org)
        self.stdout.write(f'  Organization: {org.name}')

        # 2. Users + memberships
        memberships = list(
            OrganizationMembership.objects.using(DB_ALIAS)
            .filter(organization=org)
            .select_related('user', 'invited_by')
        )
        users = []
        user_ids_seen = set()
        for m in memberships:
            if m.user_id not in user_ids_seen:
                users.append(m.user)
                user_ids_seen.add(m.user_id)
            if m.invited_by_id and m.invited_by_id not in user_ids_seen:
                users.append(m.invited_by)
                user_ids_seen.add(m.invited_by_id)

        objects.extend(users)
        self.stdout.write(f'  Users: {len(users)}')

        # 3. Product
        objects.append(product)
        self.stdout.write(f'  Product: {product.name} (subdomain={product.subdomain})')

        # 4. Memberships (after users and org)
        objects.extend(memberships)
        self.stdout.write(f'  Memberships: {len(memberships)}')

        # 5. Knowledge sources
        sources, skipped = _safe_query(KnowledgeSource, col_cache[KnowledgeSource], product=product)
        if skipped:
            self.stdout.write(self.style.WARNING(f'    (deferred columns: {skipped})'))
        objects.extend(sources)
        self.stdout.write(f'  Knowledge sources: {len(sources)}')

        # 6. Snippet items only
        snippet_sources = [s for s in sources if s.source_type == 'snippets']
        snippet_items = []
        if snippet_sources:
            snippet_items, skipped = _safe_query(
                KnowledgeItem, col_cache[KnowledgeItem],
                source__in=snippet_sources,
                item_type=KnowledgeItem.ItemType.SNIPPET,
            )
            if skipped:
                self.stdout.write(self.style.WARNING(f'    (deferred columns: {skipped})'))
        objects.extend(snippet_items)
        self.stdout.write(f'  Snippet items: {len(snippet_items)}')

        # 7. Actions (tools)
        actions, skipped = _safe_query(Action, col_cache[Action], product=product)
        if skipped:
            self.stdout.write(self.style.WARNING(f'    (deferred columns: {skipped})'))
        objects.extend(actions)
        self.stdout.write(f'  Actions/tools: {len(actions)}')

        # 8. Sync secrets
        secrets, skipped = _safe_query(SyncSecret, col_cache[SyncSecret], product=product)
        if skipped:
            self.stdout.write(self.style.WARNING(f'    (deferred columns: {skipped})'))
        objects.extend(secrets)
        self.stdout.write(f'  Sync secrets: {len(secrets)}')

        # 9. Tool endpoints
        endpoints, skipped = _safe_query(ToolEndpoint, col_cache[ToolEndpoint], product=product)
        if skipped:
            self.stdout.write(self.style.WARNING(f'    (deferred columns: {skipped})'))
        objects.extend(endpoints)
        self.stdout.write(f'  Tool endpoints: {len(endpoints)}')

        # 10. Platforms
        platforms, skipped = _safe_query(Platform, col_cache[Platform], product=product)
        if skipped:
            self.stdout.write(self.style.WARNING(f'    (deferred columns: {skipped})'))
        objects.extend(platforms)
        self.stdout.write(f'  Platforms: {len(platforms)}')

        return objects

    def _strip_vectors(self, data):
        """Null out large vector/embedding fields and sensitive data."""
        import secrets as _secrets
        for obj in data:
            fields = obj.get('fields', {})
            for key in ('description_embedding', 'example_embeddings'):
                if key in fields:
                    fields[key] = None if key == 'description_embedding' else []
            if 'password' in fields:
                fields['password'] = '!unusable'
            if 'last_selected_product' in fields:
                fields['last_selected_product'] = None
            # Encrypted fields can't be decrypted with local keys — generate fresh
            if obj.get('model') == 'products.syncsecret' and 'secret_hash' in fields:
                raw = 'plr_fixture_' + _secrets.token_hex(16)
                fields['secret_hash'] = raw
                fields['last_four'] = raw[-4:]
                self.stdout.write(f'    Generated fixture secret: {raw}')

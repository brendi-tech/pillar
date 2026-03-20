"""
Import a dev product fixture into the local database.

Handles conflicts with existing users by remapping PKs instead of
creating duplicates. Uses update_or_create semantics for all objects.

Usage:
    uv run python manage.py import_dev_product fixtures/dev_pillar-help.json
"""
import json

from django.core.management.base import BaseCommand, CommandError
from django.apps import apps


class Command(BaseCommand):
    help = 'Import a dev product fixture into the local database, handling PK conflicts'

    def add_arguments(self, parser):
        parser.add_argument('fixture', help='Path to the fixture JSON file')

    def handle(self, *args, **options):
        fixture_path = options['fixture']

        try:
            with open(fixture_path) as f:
                data = json.load(f)
        except FileNotFoundError:
            raise CommandError(f'Fixture file not found: {fixture_path}')

        user_pk_remap = self._build_user_remap(data)
        self._apply_remap(data, user_pk_remap)

        stats = {}
        for entry in data:
            model_label = entry['model']
            pk = entry['pk']
            fields = entry['fields']

            Model = apps.get_model(model_label)
            model_name = Model.__name__

            # Apply FK remaps for user references
            self._remap_user_fks(Model, fields, user_pk_remap)

            try:
                obj, created = self._upsert(Model, pk, fields)
                action = 'created' if created else 'updated'
                stats.setdefault(model_name, {'created': 0, 'updated': 0, 'skipped': 0})
                stats[model_name][action] += 1
            except Exception as exc:
                stats.setdefault(model_name, {'created': 0, 'updated': 0, 'skipped': 0})
                stats[model_name]['skipped'] += 1
                self.stderr.write(self.style.WARNING(
                    f'  Skipped {model_label} pk={pk}: {exc}'
                ))

        self.stdout.write('')
        for model_name, counts in stats.items():
            parts = []
            if counts['created']:
                parts.append(f"{counts['created']} created")
            if counts['updated']:
                parts.append(f"{counts['updated']} updated")
            if counts['skipped']:
                parts.append(f"{counts['skipped']} skipped")
            self.stdout.write(f'  {model_name:<30} {", ".join(parts)}')

        total = sum(c['created'] + c['updated'] for c in stats.values())
        skipped = sum(c['skipped'] for c in stats.values())
        self.stdout.write(self.style.SUCCESS(
            f'\nImported {total} objects ({skipped} skipped)'
        ))

    def _build_user_remap(self, data):
        """Find users that already exist locally and build a PK remap dict."""
        from apps.users.models import User

        remap = {}
        for entry in data:
            if entry['model'] != 'users.user':
                continue
            email = entry['fields'].get('email')
            fixture_pk = entry['pk']
            if email:
                try:
                    local_user = User.objects.get(email=email)
                    if local_user.pk != fixture_pk:
                        remap[fixture_pk] = local_user.pk
                        self.stdout.write(
                            f'  Remapping user {email}: pk {fixture_pk} -> {local_user.pk}'
                        )
                except User.DoesNotExist:
                    pass
        return remap

    def _apply_remap(self, data, user_pk_remap):
        """Remove remapped users from fixture (they already exist locally)."""
        if not user_pk_remap:
            return
        data[:] = [
            entry for entry in data
            if not (entry['model'] == 'users.user' and entry['pk'] in user_pk_remap)
        ]

    def _remap_user_fks(self, Model, fields, user_pk_remap):
        """Remap any FK fields pointing to User to use local PKs."""
        if not user_pk_remap:
            return
        from apps.users.models import User
        for field in Model._meta.get_fields():
            if hasattr(field, 'related_model') and field.related_model is User:
                # Django serializer stores FK values under the field name (not attname)
                fk_name = field.name
                if fk_name in fields:
                    old_val = fields[fk_name]
                    if old_val in user_pk_remap:
                        fields[fk_name] = user_pk_remap[old_val]

    def _upsert(self, Model, pk, fields):
        """Insert or update a model instance by PK."""
        from django.db import models as m

        cleaned = {}
        for field_name, value in fields.items():
            try:
                field = Model._meta.get_field(field_name)
            except Exception:
                continue
            if isinstance(field, m.ManyToManyField):
                continue
            # For FK fields, use the attname (e.g. organization_id) not the name
            if isinstance(field, m.ForeignKey):
                cleaned[field.attname] = value
            else:
                cleaned[field_name] = value

        try:
            obj = Model.objects.get(pk=pk)
            for k, v in cleaned.items():
                setattr(obj, k, v)
            obj.save()
            return obj, False
        except Model.DoesNotExist:
            obj = Model(pk=pk, **cleaned)
            obj.save()
            return obj, True

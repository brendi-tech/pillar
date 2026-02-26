"""
Management command to bootstrap a demo product with a sync secret.

Creates (or reuses) a user, organization, product, and sync secret,
then writes the secret to a .env file in the target demo directory.

Usage:
    uv run python manage.py setup_demo_product \\
        --slug twenty \\
        --name "Twenty CRM" \\
        --email demo-twenty@trypillar.com \\
        --output ../../demos/twenty-copilot/.env
"""
import secrets
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.products.models import Product
from apps.products.models.sync_secret import SyncSecret
from apps.users.models import User, Organization, OrganizationMembership


class Command(BaseCommand):
    help = 'Create a demo product with a sync secret and write credentials to a .env file'

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            '--slug',
            required=True,
            help='Product subdomain / slug (e.g. "twenty")',
        )
        parser.add_argument(
            '--name',
            default='',
            help='Product display name (defaults to slug)',
        )
        parser.add_argument(
            '--email',
            default='',
            help='Email for the owner user (defaults to demo-{slug}@trypillar.com)',
        )
        parser.add_argument(
            '--output',
            default='',
            help='Path to write .env file with PILLAR_SLUG and PILLAR_SECRET',
        )

    def handle(self, *args, **options) -> None:
        slug: str = options['slug'].lower().strip()
        name: str = options['name'] or slug.title()
        email: str = options['email'] or f'demo-{slug}@trypillar.com'
        output: str = options['output']

        # 1. User
        user, user_created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email,
                'full_name': f'{name} Demo',
                'is_active': True,
            },
        )
        if user_created:
            user.set_password(secrets.token_urlsafe(16))
            user.save()
            self.stdout.write(f'  Created user: {email}')
        else:
            self.stdout.write(f'  Reusing user: {email}')

        # 2. Organization
        org = user.organizations.first()
        if not org:
            org = Organization.objects.create(name=f'{name} Demo')
            OrganizationMembership.objects.create(
                organization=org,
                user=user,
                role=OrganizationMembership.Role.ADMIN,
            )
            self.stdout.write(f'  Created organization: {org.name}')
        else:
            self.stdout.write(f'  Reusing organization: {org.name}')

        # 3. Product
        product, prod_created = Product.objects.get_or_create(
            subdomain=slug,
            defaults={
                'organization': org,
                'name': name,
                'is_default': True,
            },
        )
        if prod_created:
            self.stdout.write(f'  Created product: {product.name} (slug={slug})')
        else:
            self.stdout.write(f'  Reusing product: {product.name} (slug={slug})')

        # 4. Sync secret — always append a new one (up to 10 per product)
        existing = product.sync_secrets.count()
        if existing >= 10:
            self.stderr.write(self.style.WARNING(
                f'  Product already has {existing} secrets (max 10). '
                f'Delete one first via the admin UI.'
            ))
            secret_name = None
            raw_secret = None
        else:
            # Pick a unique name: demo, demo-2, demo-3, ...
            secret_name = 'demo'
            counter = 2
            existing_names = set(
                product.sync_secrets.values_list('name', flat=True)
            )
            while secret_name in existing_names:
                secret_name = f'demo-{counter}'
                counter += 1

            raw_secret = 'plr_' + secrets.token_hex(32)
            SyncSecret.objects.create(
                product=product,
                organization=product.organization,
                name=secret_name,
                secret_hash=raw_secret,
                created_by=user,
            )
            self.stdout.write(f'  Generated sync secret: {secret_name} ({existing + 1}/10)')

        # 5. Write .env
        if not raw_secret:
            self.stdout.write(self.style.WARNING(
                f'\nProduct "{slug}" exists but no new secret was created.'
            ))
            return

        if output:
            env_path = Path(output)
            if not env_path.is_absolute():
                env_path = Path.cwd() / env_path

            env_content = (
                f'PILLAR_SLUG={slug}\n'
                f'PILLAR_SECRET={raw_secret}\n'
            )
            env_path.write_text(env_content)
            self.stdout.write(f'  Wrote credentials to: {env_path}')
        else:
            self.stdout.write(f'\n  PILLAR_SLUG={slug}')
            self.stdout.write(f'  PILLAR_SECRET={raw_secret}')
            self.stdout.write('  (pass --output <path> to write to a .env file)')

        self.stdout.write(self.style.SUCCESS(f'\nDone. Product "{slug}" is ready for action sync.'))

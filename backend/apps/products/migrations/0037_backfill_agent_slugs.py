"""
Backfill slug for all existing agents.

- Web agents: use their product's subdomain as the slug (preserves existing SDK installs)
- Non-web agents: generate from agent name
- Handles conflicts with suffix fallback
"""
import re
import random
import string

from django.db import migrations


def _sanitize(text: str) -> str:
    text = text.lower().replace(' ', '-').replace('_', '-').replace("'", '')
    text = re.sub(r'[^a-z0-9-]', '', text)
    text = re.sub(r'-+', '-', text).strip('-')
    return text[:50]


def _ensure_unique(base: str, existing: set) -> str:
    if base not in existing:
        return base
    for _ in range(10):
        chars = string.ascii_lowercase + string.digits
        suffix = ''.join(random.choices(chars, k=3))
        candidate = f"{base}-{suffix}"
        if candidate not in existing:
            return candidate
    counter = 2
    while counter <= 100:
        candidate = f"{base}-{counter}"
        if candidate not in existing:
            return candidate
        counter += 1
    import uuid
    return f"{base[:40]}-{uuid.uuid4().hex[:6]}"


def forwards(apps, schema_editor):
    Agent = apps.get_model('products', 'Agent')

    used_slugs = set(
        Agent.objects.exclude(slug__isnull=True)
        .exclude(slug='')
        .values_list('slug', flat=True)
    )

    agents_needing_slug = Agent.objects.filter(slug__isnull=True) | Agent.objects.filter(slug='')
    updated = 0

    for agent in agents_needing_slug.select_related('product'):
        if agent.channel == 'web' and agent.product and agent.product.subdomain:
            base = agent.product.subdomain
        else:
            base = _sanitize(agent.name)

        if len(base) < 3:
            base = f"agent-{base}" if base else "agent"

        slug = _ensure_unique(base, used_slugs)
        used_slugs.add(slug)

        agent.slug = slug
        agent.save(update_fields=['slug'])
        updated += 1

    if updated:
        print(f"  Backfilled slugs for {updated} agent(s).")


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0036_add_agent_slug"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]

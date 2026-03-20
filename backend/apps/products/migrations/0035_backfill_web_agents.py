"""
Backfill web agents for products that don't have one.

Migration 0032 created web agents for products that existed at that time.
Products created after 0032 (but before the post_save signal was added)
may be missing a web agent. This fills the gap.
"""
from django.db import migrations


def forwards(apps, schema_editor):
    Product = apps.get_model('products', 'Product')
    Agent = apps.get_model('products', 'Agent')

    products_without_web_agent = Product.objects.exclude(
        agents__channel='web',
    )

    created = 0
    for product in products_without_web_agent.select_related('organization'):
        config = product.config or {}
        ai = config.get('ai', {})

        Agent.objects.create(
            organization=product.organization,
            product=product,
            name=ai.get('assistantName') or product.name,
            channel='web',
            is_active=True,
        )
        created += 1

    if created:
        print(f"  Created {created} web agent(s) for products missing one.")


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0034_agent_knowledge_scope_agent_knowledge_sources"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]

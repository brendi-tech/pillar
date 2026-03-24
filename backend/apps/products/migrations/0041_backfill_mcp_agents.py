"""
Backfill MCP agents for products that don't have one.

Every product should have a channel='mcp' agent (the default MCP server).
Products created after this migration will get one via the post_save signal.
"""
from django.db import migrations


def forwards(apps, schema_editor):
    Product = apps.get_model('products', 'Product')
    Agent = apps.get_model('products', 'Agent')

    products_without_mcp_agent = Product.objects.exclude(
        agents__channel='mcp',
    )

    created = 0
    for product in products_without_mcp_agent.select_related('organization'):
        Agent.objects.create(
            organization=product.organization,
            product=product,
            name=f"{product.name} MCP",
            channel='mcp',
            is_active=True,
            include_suggested_followups=False,
        )
        created += 1

    if created:
        print(f"  Created {created} MCP agent(s) for products missing one.")


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0040_agent_mcp_domain_alter_agent_channel"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]

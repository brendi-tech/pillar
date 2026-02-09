# Generated migration to drop Tooltip table
# This model is no longer used

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0011_alter_tooltip_knowledge_item'),
    ]

    operations = [
        migrations.DeleteModel(
            name='Tooltip',
        ),
    ]

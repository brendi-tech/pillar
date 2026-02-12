# Drop orphaned 'guidance' column from products_action.
# This column was added outside of Django migrations and has a NOT NULL
# constraint that breaks the action sync workflow.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0018_alter_action_id_alter_actiondeployment_id_and_more"),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE products_action DROP COLUMN IF EXISTS guidance;",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]

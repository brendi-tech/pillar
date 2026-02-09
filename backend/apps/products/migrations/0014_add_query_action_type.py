# Generated manually for query action type support
# Adding 'query' to ActionType choices
#
# Note: Since action_type is a CharField (not a DB-level ENUM), this migration
# is primarily for documentation. The new 'query' choice is automatically
# available once the model code is updated.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0013_add_sdk_last_initialized_at'),
    ]

    operations = [
        # Update action_type choices to include 'query'
        # This is a no-op for the database (CharField stores any string),
        # but documents the addition of the new action type.
        migrations.AlterField(
            model_name='action',
            name='action_type',
            field=models.CharField(
                choices=[
                    ('navigate', 'Navigate to Page'),
                    ('open_modal', 'Open Modal/Dialog'),
                    ('fill_form', 'Fill Form Fields'),
                    ('trigger_action', 'Trigger Custom Action'),
                    ('copy_text', 'Copy to Clipboard'),
                    ('external_link', 'Open External Link'),
                    ('start_tutorial', 'Start Tutorial/Walkthrough'),
                    ('inline_ui', 'Inline UI Card'),
                    ('query', 'Query Data'),  # NEW: Fetch data from client
                ],
                default='trigger_action',
                help_text='Type of action this action performs',
                max_length=50,
            ),
        ),
    ]

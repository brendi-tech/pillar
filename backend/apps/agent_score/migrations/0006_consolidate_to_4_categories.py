"""
Consolidate from 5+2 categories to 4 unified categories.

- Remove: discovery_score, readability_score, interactability_score,
          permissions_score, accessibility_score
- Add: content_score, interaction_score
- Update AgentScoreCheck.category choices to 4 options
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("agent_score", "0005_add_scan_notes"),
    ]

    operations = [
        # Add new score fields
        migrations.AddField(
            model_name="agentscorereport",
            name="content_score",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="agentscorereport",
            name="interaction_score",
            field=models.IntegerField(blank=True, null=True),
        ),
        # Remove old score fields
        migrations.RemoveField(
            model_name="agentscorereport",
            name="discovery_score",
        ),
        migrations.RemoveField(
            model_name="agentscorereport",
            name="readability_score",
        ),
        migrations.RemoveField(
            model_name="agentscorereport",
            name="interactability_score",
        ),
        migrations.RemoveField(
            model_name="agentscorereport",
            name="permissions_score",
        ),
        migrations.RemoveField(
            model_name="agentscorereport",
            name="accessibility_score",
        ),
        # Update category choices on AgentScoreCheck
        migrations.AlterField(
            model_name="agentscorecheck",
            name="category",
            field=models.CharField(
                choices=[
                    ("content", "Content"),
                    ("interaction", "Interaction"),
                    ("webmcp", "WebMCP"),
                    ("signup_test", "Signup Test"),
                ],
                help_text="Scoring category this check belongs to",
                max_length=30,
            ),
        ),
    ]

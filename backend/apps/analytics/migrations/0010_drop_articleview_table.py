# Generated migration to drop ArticleView table
# This model was never populated and is being removed

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('analytics', '0009_rename_analytics_a_knowled_ce7603_idx_analytics_a_article_ce7603_idx_and_more'),
    ]

    operations = [
        migrations.DeleteModel(
            name='ArticleView',
        ),
    ]

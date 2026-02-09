# Generated manually for ActionSyncJob model

import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0005_add_action_examples"),
    ]

    operations = [
        migrations.CreateModel(
            name="ActionSyncJob",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "platform",
                    models.CharField(
                        choices=[
                            ("web", "Web"),
                            ("ios", "iOS"),
                            ("android", "Android"),
                            ("desktop", "Desktop"),
                        ],
                        db_index=True,
                        help_text="Platform this sync is for",
                        max_length=20,
                    ),
                ),
                (
                    "version",
                    models.CharField(
                        db_index=True,
                        help_text="Semantic version or git SHA (e.g., '1.2.3' or 'abc123')",
                        max_length=50,
                    ),
                ),
                (
                    "git_sha",
                    models.CharField(
                        blank=True,
                        help_text="Git commit SHA for this sync",
                        max_length=40,
                    ),
                ),
                (
                    "manifest_hash",
                    models.CharField(
                        db_index=True,
                        help_text="SHA256 hash of the action manifest for deduplication",
                        max_length=64,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("processing", "Processing"),
                            ("completed", "Completed"),
                            ("failed", "Failed"),
                        ],
                        db_index=True,
                        default="pending",
                        help_text="Current status of the sync job",
                        max_length=20,
                    ),
                ),
                (
                    "progress",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Progress tracking: {total, processed, created, updated, deleted}",
                    ),
                ),
                (
                    "error_message",
                    models.TextField(
                        blank=True, help_text="Error message if job failed"
                    ),
                ),
                (
                    "is_complete",
                    models.BooleanField(
                        db_index=True,
                        default=False,
                        help_text="True only when ALL steps completed successfully (actions, embeddings, deployment)",
                    ),
                ),
                (
                    "started_at",
                    models.DateTimeField(
                        blank=True,
                        help_text="When processing started",
                        null=True,
                    ),
                ),
                (
                    "completed_at",
                    models.DateTimeField(
                        blank=True,
                        help_text="When job completed (successfully or failed)",
                        null=True,
                    ),
                ),
                (
                    "organization",
                    models.ForeignKey(
                        help_text="Organization that owns this data",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="%(app_label)s_%(class)s_set",
                        to="users.organization",
                    ),
                ),
                (
                    "product",
                    models.ForeignKey(
                        help_text="Product this sync job belongs to",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="action_sync_jobs",
                        to="products.product",
                    ),
                ),
                (
                    "deployment",
                    models.ForeignKey(
                        blank=True,
                        help_text="Deployment created by this sync job (if successful)",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="sync_jobs",
                        to="products.actiondeployment",
                    ),
                ),
            ],
            options={
                "verbose_name": "Action Sync Job",
                "verbose_name_plural": "Action Sync Jobs",
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(
                        fields=["product", "status"],
                        name="products_ac_product_status_idx",
                    ),
                    models.Index(
                        fields=["product", "platform", "version"],
                        name="products_ac_product_platform_version_idx",
                    ),
                    models.Index(
                        fields=["manifest_hash"],
                        name="products_ac_manifest_hash_idx",
                    ),
                    models.Index(
                        fields=["organization", "status"],
                        name="products_ac_organization_status_idx",
                    ),
                    models.Index(
                        fields=["is_complete"],
                        name="products_ac_is_complete_idx",
                    ),
                ],
            },
        ),
    ]

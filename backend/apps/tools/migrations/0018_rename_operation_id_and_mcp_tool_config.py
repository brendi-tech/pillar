"""Rename OpenAPIOperationConfig.operation_id -> tool_name and create MCPToolConfig."""

import django.db.models.deletion
import uuid_utils.compat
from django.db import migrations, models


def backfill_mcp_tool_configs(apps, schema_editor):
    """Create MCPToolConfig rows from existing MCPToolSource.discovered_tools."""
    MCPToolSource = apps.get_model("tools", "MCPToolSource")
    MCPToolConfig = apps.get_model("tools", "MCPToolConfig")
    db_alias = schema_editor.connection.alias

    objs = []
    for source in MCPToolSource.objects.using(db_alias).all():
        for tool_def in source.discovered_tools or []:
            name = tool_def.get("name")
            if not name:
                continue
            annotations = tool_def.get("annotations", {}) or {}
            if annotations.get("readOnlyHint") is True:
                requires_confirmation = False
            elif annotations.get("destructiveHint") is True:
                requires_confirmation = True
            else:
                requires_confirmation = False
            objs.append(MCPToolConfig(
                mcp_source=source,
                tool_name=name,
                is_enabled=True,
                requires_confirmation=requires_confirmation,
            ))
    if objs:
        MCPToolConfig.objects.using(db_alias).bulk_create(objs, ignore_conflicts=True)


class Migration(migrations.Migration):

    dependencies = [
        ("tools", "0017_add_openapi_operation_config"),
    ]

    operations = [
        # Rename operation_id -> tool_name on OpenAPIOperationConfig
        migrations.RenameField(
            model_name="openapioperationconfig",
            old_name="operation_id",
            new_name="tool_name",
        ),
        # The unique constraint name stays the same (Django handles the column rename),
        # but we need to update the constraint fields reference.
        # Remove old constraint and add new one with updated field name.
        migrations.RemoveConstraint(
            model_name="openapioperationconfig",
            name="openapi_op_config_uniq",
        ),
        migrations.AddConstraint(
            model_name="openapioperationconfig",
            constraint=models.UniqueConstraint(
                fields=["openapi_source", "tool_name"],
                name="openapi_op_config_uniq",
            ),
        ),
        # Create MCPToolConfig
        migrations.CreateModel(
            name="MCPToolConfig",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid_utils.compat.uuid7,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("tool_name", models.CharField(max_length=255)),
                ("is_enabled", models.BooleanField(default=True)),
                ("requires_confirmation", models.BooleanField(default=False)),
                (
                    "mcp_source",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tool_configs",
                        to="tools.mcptoolsource",
                    ),
                ),
            ],
            options={
                "verbose_name": "MCP Tool Config",
                "verbose_name_plural": "MCP Tool Configs",
            },
        ),
        migrations.AddConstraint(
            model_name="mcptoolconfig",
            constraint=models.UniqueConstraint(
                fields=["mcp_source", "tool_name"],
                name="mcp_tool_config_uniq",
            ),
        ),
        migrations.AddIndex(
            model_name="mcptoolconfig",
            index=models.Index(
                fields=["mcp_source"],
                name="mcp_toolconfig_source_idx",
            ),
        ),
        # Backfill MCPToolConfig from existing discovered_tools
        migrations.RunPython(
            backfill_mcp_tool_configs,
            migrations.RunPython.noop,
        ),
    ]

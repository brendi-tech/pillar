"""Rename AgentOpenAPIOperationOverride.operation_id -> tool_name,
create AgentMCPSource + AgentMCPToolOverride, and migrate Agent.mcp_sources
from plain M2M to through-table M2M."""

import django.db.models.deletion
import uuid_utils.compat
from django.db import migrations, models


def copy_implicit_mcp_m2m(apps, schema_editor):
    """Copy rows from the implicit M2M junction table into AgentMCPSource."""
    AgentMCPSource = apps.get_model("products", "AgentMCPSource")
    db_alias = schema_editor.connection.alias

    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_name = 'products_agent_mcp_sources' "
            "AND table_schema = 'public'"
        )
        if not cursor.fetchone():
            return
        cursor.execute(
            "SELECT agent_id, mcptoolsource_id "
            "FROM products_agent_mcp_sources"
        )
        rows = cursor.fetchall()

    objs = [
        AgentMCPSource(agent_id=agent_id, mcp_source_id=source_id)
        for agent_id, source_id in rows
    ]
    if objs:
        AgentMCPSource.objects.using(db_alias).bulk_create(objs)


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0045_relational_openapi_overrides"),
        ("tools", "0018_rename_operation_id_and_mcp_tool_config"),
    ]

    operations = [
        # 1. Rename operation_id -> tool_name on AgentOpenAPIOperationOverride
        migrations.RenameField(
            model_name="agentopenapioperationoverride",
            old_name="operation_id",
            new_name="tool_name",
        ),
        migrations.RemoveConstraint(
            model_name="agentopenapioperationoverride",
            name="agent_openapi_op_override_uniq",
        ),
        migrations.AddConstraint(
            model_name="agentopenapioperationoverride",
            constraint=models.UniqueConstraint(
                fields=["agent_openapi_source", "tool_name"],
                name="agent_openapi_op_override_uniq",
            ),
        ),

        # 2. Create AgentMCPSource through table
        migrations.CreateModel(
            name="AgentMCPSource",
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
                (
                    "agent",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="agent_mcp_configs",
                        to="products.agent",
                    ),
                ),
                (
                    "mcp_source",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="agent_configs",
                        to="tools.mcptoolsource",
                    ),
                ),
            ],
            options={
                "verbose_name": "Agent MCP Source Config",
                "verbose_name_plural": "Agent MCP Source Configs",
            },
        ),
        migrations.AddConstraint(
            model_name="agentmcpsource",
            constraint=models.UniqueConstraint(
                fields=["agent", "mcp_source"],
                name="agent_mcp_src_uniq",
            ),
        ),
        migrations.AddIndex(
            model_name="agentmcpsource",
            index=models.Index(
                fields=["agent"],
                name="agentmcp_agent_idx",
            ),
        ),

        # 3. Create AgentMCPToolOverride
        migrations.CreateModel(
            name="AgentMCPToolOverride",
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
                ("is_enabled", models.BooleanField(blank=True, null=True)),
                ("requires_confirmation", models.BooleanField(blank=True, null=True)),
                (
                    "agent_mcp_source",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tool_overrides",
                        to="products.agentmcpsource",
                    ),
                ),
            ],
            options={
                "verbose_name": "Agent MCP Tool Override",
                "verbose_name_plural": "Agent MCP Tool Overrides",
            },
        ),
        migrations.AddConstraint(
            model_name="agentmcptooloverride",
            constraint=models.UniqueConstraint(
                fields=["agent_mcp_source", "tool_name"],
                name="agent_mcp_tool_override_uniq",
            ),
        ),
        migrations.AddIndex(
            model_name="agentmcptooloverride",
            index=models.Index(
                fields=["agent_mcp_source"],
                name="agentmcp_override_src_idx",
            ),
        ),

        # 4. Copy implicit M2M data before removing the old field
        migrations.RunPython(
            copy_implicit_mcp_m2m,
            migrations.RunPython.noop,
        ),

        # 5. Remove + re-add Agent.mcp_sources with through=
        migrations.RemoveField(
            model_name="agent",
            name="mcp_sources",
        ),
        migrations.AddField(
            model_name="agent",
            name="mcp_sources",
            field=models.ManyToManyField(
                blank=True,
                help_text="External MCP servers whose tools this agent can use.",
                related_name="agents",
                through="products.AgentMCPSource",
                to="tools.mcptoolsource",
            ),
        ),
    ]

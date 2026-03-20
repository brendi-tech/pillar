"""Write/mutation tools — available on all channels."""
from __future__ import annotations

import logging
from typing import Any

from pillar import ToolContext

from apps.mcp.services.agent.channels import Channel
from apps.tools.pillar_tools import pillar
from apps.tools.pillar_tools._resolve import resolve_product

logger = logging.getLogger(__name__)


async def _patch_config(product: Any, path: list[str], value: Any) -> None:
    """Update a nested key in product.config and save."""
    config = dict(product.config or {})
    target = config
    for key in path[:-1]:
        target = target.setdefault(key, {})
    target[path[-1]] = value
    product.config = config
    await product.asave(update_fields=["config"])


# ---------------------------------------------------------------------------
# Branding / AI config mutations
# ---------------------------------------------------------------------------


@pillar.tool(
    description=(
        "Update the brand name displayed in the help center. "
        "Use when user wants to change their company name, brand name, "
        "or help center title. This saves immediately."
    ),
    channel_compatibility=Channel.ALL,
)
async def update_brand_name(name: str, ctx: ToolContext) -> dict:
    if not name or not name.strip():
        raise ValueError("Name is required")
    product = await resolve_product(ctx)
    await _patch_config(product, ["branding", "name"], name.strip())
    return {"success": True, "message": f'Brand name updated to "{name.strip()}"'}



@pillar.tool(
    description=(
        "Update the AI assistant's display name shown in the chat widget. "
        "Use when user wants to rename the chatbot, change the assistant name, "
        "or personalize the AI identity. This saves immediately."
    ),
    channel_compatibility=Channel.ALL,
)
async def update_ai_assistant_name(name: str, ctx: ToolContext) -> dict:
    if not name or not name.strip():
        raise ValueError("Name is required")
    product = await resolve_product(ctx)
    await _patch_config(product, ["ai", "assistantName"], name.strip())
    return {"success": True, "message": f'AI assistant name updated to "{name.strip()}"'}


@pillar.tool(
    description=(
        "Update the welcome message shown when users open the AI chat. "
        "Use when user wants to change the greeting, update the intro message, "
        "or customize how the AI introduces itself. This saves immediately."
    ),
    channel_compatibility=Channel.ALL,
)
async def update_ai_welcome_message(message: str, ctx: ToolContext) -> dict:
    if not message or not message.strip():
        raise ValueError("Message is required")
    product = await resolve_product(ctx)
    await _patch_config(product, ["ai", "welcomeMessage"], message.strip())
    return {"success": True, "message": "Welcome message updated"}


@pillar.tool(
    description=(
        "Set the suggested questions that appear in the AI chat widget. "
        "Use when user wants to configure starter questions, conversation starters, "
        "or example queries. This saves immediately."
    ),
    channel_compatibility=Channel.ALL,
)
async def set_suggested_questions(questions: list[str], ctx: ToolContext) -> dict:
    if not questions or not isinstance(questions, list) or len(questions) == 0:
        raise ValueError("At least one question is required")
    cleaned = [q.strip() for q in questions if q.strip()]
    product = await resolve_product(ctx)
    await _patch_config(product, ["ai", "suggestedQuestions"], cleaned)
    return {"success": True, "message": f"Set {len(cleaned)} suggested questions"}


@pillar.tool(
    description=(
        "Update the fallback message shown when the AI cannot answer a question. "
        "Use when user wants to customize what happens when the AI doesn't know, "
        "or change the escalation message. This saves immediately."
    ),
    channel_compatibility=Channel.ALL,
)
async def update_fallback_message(message: str, ctx: ToolContext) -> dict:
    if not message or not message.strip():
        raise ValueError("Message is required")
    product = await resolve_product(ctx)
    await _patch_config(product, ["ai", "fallbackMessage"], message.strip())
    return {"success": True, "message": "Fallback message updated"}


# ---------------------------------------------------------------------------
# Knowledge source operations
# ---------------------------------------------------------------------------


@pillar.tool(
    description=(
        "Trigger a re-sync for a knowledge source to refresh content. "
        "Use when user wants to update content, refresh docs, re-crawl a website, "
        "or sync the latest changes from a source. "
        "Call list_sources first if source_id is unknown."
    ),
    channel_compatibility=Channel.ALL,
)
async def resync_source(source_id: str, ctx: ToolContext) -> dict:
    from django.utils import timezone

    from apps.knowledge.models import KnowledgeSource, KnowledgeSyncHistory
    from common.task_router import TaskRouter

    product = await resolve_product(ctx)
    source = await KnowledgeSource.objects.filter(
        product=product, id=source_id,
    ).afirst()
    if not source:
        raise ValueError(f"Source {source_id} not found")

    if source.source_type == KnowledgeSource.SourceType.SNIPPETS:
        raise ValueError("Snippet sources cannot be synced")

    if source.status == KnowledgeSource.Status.SYNCING:
        raise ValueError("Source is already syncing")

    sync_history_id = None
    if source.source_type in (
        KnowledgeSource.SourceType.HELP_CENTER,
        KnowledgeSource.SourceType.MARKETING_SITE,
        KnowledgeSource.SourceType.WEBSITE_CRAWL,
    ):
        sync_history = await KnowledgeSyncHistory.objects.acreate(
            organization=source.organization,
            source=source,
            sync_type=KnowledgeSyncHistory.SyncType.FULL,
            status=KnowledgeSyncHistory.Status.RUNNING,
            started_at=timezone.now(),
        )
        sync_history_id = str(sync_history.id)

    TaskRouter.execute(
        "knowledge-sync-source",
        source_id=str(source.id),
        organization_id=str(source.organization_id),
        sync_history_id=sync_history_id,
    )

    source.status = KnowledgeSource.Status.SYNCING
    await source.asave(update_fields=["status"])

    return {"success": True, "message": "Sync started successfully"}


@pillar.tool(
    description=(
        "Delete a knowledge source and remove all its content from the knowledge base. "
        "This is a destructive action that cannot be undone. "
        "Use when user wants to remove a source, disconnect an integration, "
        "or delete imported content."
    ),
    channel_compatibility=Channel.ALL,
)
async def delete_source(source_id: str, ctx: ToolContext) -> dict:
    from apps.knowledge.models import KnowledgeSource

    product = await resolve_product(ctx)
    deleted_count, _ = await (
        KnowledgeSource.objects
        .filter(product=product, id=source_id)
        .adelete()
    )
    if deleted_count == 0:
        raise ValueError(f"Source {source_id} not found")
    return {"success": True, "message": "Source deleted successfully"}


# ---------------------------------------------------------------------------
# Team management
# ---------------------------------------------------------------------------


@pillar.tool(
    description=(
        "Invite team members by email. "
        "Use when user wants to invite someone, add a team member, or send an invite."
    ),
    channel_compatibility=Channel.ALL,
)
async def invite_members(emails: list[str], ctx: ToolContext, role: str = "member") -> dict:
    from apps.users.models import OrganizationInvitation, OrganizationMembership
    from apps.users.models import User

    product = await resolve_product(ctx)
    org = product.organization
    results = []

    for email_addr in emails:
        email_addr = email_addr.strip().lower()
        if not email_addr:
            continue

        existing_user = await User.objects.filter(email=email_addr).afirst()
        if existing_user:
            already_member = await OrganizationMembership.objects.filter(
                organization=org, user=existing_user,
            ).aexists()
            if already_member:
                results.append({"email": email_addr, "status": "already_member"})
                continue

        has_pending = await OrganizationInvitation.objects.filter(
            organization=org, email=email_addr,
            status=OrganizationInvitation.Status.PENDING,
        ).aexists()
        if has_pending:
            results.append({"email": email_addr, "status": "already_invited"})
            continue

        await OrganizationInvitation.objects.acreate(
            organization=org,
            email=email_addr,
            role=role,
        )

        try:
            from apps.users.services.email_service import send_organization_invitation_email

            invitation = await OrganizationInvitation.objects.filter(
                organization=org, email=email_addr,
                status=OrganizationInvitation.Status.PENDING,
            ).order_by("-created_at").afirst()
            if invitation:
                send_organization_invitation_email(
                    email=email_addr,
                    token=str(invitation.token),
                    organization_name=org.name,
                    invited_by_name="Team Admin",
                )
        except Exception:
            logger.exception("Failed to send invitation email to %s", email_addr)

        results.append({"email": email_addr, "status": "invited"})

    return {
        "results": results,
        "invited_count": sum(1 for r in results if r["status"] == "invited"),
    }


# ---------------------------------------------------------------------------
# API key management
# ---------------------------------------------------------------------------


@pillar.tool(
    description=(
        "Generate a new API key (sync secret) for the current project. "
        "Always provide a name -- do NOT ask the user for one. If they specified "
        "a name, use it. Otherwise pick a sensible default like 'default'."
    ),
    channel_compatibility=Channel.ALL,
    output_schema={
        "type": "object",
        "properties": {
            "secret": {"type": "string", "sensitive": True},
            "name": {"type": "string"},
            "id": {"type": "string"},
        },
    },
)
async def generate_api_key(name: str, ctx: ToolContext) -> dict:
    import re
    import secrets as secrets_mod

    from apps.products.models import SyncSecret

    product = await resolve_product(ctx)
    clean_name = re.sub(r"[^a-z0-9-]", "", (name or "default").strip().lower())
    if not clean_name:
        clean_name = "default"

    raw_secret = f"sk_live_{secrets_mod.token_urlsafe(32)}"
    secret_obj = await SyncSecret.objects.acreate(
        product=product,
        organization=product.organization,
        name=clean_name,
        secret_hash=raw_secret,
        last_four=raw_secret[-4:],
    )
    return {
        "id": str(secret_obj.id),
        "name": clean_name,
        "secret": raw_secret,
    }

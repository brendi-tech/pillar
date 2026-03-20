"""Read-only query tools — available on all channels."""
from __future__ import annotations

from pillar import ToolContext

from apps.mcp.services.agent.channels import Channel
from apps.tools.pillar_tools import pillar
from apps.tools.pillar_tools._resolve import resolve_product


@pillar.tool(
    description=(
        "Get the list of configured knowledge sources. "
        "Returns source IDs, names, types, and sync status. "
        "Call this before suggesting source-specific tools to know what exists."
    ),
    channel_compatibility=Channel.ALL,
)
async def list_sources(ctx: ToolContext) -> dict:
    from apps.knowledge.models import KnowledgeSource

    product = await resolve_product(ctx)
    sources = []
    async for s in (
        KnowledgeSource.objects
        .filter(product=product)
        .order_by("-created_at")
        .aiterator()
    ):
        sources.append({
            "id": str(s.id),
            "name": s.name,
            "type": s.source_type,
            "status": s.status,
            "last_synced": s.last_synced_at.isoformat() if s.last_synced_at else None,
            "item_count": s.item_count,
        })
    return {"sources": sources, "count": len(sources)}


@pillar.tool(
    description=(
        "Get detailed sync status for a knowledge source. "
        "Returns last sync time, item count, errors, and status. "
        "Call this when user asks about sync status or content freshness."
    ),
    channel_compatibility=Channel.ALL,
)
async def get_source_sync_status(source_id: str, ctx: ToolContext) -> dict:
    from apps.knowledge.models import KnowledgeSource

    product = await resolve_product(ctx)
    source = await KnowledgeSource.objects.filter(
        product=product, id=source_id,
    ).afirst()
    if not source:
        raise ValueError(f"Source {source_id} not found")
    return {
        "id": str(source.id),
        "name": source.name,
        "type": source.source_type,
        "status": source.status,
        "last_synced_at": source.last_synced_at.isoformat() if source.last_synced_at else None,
        "item_count": source.item_count,
        "error_message": source.error_message or None,
    }


@pillar.tool(
    description=(
        "Get the list of team members and pending invitations. "
        "Returns member emails, roles, and status. "
        "Call this before suggesting invite or role-change tools."
    ),
    channel_compatibility=Channel.ALL,
)
async def list_team_members(ctx: ToolContext) -> dict:
    from apps.users.models import OrganizationInvitation, OrganizationMembership

    product = await resolve_product(ctx)
    org = product.organization

    members = []
    async for m in (
        OrganizationMembership.objects
        .filter(organization=org)
        .select_related("user")
        .aiterator()
    ):
        members.append({
            "email": m.user.email,
            "name": m.user.get_full_name() or m.user.email,
            "role": m.role,
        })

    pending = []
    async for inv in (
        OrganizationInvitation.objects
        .filter(organization=org, status=OrganizationInvitation.Status.PENDING)
        .aiterator()
    ):
        pending.append({
            "email": inv.email,
            "role": inv.role,
            "invited_at": inv.created_at.isoformat(),
        })

    return {
        "members": members,
        "pending_invitations": pending,
        "member_count": len(members),
        "pending_count": len(pending),
    }


@pillar.tool(
    description=(
        "Get AI conversation statistics for the past 30 days. "
        "Returns total conversations, resolution rate, and top questions. "
        "Call this when user asks about usage, performance, or analytics."
    ),
    channel_compatibility=Channel.ALL,
)
async def get_conversation_stats(ctx: ToolContext) -> dict:
    from datetime import timedelta

    from django.db.models import Count
    from django.utils import timezone

    from apps.analytics.models import ChatConversation, ChatMessage

    product = await resolve_product(ctx)
    end = timezone.now()
    start = end - timedelta(days=30)

    conversations = ChatConversation.objects.filter(
        organization=product.organization,
        started_at__gte=start,
        started_at__lte=end,
        product=product,
    )
    total = await conversations.acount()
    resolved = await conversations.filter(status=ChatConversation.Status.RESOLVED).acount()
    escalated = await conversations.filter(status=ChatConversation.Status.ESCALATED).acount()

    resolution_rate = round(resolved / total * 100, 1) if total else 0

    messages = ChatMessage.objects.filter(
        organization=product.organization,
        conversation__in=conversations,
    )
    total_messages = await messages.acount()
    avg_messages = round(total_messages / total, 1) if total else 0

    top_questions_qs = (
        messages.filter(role=ChatMessage.Role.USER)
        .values("content")
        .annotate(count=Count("id"))
        .order_by("-count")[:5]
    )
    top_questions = [
        {"question": q["content"], "count": q["count"]}
        async for q in top_questions_qs
    ]

    return {
        "total_conversations": total,
        "resolution_rate": resolution_rate,
        "escalated": escalated,
        "avg_messages_per_chat": avg_messages,
        "top_questions": top_questions,
        "period": "last_30_days",
    }


@pillar.tool(
    description=(
        "Get the current product configuration. "
        "Returns brand name, features enabled, and AI settings. "
        "Call this when user asks about settings or configuration."
    ),
    channel_compatibility=Channel.ALL,
)
async def get_product_settings(ctx: ToolContext) -> dict:
    product = await resolve_product(ctx)
    config = product.config or {}
    return {
        "name": product.name,
        "subdomain": product.subdomain,
        "branding": config.get("branding"),
        "features": config.get("features"),
        "ai": config.get("ai"),
    }


@pillar.tool(
    description=(
        "Get the list of API keys (sync secrets) for the current project. "
        "Returns key names, creation dates, and last used dates. "
        "Call this when you need to reference keys by name."
    ),
    channel_compatibility=Channel.ALL,
)
async def list_api_keys(ctx: ToolContext) -> dict:
    from apps.products.models import SyncSecret

    product = await resolve_product(ctx)
    keys = []
    async for s in (
        SyncSecret.objects
        .filter(product=product, is_active=True)
        .order_by("-created_at")
        .aiterator()
    ):
        keys.append({
            "id": str(s.id),
            "name": s.name,
            "created_at": s.created_at.isoformat(),
            "last_used_at": s.last_used_at.isoformat() if s.last_used_at else None,
        })
    return {"keys": keys, "count": len(keys)}


@pillar.tool(
    description=(
        "Get the overall help center setup status. "
        "Returns what's configured and what's missing. "
        "Call this when helping with initial setup or onboarding."
    ),
    channel_compatibility=Channel.ALL,
)
async def get_help_center_status(ctx: ToolContext) -> dict:
    from apps.knowledge.models import KnowledgeSource

    product = await resolve_product(ctx)
    sources = KnowledgeSource.objects.filter(product=product)
    source_count = await sources.acount()
    has_website = await sources.filter(
        source_type=KnowledgeSource.SourceType.WEBSITE_CRAWL,
    ).aexists()
    has_cloud_storage = await sources.filter(
        source_type=KnowledgeSource.SourceType.CLOUD_STORAGE,
    ).aexists()
    return {
        "has_content": source_count > 0,
        "source_count": source_count,
        "has_website": has_website,
        "has_cloud_storage": has_cloud_storage,
        "setup_complete": source_count > 0,
    }


@pillar.tool(
    description=(
        "Get the list of custom instruction snippets. "
        "Returns snippet titles and excerpts. "
        "Call this when user asks about custom instructions or AI behavior customization."
    ),
    channel_compatibility=Channel.ALL,
)
async def list_snippets(ctx: ToolContext) -> dict:
    from apps.knowledge.models import KnowledgeItem

    product = await resolve_product(ctx)
    snippets = []
    async for s in (
        KnowledgeItem.objects
        .filter(
            source__product=product,
            item_type=KnowledgeItem.ItemType.SNIPPET,
            is_active=True,
        )
        .order_by("-created_at")
        .aiterator()
    ):
        snippets.append({
            "id": str(s.id),
            "title": s.title,
            "excerpt": s.excerpt or s.raw_content or "",
        })
    return {"snippets": snippets, "count": len(snippets)}


@pillar.tool(
    description=(
        "Get the list of defined tools for this product. "
        "Returns tool names, descriptions, and types. "
        "Call this when user asks what you can do or what tools are available."
    ),
    channel_compatibility=Channel.ALL,
)
async def list_tools(ctx: ToolContext) -> dict:
    from apps.products.models import Action

    product = await resolve_product(ctx)
    tools = []
    async for a in (
        Action.objects
        .filter(product=product, status=Action.Status.PUBLISHED)
        .order_by("name")
        .aiterator()
    ):
        tools.append({
            "name": a.name,
            "description": a.description,
            "type": a.action_type,
            "tool_type": a.tool_type,
        })
    return {"tools": tools, "count": len(tools)}

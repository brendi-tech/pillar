"""
Shared configuration for Hatchet workers.

This module defines the workflow list used by both:
- worker.py (local development)
- hatchet-worker-healthcheck.py (Cloud Run deployment)

Adding a workflow here automatically registers it in both environments.
"""

def get_all_workflows():
    """
    Get all workflow objects to register with Hatchet.
    
    Returns a list of Hatchet workflow objects.
    
    NOTE: This function must be called AFTER Django is setup,
    because workflows import Django models.
    """
    # Import knowledge workflows (unified content indexing and processing)
    from apps.knowledge.workflows import (
        sync_source_workflow,
        process_item_workflow,
        index_knowledge_item_workflow,
        delete_knowledge_item_index_workflow,
        start_async_crawl_workflow,
        poll_async_crawl_workflow,
        process_async_crawl_workflow,
        cleanup_pending_uploads_workflow,
        resync_active_sources_workflow,
    )
    
    # Import products workflows
    from apps.products.workflows.sync_actions import sync_actions_workflow
    
    
    # Import billing workflows (cron jobs for billing automation)
    from apps.billing.workflows import (
        early_adopter_bonus_workflow,
        free_tier_early_adopter_bonus_workflow,
    )

    # Import demos workflows
    from apps.demos.workflows import superset_reset_workflow
    
    # Import tools workflows (server-side tool infrastructure)
    from apps.tools.workflows import (
        endpoint_health_check_workflow,
        mcp_discovery_workflow,
        mcp_embed_descriptions_workflow,
        mcp_source_refresh_workflow,
    )
    from apps.tools.workflows.openapi_discovery import (
        openapi_embed_descriptions_workflow,
        openapi_refresh_tokens_workflow,
    )

    # Import Slack integration workflows
    from apps.integrations.slack.workflows.handle_message import handle_slack_message
    from apps.integrations.slack.workflows.account_link import handle_account_link
    from apps.integrations.slack.workflows.tool_oauth import handle_tool_oauth

    # Import Discord integration workflows
    from apps.integrations.discord.workflows.handle_message import handle_discord_message
    from apps.integrations.discord.workflows.account_link import handle_account_link as handle_discord_account_link

    # Import Email channel workflows
    from apps.integrations.email_channel.workflows.handle_email import handle_inbound_email

    # Import agent score workflows
    from apps.agent_score.workflows import (
        http_probes_workflow,
        browser_analysis_workflow,
        analyze_and_score_workflow,
        signup_test_workflow,
        finalize_report_workflow,
        openclaw_test_workflow,
    )
    
    return [
        # Knowledge app workflows (unified content system)
        sync_source_workflow,
        process_item_workflow,
        # Knowledge indexing workflows
        index_knowledge_item_workflow,
        delete_knowledge_item_index_workflow,
        # Async Firecrawl crawl workflows for large sites
        start_async_crawl_workflow,
        poll_async_crawl_workflow,
        process_async_crawl_workflow,
        # Cleanup workflows
        cleanup_pending_uploads_workflow,
        # Knowledge cron workflows
        resync_active_sources_workflow,
        # Products app workflows
        sync_actions_workflow,
        # Tools app workflows (server-side tool infrastructure)
        endpoint_health_check_workflow,
        mcp_discovery_workflow,
        mcp_embed_descriptions_workflow,
        mcp_source_refresh_workflow,
        # OpenAPI tool source workflows
        openapi_embed_descriptions_workflow,
        openapi_refresh_tokens_workflow,
        # Billing app workflows (cron jobs)
        early_adopter_bonus_workflow,
        free_tier_early_adopter_bonus_workflow,
        # Demos app workflows
        superset_reset_workflow,
        # Slack integration workflows
        handle_slack_message,
        handle_account_link,
        handle_tool_oauth,
        # Discord integration workflows
        handle_discord_message,
        handle_discord_account_link,
        # Email channel workflows
        handle_inbound_email,
        # Agent Score workflows (public scoring tool)
        http_probes_workflow,
        browser_analysis_workflow,
        analyze_and_score_workflow,
        signup_test_workflow,
        finalize_report_workflow,
        openclaw_test_workflow,
    ]

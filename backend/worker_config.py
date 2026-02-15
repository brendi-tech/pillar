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
    )
    
    # Import products workflows
    from apps.products.workflows.sync_actions import sync_actions_workflow
    
    
    # Import demos workflows
    from apps.demos.workflows import superset_reset_workflow
    
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
        # Products app workflows
        sync_actions_workflow,
        # Demos app workflows
        superset_reset_workflow,
        # Agent Score workflows (public scoring tool)
        http_probes_workflow,
        browser_analysis_workflow,
        analyze_and_score_workflow,
        signup_test_workflow,
        finalize_report_workflow,
        openclaw_test_workflow,
    ]

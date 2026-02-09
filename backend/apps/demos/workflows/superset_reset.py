"""
Superset Demo Reset Workflow

Resets the Superset demo database every 30 minutes to provide
a clean environment for new demo users.

Triggered via cron schedule in production namespaces only (pillar-dev, pillar-prod).
Local development namespaces will not run this workflow on a schedule.

The workflow:
1. Connects to the Superset demo PostgreSQL database
2. Deletes user-created dashboards and charts (preserving example data)
3. Clears user sessions, saved queries, and temporary data
4. Flushes the Redis cache to ensure fresh state
"""

import logging
import os
from datetime import timedelta

from hatchet_sdk import Context

from common.hatchet_client import task_with_conditional_cron

logger = logging.getLogger(__name__)


# SQL to reset the Superset demo database
# Preserves example dashboards/charts while removing user-created content
RESET_SQL = """
BEGIN;

-- Delete user-created dashboards (keep examples)
-- Examples typically have NULL created_by_fk or specific titles
DELETE FROM dashboards 
WHERE created_by_fk IS NOT NULL
  AND dashboard_title NOT LIKE '%Example%'
  AND dashboard_title NOT LIKE '%World%'
  AND dashboard_title NOT LIKE '%Birth%'
  AND dashboard_title NOT LIKE '%Tabbed%'
  AND dashboard_title NOT LIKE '%Deck%';

-- Delete user-created charts (keep examples)
DELETE FROM slices 
WHERE created_by_fk IS NOT NULL
  AND slice_name NOT LIKE '%Example%'
  AND slice_name NOT LIKE '%Birth%'
  AND slice_name NOT LIKE '%World%';

-- Clear user sessions and queries
DELETE FROM saved_query;
DELETE FROM query;
DELETE FROM tab_state;
DELETE FROM table_schema;

-- Clean up orphaned dashboard-chart relationships
DELETE FROM dashboard_slices 
WHERE dashboard_id NOT IN (SELECT id FROM dashboards);

-- Clean up user-uploaded datasets (keep example datasets)
DELETE FROM tables 
WHERE created_by_fk IS NOT NULL
  AND table_name NOT LIKE '%birth%'
  AND table_name NOT LIKE '%flights%'
  AND table_name NOT LIKE '%energy%'
  AND table_name NOT LIKE '%world%'
  AND table_name NOT LIKE '%random%';

-- Reset sequence values to avoid gaps
SELECT setval('dashboards_id_seq', COALESCE((SELECT MAX(id) FROM dashboards), 1));
SELECT setval('slices_id_seq', COALESCE((SELECT MAX(id) FROM slices), 1));
SELECT setval('tables_id_seq', COALESCE((SELECT MAX(id) FROM tables), 1));

COMMIT;
"""


@task_with_conditional_cron(
    name="superset-demo-reset",
    on_crons=["*/30 * * * *"],  # Every 30 minutes
    retries=2,
    execution_timeout=timedelta(minutes=5),
)
async def superset_reset_workflow(workflow_input: dict, context: Context) -> dict:
    """
    Reset Superset demo database to a clean state.
    
    This workflow runs every 30 minutes in production to ensure demo users
    always have a clean, working Superset instance with example data.
    
    Args:
        workflow_input: Input parameters (not used for cron-triggered runs)
        context: Hatchet execution context for logging
        
    Returns:
        dict: Status of each reset operation with success/error details
    """
    results = {
        "database_reset": "skipped",
        "redis_clear": "skipped",
        "rows_deleted": 0,
    }
    
    database_url = os.environ.get("SUPERSET_DEMO_DATABASE_URL")
    redis_url = os.environ.get("SUPERSET_DEMO_REDIS_URL")
    
    # Reset database
    if database_url:
        try:
            import asyncpg
            
            context.log("Connecting to Superset demo database...")
            conn = await asyncpg.connect(database_url)
            
            try:
                # Execute the reset SQL
                context.log("Executing database reset...")
                result = await conn.execute(RESET_SQL)
                
                # Log what was deleted
                context.log(f"Database reset completed: {result}")
                results["database_reset"] = "success"
                
            finally:
                await conn.close()
                
        except Exception as e:
            error_msg = f"Database reset failed: {str(e)}"
            logger.error(error_msg, exc_info=True)
            context.log(f"ERROR: {error_msg}")
            results["database_reset"] = f"error: {str(e)}"
    else:
        context.log("SUPERSET_DEMO_DATABASE_URL not configured, skipping database reset")
    
    # Clear Redis cache
    if redis_url:
        try:
            import redis.asyncio as redis_async
            
            context.log("Connecting to Redis cache...")
            client = redis_async.from_url(redis_url)
            
            try:
                # Flush all keys (demo has its own Redis instance)
                await client.flushall()
                context.log("Redis cache cleared successfully")
                results["redis_clear"] = "success"
                
            finally:
                await client.close()
                
        except Exception as e:
            error_msg = f"Redis clear failed: {str(e)}"
            logger.error(error_msg, exc_info=True)
            context.log(f"ERROR: {error_msg}")
            results["redis_clear"] = f"error: {str(e)}"
    else:
        context.log("SUPERSET_DEMO_REDIS_URL not configured, skipping cache clear")
    
    # Log final status
    context.log(f"Reset completed: {results}")
    
    return results

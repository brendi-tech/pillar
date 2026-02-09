"""
Task Router - Routes all tasks to Hatchet.

This module provides a simple interface for executing background tasks via Hatchet.
Celery has been completely removed from the application.
"""
import json
import logging
import time as time_module
from typing import Any, Optional
from uuid import UUID
from datetime import datetime, date, time
from decimal import Decimal
from django.conf import settings

logger = logging.getLogger(__name__)

# gRPC message size limits (Hatchet uses gRPC for task communication)
GRPC_MAX_MESSAGE_SIZE = 4 * 1024 * 1024  # 4MB - Hatchet's gRPC limit
PAYLOAD_WARNING_THRESHOLD = 2 * 1024 * 1024  # 2MB - warn before hitting limit


class TaskRouter:
    """
    Route all background tasks to Hatchet.
    
    Usage:
        from common.task_router import TaskRouter
        TaskRouter.execute('content-index-page', page_crawl_id=123)
    """
    
    @classmethod
    def execute(cls, workflow_name: str, organization_id: str = None, **kwargs) -> Optional[str]:
        """
        Execute a task via Hatchet.
        
        Args:
            workflow_name: Hatchet workflow name (e.g., 'content-index-page')
            organization_id: Organization ID for logging (optional, not used for routing)
            **kwargs: Keyword arguments for the workflow
            
        Returns:
            Workflow run ID (string)
            
        Example:
            TaskRouter.execute('content-index-page', 
                             organization_id='org-123',
                             page_crawl_id=123)
            TaskRouter.execute('competitive-rank-with-provider', 
                             organization_id='org-456',
                             snapshot_id='abc', 
                             provider_key='chatgpt')
        """
        logger.info(
            f"[TaskRouter] EXECUTE called: workflow={workflow_name}, "
            f"org={organization_id or 'system'}, kwargs={kwargs}"
        )
        
        # Remove organization_id from kwargs before passing to task
        # (it's only used for logging, not task execution)
        task_kwargs = {k: v for k, v in kwargs.items()}
        
        logger.info(f"[TaskRouter] Routing {workflow_name} to HATCHET (org={organization_id or 'system'})")
        return cls._execute_hatchet(workflow_name, **task_kwargs)
    
    @classmethod
    def _serialize_for_hatchet(cls, obj: Any) -> Any:
        """
        Serialize Python objects to JSON-compatible types for Hatchet.
        
        Hatchet's API client requires all input to be JSON-serializable.
        This converts UUID, datetime, and other types to strings.
        
        Args:
            obj: Object to serialize (can be dict, list, or primitive)
            
        Returns:
            JSON-serializable version of the object
        """
        if isinstance(obj, UUID):
            return str(obj)
        elif isinstance(obj, (datetime, date, time)):
            return obj.isoformat()
        elif isinstance(obj, Decimal):
            return float(obj)
        elif isinstance(obj, dict):
            return {key: cls._serialize_for_hatchet(value) for key, value in obj.items()}
        elif isinstance(obj, (list, tuple)):
            return [cls._serialize_for_hatchet(item) for item in obj]
        elif isinstance(obj, set):
            return [cls._serialize_for_hatchet(item) for item in obj]
        else:
            return obj
    
    @classmethod
    def _is_retryable_error(cls, exception: Exception) -> bool:
        """
        Determine if an exception is retryable (transient network/connection error).
        
        Args:
            exception: The exception to check
            
        Returns:
            True if the error is retryable, False otherwise
        """
        import ssl
        from urllib3.exceptions import ProtocolError, MaxRetryError
        from requests.exceptions import ConnectionError, Timeout, RequestException
        
        # SSL errors (stale connections, handshake failures)
        if isinstance(exception, (ssl.SSLError, ssl.SSLEOFError)):
            return True
        
        # HTTP connection errors
        if isinstance(exception, (ConnectionError, Timeout, ProtocolError)):
            return True
        
        # urllib3 max retry errors (connection pool issues)
        if isinstance(exception, MaxRetryError):
            return True
        
        # Check for SSL errors in the exception chain
        if 'SSLError' in str(type(exception)) or 'SSLEOFError' in str(type(exception)):
            return True
        
        # Check error message for common transient issues
        error_msg = str(exception).lower()
        transient_indicators = [
            'ssl',
            'connection',
            'timeout',
            'timed out',
            'eof occurred',
            'connection pool',
            'max retries exceeded',
            'connection reset',
            'broken pipe',
        ]
        
        return any(indicator in error_msg for indicator in transient_indicators)
    
    @classmethod
    def _execute_hatchet(cls, workflow_name: str, **kwargs) -> Optional[str]:
        """
        Execute task via Hatchet with retry logic for transient failures.
        
        Implements exponential backoff for SSL errors, connection errors, and timeouts.
        Handles stale connection pool issues by resetting client on connection errors.
        
        Returns:
            Workflow run ID (string)
        """
        from common.hatchet_client import get_hatchet_client, reset_hatchet_client
        from django.conf import settings
        
        # Retry configuration
        max_retries = 3
        base_delay = 1  # seconds
        max_delay = 10  # seconds
        
        # Serialize kwargs to ensure all values are JSON-compatible
        # (converts UUIDs, datetimes, etc. to strings)
        serialized_kwargs = cls._serialize_for_hatchet(kwargs)
        
        # Check payload size before sending to prevent gRPC errors
        # This provides better error messages than cryptic gRPC failures
        try:
            payload_json = json.dumps(serialized_kwargs)
            payload_size = len(payload_json.encode('utf-8'))
            
            # Log payload size for debugging (helps identify large payloads)
            logger.debug(
                f"[TaskRouter] Workflow '{workflow_name}' payload size: "
                f"{payload_size / 1024:.1f}KB"
            )
            
            # Warn if approaching limit
            if payload_size > PAYLOAD_WARNING_THRESHOLD:
                # Find the largest field to help identify the issue
                key_sizes = {}
                for key, value in serialized_kwargs.items():
                    try:
                        key_size = len(json.dumps(value).encode('utf-8'))
                        key_sizes[key] = key_size
                    except (TypeError, ValueError):
                        key_sizes[key] = 0
                
                largest_key = max(key_sizes, key=key_sizes.get) if key_sizes else 'unknown'
                largest_size = key_sizes.get(largest_key, 0)
                
                logger.warning(
                    f"[TaskRouter] Large workflow payload for '{workflow_name}': "
                    f"{payload_size / 1024 / 1024:.2f}MB (limit: {GRPC_MAX_MESSAGE_SIZE / 1024 / 1024:.0f}MB). "
                    f"Largest field: '{largest_key}' ({largest_size / 1024:.1f}KB)"
                )
            
            # Fail fast if payload exceeds gRPC limit
            if payload_size > GRPC_MAX_MESSAGE_SIZE:
                # Find key sizes for detailed error
                key_sizes = {}
                for key, value in serialized_kwargs.items():
                    try:
                        key_size = len(json.dumps(value).encode('utf-8'))
                        key_sizes[key] = key_size
                    except (TypeError, ValueError):
                        key_sizes[key] = 0
                
                largest_key = max(key_sizes, key=key_sizes.get) if key_sizes else 'unknown'
                largest_size = key_sizes.get(largest_key, 0)
                
                error_msg = (
                    f"Workflow payload for '{workflow_name}' exceeds gRPC limit: "
                    f"{payload_size / 1024 / 1024:.2f}MB (limit: {GRPC_MAX_MESSAGE_SIZE / 1024 / 1024:.0f}MB). "
                    f"Largest field: '{largest_key}' ({largest_size / 1024 / 1024:.2f}MB). "
                    f"Consider storing large data in Redis and passing only a reference key."
                )
                logger.error(f"[TaskRouter] {error_msg}")
                raise ValueError(error_msg)
                
        except (TypeError, ValueError) as e:
            if 'exceeds gRPC limit' in str(e):
                raise  # Re-raise our size limit error
            logger.warning(f"[TaskRouter] Could not check payload size: {e}")
        
        last_exception = None
        
        for attempt in range(max_retries):
            try:
                # Get client (may be reset on retry)
                logger.info(
                    f"[TaskRouter] 🚀 Attempt {attempt + 1}/{max_retries}: "
                    f"Triggering Hatchet workflow '{workflow_name}' "
                    f"(namespace: {settings.HATCHET_NAMESPACE})"
                )
                
                hatchet = get_hatchet_client()
                
                # Trigger workflow using runs.create() API
                # Reference: https://docs.hatchet.run/sdks/python/client
                workflow_run = hatchet.runs.create(
                    workflow_name=workflow_name,
                    input=serialized_kwargs
                )
                
                # Extract workflow run ID from the response (V1WorkflowRunDetails object)
                # The response is a Pydantic model, we can use model_dump() to inspect it
                run_id = None
                
                # Method 1: Try run.metadata.id (V1WorkflowRunDetails structure)
                try:
                    if hasattr(workflow_run, 'run') and workflow_run.run:
                        if hasattr(workflow_run.run, 'metadata') and workflow_run.run.metadata:
                            run_id = workflow_run.run.metadata.id
                except (AttributeError, TypeError) as e:
                    logger.debug(f"[TaskRouter] Method 1 (run.metadata.id) failed: {type(e).__name__}")
                
                # Method 2: Try metadata.id (direct metadata)
                if not run_id:
                    try:
                        if hasattr(workflow_run, 'metadata') and workflow_run.metadata:
                            run_id = workflow_run.metadata.id
                    except (AttributeError, TypeError) as e:
                        logger.debug(f"[TaskRouter] Method 2 (metadata.id) failed: {type(e).__name__}")
                
                # Method 3: Try direct workflow_run_id attribute
                if not run_id:
                    try:
                        run_id = workflow_run.workflow_run_id
                    except (AttributeError, TypeError) as e:
                        logger.debug(f"[TaskRouter] Method 3 (workflow_run_id) failed: {type(e).__name__}")
                
                # Method 4: Try id attribute directly
                if not run_id:
                    try:
                        run_id = workflow_run.id
                    except (AttributeError, TypeError) as e:
                        logger.debug(f"[TaskRouter] Method 4 (id) failed: {type(e).__name__}")
                
                # Method 5: Try to dump model and extract from dict
                if not run_id:
                    try:
                        data = workflow_run.model_dump()
                        logger.debug(f"[TaskRouter] V1WorkflowRunDetails structure: {data.keys()}")
                        # Try to find ID in the dumped data
                        if 'run' in data and isinstance(data['run'], dict):
                            if 'metadata' in data['run'] and isinstance(data['run']['metadata'], dict):
                                run_id = data['run']['metadata'].get('id')
                    except (AttributeError, TypeError) as e:
                        logger.warning(f"[TaskRouter] Could not dump model: {e}")
                
                # Fallback: Log full object for debugging and raise error
                if not run_id:
                    # Try to get useful debug info
                    try:
                        debug_info = workflow_run.model_dump() if hasattr(workflow_run, 'model_dump') else str(workflow_run)
                        logger.error(f"[TaskRouter] Could not extract run ID. Response structure: {debug_info}")
                    except:
                        logger.error(f"[TaskRouter] Could not extract run ID from workflow_run: {type(workflow_run)}")
                    raise ValueError(f"Could not extract run ID from Hatchet response: {type(workflow_run)}")
                
                logger.info(f"[TaskRouter] ✅ Hatchet workflow {workflow_name} triggered successfully! Run ID: {run_id}")
                
                return run_id
                
            except Exception as e:
                last_exception = e
                
                # Check if this is a retryable error
                is_retryable = cls._is_retryable_error(e)
                
                if is_retryable and attempt < max_retries - 1:
                    # Calculate exponential backoff delay
                    delay = min(base_delay * (2 ** attempt), max_delay)
                    
                    logger.warning(
                        f"[TaskRouter] ⚠️ Attempt {attempt + 1}/{max_retries} failed for '{workflow_name}': {e}. "
                        f"Retrying in {delay}s... (retryable error detected)"
                    )
                    
                    # Reset Hatchet client to clear stale connection pool
                    try:
                        reset_hatchet_client()
                        logger.info("[TaskRouter] 🔄 Hatchet client reset to clear connection pool")
                    except Exception as reset_error:
                        logger.warning(f"[TaskRouter] Failed to reset Hatchet client: {reset_error}")
                    
                    # Wait before retry
                    time_module.sleep(delay)
                    continue
                else:
                    # Non-retryable error or exhausted retries
                    if is_retryable:
                        logger.error(
                            f"[TaskRouter] ❌ All {max_retries} attempts failed for '{workflow_name}'. "
                            f"Last error: {e}"
                        )
                    else:
                        logger.error(
                            f"[TaskRouter] ❌ Non-retryable error for '{workflow_name}': {e}"
                        )
                    
                    error_msg = (
                        f"❌ Failed to execute '{workflow_name}' via Hatchet: {e}. "
                        f"All background tasks now use Hatchet (Celery has been removed)."
                    )
                    raise RuntimeError(error_msg) from e
        
        # Should never reach here, but just in case
        if last_exception:
            error_msg = (
                f"❌ Failed to execute '{workflow_name}' via Hatchet after {max_retries} attempts: {last_exception}. "
                f"All background tasks now use Hatchet (Celery has been removed)."
            )
            logger.error(f"[TaskRouter] {error_msg}", exc_info=True)
            raise RuntimeError(error_msg) from last_exception

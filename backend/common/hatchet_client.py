"""
Hatchet client singleton for the application.

This module provides a singleton instance of the Hatchet client that can be
imported and used throughout the application to register workflows and steps.

The client is pre-initialized during Django startup (in CommonConfig.ready())
to avoid 16+ second connection delays on the first request.

The client is wrapped in DjangoHatchetClient which automatically calls
close_old_connections() before each task execution, preventing stale DB
connection errors in long-lived Hatchet worker processes.
"""
from django.conf import settings
import asyncio
import logging
from typing import Optional, List, Callable, Any
from datetime import timedelta
from functools import wraps

logger = logging.getLogger(__name__)

# Global Hatchet client instance (pre-initialized at startup, lazy fallback)
_hatchet_client = None

# Production namespaces that should register cron schedules
PRODUCTION_NAMESPACES = {'pillar-dev', 'pillar-prod'}


class MockWorkflowRun:
    """Mock workflow run response."""
    def __init__(self):
        self.metadata = type('obj', (object,), {'id': 'mock-run-id'})()


class MockRuns:
    """Mock runs API for triggering workflows."""
    def create(self, workflow_name: str, input: dict) -> MockWorkflowRun:
        """Mock workflow trigger that returns a fake run ID."""
        logger.info(f"Running in test mode - using mock Hatchet client")
        return MockWorkflowRun()


class MockTask:
    """Mock task object that mimics Hatchet's task structure."""
    def __init__(self, fn: Callable):
        self.fn = fn


class MockHatchetClient:
    """
    Mock Hatchet client for test environments.
    
    Provides the same interface as the real Hatchet client but does nothing.
    This allows workflow modules to be imported without connecting to Hatchet.
    """
    
    def __init__(self):
        self.runs = MockRuns()
    
    def task(
        self,
        name: str = None,
        retries: int = None,
        execution_timeout: timedelta = None,
        on_crons: List[str] = None,
        **kwargs
    ) -> Callable:
        """No-op task decorator that adds _task attribute for test compatibility."""
        def decorator(func: Callable) -> Callable:
            # Preserve the original function but add _task attribute
            # This allows tests to access the function via decorated_func._task.fn
            func._task = MockTask(func)
            
            # Add schedule method to the function for delayed execution
            def schedule(run_at, workflow_input):
                """Mock schedule method that does nothing."""
                logger.info(f"Mock schedule called for {name or func.__name__} at {run_at}")
                return MockWorkflowRun()
            func.schedule = schedule
            
            return func
        return decorator
    
    def workflow(self, *args, **kwargs) -> Callable:
        """No-op workflow decorator."""
        def decorator(func: Callable) -> Callable:
            return func
        return decorator
    
    def step(self, *args, **kwargs) -> Callable:
        """No-op step decorator."""
        def decorator(func: Callable) -> Callable:
            return func
        return decorator


class DjangoHatchetClient:
    """
    Wraps the real Hatchet client to automatically close stale Django DB
    connections before each task execution.

    Hatchet workers are long-lived processes. Between task executions the
    PostgreSQL connection can go stale (Cloud SQL proxy idle timeout, DB
    restart, etc.). Django's request/response cycle normally calls
    close_old_connections(), but Hatchet tasks bypass that cycle entirely.

    This wrapper intercepts @hatchet.task() so every decorated function
    gets close_old_connections() called before it runs — no workflow
    author ever has to remember to add it manually.
    """

    def __init__(self, hatchet):
        self._hatchet = hatchet

    def __getattr__(self, name: str):
        return getattr(self._hatchet, name)

    def task(self, **kwargs) -> Callable:
        real_decorator = self._hatchet.task(**kwargs)

        def wrapper_decorator(fn: Callable) -> Callable:
            if asyncio.iscoroutinefunction(fn):
                @wraps(fn)
                async def wrapped(*args, **inner_kwargs):
                    from django.db import close_old_connections
                    close_old_connections()
                    return await fn(*args, **inner_kwargs)
            else:
                @wraps(fn)
                def wrapped(*args, **inner_kwargs):
                    from django.db import close_old_connections
                    close_old_connections()
                    return fn(*args, **inner_kwargs)

            return real_decorator(wrapped)

        return wrapper_decorator

    def worker(self, *args, **kwargs):
        return self._hatchet.worker(*args, **kwargs)


# Singleton mock client instance
_mock_hatchet_client = None


def reset_hatchet_client():
    """
    Reset the global Hatchet client instance.
    
    This clears the connection pool and forces a new client to be created
    on the next call to get_hatchet_client(). Useful for handling stale
    connections or connection pool issues.
    """
    global _hatchet_client
    
    if _hatchet_client is not None:
        logger.info("Resetting Hatchet client to clear stale connections")
        _hatchet_client = None


def get_hatchet_client():
    """
    Get or create the global Hatchet client instance.
    
    The client is pre-initialized during Django startup (CommonConfig.ready())
    to avoid connection delays on the first request. If not already initialized,
    this function will initialize it on first access (lazy fallback).
    
    When HATCHET_ENABLED is False (e.g., in test environment), returns a
    MockHatchetClient that provides no-op decorators, allowing workflow modules
    to be imported without connecting to Hatchet.
    
    Returns:
        Hatchet | MockHatchetClient: Hatchet client instance (real or mock)
        
    Raises:
        ValueError: If HATCHET_CLIENT_TOKEN is not configured (when enabled)
        ImportError: If hatchet-sdk is not installed (when enabled)
    """
    global _hatchet_client
    
    # Check if Hatchet is disabled (e.g., in test environment)
    if not getattr(settings, 'HATCHET_ENABLED', True):
        global _mock_hatchet_client
        if _mock_hatchet_client is None:
            logger.debug("Hatchet is disabled (HATCHET_ENABLED=False), using mock client")
            _mock_hatchet_client = MockHatchetClient()
        return _mock_hatchet_client
    
    if _hatchet_client is None:
        try:
            from hatchet_sdk import Hatchet, ClientConfig
        except ImportError as e:
            logger.error("hatchet-sdk not installed. Run: uv add hatchet-sdk")
            raise ImportError(
                "hatchet-sdk is not installed. Install with: uv add hatchet-sdk"
            ) from e
        
        # Validate configuration
        if not settings.HATCHET_CLIENT_TOKEN:
            raise ValueError(
                "HATCHET_CLIENT_TOKEN not configured. "
                "Set it in your environment variables or settings."
            )
        
        # Get root logger to capture all workflow logs
        root_logger = logging.getLogger()
        
        # Build config - for Hatchet Cloud, server_url is optional and defaults to cloud
        config_params = {
            'token': settings.HATCHET_CLIENT_TOKEN,
            'namespace': settings.HATCHET_NAMESPACE,
            'logger': root_logger,
        }
        
        # Only set server_url if explicitly configured (not needed for Hatchet Cloud)
        if settings.HATCHET_SERVER_URL and settings.HATCHET_SERVER_URL != 'https://app.hatchet.run':
            config_params['server_url'] = settings.HATCHET_SERVER_URL
            logger.info(
                f"Initializing Hatchet client "
                f"(custom server={settings.HATCHET_SERVER_URL}, "
                f"namespace={settings.HATCHET_NAMESPACE})"
            )
        else:
            logger.info(
                f"Initializing Hatchet client "
                f"(Hatchet Cloud, namespace={settings.HATCHET_NAMESPACE})"
            )
        
        try:
            config = ClientConfig(**config_params)
            _hatchet_client = DjangoHatchetClient(Hatchet(
                debug=settings.DEBUG,
                config=config,
            ))
            logger.info("Hatchet client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Hatchet client: {e}", exc_info=True)
            raise
    
    return _hatchet_client


def should_register_cron_schedules() -> bool:
    """
    Check if cron schedules should be registered based on the namespace.
    
    Cron schedules are only registered for production namespaces (pillar-dev, pillar-prod).
    Local development namespaces (jj-local, etc.) should not register cron schedules.
    
    Returns:
        bool: True if cron schedules should be registered, False otherwise
    """
    namespace = getattr(settings, 'HATCHET_NAMESPACE', '')
    is_production = namespace in PRODUCTION_NAMESPACES
    
    if is_production:
        logger.info(f"✓ Cron schedules will be registered (namespace: {namespace})")
    else:
        logger.info(f"⊗ Cron schedules will NOT be registered (namespace: {namespace} is not production)")
    
    return is_production


def task_with_conditional_cron(
    name: str,
    on_crons: Optional[List[str]] = None,
    retries: Optional[int] = None,
    execution_timeout: Optional[timedelta] = None,
):
    """
    Wrapper for @hatchet.task() that conditionally applies cron schedules.
    
    Cron schedules are only applied in production namespaces (pillar-dev, pillar-prod).
    For local development, the task is registered without cron schedules.
    
    Args:
        name: Task name
        on_crons: Cron schedule expressions (only applied in production namespaces)
        retries: Number of retries
        execution_timeout: Task execution timeout
        
    Usage:
        @task_with_conditional_cron(
            name="my-task",
            on_crons=["0 2 * * *"],  # Only registered in pillar-dev/pillar-prod
            execution_timeout=timedelta(hours=1)
        )
        def my_task(workflow_input: dict, context: Context):
            pass
    """
    hatchet = get_hatchet_client()
    
    # Build decorator kwargs
    kwargs = {'name': name}
    
    # Only add cron schedules for production namespaces
    if on_crons and should_register_cron_schedules():
        kwargs['on_crons'] = on_crons
    
    if retries is not None:
        kwargs['retries'] = retries
    
    if execution_timeout is not None:
        kwargs['execution_timeout'] = execution_timeout
    
    return hatchet.task(**kwargs)


# Don't initialize client at module level to avoid import-time issues
# The client is pre-initialized in CommonConfig.ready() during startup
# Import get_hatchet_client() to access the singleton instance
hatchet_client = None


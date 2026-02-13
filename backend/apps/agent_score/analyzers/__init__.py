"""
Agent Score analyzers — one module per scoring category.
"""
from .accessibility import run as run_accessibility
from .data_quality import assess_data_quality
from .discovery import run as run_discovery
from .interactability import run as run_interactability
from .permissions import run as run_permissions
from .readability import run as run_readability
from .webmcp import run as run_webmcp

__all__ = [
    'assess_data_quality',
    'run_discovery',
    'run_readability',
    'run_interactability',
    'run_permissions',
    'run_accessibility',
    'run_webmcp',
]

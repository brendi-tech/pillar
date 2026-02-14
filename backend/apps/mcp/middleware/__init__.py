"""
MCP middleware.
"""
from apps.mcp.middleware.product_resolver import ProductResolverMiddleware
from apps.mcp.middleware.disconnect_detection import ASGIDisconnectMiddleware

__all__ = ['ProductResolverMiddleware', 'ASGIDisconnectMiddleware']

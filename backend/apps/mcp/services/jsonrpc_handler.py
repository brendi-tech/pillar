"""
JSON-RPC 2.0 protocol handler.

Implements the JSON-RPC 2.0 specification for request/response handling.
See: https://www.jsonrpc.org/specification

Copyright (C) 2025 Pillar Team
"""
import logging
import asyncio
from typing import Any, Dict, Optional, Callable
from django.http import JsonResponse

logger = logging.getLogger(__name__)


# JSON-RPC 2.0 Error Codes
class JSONRPCError:
    PARSE_ERROR = -32700
    INVALID_REQUEST = -32600
    METHOD_NOT_FOUND = -32601
    INVALID_PARAMS = -32602
    INTERNAL_ERROR = -32603


class JSONRPCHandler:
    """
    Handles JSON-RPC 2.0 protocol requests and responses.

    Usage:
        handler = JSONRPCHandler()
        handler.register('method_name', method_callable)
        response = handler.handle_request(request_data)
    """

    def __init__(self):
        self.methods: Dict[str, Callable] = {}

    def register(self, method_name: str, handler: Callable):
        """Register a method handler."""
        self.methods[method_name] = handler

    def parse_request(self, data: Any) -> Optional[Dict[str, Any]]:
        """
        Parse and validate JSON-RPC request.

        Returns:
            Parsed request dict or None if invalid
        """
        if not isinstance(data, dict):
            return None

        # Validate required fields
        if data.get('jsonrpc') != '2.0':
            return None

        if 'method' not in data:
            return None

        if not isinstance(data['method'], str):
            return None

        # id is optional for notifications, but must be string, number, or null
        if 'id' in data:
            request_id = data['id']
            if not (isinstance(request_id, (str, int, type(None)))):
                return None

        # params is optional
        if 'params' in data:
            params = data['params']
            if not isinstance(params, (dict, list)):
                return None

        return data

    async def handle_request(
        self,
        request_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Handle a JSON-RPC request (async).

        Supports both sync and async method handlers, automatically detecting
        and awaiting async handlers.

        Args:
            request_data: Parsed JSON request
            context: Optional context to pass to method handlers

        Returns:
            JSON-RPC response dict, or None for notifications
        """
        # Validate request structure
        parsed = self.parse_request(request_data)
        if parsed is None:
            return self.error_response(
                None,
                JSONRPCError.INVALID_REQUEST,
                "Invalid Request",
                "Request does not conform to JSON-RPC 2.0 specification"
            )

        method_name = parsed['method']
        request_id = parsed.get('id')
        params = parsed.get('params', {})

        # Detect if this is a notification (no id field means notification)
        is_notification = 'id' not in parsed

        # Check if method exists
        if method_name not in self.methods:
            # For notifications, silently ignore unknown methods
            if is_notification:
                logger.debug(f"Ignoring unknown notification: {method_name}")
                return None

            return self.error_response(
                request_id,
                JSONRPCError.METHOD_NOT_FOUND,
                "Method not found",
                f"The method '{method_name}' does not exist"
            )

        # Call method handler with timeout protection
        try:
            handler = self.methods[method_name]

            # Timeout settings
            timeout = 60.0 if method_name == 'initialize' else 30.0

            # Detect if handler is async and call appropriately
            if asyncio.iscoroutinefunction(handler):
                try:
                    if context:
                        result = await asyncio.wait_for(handler(params, context), timeout=timeout)
                    else:
                        result = await asyncio.wait_for(handler(params), timeout=timeout)
                except asyncio.TimeoutError:
                    logger.error(f"[{method_name}] Request timed out after {timeout}s")
                    if not is_notification:
                        return self.error_response(
                            request_id,
                            JSONRPCError.INTERNAL_ERROR,
                            "Request timeout",
                            f"Method '{method_name}' exceeded timeout of {timeout}s"
                        )
                    return None
            else:
                # Sync handler
                if context:
                    result = handler(params, context)
                else:
                    result = handler(params)

            # For notifications, don't return a response
            if is_notification:
                return None

            return self.success_response(request_id, result)

        except TypeError as e:
            logger.error(f"[{method_name}] Invalid params - {e}")
            if not is_notification:
                return self.error_response(
                    request_id,
                    JSONRPCError.INVALID_PARAMS,
                    "Invalid params",
                    str(e)
                )
            return None

        except ValueError as e:
            logger.error(f"[{method_name}] Protocol error - {e}")
            if not is_notification:
                return self.error_response(
                    request_id,
                    JSONRPCError.INVALID_PARAMS,
                    "Protocol error",
                    str(e)
                )
            return None

        except Exception as e:
            logger.error(f"[{method_name}] Unexpected error - {e}", exc_info=True)
            if not is_notification:
                return self.error_response(
                    request_id,
                    JSONRPCError.INTERNAL_ERROR,
                    "Internal error",
                    str(e)
                )
            return None

    def success_response(self, request_id: Optional[Any], result: Any) -> Dict[str, Any]:
        """Create a successful JSON-RPC response."""
        return {
            'jsonrpc': '2.0',
            'id': request_id,
            'result': result
        }

    def error_response(
        self,
        request_id: Optional[Any],
        code: int,
        message: str,
        data: Optional[Any] = None
    ) -> Dict[str, Any]:
        """Create an error JSON-RPC response."""
        error = {
            'code': code,
            'message': message
        }

        if data is not None:
            error['data'] = data

        return {
            'jsonrpc': '2.0',
            'id': request_id,
            'error': error
        }

    def create_django_response(
        self,
        jsonrpc_response: Dict[str, Any],
        json_dumps_params: Dict = None
    ) -> JsonResponse:
        """
        Convert JSON-RPC response to Django JsonResponse.

        Per JSON-RPC 2.0 specification and MCP transport conventions:
        - HTTP 200 for all valid JSON-RPC responses (including application errors)
        - HTTP 400 only for protocol-level errors (parse error, invalid request)
        - The error field in the JSON-RPC response body indicates application errors

        This allows clients to distinguish between transport issues (HTTP errors)
        and application errors (JSON-RPC error responses).
        """
        # Determine HTTP status code
        if 'error' in jsonrpc_response:
            error_code = jsonrpc_response['error']['code']

            # Only parse/protocol errors get HTTP error status
            if error_code in (JSONRPCError.PARSE_ERROR, JSONRPCError.INVALID_REQUEST):
                status = 400
            else:
                # All other errors (method not found, invalid params, internal error, etc.)
                # are application-level and should return HTTP 200 with error in body
                status = 200
        else:
            status = 200

        return JsonResponse(jsonrpc_response, status=status, json_dumps_params=json_dumps_params or {})

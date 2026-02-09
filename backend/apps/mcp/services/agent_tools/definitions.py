"""
Agent tool definitions for the agentic reasoning loop.

Dynamic action tool architecture:
- search: Find actions and documentation (unified search)
- [dynamic action tools]: Discovered via search, registered as native tools

The model responds directly via content tokens (no respond tool).
When the model produces content with no tool calls, the turn is over.

Example flow:
- "how do I" questions → search → direct response
- "do X for me" requests → search → [action tool] → direct response
- Multi-step tasks → search → [action tool] → [action tool] → ... → direct response
"""
from typing import Any, Dict, List, Optional


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================
# Core tools are always available. Conditional tools are unlocked by context:
# - get_article: unlocked after search returns knowledge chunks
# - interact_with_page: unlocked when DOM snapshot is present in user_context

# Core tools - always sent to the LLM
CORE_TOOLS = [
    {
        "name": "search",
        "description": (
            "Search for actions (capabilities) and knowledge (documentation/help articles). "
            "Always searches both. Actions are operations you can execute. "
            "Knowledge is documentation relevant to the user's question."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "What to search for",
                },
                "limit": {
                    "type": "integer",
                    "default": 5,
                    "description": "Maximum number of results per type",
                },
            },
            "required": ["query"],
        },
    },
]

# Conditional tools - unlocked by context during the agentic loop
CONDITIONAL_TOOLS = {
    "get_article": {
        "name": "get_article",
        "description": (
            "Get the full content of a knowledge article by its ID. "
            "Use when a search result chunk seems relevant but incomplete."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "item_id": {
                    "type": "string",
                    "description": "The knowledge item ID from search results",
                },
            },
            "required": ["item_id"],
        },
    },
    "interact_with_page": {
        "name": "interact_with_page",
        "description": (
            "Interact with elements on the user's current page. "
            "Use when the user asks to click, type, select, or interact with UI elements. "
            "The ref parameter must be an exact ref from the page context (e.g., 'pr-ml72ub3b-f')."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": ["click", "type", "select", "focus", "toggle"],
                    "description": "The interaction type to perform",
                },
                "ref": {
                    "type": "string",
                    "description": "Element ref from page context (e.g., 'pr-a1'). Must match exactly.",
                },
                "value": {
                    "type": "string",
                    "description": "Text to type or option to select (required for type/select operations)",
                },
            },
            "required": ["operation", "ref"],
        },
    },
}

# All tools combined (used for validation - must know about all possible tools)
AGENT_TOOLS = CORE_TOOLS + list(CONDITIONAL_TOOLS.values())


def get_tools_for_api(
    include_get_article: bool = False,
    include_interact_with_page: bool = False,
) -> List[Dict[str, Any]]:
    """
    Get tool definitions in OpenAI function-calling format for the API.
    
    Core tools (search) are always included. Conditional tools
    are included based on flags:
    - get_article: after search returns knowledge chunks
    - interact_with_page: when DOM snapshot is present in user_context
    
    Args:
        include_get_article: Include the get_article tool
        include_interact_with_page: Include the interact_with_page tool
    
    Returns:
        List of tool definitions ready for the 'tools' API parameter
    """
    tools = [{"type": "function", "function": tool} for tool in CORE_TOOLS]
    if include_get_article:
        tools.append({"type": "function", "function": CONDITIONAL_TOOLS["get_article"]})
    if include_interact_with_page:
        tools.append({"type": "function", "function": CONDITIONAL_TOOLS["interact_with_page"]})
    return tools


def get_tool_by_name(name: str) -> Optional[Dict[str, Any]]:
    """Get a tool definition by name."""
    for tool in AGENT_TOOLS:
        if tool["name"] == name:
            return tool
    return None


def validate_tool_call(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate a tool call against its schema before execution.
    
    This is a generic validation layer that prevents broken payloads from
    being sent to the client SDK. If validation fails, the error should be
    surfaced back to the LLM so it can correct its request.
    
    Args:
        tool_name: Name of the tool being called
        arguments: Arguments provided for the tool
    
    Returns:
        Dict with:
        - valid: bool - whether the call is valid
        - error: str - error message if invalid (for LLM feedback)
        - hint: str - suggestion for fixing the error
    """
    tool = get_tool_by_name(tool_name)
    
    if not tool:
        return {
            "valid": False,
            "error": f"Unknown tool: {tool_name}",
            "hint": f"Available tools: {', '.join(get_tool_names())}",
        }
    
    schema = tool.get("parameters", {})
    properties = schema.get("properties", {})
    required = schema.get("required", [])
    
    # Ensure arguments is a dict
    if arguments is None:
        arguments = {}
    if not isinstance(arguments, dict):
        return {
            "valid": False,
            "error": f"Arguments must be an object, got {type(arguments).__name__}",
            "hint": "Provide arguments as a JSON object with named parameters",
        }
    
    # Check required parameters are present and non-empty
    missing = []
    empty = []
    for param in required:
        if param not in arguments:
            missing.append(param)
        elif arguments[param] is None or arguments[param] == "":
            empty.append(param)
    
    if missing:
        expected = [f"{p}: {properties.get(p, {}).get('description', '')}" for p in required]
        return {
            "valid": False,
            "error": f"Missing required parameters: {missing}",
            "hint": f"Required parameters: {'; '.join(expected)}",
        }
    
    if empty:
        return {
            "valid": False,
            "error": f"Required parameters cannot be empty: {empty}",
            "hint": f"Provide non-empty values for: {', '.join(empty)}",
        }
    
    # Check for unknown parameters (helps LLM learn correct param names)
    # Skip this check if additionalProperties is allowed (e.g., execute_query accepts action params directly)
    if properties and not schema.get("additionalProperties", False):
        unknown = [p for p in arguments if p not in properties]
        if unknown:
            expected = list(properties.keys())
            return {
                "valid": False,
                "error": f"Unknown parameters: {unknown}",
                "hint": f"Expected parameters: {', '.join(expected)}",
            }
    
    # Basic type validation for required string fields
    for param in required:
        if param in arguments and param in properties:
            expected_type = properties[param].get("type")
            value = arguments[param]
            
            if expected_type == "string" and not isinstance(value, str):
                return {
                    "valid": False,
                    "error": f"Parameter '{param}' must be a string, got {type(value).__name__}",
                    "hint": f"Provide a string value for '{param}'",
                }
            elif expected_type == "object" and not isinstance(value, dict):
                return {
                    "valid": False,
                    "error": f"Parameter '{param}' must be an object, got {type(value).__name__}",
                    "hint": f"Provide an object/dict value for '{param}'",
                }
            elif expected_type == "array" and not isinstance(value, list):
                return {
                    "valid": False,
                    "error": f"Parameter '{param}' must be an array, got {type(value).__name__}",
                    "hint": f"Provide an array/list value for '{param}'",
                }
    
    return {"valid": True}


def get_tool_names() -> List[str]:
    """Get list of all available tool names."""
    return [tool["name"] for tool in AGENT_TOOLS]


# =============================================================================
# DYNAMIC ACTION TOOLS - Register discovered actions as native LLM tools
# =============================================================================


def _sanitize_schema(schema: Dict[str, Any]) -> Dict[str, Any]:
    """
    Recursively ensure all arrays have items and all objects have properties.

    Gemini strictly requires every type: "array" to have an "items" field and
    every type: "object" to have a "properties" field, even though standard
    JSON Schema considers them optional. Without this, Gemini returns a 400
    INVALID_ARGUMENT error rejecting the entire tool declaration.

    This is called on every action schema before it is sent to the LLM,
    protecting against incomplete schemas from any product.
    """
    if not isinstance(schema, dict):
        return schema

    schema = schema.copy()
    schema_type = schema.get("type")

    if schema_type == "array":
        if "items" not in schema:
            schema["items"] = {"type": "string"}
        else:
            schema["items"] = _sanitize_schema(schema["items"])

    if schema_type == "object":
        if "properties" not in schema:
            schema["properties"] = {}
        else:
            schema["properties"] = {
                k: _sanitize_schema(v)
                for k, v in schema["properties"].items()
            }

    return schema


def action_to_tool(action: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert an action from search results to OpenAI tool format.
    
    This enables native schema enforcement by the LLM's tool calling API,
    eliminating parameter validation errors that occurred with the generic
    'execute' meta-tool.
    
    Args:
        action: Action dict from search results with name, description, and data_schema
        
    Returns:
        Tool definition in OpenAI function-calling format
    """
    # Use data_schema if present, otherwise empty object schema
    schema = action.get("data_schema") or action.get("schema") or {
        "type": "object",
        "properties": {},
    }
    
    # Ensure the schema has required fields for OpenAI format
    if "type" not in schema:
        schema["type"] = "object"
    if "properties" not in schema:
        schema["properties"] = {}

    # Sanitize for Gemini compatibility (arrays need items, objects need properties)
    schema = _sanitize_schema(schema)
    
    return {
        "type": "function",
        "function": {
            "name": action["name"],
            "description": action.get("description", ""),
            "parameters": schema,
        }
    }


def get_dynamic_tools(
    registered_actions: List[Dict[str, Any]],
    include_get_article: bool = False,
    include_interact_with_page: bool = False,
) -> List[Dict[str, Any]]:
    """
    Build the complete tool list: base tools + conditional tools + discovered action tools.
    
    Actions discovered via search are converted to native tools, enabling
    the LLM to call them directly with schema validation.
    
    Args:
        registered_actions: List of action dicts from context.registered_actions
        include_get_article: Include the get_article conditional tool
        include_interact_with_page: Include the interact_with_page conditional tool
        
    Returns:
        Complete list of tools for the LLM API call
    """
    base_tools = get_tools_for_api(
        include_get_article=include_get_article,
        include_interact_with_page=include_interact_with_page,
    )
    action_tools = [action_to_tool(a) for a in registered_actions]
    return base_tools + action_tools

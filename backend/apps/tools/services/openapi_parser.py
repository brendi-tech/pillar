"""
OpenAPI spec parser — fetches an OpenAPI spec and extracts operations
as tool definitions with JSON Schema inputs.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx
from django.utils import timezone

logger = logging.getLogger(__name__)


async def fetch_and_parse_spec(spec_url: str) -> dict[str, Any]:
    """Fetch an OpenAPI spec from a URL and return the parsed dict."""
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        response = await client.get(spec_url)
        response.raise_for_status()

    content_type = response.headers.get("content-type", "")
    text = response.text

    if "yaml" in content_type or spec_url.endswith((".yaml", ".yml")):
        import yaml
        return yaml.safe_load(text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        import yaml
        return yaml.safe_load(text)


def parse_spec_content(raw_text: str) -> dict[str, Any]:
    """Parse raw OpenAPI spec content (JSON or YAML string) without fetching."""
    try:
        return json.loads(raw_text)
    except (json.JSONDecodeError, ValueError):
        import yaml
        return yaml.safe_load(raw_text)


def _detect_spec_format(text: str) -> str:
    """Sniff whether raw text is JSON or YAML."""
    stripped = text.lstrip()
    if stripped.startswith("{"):
        return "json"
    return "yaml"


def _resolve_ref(spec: dict[str, Any], ref: str) -> dict[str, Any]:
    """Resolve a $ref pointer like '#/components/schemas/Pet'."""
    if not ref.startswith("#/"):
        return {}
    parts = ref.lstrip("#/").split("/")
    node = spec
    for part in parts:
        node = node.get(part, {})
        if not isinstance(node, dict):
            return {}
    return node


def _deep_resolve_refs(node: Any, spec: dict[str, Any], depth: int = 0) -> Any:
    """Recursively resolve all $ref pointers in a schema, with cycle protection."""
    if depth > 20:
        return node
    if isinstance(node, dict):
        if "$ref" in node:
            resolved = _resolve_ref(spec, node["$ref"])
            return _deep_resolve_refs(resolved, spec, depth + 1)
        return {k: _deep_resolve_refs(v, spec, depth + 1) for k, v in node.items()}
    if isinstance(node, list):
        return [_deep_resolve_refs(item, spec, depth + 1) for item in node]
    return node


def _generate_operation_id(method: str, path: str) -> str:
    """Generate an operation ID from method + path when operationId is missing."""
    clean = re.sub(r'[{}]', '', path)
    clean = re.sub(r'[^a-zA-Z0-9/]', '_', clean)
    parts = [p for p in clean.split('/') if p]
    return f"{method}_{'_'.join(parts)}"


def _build_input_schema(
    parameters: list[dict], request_body: dict | None, spec: dict
) -> dict[str, Any]:
    """
    Merge path/query/header parameters and request body into a single
    JSON Schema object suitable for LLM tool calling.
    """
    properties: dict[str, Any] = {}
    required: list[str] = []

    for param in parameters:
        param = _deep_resolve_refs(param, spec)
        name = param.get("name", "")
        if not name:
            continue
        schema = _deep_resolve_refs(param.get("schema", {}), spec)
        prop: dict[str, Any] = {**schema}
        description_parts = []
        if param.get("description"):
            description_parts.append(param["description"])
        location = param.get("in", "query")
        if location != "query":
            description_parts.append(f"(in {location})")
        if description_parts:
            prop["description"] = " ".join(description_parts)
        properties[name] = prop
        if param.get("required"):
            required.append(name)

    if request_body:
        content = request_body.get("content", {})
        json_content = content.get("application/json", {})
        body_schema = _deep_resolve_refs(json_content.get("schema", {}), spec)
        if body_schema.get("type") == "object" and body_schema.get("properties"):
            for prop_name, prop_schema in body_schema["properties"].items():
                properties[prop_name] = prop_schema
            for req_name in body_schema.get("required", []):
                if req_name not in required:
                    required.append(req_name)
        elif body_schema:
            properties["body"] = body_schema
            if request_body.get("required"):
                required.append("body")

    result: dict[str, Any] = {
        "type": "object",
        "properties": properties,
    }
    if required:
        result["required"] = required
    return result


def extract_operations(spec: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Extract all operations from an OpenAPI spec as tool-ready dicts.

    Each operation dict contains:
    - operation_id: unique identifier
    - method: HTTP method (get, post, etc.)
    - path: URL path template
    - summary: short description
    - description: full description
    - input_schema: merged JSON Schema for all inputs
    - security: security requirements for this operation
    - parameters_meta: metadata about where each param goes (path, query, header)
    """
    operations: list[dict[str, Any]] = []
    paths = spec.get("paths", {})
    global_security = spec.get("security", [])

    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        path_params = _deep_resolve_refs(path_item.get("parameters", []), spec)

        for method in ("get", "post", "put", "patch", "delete", "head", "options"):
            operation = path_item.get(method)
            if not operation or not isinstance(operation, dict):
                continue

            op_params = _deep_resolve_refs(operation.get("parameters", []), spec)
            merged_params = _merge_parameters(path_params, op_params)

            request_body = _deep_resolve_refs(operation.get("requestBody"), spec)
            input_schema = _build_input_schema(merged_params, request_body, spec)

            operation_id = operation.get("operationId") or _generate_operation_id(method, path)
            operation_id = re.sub(r'[^a-zA-Z0-9_]', '_', operation_id)

            summary = operation.get("summary", "")
            description = operation.get("description", "")

            security = operation.get("security", global_security)

            params_meta = {}
            for param in merged_params:
                param = _deep_resolve_refs(param, spec)
                name = param.get("name", "")
                if name:
                    params_meta[name] = param.get("in", "query")

            operations.append({
                "operation_id": operation_id,
                "method": method.upper(),
                "path": path,
                "summary": summary,
                "description": description,
                "input_schema": input_schema,
                "security": security,
                "parameters_meta": params_meta,
            })

    return operations


def _merge_parameters(
    path_params: list[dict], op_params: list[dict]
) -> list[dict]:
    """Merge path-level and operation-level parameters (operation overrides)."""
    by_key: dict[tuple, dict] = {}
    for p in path_params:
        key = (p.get("name"), p.get("in"))
        by_key[key] = p
    for p in op_params:
        key = (p.get("name"), p.get("in"))
        by_key[key] = p
    return list(by_key.values())


def extract_security_schemes(spec: dict[str, Any]) -> dict[str, Any]:
    """Extract securitySchemes from the spec's components."""
    return spec.get("components", {}).get("securitySchemes", {})


def extract_server_url(spec: dict[str, Any]) -> str:
    """Extract the first server URL from the spec."""
    servers = spec.get("servers", [])
    if servers and isinstance(servers[0], dict):
        return servers[0].get("url", "")
    return ""


async def discover_and_store(source) -> None:
    """
    Parse the OpenAPI spec and persist operations to the source.
    Fetches from URL if spec_url is set, otherwise parses spec_content directly.
    Fires a background Hatchet task to embed descriptions.
    """
    from apps.tools.models import OpenAPIToolSource

    try:
        if source.spec_url:
            spec = await fetch_and_parse_spec(source.spec_url)
            spec_format = "yaml" if source.spec_url.endswith((".yaml", ".yml")) else "json"
        elif source.spec_content:
            spec = parse_spec_content(source.spec_content)
            spec_format = _detect_spec_format(source.spec_content)
        else:
            raise ValueError("No spec_url or spec_content provided")
    except Exception as exc:
        source.discovery_status = OpenAPIToolSource.DiscoveryStatus.ERROR
        source.discovery_error = f"Failed to parse spec: {exc}"
        await source.asave(update_fields=["discovery_status", "discovery_error"])
        raise

    spec_version = spec.get("info", {}).get("version", "")
    base_url = source.base_url or extract_server_url(spec)

    operations = extract_operations(spec)

    source.discovered_operations = operations
    source.spec_version = spec_version
    source.spec_format = spec_format
    if not source.base_url and base_url:
        source.base_url = base_url
    source.last_discovery_at = timezone.now()
    source.discovery_status = OpenAPIToolSource.DiscoveryStatus.SUCCESS
    source.discovery_error = ""
    source.current_version_number = (source.current_version_number or 0) + 1
    await source.asave()

    await _sync_operation_configs(source, operations)
    await _create_version_snapshot(source, operations)

    logger.info(
        "OpenAPI discovery for %s: %d operations stored (spec v%s, version #%d)",
        source.name, len(operations), spec_version, source.current_version_number,
    )

    from common.task_router import TaskRouter
    TaskRouter.execute(
        "tools-openapi-embed-descriptions",
        openapi_source_id=str(source.id),
    )


CONFIRMATION_DEFAULT_METHODS = {"DELETE", "PATCH", "PUT", "POST"}


async def _sync_operation_configs(source, operations: list[dict]) -> None:
    """Sync OpenAPIOperationConfig rows to match discovered operations.

    Creates new rows for new operations, removes rows for operations
    that no longer exist, and preserves user-modified rows for operations
    that still exist.
    """
    from apps.tools.models import OpenAPIOperationConfig

    existing = {
        cfg.tool_name: cfg
        async for cfg in OpenAPIOperationConfig.objects.filter(openapi_source=source)
    }
    discovered_ids = {op["operation_id"] for op in operations}

    stale_ids = set(existing.keys()) - discovered_ids
    if stale_ids:
        await OpenAPIOperationConfig.objects.filter(
            openapi_source=source, tool_name__in=stale_ids,
        ).adelete()

    new_ops = [op for op in operations if op["operation_id"] not in existing]
    if new_ops:
        await OpenAPIOperationConfig.objects.abulk_create([
            OpenAPIOperationConfig(
                openapi_source=source,
                tool_name=op["operation_id"],
                is_enabled=True,
                requires_confirmation=op.get("method", "").upper() in CONFIRMATION_DEFAULT_METHODS,
            )
            for op in new_ops
        ])

    logger.info(
        "OpenAPI operation configs synced for %s: %d new, %d removed, %d kept",
        source.name, len(new_ops), len(stale_ids),
        len(discovered_ids & set(existing.keys())),
    )


async def _create_version_snapshot(source, operations: list[dict]) -> None:
    """Create an immutable version record for this spec parse."""
    from apps.tools.models import OpenAPIToolSourceVersion

    spec_version = source.spec_version or ''
    existing_count = await OpenAPIToolSourceVersion.objects.filter(
        source=source, spec_version=spec_version,
    ).acount()
    revision = existing_count + 1

    ops_without_embeddings = [
        {k: v for k, v in op.items() if not k.startswith("_")}
        for op in operations
    ]

    await OpenAPIToolSourceVersion.objects.acreate(
        source=source,
        organization_id=source.organization_id,
        version_number=source.current_version_number,
        spec_version=spec_version,
        revision=revision,
        spec_content=source.spec_content or '',
        spec_url=source.spec_url or '',
        spec_format=source.spec_format or '',
        discovered_operations=ops_without_embeddings,
        operation_count=len(operations),
    )


async def embed_source_descriptions(source) -> None:
    """Embed operation descriptions concurrently and persist."""
    import asyncio

    from common.services.embedding_service import get_embedding_service

    service = get_embedding_service()
    sem = asyncio.Semaphore(20)

    async def _embed(text: str) -> list[float]:
        async with sem:
            return await service.embed_query_async(text)

    operations = source.discovered_operations or []
    tasks: list[tuple[dict, asyncio.Task]] = []

    for op in operations:
        if "_description_embedding" in op:
            continue
        desc = op.get("summary") or op.get("description") or ""
        if desc:
            tasks.append((op, asyncio.ensure_future(_embed(desc))))

    if not tasks:
        logger.info("OpenAPI embed for %s: nothing to embed", source.name)
        return

    results = await asyncio.gather(*(t for _, t in tasks), return_exceptions=True)

    embedded = 0
    for (item, _), result in zip(tasks, results):
        if isinstance(result, Exception):
            logger.warning("Embedding failed for %s op: %s", source.name, result)
            continue
        item["_description_embedding"] = result
        embedded += 1

    await source.asave(update_fields=["discovered_operations"])

    logger.info(
        "OpenAPI embed for %s: %d/%d descriptions embedded",
        source.name, embedded, len(tasks),
    )

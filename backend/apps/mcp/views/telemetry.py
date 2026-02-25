"""
OTLP trace proxy endpoint.

Accepts OTLP JSON from the browser SDK and forwards spans through the
server-side Cloud Trace exporter, so browser and server traces end up
in the same Cloud Trace project without requiring a separate OTel Collector.
"""
import json
import logging

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from common.observability.tracing import get_span_exporter

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
async def otlp_traces_proxy(request):
    """
    Accept OTLP JSON and forward to Cloud Trace.

    The browser SDK sends spans as OTLP/JSON. We deserialise them into
    OTel ReadableSpan objects and export via the same BatchSpanProcessor
    that the server-side instrumentation uses.

    This avoids deploying a dedicated OTel Collector service.
    """
    from common.utils.cors import add_cors_headers

    if request.method == "OPTIONS":
        response = JsonResponse({})
        return add_cors_headers(response, request)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        response = JsonResponse({"error": "invalid_json"}, status=400)
        return add_cors_headers(response, request)

    provider = get_span_exporter()
    if provider is None:
        response = JsonResponse({"status": "no_exporter"}, status=200)
        return add_cors_headers(response, request)

    try:
        from opentelemetry.sdk.trace import ReadableSpan
        from opentelemetry.trace import SpanContext, SpanKind, TraceFlags
        from opentelemetry.sdk.resources import Resource

        resource_spans = body.get("resourceSpans", [])
        readable_spans: list[ReadableSpan] = []

        for rs in resource_spans:
            resource_attrs = {}
            res = rs.get("resource", {})
            for attr in res.get("attributes", []):
                resource_attrs[attr["key"]] = _extract_value(attr.get("value", {}))
            resource = Resource.create(resource_attrs)

            for scope_spans in rs.get("scopeSpans", []):
                for span_data in scope_spans.get("spans", []):
                    readable = _otlp_span_to_readable(span_data, resource)
                    if readable:
                        readable_spans.append(readable)

        if readable_spans:
            # Export through any active span processors on the provider
            for processor in provider._active_span_processor._span_processors:
                for span in readable_spans:
                    processor.on_end(span)

        response = JsonResponse({"accepted": len(readable_spans)})
        return add_cors_headers(response, request)

    except Exception as exc:
        logger.warning(f"[Telemetry] Failed to process browser spans: {exc}", exc_info=True)
        response = JsonResponse({"error": "processing_failed"}, status=500)
        return add_cors_headers(response, request)


def _extract_value(value_obj: dict):
    """Extract a typed value from an OTLP attribute value object."""
    if "stringValue" in value_obj:
        return value_obj["stringValue"]
    if "intValue" in value_obj:
        return int(value_obj["intValue"])
    if "doubleValue" in value_obj:
        return float(value_obj["doubleValue"])
    if "boolValue" in value_obj:
        return value_obj["boolValue"]
    return str(value_obj)


def _otlp_span_to_readable(span_data: dict, resource):
    """Convert an OTLP JSON span into an OpenTelemetry ReadableSpan."""
    try:
        from opentelemetry.sdk.trace import ReadableSpan
        from opentelemetry.trace import SpanContext, SpanKind, TraceFlags
        from opentelemetry.trace.status import Status, StatusCode

        trace_id = int(span_data.get("traceId", "0"), 16)
        span_id = int(span_data.get("spanId", "0"), 16)
        parent_id = int(span_data["parentSpanId"], 16) if span_data.get("parentSpanId") else 0

        ctx = SpanContext(
            trace_id=trace_id,
            span_id=span_id,
            is_remote=False,
            trace_flags=TraceFlags(TraceFlags.SAMPLED),
        )

        parent_ctx = None
        if parent_id:
            parent_ctx = SpanContext(
                trace_id=trace_id,
                span_id=parent_id,
                is_remote=True,
                trace_flags=TraceFlags(TraceFlags.SAMPLED),
            )

        # Parse attributes
        attributes = {}
        for attr in span_data.get("attributes", []):
            attributes[attr["key"]] = _extract_value(attr.get("value", {}))

        # Parse status
        status_data = span_data.get("status", {})
        status_code_val = status_data.get("code", 0)
        if status_code_val == 2:
            status = Status(StatusCode.ERROR, status_data.get("message", ""))
        elif status_code_val == 1:
            status = Status(StatusCode.OK)
        else:
            status = Status(StatusCode.UNSET)

        # Map span kind
        kind_val = span_data.get("kind", 0)
        kind_map = {0: SpanKind.INTERNAL, 1: SpanKind.SERVER, 2: SpanKind.CLIENT, 3: SpanKind.PRODUCER, 4: SpanKind.CONSUMER}
        kind = kind_map.get(kind_val, SpanKind.INTERNAL)

        span = ReadableSpan(
            name=span_data.get("name", "unknown"),
            context=ctx,
            parent=parent_ctx,
            resource=resource,
            attributes=attributes,
            kind=kind,
            status=status,
            start_time=int(span_data.get("startTimeUnixNano", 0)),
            end_time=int(span_data.get("endTimeUnixNano", 0)),
        )
        return span

    except Exception as exc:
        logger.debug(f"[Telemetry] Could not parse span: {exc}")
        return None

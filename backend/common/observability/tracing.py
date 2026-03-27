"""
OpenTelemetry tracing for Pillar agent server.

Always-on: traces are exported to local NDJSON files in development and to
Google Cloud Trace in production.  Instruments Django, ASGI, database, Redis,
and HTTP clients automatically.
"""
import logging
import os
from typing import Optional

from opentelemetry import trace, context as otel_context
from opentelemetry.context import Context
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SimpleSpanProcessor
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

logger = logging.getLogger(__name__)

_propagator = TraceContextTextMapPropagator()
_initialized = False


def _is_local_dev() -> bool:
    """Return True when running in local development (not Cloud Run)."""
    env = os.getenv("ENV", "dev").lower()
    return env in ("dev", "development", "local", "test", "e2e")


def _get_service_name() -> str:
    service_type = os.getenv("SERVICE_TYPE", "unknown")
    env = os.getenv("ENV", "dev")
    return f"pillar-{service_type}-{env}"


def setup_tracing(project_id: Optional[str] = None) -> trace.Tracer:
    """
    Initialize OpenTelemetry tracing.

    Always initialises a TracerProvider:
    - Local dev / E2E: ``FileSpanExporter`` with ``SimpleSpanProcessor``
    - Production: ``CloudTraceSpanExporter`` with ``BatchSpanProcessor``

    Safe to call multiple times; only the first call takes effect.
    Returns a Tracer.
    """
    global _initialized
    if _initialized:
        return trace.get_tracer("pillar")

    try:
        resource = Resource.create({
            "service.name": _get_service_name(),
            "service.version": os.getenv("APP_VERSION", "unknown"),
            "deployment.environment": os.getenv("ENV", "dev"),
        })

        # Merge GCP resource attributes when running on Cloud Run
        try:
            from opentelemetry.resourcedetector.gcp_resource_detector import (
                GoogleCloudResourceDetector,
            )
            gcp_resource = GoogleCloudResourceDetector().detect()
            resource = resource.merge(gcp_resource)
        except Exception:
            pass  # Not on GCP (local dev)

        provider = TracerProvider(resource=resource)

        if _is_local_dev():
            from common.observability.file_exporter import FileSpanExporter
            provider.add_span_processor(SimpleSpanProcessor(FileSpanExporter()))
            logger.info(
                f"[Tracing] Local file exporter enabled for "
                f"{resource.attributes.get('service.name', 'unknown')}"
            )
        else:
            # Production: Google Cloud Trace
            try:
                from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter

                cloud_exporter = CloudTraceSpanExporter(
                    project_id=project_id or os.getenv("GCP_PROJECT_ID"),
                )
                provider.add_span_processor(
                    BatchSpanProcessor(
                        cloud_exporter,
                        max_queue_size=2048,
                        max_export_batch_size=512,
                        schedule_delay_millis=5000,
                    )
                )
                logger.info(
                    f"[Tracing] Cloud Trace exporter enabled for "
                    f"{resource.attributes.get('service.name', 'unknown')} "
                    f"-> project: {project_id or 'auto'}"
                )
            except Exception as exc:
                logger.warning(f"[Tracing] Cloud Trace exporter unavailable: {exc}")

        trace.set_tracer_provider(provider)

        _auto_instrument()

        _initialized = True
        return trace.get_tracer("pillar")

    except Exception as exc:
        logger.error(f"[Tracing] Failed to initialize: {exc}", exc_info=True)
        return trace.get_tracer("pillar")


def _auto_instrument() -> None:
    """Auto-instrument Django, psycopg, Redis, and requests."""
    instrumentors = [
        ("opentelemetry.instrumentation.django", "DjangoInstrumentor"),
        ("opentelemetry.instrumentation.psycopg", "PsycopgInstrumentor"),
        ("opentelemetry.instrumentation.redis", "RedisInstrumentor"),
        ("opentelemetry.instrumentation.requests", "RequestsInstrumentor"),
    ]
    for mod_path, cls_name in instrumentors:
        try:
            mod = __import__(mod_path, fromlist=[cls_name])
            getattr(mod, cls_name)().instrument()
        except Exception as exc:
            logger.debug(f"[Tracing] Could not instrument {cls_name}: {exc}")


def get_tracer(name: str = "pillar") -> trace.Tracer:
    """Return a tracer instance (always safe to call, even before setup)."""
    return trace.get_tracer(name)


# ---------------------------------------------------------------------------
# Context propagation helpers
# ---------------------------------------------------------------------------

def extract_context_from_headers(headers: dict) -> Context:
    """Extract W3C traceparent context from HTTP headers."""
    return _propagator.extract(carrier=headers)


def inject_context_into_headers(headers: dict, ctx: Optional[Context] = None) -> dict:
    """Inject the current trace context into outgoing HTTP headers."""
    _propagator.inject(carrier=headers, context=ctx)
    return headers


def extract_context_from_request(request) -> Context:
    """
    Extract trace context from a Django HttpRequest.

    Looks for the standard ``traceparent`` header (Django normalises it as
    ``HTTP_TRACEPARENT``).
    """
    carrier = {}
    tp = request.META.get("HTTP_TRACEPARENT")
    if tp:
        carrier["traceparent"] = tp
    ts = request.META.get("HTTP_TRACESTATE")
    if ts:
        carrier["tracestate"] = ts
    return _propagator.extract(carrier=carrier)


def get_span_exporter():
    """
    Return the BatchSpanProcessor attached to the global TracerProvider.

    Used by the OTLP proxy endpoint to forward browser spans through the
    same exporter pipeline.
    """
    provider = trace.get_tracer_provider()
    if isinstance(provider, TracerProvider):
        return provider
    return None

"""
Tests for the OTLP trace proxy endpoint.

Verifies that browser-originated OTLP JSON spans are correctly parsed,
converted to ReadableSpan objects, and forwarded through the TracerProvider's
span processors.
"""
import json
from unittest.mock import MagicMock, patch

import pytest
from django.test import AsyncRequestFactory

from apps.mcp.views.telemetry import otlp_traces_proxy, _extract_value, _otlp_span_to_readable


def _make_otlp_body(
    *,
    trace_id: str = "0af7651916cd43dd8448eb211c80319c",
    span_id: str = "b7ad6b7169203331",
    parent_span_id: str | None = None,
    name: str = "browser-click",
    kind: int = 2,
    status_code: int = 0,
    attributes: list | None = None,
) -> dict:
    """Build a minimal OTLP/JSON resourceSpans payload."""
    span = {
        "traceId": trace_id,
        "spanId": span_id,
        "name": name,
        "kind": kind,
        "startTimeUnixNano": "1000000000",
        "endTimeUnixNano": "2000000000",
        "attributes": attributes or [],
        "status": {"code": status_code},
    }
    if parent_span_id:
        span["parentSpanId"] = parent_span_id

    return {
        "resourceSpans": [
            {
                "resource": {
                    "attributes": [
                        {"key": "service.name", "value": {"stringValue": "browser-sdk"}},
                    ]
                },
                "scopeSpans": [{"spans": [span]}],
            }
        ]
    }


@pytest.fixture
def rf():
    return AsyncRequestFactory()


# -- Unit tests for helpers --------------------------------------------------


class TestExtractValue:
    def test_string_value(self):
        assert _extract_value({"stringValue": "hello"}) == "hello"

    def test_int_value(self):
        assert _extract_value({"intValue": "42"}) == 42

    def test_double_value(self):
        assert _extract_value({"doubleValue": 3.14}) == 3.14

    def test_bool_value(self):
        assert _extract_value({"boolValue": True}) is True

    def test_fallback(self):
        assert _extract_value({"arrayValue": [1, 2]}) == str({"arrayValue": [1, 2]})


class TestOtlpSpanToReadable:
    def test_converts_basic_span(self):
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.trace import SpanKind

        resource = Resource.create({"service.name": "test"})
        span_data = {
            "traceId": "0af7651916cd43dd8448eb211c80319c",
            "spanId": "b7ad6b7169203331",
            "name": "test-span",
            "kind": 2,
            "startTimeUnixNano": "1000000000",
            "endTimeUnixNano": "2000000000",
            "attributes": [
                {"key": "http.method", "value": {"stringValue": "GET"}},
            ],
            "status": {"code": 0},
        }

        readable = _otlp_span_to_readable(span_data, resource)

        assert readable is not None
        assert readable.name == "test-span"
        assert readable.kind == SpanKind.CLIENT
        assert readable.attributes["http.method"] == "GET"

    def test_with_parent_span(self):
        from opentelemetry.sdk.resources import Resource

        resource = Resource.create({})
        span_data = {
            "traceId": "0af7651916cd43dd8448eb211c80319c",
            "spanId": "b7ad6b7169203331",
            "parentSpanId": "00f067aa0ba902b7",
            "name": "child-span",
            "kind": 0,
            "startTimeUnixNano": "1000000000",
            "endTimeUnixNano": "2000000000",
            "attributes": [],
            "status": {"code": 0},
        }

        readable = _otlp_span_to_readable(span_data, resource)

        assert readable is not None
        assert readable.parent is not None
        assert readable.parent.is_remote is True

    def test_error_status(self):
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.trace.status import StatusCode

        resource = Resource.create({})
        span_data = {
            "traceId": "0af7651916cd43dd8448eb211c80319c",
            "spanId": "b7ad6b7169203331",
            "name": "error-span",
            "kind": 0,
            "startTimeUnixNano": "1000000000",
            "endTimeUnixNano": "2000000000",
            "attributes": [],
            "status": {"code": 2, "message": "something broke"},
        }

        readable = _otlp_span_to_readable(span_data, resource)

        assert readable is not None
        assert readable.status.status_code == StatusCode.ERROR
        assert readable.status.description == "something broke"

    def test_returns_none_on_malformed_data(self):
        from opentelemetry.sdk.resources import Resource

        resource = Resource.create({})
        readable = _otlp_span_to_readable({"traceId": "not-hex"}, resource)
        assert readable is None


# -- Async endpoint tests ----------------------------------------------------


@pytest.mark.asyncio
async def test_options_returns_cors(rf):
    request = rf.options("/mcp/telemetry/v1/traces")
    response = await otlp_traces_proxy(request)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_invalid_json_returns_400(rf):
    request = rf.post(
        "/mcp/telemetry/v1/traces",
        data=b"not json",
        content_type="application/json",
    )
    response = await otlp_traces_proxy(request)
    assert response.status_code == 400
    assert json.loads(response.content)["error"] == "invalid_json"


@pytest.mark.asyncio
async def test_no_exporter_returns_200(rf):
    request = rf.post(
        "/mcp/telemetry/v1/traces",
        data=json.dumps(_make_otlp_body()),
        content_type="application/json",
    )
    with patch("apps.mcp.views.telemetry.get_span_exporter", return_value=None):
        response = await otlp_traces_proxy(request)

    assert response.status_code == 200
    assert json.loads(response.content)["status"] == "no_exporter"


@pytest.mark.asyncio
async def test_valid_spans_are_forwarded_to_processors(rf):
    mock_processor = MagicMock()
    mock_active = MagicMock()
    mock_active._span_processors = [mock_processor]
    mock_provider = MagicMock()
    mock_provider._active_span_processor = mock_active

    request = rf.post(
        "/mcp/telemetry/v1/traces",
        data=json.dumps(_make_otlp_body()),
        content_type="application/json",
    )
    with patch("apps.mcp.views.telemetry.get_span_exporter", return_value=mock_provider):
        response = await otlp_traces_proxy(request)

    assert response.status_code == 200
    body = json.loads(response.content)
    assert body["accepted"] == 1
    mock_processor.on_end.assert_called_once()

    exported_span = mock_processor.on_end.call_args[0][0]
    assert exported_span.name == "browser-click"


@pytest.mark.asyncio
async def test_empty_resource_spans_accepted_as_zero(rf):
    request = rf.post(
        "/mcp/telemetry/v1/traces",
        data=json.dumps({"resourceSpans": []}),
        content_type="application/json",
    )
    with patch("apps.mcp.views.telemetry.get_span_exporter", return_value=MagicMock()):
        response = await otlp_traces_proxy(request)

    assert response.status_code == 200
    assert json.loads(response.content)["accepted"] == 0

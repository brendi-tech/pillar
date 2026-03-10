"""
Tests for the Cloud Logging formatter and deduplication filter.

Verifies:
- JSON output contains Cloud Logging-required fields (severity, sourceLocation)
- Exception metadata (exception_type, exception_module, stack_trace) is emitted
- Severity mapping matches Cloud Logging values
- DeduplicateExceptionFilter suppresses inner tracebacks for chained exceptions
- Normal (non-exception) logs pass through the dedup filter unchanged
"""
import json
import io
import logging

import pytest

from common.logging import CloudLoggingFormatter, DeduplicateExceptionFilter


@pytest.fixture()
def json_logger():
    """Create a logger with CloudLoggingFormatter writing to a StringIO buffer."""
    buf = io.StringIO()
    handler = logging.StreamHandler(buf)
    handler.setFormatter(
        CloudLoggingFormatter("%(message)s %(levelname)s %(name)s")
    )
    logger = logging.getLogger("test.cloud_logging")
    logger.handlers = [handler]
    logger.setLevel(logging.DEBUG)
    logger.propagate = False
    return logger, buf


def _parse_last_line(buf: io.StringIO) -> dict:
    """Return the last non-empty JSON line from the buffer."""
    buf.seek(0)
    lines = [ln.strip() for ln in buf.readlines() if ln.strip()]
    assert lines, "No log output produced"
    return json.loads(lines[-1])


class TestCloudLoggingFormatter:
    """Verify structured JSON output matches Cloud Logging expectations."""

    def test_info_log_has_severity(self, json_logger):
        logger, buf = json_logger
        logger.info("hello world")
        record = _parse_last_line(buf)
        assert record["severity"] == "INFO"
        assert record["message"] == "hello world"

    @pytest.mark.parametrize(
        "level,expected_severity",
        [
            (logging.DEBUG, "DEBUG"),
            (logging.INFO, "INFO"),
            (logging.WARNING, "WARNING"),
            (logging.ERROR, "ERROR"),
            (logging.CRITICAL, "CRITICAL"),
        ],
    )
    def test_severity_mapping(self, json_logger, level, expected_severity):
        logger, buf = json_logger
        logger.log(level, "test message")
        record = _parse_last_line(buf)
        assert record["severity"] == expected_severity

    def test_source_location_present(self, json_logger):
        logger, buf = json_logger
        logger.info("check location")
        record = _parse_last_line(buf)
        loc = record["logging.googleapis.com/sourceLocation"]
        assert "file" in loc
        assert "line" in loc
        assert "function" in loc
        assert isinstance(loc["line"], int)

    def test_logger_name_included(self, json_logger):
        logger, buf = json_logger
        logger.info("check logger")
        record = _parse_last_line(buf)
        assert record["logger"] == "test.cloud_logging"

    def test_service_field_present(self, json_logger):
        logger, buf = json_logger
        logger.info("check service")
        record = _parse_last_line(buf)
        assert "service" in record

    def test_exception_metadata_on_error(self, json_logger):
        logger, buf = json_logger
        try:
            raise ValueError("bad value")
        except ValueError:
            logger.error("something broke", exc_info=True)
        record = _parse_last_line(buf)
        assert record["exception_type"] == "ValueError"
        assert record["exception_module"] == "builtins"
        assert "stack_trace" in record
        assert "bad value" in record["stack_trace"]

    def test_no_exception_fields_on_normal_log(self, json_logger):
        logger, buf = json_logger
        logger.warning("just a warning")
        record = _parse_last_line(buf)
        assert "exception_type" not in record
        assert "stack_trace" not in record

    def test_extra_fields_pass_through(self, json_logger):
        logger, buf = json_logger
        logger.info(
            "with context",
            extra={"view": "MyView", "method": "GET", "path": "/api/test/"},
        )
        record = _parse_last_line(buf)
        assert record["view"] == "MyView"
        assert record["method"] == "GET"
        assert record["path"] == "/api/test/"

    def test_output_is_valid_single_line_json(self, json_logger):
        logger, buf = json_logger
        try:
            raise RuntimeError("multi\nline\nerror")
        except RuntimeError:
            logger.error("error with newlines", exc_info=True)
        buf.seek(0)
        lines = [ln for ln in buf.readlines() if ln.strip()]
        assert len(lines) == 1, "JSON output must be a single line for Cloud Logging"
        json.loads(lines[0])


class TestDeduplicateExceptionFilter:
    """Verify the filter suppresses duplicate inner tracebacks."""

    @pytest.fixture()
    def filtered_logger(self):
        buf = io.StringIO()
        handler = logging.StreamHandler(buf)
        handler.setFormatter(
            CloudLoggingFormatter("%(message)s %(levelname)s %(name)s")
        )
        handler.addFilter(DeduplicateExceptionFilter())
        logger = logging.getLogger("test.dedup")
        logger.handlers = [handler]
        logger.setLevel(logging.DEBUG)
        logger.propagate = False
        return logger, buf

    def test_normal_logs_pass_through(self, filtered_logger):
        logger, buf = filtered_logger
        logger.info("normal message")
        logger.warning("another message")
        buf.seek(0)
        lines = [ln.strip() for ln in buf.readlines() if ln.strip()]
        assert len(lines) == 2

    def test_single_exception_passes(self, filtered_logger):
        logger, buf = filtered_logger
        try:
            raise ValueError("standalone error")
        except ValueError:
            logger.error("error", exc_info=True)
        buf.seek(0)
        lines = [ln.strip() for ln in buf.readlines() if ln.strip()]
        assert len(lines) == 1

    def test_chained_exception_deduplicates(self, filtered_logger):
        """Simulate Django's DB error pattern: inner exception logged, then
        the wrapping exception is logged with __cause__ pointing to the inner."""
        logger, buf = filtered_logger

        inner_exc = None
        outer_exc = None
        try:
            try:
                raise ConnectionError("connection refused")
            except ConnectionError as inner:
                inner_exc = inner
                raise RuntimeError("database query failed") from inner
        except RuntimeError as outer:
            outer_exc = outer

        # Log the outer (wrapping) exception first -- this records inner's id
        logger.error("wrapped error", exc_info=(type(outer_exc), outer_exc, None))
        # Now log the inner exception -- should be suppressed
        logger.error("inner error", exc_info=(type(inner_exc), inner_exc, None))

        buf.seek(0)
        lines = [ln.strip() for ln in buf.readlines() if ln.strip()]
        assert len(lines) == 1, (
            "Inner exception should be suppressed when the wrapping exception "
            "was already logged"
        )
        record = json.loads(lines[0])
        assert record["message"] == "wrapped error"

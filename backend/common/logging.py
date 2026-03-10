"""
Cloud Logging-compatible structured JSON formatter and log noise filters.

Cloud Run captures stdout/stderr and auto-parses JSON lines into structured
log entries. This formatter outputs JSON with fields that Cloud Logging
recognises natively (severity, sourceLocation, labels).
"""
import logging
import os
import traceback
from typing import Any

from pythonjsonlogger.json import JsonFormatter


class CloudLoggingFormatter(JsonFormatter):
    """JSON formatter that maps Python log levels to Cloud Logging severity
    and attaches service context + exception metadata."""

    _SEVERITY_MAP = {
        "DEBUG": "DEBUG",
        "INFO": "INFO",
        "WARNING": "WARNING",
        "ERROR": "ERROR",
        "CRITICAL": "CRITICAL",
    }

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._service_name = os.environ.get("K_SERVICE", "unknown")

    def add_fields(
        self,
        log_record: dict,
        record: logging.LogRecord,
        message_dict: dict,
    ) -> None:
        super().add_fields(log_record, record, message_dict)

        log_record["severity"] = self._SEVERITY_MAP.get(
            record.levelname, "DEFAULT"
        )
        log_record["logger"] = record.name
        log_record["service"] = self._service_name

        log_record["logging.googleapis.com/sourceLocation"] = {
            "file": record.pathname,
            "line": record.lineno,
            "function": record.funcName,
        }

        if record.exc_info and record.exc_info[1]:
            exc = record.exc_info[1]
            log_record["exception_type"] = type(exc).__qualname__
            log_record["exception_module"] = type(exc).__module__
            log_record["stack_trace"] = "".join(
                traceback.format_exception(*record.exc_info)
            )


class DeduplicateExceptionFilter(logging.Filter):
    """Suppress the short "inner" traceback that Django emits for DB errors.

    When a database query fails, Django's ORM logs the raw psycopg/DB-API
    error as one ERROR entry, then re-raises the wrapped
    ``django.db.utils.*Error`` which produces a second, fuller traceback.
    This filter drops the short inner one so each real failure produces
    exactly one log entry.

    It works by remembering the last exception identity per thread; if the
    same exception object is logged twice within a short window the second
    (duplicate) emit is suppressed.
    """

    def __init__(self) -> None:
        super().__init__()
        self._seen: dict[int, int] = {}

    def filter(self, record: logging.LogRecord) -> bool:
        if not record.exc_info or not record.exc_info[1]:
            return True

        exc = record.exc_info[1]
        exc_id = id(exc)

        if exc_id in self._seen:
            del self._seen[exc_id]
            return False

        cause = getattr(exc, "__cause__", None) or getattr(
            exc, "__context__", None
        )
        if cause is not None:
            self._seen[id(cause)] = exc_id

        return True

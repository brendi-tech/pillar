/**
 * Cloud Logging-compatible structured JSON logger.
 *
 * Cloud Run captures stdout/stderr and auto-parses JSON lines into structured
 * log entries. This module configures pino to output JSON with the same fields
 * the backend's CloudLoggingFormatter uses (severity, service, exception_type,
 * stack_trace) so every log — including Next.js's own error output — becomes
 * a single structured entry in Cloud Logging.
 *
 * Usage: call patchConsole() once during server startup (instrumentation.ts)
 * to redirect console.log/warn/error/debug through pino in production.
 */
import pino from "pino";

const SEVERITY_MAP: Record<string, string> = {
  trace: "DEBUG",
  debug: "DEBUG",
  info: "INFO",
  warn: "WARNING",
  error: "ERROR",
  fatal: "CRITICAL",
};

const serviceName = process.env.K_SERVICE || "unknown";

export const logger = pino({
  messageKey: "message",
  formatters: {
    level(label) {
      return { severity: SEVERITY_MAP[label] || "DEFAULT" };
    },
    log(object) {
      const result: Record<string, unknown> = {
        ...object,
        service: serviceName,
      };

      if (result.err && typeof result.err === "object") {
        const err = result.err as Record<string, unknown>;
        result.exception_type = err.type || "Error";
        result.stack_trace = err.stack;
        delete result.err;
      }

      return result;
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Extracts a message string and the first Error from a list of console args.
 * Non-string, non-Error values are JSON-stringified.
 */
function formatArgs(args: unknown[]): { message: string; err?: Error } {
  let err: Error | undefined;
  const parts: string[] = [];

  for (const arg of args) {
    if (arg instanceof Error && !err) {
      err = arg;
      parts.push(arg.message);
    } else if (typeof arg === "string") {
      parts.push(arg);
    } else {
      try {
        parts.push(
          typeof arg === "object" ? JSON.stringify(arg) : String(arg),
        );
      } catch {
        parts.push(String(arg));
      }
    }
  }

  return { message: parts.join(" "), err };
}

/**
 * Replace console.log/info/warn/error/debug with pino-backed equivalents.
 * Call once in instrumentation.ts register() for the Node.js runtime.
 */
export function patchConsole(): void {
  const methods = {
    log: logger.info.bind(logger),
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
    debug: logger.debug.bind(logger),
  } as const;

  for (const [method, logFn] of Object.entries(methods)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (console as any)[method] = (...args: unknown[]) => {
      const { message, err } = formatArgs(args);
      if (err) {
        logFn({ err }, message);
      } else {
        logFn(message);
      }
    };
  }
}

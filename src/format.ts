import type { CloudProvider, LogFormat, LogRecord } from "./types.js";

const COLORS: Record<string, string> = {
  debug: "\x1b[35m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  fatal: "\x1b[41m\x1b[37m",
  reset: "\x1b[0m",
  dim: "\x1b[2m",
};

const GCP_SEVERITY: Record<string, string> = {
  debug: "DEBUG",
  info: "INFO",
  warn: "WARNING",
  error: "ERROR",
  fatal: "CRITICAL",
};

export function formatJson(record: LogRecord): string {
  return JSON.stringify(record);
}

export function formatPretty(record: LogRecord, color = true): string {
  const c = color ? COLORS : { debug: "", info: "", warn: "", error: "", fatal: "", reset: "", dim: "" };
  const level = record.level.toUpperCase().padEnd(5);
  const parts = [
    `${c[record.level] ?? ""}${level}${c.reset}`,
    `${c.dim}${record.time}${c.reset}`,
  ];
  if (record.requestId) parts.push(`${c.dim}req:${record.requestId}${c.reset}`);
  if (record.trace_id) parts.push(`${c.dim}trace:${record.trace_id}${c.reset}`);
  parts.push(record.message);

  const skip = new Set([
    "level",
    "message",
    "time",
    "requestId",
    "trace_id",
    "span_id",
    "err",
  ]);
  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (!skip.has(k)) extras[k] = v;
  }
  let line = parts.join(" ");
  if (Object.keys(extras).length) {
    line += ` ${c.dim}${JSON.stringify(extras)}${c.reset}`;
  }
  if (record.err?.stack) {
    line += `\n${c.dim}${record.err.stack}${c.reset}`;
  }
  return line;
}

/**
 * Cloud-friendly JSON (GCP Logging / CloudWatch / Azure Monitor friendly).
 */
export function formatCloud(
  record: LogRecord,
  provider: CloudProvider = "gcp",
): string {
  if (provider === "gcp") {
    const payload: Record<string, unknown> = {
      severity: GCP_SEVERITY[record.level] ?? "DEFAULT",
      message: record.message,
      timestamp: record.time,
      ...(record.requestId ? { "logging.googleapis.com/labels": { requestId: record.requestId } } : {}),
      ...(record.trace_id
        ? { "logging.googleapis.com/trace": record.trace_id }
        : {}),
      ...(record.span_id
        ? { "logging.googleapis.com/spanId": record.span_id }
        : {}),
    };
    for (const [k, v] of Object.entries(record)) {
      if (
        !["level", "message", "time", "requestId", "trace_id", "span_id"].includes(k)
      ) {
        payload[k] = v;
      }
    }
    return JSON.stringify(payload);
  }

  // aws / azure: flat JSON with severity + request id
  return JSON.stringify({
    severity: record.level.toUpperCase(),
    message: record.message,
    timestamp: record.time,
    requestId: record.requestId,
    traceId: record.trace_id,
    spanId: record.span_id,
    ...Object.fromEntries(
      Object.entries(record).filter(
        ([k]) =>
          !["level", "message", "time", "requestId", "trace_id", "span_id"].includes(
            k,
          ),
      ),
    ),
  });
}

export function formatRecord(
  record: LogRecord,
  format: LogFormat,
  options: { color?: boolean; cloud?: CloudProvider } = {},
): string {
  if (format === "pretty") return formatPretty(record, options.color ?? true);
  if (format === "cloud") return formatCloud(record, options.cloud ?? "gcp");
  return formatJson(record);
}

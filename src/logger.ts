import type {
  LogBindings,
  LogLevel,
  LogRecord,
  LoggerOptions,
  Destination,
  OtelContextProvider,
} from "./types.js";
import { LEVELS } from "./types.js";
import { formatRecord } from "./format.js";
import { getRequestId } from "./request-id.js";
import {
  createCollectDestination,
  createRotatingFileDestination,
  createStdoutDestination,
} from "./destination.js";

function serializeError(err: unknown): LogRecord["err"] | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      message: err.message,
      name: err.name,
      stack: err.stack,
    };
  }
  return { message: String(err) };
}

/**
 * Modern structured logger.
 *
 * @example
 * ```ts
 * const log = createLogger({ format: "pretty" });
 * log.info("server started", { port: 3000 });
 * ```
 */
export class Logger {
  private level: LogLevel;
  private format: LoggerOptions["format"];
  private cloud: LoggerOptions["cloud"];
  private bindings: LogBindings;
  private destinations: Destination[];
  private color: boolean;
  private otel: false | OtelContextProvider;
  readonly name?: string;

  constructor(options: LoggerOptions = {}) {
    this.name = options.name;
    this.level = options.level ?? (process.env.LOG_LEVEL as LogLevel) ?? "info";
    this.format =
      options.format ??
      (process.env.NODE_ENV === "production" ? "json" : "pretty");
    this.cloud = options.cloud ?? "gcp";
    this.bindings = { ...(options.bindings ?? {}) };
    this.color = options.color ?? Boolean(process.stdout.isTTY);
    this.otel =
      options.otel === true
        ? () => undefined
        : typeof options.otel === "function"
          ? options.otel
          : false;

    const destinations: Destination[] = [];
    if (options.stdout !== false) destinations.push(createStdoutDestination());
    if (options.file) destinations.push(createRotatingFileDestination(options.file));
    if (options.destination) {
      const extra = Array.isArray(options.destination)
        ? options.destination
        : [options.destination];
      destinations.push(...extra);
    }
    this.destinations = destinations;
  }

  child(bindings: LogBindings): Logger {
    return new Logger({
      name: this.name,
      level: this.level,
      format: this.format,
      cloud: this.cloud,
      bindings: { ...this.bindings, ...bindings },
      destination: this.destinations,
      stdout: false,
      color: this.color,
      otel: this.otel === false ? false : this.otel,
    });
  }

  private enabled(level: LogLevel): boolean {
    return (LEVELS[level] ?? 0) >= (LEVELS[this.level] ?? 0);
  }

  private write(level: LogLevel, message: string, bindings: LogBindings = {}) {
    if (!this.enabled(level)) return;

    const requestId = getRequestId();
    const otel = this.otel ? this.otel() : undefined;
    const err = serializeError(bindings.err ?? bindings.error);

    const record: LogRecord = {
      ...this.bindings,
      ...bindings,
      level,
      message,
      time: new Date().toISOString(),
      ...(this.name ? { name: this.name } : {}),
      ...(requestId ? { requestId } : {}),
      ...(otel?.traceId ? { trace_id: otel.traceId } : {}),
      ...(otel?.spanId ? { span_id: otel.spanId } : {}),
      ...(err ? { err } : {}),
    };
    delete (record as LogBindings).error;

    const line = formatRecord(record, this.format ?? "json", {
      color: this.color,
      cloud: this.cloud,
    });

    for (const dest of this.destinations) {
      void dest.write(line, record);
    }
  }

  debug(message: string, bindings?: LogBindings) {
    this.write("debug", message, bindings);
  }
  info(message: string, bindings?: LogBindings) {
    this.write("info", message, bindings);
  }
  warn(message: string, bindings?: LogBindings) {
    this.write("warn", message, bindings);
  }
  error(message: string, bindings?: LogBindings) {
    this.write("error", message, bindings);
  }
  fatal(message: string, bindings?: LogBindings) {
    this.write("fatal", message, bindings);
  }

  async flush(): Promise<void> {
    await Promise.all(this.destinations.map((d) => d.flush?.()));
  }

  async close(): Promise<void> {
    await Promise.all(this.destinations.map((d) => d.close?.()));
  }
}

export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}

/** Capture logs into an array (tests). */
export function createTestLogger(): { log: Logger; lines: string[] } {
  const lines: string[] = [];
  const log = new Logger({
    format: "json",
    stdout: false,
    level: "debug",
    destination: createCollectDestination(lines),
  });
  return { log, lines };
}

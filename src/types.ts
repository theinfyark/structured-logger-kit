export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal" | "silent";

export const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
  silent: 100,
};

export type LogFormat = "json" | "pretty" | "cloud";

export type CloudProvider = "gcp" | "aws" | "azure";

export interface LogBindings {
  [key: string]: unknown;
}

export interface LogRecord extends LogBindings {
  level: LogLevel;
  message: string;
  time: string;
  requestId?: string;
  trace_id?: string;
  span_id?: string;
  err?: {
    message: string;
    name?: string;
    stack?: string;
  };
}

export interface OpenTelemetryContext {
  traceId?: string;
  spanId?: string;
}

export type OtelContextProvider = () => OpenTelemetryContext | undefined;

export interface Destination {
  write: (line: string, record: LogRecord) => void | Promise<void>;
  flush?: () => void | Promise<void>;
  close?: () => void | Promise<void>;
}

export interface FileRotationOptions {
  /** Destination file path */
  path: string;
  /** Max size in bytes before rotate. Default: 10MB */
  maxSizeBytes?: number;
  /** Number of rotated files to keep. Default: 5 */
  maxFiles?: number;
}

export interface LoggerOptions {
  name?: string;
  level?: LogLevel;
  format?: LogFormat;
  /** Cloud JSON style when format is "cloud" */
  cloud?: CloudProvider;
  bindings?: LogBindings;
  destination?: Destination | Destination[];
  /** Auto stdout destination. Default: true */
  stdout?: boolean;
  color?: boolean;
  otel?: boolean | OtelContextProvider;
  file?: FileRotationOptions;
}

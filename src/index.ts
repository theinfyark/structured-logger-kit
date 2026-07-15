export { createLogger, Logger, createTestLogger } from "./logger.js";
export {
  withRequestId,
  getRequestId,
  requestIdMiddleware,
  requestStore,
} from "./request-id.js";
export {
  formatJson,
  formatPretty,
  formatCloud,
  formatRecord,
} from "./format.js";
export {
  createRotatingFileDestination,
  createStdoutDestination,
  createCollectDestination,
} from "./destination.js";
export { LEVELS } from "./types.js";

export type {
  LogLevel,
  LogFormat,
  CloudProvider,
  LogBindings,
  LogRecord,
  OpenTelemetryContext,
  OtelContextProvider,
  Destination,
  FileRotationOptions,
  LoggerOptions,
} from "./types.js";

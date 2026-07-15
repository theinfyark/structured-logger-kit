# structured-logger-kit

## Introduction

**structured-logger-kit** is a modern structured logger for Node.js.

It supports **JSON**, **pretty** console output, **request IDs**, optional **OpenTelemetry** context hooks, **cloud logging** shapes (GCP / AWS / Azure), and **size-based file rotation** — with zero runtime dependencies.

Works from **TypeScript and JavaScript** (ESM + CommonJS + `.d.ts`).

## Why this package exists

Most apps need more than `console.log`, but full frameworks (or heavy wrappers) are overkill for many services. **structured-logger-kit** gives you production defaults — structured fields, request correlation, cloud-friendly JSON, and rotating files — in a small, typed package inspired by the DX of libraries like pino, without requiring native addons.

## Installation

```bash
npm install structured-logger-kit
```

Requires Node.js 18+.

## Features

- Levels: `debug` · `info` · `warn` · `error` · `fatal` · `silent`
- Formats: `json` · `pretty` · `cloud`
- Request IDs via `AsyncLocalStorage` (+ Express middleware)
- Optional OpenTelemetry `trace_id` / `span_id` injection (you provide the provider; no hard OTel dependency)
- Cloud-friendly payloads for GCP Logging, CloudWatch, Azure Monitor
- Size-based file rotation (no external deps)
- Child loggers with merged bindings
- Dual ESM + CJS + TypeScript types
- Zero runtime dependencies

## Quick Start

### TypeScript

```ts
import { createLogger, withRequestId } from "structured-logger-kit";

const log = createLogger({
  name: "api",
  format: "pretty", // or "json" / "cloud"
  level: "info",
});

log.info("server started", { port: 3000 });

withRequestId("req-abc", () => {
  log.info("handling request");
});
```

### JavaScript

```js
import { createLogger, withRequestId } from "structured-logger-kit";

const log = createLogger({ name: "api", format: "json" });

log.info("server started", { port: 3000 });

withRequestId("req-abc", () => {
  log.info("handling request");
});
```

### CommonJS

```js
const { createLogger } = require("structured-logger-kit");
const log = createLogger({ format: "json" });
log.info("hello");
```

## API Reference

### `createLogger(options?)`

Creates a `Logger`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | — | Logger name field |
| `level` | `LogLevel` | `process.env.LOG_LEVEL` or `"info"` | Minimum level |
| `format` | `"json" \| "pretty" \| "cloud"` | pretty in non-prod, json in prod | Output format |
| `cloud` | `"gcp" \| "aws" \| "azure"` | `"gcp"` | Cloud JSON shape when `format: "cloud"` |
| `bindings` | `object` | `{}` | Fields on every log |
| `stdout` | `boolean` | `true` | Write to stdout |
| `file` | `FileRotationOptions` | — | Rotating file destination |
| `destination` | `Destination \| Destination[]` | — | Custom sinks |
| `color` | `boolean` | TTY | Pretty colors |
| `otel` | `false \| true \| () => { traceId?, spanId? }` | `false` | OTel field injection |

### `Logger` methods

- `debug|info|warn|error|fatal(message, bindings?)`
- `child(bindings)` — merge bindings
- `flush()` / `close()` — flush/close destinations

### Request IDs

- `withRequestId(id?, fn)` — run `fn` with a request id
- `getRequestId()` — read current id
- `requestIdMiddleware(header?)` — Express-style middleware (`x-request-id`)

### Formats / destinations

- `formatJson` · `formatPretty` · `formatCloud` · `formatRecord`
- `createRotatingFileDestination` · `createStdoutDestination` · `createCollectDestination`
- `createTestLogger()` — `{ log, lines }` for tests

## Examples

```ts
const log = createLogger({
  format: "cloud",
  cloud: "gcp",
  bindings: { service: "checkout" },
});

log.warn("slow query", { ms: 420, sql: "SELECT ..." });
log.error("payment failed", { err: new Error("timeout"), orderId: "o-1" });
```

## Advanced Examples

### File rotation

```ts
const log = createLogger({
  format: "json",
  file: {
    path: "./logs/app.log",
    maxSizeBytes: 10 * 1024 * 1024,
    maxFiles: 5,
  },
});
```

### OpenTelemetry (no hard dependency)

```ts
import { createLogger } from "structured-logger-kit";
import { trace } from "@opentelemetry/api"; // your dependency

const log = createLogger({
  format: "json",
  otel: () => {
    const span = trace.getActiveSpan();
    const ctx = span?.spanContext();
    return ctx ? { traceId: ctx.traceId, spanId: ctx.spanId } : undefined;
  },
});
```

### Custom destination

```ts
createLogger({
  stdout: false,
  destination: {
    write(line, record) {
      // ship to HTTP / queue / buffer
      void line;
      void record;
    },
  },
});
```

## Framework Integration

### Express

```ts
import express from "express";
import { createLogger, requestIdMiddleware } from "structured-logger-kit";

const app = express();
const log = createLogger({ format: "json" });

app.use(requestIdMiddleware());
app.use((req, _res, next) => {
  log.info("request", { method: req.method, url: req.url });
  next();
});
```

### Fastify / Hono / Nest

Create one logger at boot, use `withRequestId` (or middleware equivalent) per request, pass `log.child({ route })` into handlers.

## TypeScript Usage

```ts
import {
  createLogger,
  type LoggerOptions,
  type LogRecord,
} from "structured-logger-kit";

const options: LoggerOptions = { level: "debug", format: "pretty" };
const log = createLogger(options);
```

Types ship via `exports.types`. Prefer `strict` in your `tsconfig`.

## Error Handling

Pass errors as `err` (or `error`) in bindings — they are serialized to `{ message, name, stack }` without throwing:

```ts
try {
  await work();
} catch (err) {
  log.error("work failed", { err });
}
```

Destinations that throw should be wrapped by the caller; the logger itself does not catch destination errors.

## Performance

- Synchronous format + write on the hot path (same model as typical Node loggers)
- Zero runtime dependencies
- Child loggers share destinations (no extra file handles)
- Prefer `json`/`cloud` in production; use `pretty` only for local TTY

## Best Practices

- Use `json` or `cloud` in production (log aggregators)
- Always propagate request ids (`withRequestId` / middleware)
- Add service/version via root `bindings`
- Wire OTel via a provider — don’t bundle OTel into every process
- Rotate files for long-running hosts; prefer stdout on containers
- Never log secrets / raw PII

## FAQ

**Is this a drop-in for pino?**  
Same idea (structured levels + JSON), different API. No worker-thread transport; destinations are pluggable.

**Do I need OpenTelemetry installed?**  
No. Pass `otel: () => ({ traceId, spanId })` only if you already have a tracer.

**Does cloud format talk to GCP/AWS APIs?**  
No — it emits agent-friendly JSON on stdout/files. Wire your platform’s logging agent / collector.

**Can I use CommonJS?**  
Yes: `require("structured-logger-kit")`.

## Migration Guide

### From `console.log`

Replace ad-hoc strings with `createLogger()` and structured bindings.

### From pino / winston

Map levels 1:1; move redaction/transports to custom `destination`s. Prefer `child()` for request-scoped fields, or rely on request-id ALS.

### SemVer

Breaking changes only in major versions — see `CHANGELOG.md`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No logs | Check `level` / `LOG_LEVEL` (too high) or `silent` |
| Missing `requestId` | Ensure `withRequestId` / middleware wraps the async work |
| Ugly CI output | Set `format: "json"` or `color: false` |
| Types not found | Import from `structured-logger-kit`; use Node 18+ / modern `moduleResolution` |
| Rotation not creating `.1` files | Raise write volume past `maxSizeBytes` |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT

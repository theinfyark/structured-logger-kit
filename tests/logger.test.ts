import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createLogger,
  createTestLogger,
  withRequestId,
  getRequestId,
  formatCloud,
  formatPretty,
  formatJson,
  createRotatingFileDestination,
  type LogRecord,
} from "../src/index.js";

describe("createLogger", () => {
  it("logs json lines", () => {
    const { log, lines } = createTestLogger();
    log.info("hello", { userId: 1 });
    expect(lines).toHaveLength(1);
    const row = JSON.parse(lines[0]!);
    expect(row.level).toBe("info");
    expect(row.message).toBe("hello");
    expect(row.userId).toBe(1);
    expect(row.time).toMatch(/^\d{4}-/);
  });

  it("defaults unknown LOG_LEVEL to info", () => {
    const lines: string[] = [];
    const log = createLogger({
      level: "verbose" as never,
      format: "json",
      stdout: false,
      destination: {
        write(line) {
          lines.push(line);
        },
      },
    });
    log.debug("nope");
    log.info("yes");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!).message).toBe("yes");
  });

  it("respects log level", () => {
    const { log, lines } = createTestLogger();
    const quiet = createLogger({
      level: "warn",
      format: "json",
      stdout: false,
      destination: {
        write(line) {
          lines.push(line);
        },
      },
    });
    quiet.debug("nope");
    quiet.info("nope");
    quiet.warn("yes");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!).message).toBe("yes");
  });

  it("child merges bindings", () => {
    const { log, lines } = createTestLogger();
    log.child({ service: "api" }).info("ok");
    expect(JSON.parse(lines[0]!).service).toBe("api");
  });

  it("serializes errors", () => {
    const { log, lines } = createTestLogger();
    log.error("failed", { err: new Error("boom") });
    const row = JSON.parse(lines[0]!);
    expect(row.err.message).toBe("boom");
    expect(row.err.stack).toContain("Error: boom");
  });

  it("binds request id via withRequestId", () => {
    const { log, lines } = createTestLogger();
    withRequestId("req-123", () => {
      expect(getRequestId()).toBe("req-123");
      log.info("inside");
    });
    expect(JSON.parse(lines[0]!).requestId).toBe("req-123");
  });

  it("injects OpenTelemetry fields from provider", () => {
    const lines: string[] = [];
    const log = createLogger({
      format: "json",
      stdout: false,
      otel: () => ({ traceId: "trace-1", spanId: "span-1" }),
      destination: {
        write(line) {
          lines.push(line);
        },
      },
    });
    log.info("traced");
    const row = JSON.parse(lines[0]!);
    expect(row.trace_id).toBe("trace-1");
    expect(row.span_id).toBe("span-1");
  });
});

describe("formatters", () => {
  const base: LogRecord = {
    level: "info",
    message: "hi",
    time: "2026-01-01T00:00:00.000Z",
    requestId: "r1",
  };

  it("formatJson", () => {
    expect(JSON.parse(formatJson(base)).message).toBe("hi");
  });

  it("formatPretty includes level and message", () => {
    const line = formatPretty(base, false);
    expect(line).toContain("INFO");
    expect(line).toContain("hi");
    expect(line).toContain("req:r1");
  });

  it("formatCloud gcp uses severity", () => {
    const row = JSON.parse(formatCloud(base, "gcp"));
    expect(row.severity).toBe("INFO");
    expect(row.message).toBe("hi");
  });

  it("formatCloud aws is flat", () => {
    const row = JSON.parse(formatCloud(base, "aws"));
    expect(row.severity).toBe("INFO");
    expect(row.requestId).toBe("r1");
  });
});

describe("file rotation", () => {
  it("rotates when max size exceeded", async () => {
    const dir = mkdtempSync(join(tmpdir(), "slk-"));
    const path = join(dir, "app.log");
    try {
      const dest = createRotatingFileDestination({
        path,
        maxSizeBytes: 40,
        maxFiles: 3,
      });
      for (let i = 0; i < 10; i += 1) {
        dest.write(`line-${i}-xxxxxxxx`, {
          level: "info",
          message: "x",
          time: new Date().toISOString(),
        });
      }
      await dest.flush?.();
      dest.close?.();
      const body = readFileSync(path, "utf8");
      expect(body.length).toBeGreaterThan(0);
      expect(body).toContain("line-");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

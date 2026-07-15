import {
  createWriteStream,
  existsSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";
import type { WriteStream } from "node:fs";
import type { Destination, FileRotationOptions, LogRecord } from "./types.js";

/**
 * Size-based file rotation destination (no external deps).
 */
export function createRotatingFileDestination(
  options: FileRotationOptions,
): Destination {
  const maxSize = options.maxSizeBytes ?? 10 * 1024 * 1024;
  const maxFiles = options.maxFiles ?? 5;
  let size = existsSync(options.path) ? statSync(options.path).size : 0;
  let stream: WriteStream = createWriteStream(options.path, { flags: "a" });

  const rotate = () => {
    stream.end();
    for (let i = maxFiles - 1; i >= 1; i -= 1) {
      const src = i === 1 ? options.path : `${options.path}.${i - 1}`;
      const dest = `${options.path}.${i}`;
      if (existsSync(src)) {
        if (existsSync(dest)) unlinkSync(dest);
        renameSync(src, dest);
      }
    }
    stream = createWriteStream(options.path, { flags: "a" });
    size = 0;
  };

  return {
    write(line: string, _record: LogRecord) {
      const chunk = `${line}\n`;
      if (size + chunk.length > maxSize) rotate();
      stream.write(chunk);
      size += chunk.length;
    },
    async flush() {
      await new Promise<void>((resolve) => stream.write("", () => resolve()));
    },
    close() {
      stream.end();
    },
  };
}

export function createStdoutDestination(): Destination {
  return {
    write(line: string) {
      process.stdout.write(`${line}\n`);
    },
  };
}

export function createCollectDestination(lines: string[]): Destination {
  return {
    write(line: string) {
      lines.push(line);
    },
  };
}

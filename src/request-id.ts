import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export interface RequestStore {
  requestId: string;
}

export const requestStore = new AsyncLocalStorage<RequestStore>();

export function getRequestId(): string | undefined {
  return requestStore.getStore()?.requestId;
}

/**
 * Run work with a request id bound for nested logs.
 */
export function withRequestId<T>(requestId: string | undefined, fn: () => T): T {
  return requestStore.run({ requestId: requestId || randomUUID() }, fn);
}

/**
 * Express / Connect middleware — sets request id and response header.
 */
export function requestIdMiddleware(header = "x-request-id") {
  return (
    req: { headers: Record<string, unknown>; id?: string },
    res: { setHeader: (k: string, v: string) => void },
    next: () => void,
  ) => {
    const incoming = req.headers[header];
    const id =
      typeof incoming === "string" && incoming.trim()
        ? incoming.trim()
        : randomUUID();
    req.id = id;
    res.setHeader("X-Request-Id", id);
    withRequestId(id, () => next());
  };
}

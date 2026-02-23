/**
 * Structured JSON logger. One JSON object per line.
 * Do not log secrets, prompts, article bodies, or payloadJson.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = {
  organizationId?: string;
  requestId?: string;
  cronRunId?: string;
  jobId?: string;
  jobRunId?: string;
  jobType?: string;
  attempt?: number;
  durationMs?: number;
  meta?: Record<string, unknown>;
  /** Only serialized for warn/error levels; produces structured err field. */
  err?: unknown;
};

export type ErrShape = {
  name: string;
  code: string;
  kind: string;
  message: string;
  stack?: string;
  retryable: boolean;
  cause?: ErrShape;
};

const LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

function isJsonSafe(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.every(isJsonSafe);
  if (typeof value === "object") {
    try {
      JSON.stringify(value);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function sanitizeMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined) continue;
    if (isJsonSafe(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function normalizeError(e: unknown): ErrShape {
  if (e instanceof Error) {
    const err = e as Error & { code?: string; kind?: string; retryable?: boolean; cause?: unknown };
    return {
      name: err.name || "Error",
      code: typeof err.code === "string" ? err.code : "UNKNOWN",
      kind: typeof err.kind === "string" ? err.kind : "UNKNOWN",
      message: err.message || String(e),
      stack: err.stack,
      retryable: Boolean(err.retryable),
      cause: err.cause !== undefined && err.cause !== null ? normalizeError(err.cause) : undefined,
    };
  }
  return {
    name: "Error",
    code: "UNKNOWN",
    kind: "UNKNOWN",
    message: String(e),
    retryable: false,
  };
}

function buildPayload(
  level: LogLevel,
  event: string,
  message: string,
  ctx?: LogContext,
  errShape?: ErrShape
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    event,
    message,
  };
  if (ctx?.organizationId !== undefined) payload.organizationId = ctx.organizationId;
  if (ctx?.requestId !== undefined) payload.requestId = ctx.requestId;
  if (ctx?.cronRunId !== undefined) payload.cronRunId = ctx.cronRunId;
  if (ctx?.jobId !== undefined) payload.jobId = ctx.jobId;
  if (ctx?.jobRunId !== undefined) payload.jobRunId = ctx.jobRunId;
  if (ctx?.jobType !== undefined) payload.jobType = ctx.jobType;
  if (ctx?.attempt !== undefined) payload.attempt = ctx.attempt;
  if (ctx?.durationMs !== undefined) payload.durationMs = ctx.durationMs;
  const meta = sanitizeMeta(ctx?.meta);
  if (meta) payload.meta = meta;
  if (errShape) payload.err = errShape;
  return payload;
}

function write(level: LogLevel, event: string, message: string, ctx?: LogContext, errShape?: ErrShape): void {
  const payload = buildPayload(level, event, message, ctx, errShape);
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export type Logger = {
  debug: (event: string, message: string, ctx?: LogContext) => void;
  info: (event: string, message: string, ctx?: LogContext) => void;
  warn: (event: string, message: string, ctx?: LogContext) => void;
  error: (event: string, message: string, ctx?: LogContext) => void;
  child: (ctx: LogContext) => Logger;
  withTiming: <T>(event: string, ctx: LogContext, fn: () => Promise<T>) => Promise<T>;
};

function mergeContext(base: LogContext | undefined, extra: LogContext | undefined): LogContext | undefined {
  if (!base && !extra) return undefined;
  return { ...base, ...extra };
}

function createLogger(baseContext?: LogContext): Logger {
  return {
    debug(event: string, message: string, ctx?: LogContext) {
      write("debug", event, message, mergeContext(baseContext, ctx));
    },
    info(event: string, message: string, ctx?: LogContext) {
      write("info", event, message, mergeContext(baseContext, ctx));
    },
    warn(event: string, message: string, ctx?: LogContext) {
      const { err, ...rest } = ctx ?? {};
      const errShape = err !== undefined ? normalizeError(err) : undefined;
      write("warn", event, message, mergeContext(baseContext, rest), errShape);
    },
    error(event: string, message: string, ctx?: LogContext) {
      const { err, ...rest } = ctx ?? {};
      const errShape = err !== undefined ? normalizeError(err) : undefined;
      write("error", event, message, mergeContext(baseContext, rest), errShape);
    },
    child(ctx: LogContext): Logger {
      return createLogger(mergeContext(baseContext, ctx));
    },
    async withTiming<T>(event: string, ctx: LogContext, fn: () => Promise<T>): Promise<T> {
      const start = Date.now();
      this.info(event, `${event} start`, ctx);
      try {
        const result = await fn();
        const durationMs = Date.now() - start;
        this.info(event, `${event} end`, { ...ctx, durationMs });
        return result;
      } catch (e) {
        const durationMs = Date.now() - start;
        this.error(event, `${event} failed`, { ...ctx, durationMs, err: e });
        throw e;
      }
    },
  };
}

export const log = createLogger();

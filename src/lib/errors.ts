/**
 * Error taxonomy for consistent categorization and logging.
 * AppError is used across cron and job runner; unknown errors are wrapped via wrapUnknownError.
 */

export type AppErrorOptions = {
  code: string;
  kind: string;
  retryable?: boolean;
  httpStatus?: number;
  meta?: Record<string, unknown>;
  cause?: unknown;
};

export class AppError extends Error {
  readonly code: string;
  readonly kind: string;
  readonly retryable: boolean;
  readonly httpStatus?: number;
  readonly meta?: Record<string, unknown>;
  override readonly cause?: unknown;

  constructor(message: string, options: AppErrorOptions) {
    super(message);
    this.name = "AppError";
    this.code = options.code;
    this.kind = options.kind;
    this.retryable = options.retryable ?? false;
    this.httpStatus = options.httpStatus;
    this.meta = options.meta;
    this.cause = options.cause;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function AuthError(
  message: string,
  opts?: { code?: string; httpStatus?: number; cause?: unknown }
): AppError {
  return new AppError(message, {
    code: opts?.code ?? "AUTH_FORBIDDEN",
    kind: "AUTH",
    retryable: false,
    httpStatus: opts?.httpStatus ?? 403,
    cause: opts?.cause,
  });
}

export function ValidationError(
  message: string,
  opts?: { code?: string; httpStatus?: number; meta?: Record<string, unknown>; cause?: unknown }
): AppError {
  return new AppError(message, {
    code: opts?.code ?? "VALIDATION",
    kind: "VALIDATION",
    retryable: false,
    httpStatus: opts?.httpStatus ?? 400,
    meta: opts?.meta,
    cause: opts?.cause,
  });
}

export function ExternalServiceError(
  message: string,
  opts: {
    code?: string;
    retryable?: boolean;
    httpStatus?: number;
    meta?: Record<string, unknown>;
    cause?: unknown;
  }
): AppError {
  return new AppError(message, {
    code: opts.code ?? "EXTERNAL_SERVICE_ERROR",
    kind: "EXTERNAL",
    retryable: opts.retryable ?? false,
    httpStatus: opts.httpStatus,
    meta: opts.meta,
    cause: opts.cause,
  });
}

export function OpenAIRateLimitError(message: string, cause?: unknown): AppError {
  return ExternalServiceError(message, {
    code: "OPENAI_RATE_LIMIT",
    retryable: true,
    cause,
  });
}

export function OpenAIError(message: string, opts?: { retryable?: boolean; cause?: unknown }): AppError {
  return ExternalServiceError(message, {
    code: "OPENAI_ERROR",
    retryable: opts?.retryable ?? false,
    cause: opts?.cause,
  });
}

export function DbError(
  message: string,
  opts: {
    code?: string;
    retryable?: boolean;
    meta?: Record<string, unknown>;
    cause?: unknown;
  }
): AppError {
  return new AppError(message, {
    code: opts.code ?? "DB_ERROR",
    kind: "DB",
    retryable: opts.retryable ?? false,
    meta: opts.meta,
    cause: opts.cause,
  });
}

export function DbConstraintError(message: string, cause?: unknown): AppError {
  return DbError(message, { code: "DB_CONSTRAINT", retryable: false, cause });
}

export function DbTimeoutError(message: string, cause?: unknown): AppError {
  return DbError(message, { code: "DB_TIMEOUT", retryable: true, cause });
}

export function JobError(
  message: string,
  opts: { code?: string; retryable?: boolean; meta?: Record<string, unknown>; cause?: unknown }
): AppError {
  return new AppError(message, {
    code: opts.code ?? "JOB_HANDLER_ERROR",
    kind: "JOB",
    retryable: opts.retryable ?? false,
    meta: opts.meta,
    cause: opts.cause,
  });
}

const RATE_LIMIT_PATTERNS = [/rate limit/i, /too many requests/i, /429/i];
const TIMEOUT_PATTERNS = [/timeout/i, /ETIMEDOUT/i, /timed out/i];

function isRetryableByMessage(message: string): boolean {
  const lower = message.toLowerCase();
  if (RATE_LIMIT_PATTERNS.some((p) => p.test(lower))) return true;
  if (TIMEOUT_PATTERNS.some((p) => p.test(lower))) return true;
  return false;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function getNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  return typeof v === "number" ? v : undefined;
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (isObject(e) && typeof e.message === "string") return e.message;
  if (isObject(e) && isObject(e.error) && typeof (e.error as Record<string, unknown>).message === "string") {
    return (e.error as Record<string, unknown>).message as string;
  }
  return String(e);
}

function classifyPrismaError(e: unknown): AppError | null {
  if (!isObject(e)) return null;

  const name = getString(e, "name");
  const code = getString(e, "code");

  if (name === "PrismaClientKnownRequestError" && code) {
    if (code === "P2002") {
      return DbConstraintError("Prisma unique constraint violation", e);
    }
    if (code.startsWith("P20")) {
      return DbError("Prisma request error", {
        code: "DB_REQUEST_ERROR",
        retryable: false,
        cause: e,
        meta: { prismaCode: code },
      });
    }
  }

  if (name && name.startsWith("PrismaClient")) {
    const message = getString(e, "message") ?? "";
    if (TIMEOUT_PATTERNS.some((p) => p.test(message))) {
      return DbTimeoutError("Prisma timeout", e);
    }
    const retryable = isRetryableByMessage(message);
    return DbError("Prisma client error", {
      code: "DB_CLIENT_ERROR",
      retryable,
      cause: e,
    });
  }

  return null;
}

function classifyOpenAIError(e: unknown): AppError | null {
  if (!isObject(e)) return null;

  const status =
    getNumber(e, "status") ??
    getNumber(e, "statusCode") ??
    (isObject(e["response"] as unknown)
      ? getNumber(e["response"] as Record<string, unknown>, "status")
      : undefined);

  const message = getErrorMessage(e) || "";

  const name = getString(e, "name") ?? "";

  if (status === 429 || RATE_LIMIT_PATTERNS.some((p) => p.test(message))) {
    return OpenAIRateLimitError(message || "OpenAI rate limit", e);
  }

  if ((status && status >= 500) || TIMEOUT_PATTERNS.some((p) => p.test(message))) {
    return OpenAIError(message || "OpenAI transient error", {
      retryable: true,
      cause: e,
    });
  }

  if (name.toLowerCase().includes("openai")) {
    return OpenAIError(message || "OpenAI error", {
      retryable: false,
      cause: e,
    });
  }

  return null;
}

export function wrapUnknownError(e: unknown): AppError {
  if (e instanceof AppError) return e;

  const prisma = classifyPrismaError(e);
  if (prisma) return prisma;

  const openai = classifyOpenAIError(e);
  if (openai) return openai;

  const message = getErrorMessage(e);
  const retryable = isRetryableByMessage(message);

  return new AppError(message, {
    code: "UNKNOWN",
    kind: "UNKNOWN",
    retryable,
    cause: e,
  });
}

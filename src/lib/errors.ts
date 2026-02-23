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

/**
 * Map unknown thrown values to AppError. Preserves AppError; wraps others with retryable=false
 * unless the message matches known transient patterns (rate limit, timeout).
 */
export function wrapUnknownError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const message = e instanceof Error ? e.message : String(e);
  const retryable = isRetryableByMessage(message);
  return new AppError(message, {
    code: "UNKNOWN",
    kind: "UNKNOWN",
    retryable,
    cause: e,
  });
}

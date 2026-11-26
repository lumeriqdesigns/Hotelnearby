import { ZodError } from "zod";

/**
 * Error vocabulary shared by server actions, route handlers and UI.
 *
 * Expected failures (validation, permission, not found) are returned as values.
 * Unexpected failures are logged with detail and shown to people with a safe,
 * generic message. Never put secrets or raw database errors in `message`.
 */

export type ErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PLAN_LIMIT_REACHED"
  | "PAYMENT_FAILED"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PLAN_LIMIT_REACHED: 403,
  PAYMENT_FAILED: 402,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL: 500,
};

const GENERIC_MESSAGE = "Something went wrong on our side. Please try again in a moment.";

export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fieldErrors: FieldErrors | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { cause?: unknown; fieldErrors?: FieldErrors },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.fieldErrors = options?.fieldErrors;
  }
}

export type SafeError = {
  code: ErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
};

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: SafeError };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(
  code: ErrorCode,
  message: string,
  fieldErrors?: FieldErrors,
): ActionResult<never> {
  return { ok: false, error: fieldErrors ? { code, message, fieldErrors } : { code, message } };
}

export function fieldErrorsFromZod(error: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Convert anything thrown into something safe to show people. */
export function toSafeError(error: unknown): SafeError {
  if (error instanceof AppError) {
    return error.fieldErrors
      ? { code: error.code, message: error.message, fieldErrors: error.fieldErrors }
      : { code: error.code, message: error.message };
  }
  if (error instanceof ZodError) {
    return {
      code: "VALIDATION_FAILED",
      message: "Some details need fixing.",
      fieldErrors: fieldErrorsFromZod(error),
    };
  }
  return { code: "INTERNAL", message: GENERIC_MESSAGE };
}

/** True for errors we expect during normal use, false for bugs worth alerting on. */
export function isExpectedError(error: unknown): boolean {
  if (error instanceof ZodError) return true;
  return error instanceof AppError && error.status < 500;
}

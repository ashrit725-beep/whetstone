/**
 * The error vocabulary every route handler shares.
 *
 * An `ApiError` is the only way a handler reports a failure the client is
 * allowed to read. Anything else that escapes `run()` is an internal fault: the
 * wrapper logs it against the request id and returns a generic 500 carrying
 * that id, so a user can quote the id and an operator can find the stack
 * without the stack ever crossing the wire.
 */

export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'CSRF_FAILED',
  'NOT_FOUND',
  'CONFLICT',
  'STATE_INVALID',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA',
  'METHOD_NOT_ALLOWED',
  'INTERNAL',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  CSRF_FAILED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  STATE_INVALID: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA: 415,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL: 500,
}

export function statusFor(code: ErrorCode): number {
  return STATUS[code]
}

export type FieldErrors = Readonly<Record<string, readonly string[]>>

export interface ApiErrorInit {
  readonly fields?: FieldErrors
  /** Seconds. Rendered as `Retry-After` and echoed in the envelope. */
  readonly retryAfter?: number
  /** Extra, client-safe context, e.g. the legal transitions for a state error. */
  readonly detail?: Readonly<Record<string, unknown>>
  /** The underlying fault, for the server log only. Never serialised. */
  readonly cause?: unknown
}

export class ApiError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly fields?: FieldErrors
  readonly retryAfter?: number
  readonly detail?: Readonly<Record<string, unknown>>

  constructor(code: ErrorCode, message: string, init: ApiErrorInit = {}) {
    super(message, init.cause === undefined ? undefined : { cause: init.cause })
    this.name = 'ApiError'
    this.code = code
    this.status = STATUS[code]
    if (init.fields) this.fields = init.fields
    if (init.retryAfter !== undefined) this.retryAfter = init.retryAfter
    if (init.detail) this.detail = init.detail
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}

/* --------------------------------------------------------------------------
 * Constructors.
 *
 * Every message obeys the voice rules in CONTRACT §7.4: what broke, why it
 * matters, what to do next, no apology and no exclamation mark.
 * ----------------------------------------------------------------------- */

export function unauthenticated(
  message = 'You are signed out, so this request could not be attributed to anyone. Sign in and try it again.',
): ApiError {
  return new ApiError('UNAUTHENTICATED', message)
}

export function forbidden(message: string): ApiError {
  return new ApiError('FORBIDDEN', message)
}

export function notFound(message: string): ApiError {
  return new ApiError('NOT_FOUND', message)
}

export function conflict(message: string, fields?: FieldErrors): ApiError {
  return fields ? new ApiError('CONFLICT', message, { fields }) : new ApiError('CONFLICT', message)
}

export function stateInvalid(
  message: string,
  detail?: Readonly<Record<string, unknown>>,
): ApiError {
  return detail
    ? new ApiError('STATE_INVALID', message, { detail })
    : new ApiError('STATE_INVALID', message)
}

export function invalid(message: string, fields?: FieldErrors): ApiError {
  return fields
    ? new ApiError('VALIDATION_FAILED', message, { fields })
    : new ApiError('VALIDATION_FAILED', message)
}

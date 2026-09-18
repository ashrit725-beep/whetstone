/**
 * The one response shape.
 *
 * Every `/api` route, success or failure, returns `{ ok: true, data }` or
 * `{ ok: false, error: { code, message, … } }`. A client never has to ask what
 * kind of body it is holding, and no route gets to invent its own.
 *
 * `requestId` rides on both shapes and on the `x-request-id` header, so the id
 * printed in an `ErrorState` is the same id in the server log.
 */

import type { ErrorCode, FieldErrors } from './errors'

export interface ApiMeta {
  readonly nextCursor?: string | null
  readonly total?: number
  readonly hasMore?: boolean
}

export interface ApiOk<T> {
  readonly ok: true
  readonly data: T
  readonly meta?: ApiMeta
  readonly requestId: string
}

export interface ApiErrorBody {
  readonly code: ErrorCode
  readonly message: string
  readonly fields?: FieldErrors
  readonly retryAfter?: number
  readonly detail?: Readonly<Record<string, unknown>>
}

export interface ApiErr {
  readonly ok: false
  readonly error: ApiErrorBody
  readonly requestId: string
}

export type ApiResponse<T> = ApiOk<T> | ApiErr

export interface RateHeaders {
  readonly limit: number
  readonly remaining: number
  /** Seconds until the bucket is full enough for one more request. */
  readonly reset: number
}

function baseHeaders(requestId: string, rate?: RateHeaders): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Request-Id': requestId,
  })
  if (rate) {
    headers.set('RateLimit-Limit', String(rate.limit))
    headers.set('RateLimit-Remaining', String(Math.max(0, rate.remaining)))
    headers.set('RateLimit-Reset', String(Math.max(0, rate.reset)))
  }
  return headers
}

export function okResponse<T>(
  data: T,
  opts: { requestId: string; meta?: ApiMeta; rate?: RateHeaders; status?: number } = {
    requestId: 'unknown',
  },
): Response {
  const body: ApiOk<T> = opts.meta
    ? { ok: true, data, meta: opts.meta, requestId: opts.requestId }
    : { ok: true, data, requestId: opts.requestId }
  return new Response(JSON.stringify(body), {
    status: opts.status ?? 200,
    headers: baseHeaders(opts.requestId, opts.rate),
  })
}

export function errResponse(
  error: ApiErrorBody,
  opts: { requestId: string; status: number; rate?: RateHeaders },
): Response {
  const body: ApiErr = { ok: false, error, requestId: opts.requestId }
  const headers = baseHeaders(opts.requestId, opts.rate)
  if (error.retryAfter !== undefined) headers.set('Retry-After', String(error.retryAfter))
  return new Response(JSON.stringify(body), { status: opts.status, headers })
}

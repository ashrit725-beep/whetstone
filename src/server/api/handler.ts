import { z } from 'zod'
import type { Viewer } from '@/lib/types'
import { ApiError, invalid, isApiError, unauthenticated } from './errors'
import { errResponse, okResponse, type ApiMeta, type RateHeaders } from './envelope'
import { logError, logWarn } from './log'
import { consume, subjectFor, type LimitSpec, type RateSubject } from './rate-limit'
import { assertCsrf, currentViewer } from './actor'
import { fieldErrorsOf, searchParamsToObject } from './schema'

/**
 * The wrapper every route handler is built from.
 *
 * It runs the same sequence in the same order for every route, because the
 * order is the security property: origin and CSRF before anything reads a body,
 * rate limiting before any work is done, identity before authorisation, size
 * cap before parsing, parsing before the service call. A route that hand-rolls
 * this will eventually drop one of the steps, so no route hand-rolls it.
 *
 * `run()` returns the payload only. The envelope, the rate headers, the request
 * id and the error mapping are this file's job. An exception that is not an
 * `ApiError` never reaches the client: it is logged against the request id and
 * becomes a generic 500 carrying that id, which is what a user quotes.
 */

const DEFAULT_MAX_BYTES = 1_048_576 // 1 MB of JSON. Uploads are multipart and set their own.

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export interface HandlerContext<B, Q, P> {
  readonly request: Request
  readonly viewer: Viewer | null
  readonly body: B
  readonly query: Q
  readonly params: P
  readonly requestId: string
  readonly subject: RateSubject
  /** Attach paging or totals to the envelope without returning a wrapper object. */
  setMeta(meta: ApiMeta): void
}

export interface AuthedContext<B, Q, P> extends HandlerContext<B, Q, P> {
  readonly viewer: Viewer
}

type ZodLike<T> = z.ZodType<T, z.ZodTypeDef, unknown>

interface BaseConfig<B, Q, P> {
  /** `required` throws 401 before `run()`; `optional` leaves `viewer` nullable. */
  readonly auth: 'required' | 'optional' | 'none'
  /** One or more buckets. Every mutating route declares at least one. */
  readonly limit: LimitSpec | readonly LimitSpec[]
  readonly body?: ZodLike<B>
  readonly query?: ZodLike<Q>
  readonly params?: ZodLike<P>
  /** Defaults to true for POST, PUT, PATCH and DELETE. */
  readonly csrf?: boolean
  readonly maxBytes?: number
  /** Identifies the bucket and the log line. Defaults to the limit id. */
  readonly id?: string
}

export interface HandlerConfig<T, B, Q, P> extends BaseConfig<B, Q, P> {
  readonly auth: 'optional' | 'none'
  run(ctx: HandlerContext<B, Q, P>): Promise<T> | T
}

export interface AuthedHandlerConfig<T, B, Q, P> extends BaseConfig<B, Q, P> {
  readonly auth: 'required'
  run(ctx: AuthedContext<B, Q, P>): Promise<T> | T
}

/** Next 15 hands route handlers their dynamic segments as a promise. */
type RouteArgs = { params: Promise<Record<string, string | string[] | undefined>> }

export type RouteHandler = (request: Request, args: RouteArgs) => Promise<Response>

function specsOf(limit: LimitSpec | readonly LimitSpec[]): readonly LimitSpec[] {
  return Array.isArray(limit) ? (limit as readonly LimitSpec[]) : [limit as LimitSpec]
}

function rateHeaders(result: {
  limit: number
  remaining: number
  reset: number
}): RateHeaders {
  return { limit: result.limit, remaining: result.remaining, reset: result.reset }
}

async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const type = request.headers.get('content-type') ?? ''
  if (!type.includes('application/json')) {
    throw new ApiError(
      'UNSUPPORTED_MEDIA',
      'This endpoint reads JSON. Send the request with a Content-Type of application/json.',
    )
  }

  const declared = request.headers.get('content-length')
  if (declared !== null && Number(declared) > maxBytes) {
    throw new ApiError(
      'PAYLOAD_TOO_LARGE',
      `That request body is larger than the ${Math.round(maxBytes / 1024)} kB this endpoint accepts. Send less in one call, or split it.`,
    )
  }

  const text = await request.text()
  if (text.length > maxBytes) {
    throw new ApiError(
      'PAYLOAD_TOO_LARGE',
      `That request body is larger than the ${Math.round(maxBytes / 1024)} kB this endpoint accepts. Send less in one call, or split it.`,
    )
  }
  if (text.trim().length === 0) return {}

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw invalid('That request body is not valid JSON, so none of it was read. Send a well-formed JSON object.')
  }
}

function parseWith<T>(schema: ZodLike<T> | undefined, value: unknown, what: string): T {
  if (!schema) return undefined as T
  const parsed = schema.safeParse(value)
  if (parsed.success) return parsed.data
  throw invalid(
    `Some ${what} values were not accepted, so nothing was changed. Correct the fields named below and send it again.`,
    fieldErrorsOf(parsed.error),
  )
}

function requestIdOf(request: Request): string {
  const inbound = request.headers.get('x-request-id')
  if (inbound && /^[A-Za-z0-9._-]{8,64}$/.test(inbound)) return inbound
  return crypto.randomUUID()
}

function routeLabel(request: Request, fallback: string): string {
  try {
    return new URL(request.url).pathname
  } catch {
    return fallback
  }
}

export function handler<T, B = undefined, Q = undefined, P = undefined>(
  config: HandlerConfig<T, B, Q, P> | AuthedHandlerConfig<T, B, Q, P>,
): RouteHandler {
  const specs = specsOf(config.limit)
  const fallbackId = config.id ?? specs[0]?.id ?? 'api'

  return async function apiRoute(request: Request, args: RouteArgs): Promise<Response> {
    const requestId = requestIdOf(request)
    const route = routeLabel(request, fallbackId)
    const method = request.method.toUpperCase()
    const startedAt = Date.now()
    let rate: RateHeaders | undefined
    let viewerId: string | null = null

    try {
      const mutating = MUTATING.has(method)
      if (config.csrf ?? mutating) await assertCsrf(request)

      const viewer = config.auth === 'none' ? null : await currentViewer()
      viewerId = viewer?.id ?? null
      const subject = subjectFor(viewerId, request.headers)

      const spent = consume(specs, subject)
      rate = rateHeaders(spent)
      if (!spent.allowed) {
        throw new ApiError(
          'RATE_LIMITED',
          `You have made this request too many times in a row. Wait ${spent.reset} seconds and repeat it.`,
          { retryAfter: spent.reset },
        )
      }

      if (config.auth === 'required' && !viewer) throw unauthenticated()

      const rawParams = await args.params
      const params = parseWith(config.params, rawParams, 'address')

      const url = new URL(request.url)
      const query = parseWith(config.query, searchParamsToObject(url.searchParams), 'query')

      const body = config.body
        ? parseWith(config.body, await readJson(request, config.maxBytes ?? DEFAULT_MAX_BYTES), 'submitted')
        : (undefined as B)

      let meta: ApiMeta | undefined
      const base = {
        request,
        body,
        query,
        params,
        requestId,
        subject,
        setMeta(next: ApiMeta) {
          meta = next
        },
      }

      const data =
        config.auth === 'required'
          ? await config.run({ ...base, viewer: viewer as Viewer })
          : await config.run({ ...base, viewer })

      return okResponse(data, meta ? { requestId, meta, rate } : { requestId, rate })
    } catch (thrown) {
      if (isApiError(thrown)) {
        if (thrown.status >= 500) {
          logError({ requestId, route, method, status: thrown.status, code: thrown.code, userId: viewerId, ms: Date.now() - startedAt }, thrown)
        } else if (thrown.code === 'RATE_LIMITED' || thrown.code === 'CSRF_FAILED' || thrown.code === 'FORBIDDEN') {
          logWarn({ requestId, route, method, status: thrown.status, code: thrown.code, userId: viewerId, ms: Date.now() - startedAt })
        }
        return errResponse(
          {
            code: thrown.code,
            message: thrown.message,
            ...(thrown.fields ? { fields: thrown.fields } : {}),
            ...(thrown.retryAfter !== undefined ? { retryAfter: thrown.retryAfter } : {}),
            ...(thrown.detail ? { detail: thrown.detail } : {}),
          },
          { requestId, status: thrown.status, rate },
        )
      }

      logError(
        { requestId, route, method, status: 500, code: 'INTERNAL', userId: viewerId, ms: Date.now() - startedAt },
        thrown,
      )
      return errResponse(
        {
          code: 'INTERNAL',
          message: `Whetstone could not finish that request and nothing was changed. Try it again; if it keeps failing, quote reference ${requestId}.`,
        },
        { requestId, status: 500, rate },
      )
    }
  }
}

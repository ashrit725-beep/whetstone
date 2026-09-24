/**
 * Edge middleware. Cheap tier only.
 *
 * It lives beside `app/`, which in this repo means `src/middleware.ts`: Next
 * resolves middleware relative to the directory holding the router, and a
 * `middleware.ts` at the repository root would be silently ignored.
 *
 * It verifies the session cookie's signature and nothing else: it cannot reach
 * SQLite, so it can never know that a session was revoked or an account
 * suspended. That judgement belongs to `requireUser()` in
 * `src/server/auth/session.ts`, which every protected surface calls. This file
 * exists to redirect early, to stamp a request id, and to keep the CSRF cookie
 * alive. It does no database access and no awaited I/O beyond `jwtVerify`.
 *
 * Order of work
 *   1. Strip inbound `x-ws-*` and `x-request-id` so a client cannot spoof them.
 *   2. Stamp a fresh `x-request-id` on request and response.
 *   3. Record `x-ws-path` so `requireUser()` can build `?next=`.
 *   4. Verify `ws_session`; on success add `x-ws-uid` as a hint, never as authority.
 *   5. Redirect an unauthenticated reader away from a protected path.
 *   6. Mint `ws_csrf` when it is missing.
 */

import { NextResponse, type NextRequest } from 'next/server'
// The verify entry alone. The package root also pulls in JWE compression, which
// uses CompressionStream and makes every Edge build print a warning for code
// this file never calls.
import { jwtVerify } from 'jose/jwt/verify'
import { env, secureCookies } from '@/lib/env'

/** Mirrors `SESSION_COOKIE` in `src/lib/auth.ts`, which cannot be imported here
 *  because that module pulls in `node:crypto`. */
const SESSION_COOKIE = 'ws_session'
const CSRF_COOKIE = 'ws_csrf'
const CSRF_MAX_AGE_S = 60 * 60 * 24 * 30

/** Set by this middleware, trusted downstream, never accepted from a caller. */
const TRUSTED_INJECTED_HEADERS = ['x-ws-uid', 'x-ws-path'] as const

/**
 * Paths that render nothing useful to a signed-out reader. Everything else in
 * the product is public and must render identically to a crawler.
 */
function isProtected(pathname: string): boolean {
  if (segmentMatch(pathname, '/dashboard')) return true
  if (segmentMatch(pathname, '/settings')) return true
  if (segmentMatch(pathname, '/notifications')) return true
  if (segmentMatch(pathname, '/new')) return true
  if (pathname === '/projects/new') return true
  // The feedback composer, under both the canonical and the short project path.
  if (/^\/(?:p|projects)\/[^/]+\/(?:feedback\/new|review)\/?$/.test(pathname)) return true
  return false
}

function segmentMatch(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function csrfToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

async function hasValidSession(token: string | undefined): Promise<string | null> {
  if (!token) return null
  // Read outside the try on purpose. In production a missing AUTH_SECRET throws
  // here, and it must surface as a failed request with that message in the log.
  // Inside the try it was swallowed, and every member was quietly shown the
  // site signed out with nothing to say why.
  const key = new TextEncoder().encode(env.authSecret)
  try {
    const { payload } = await jwtVerify(token, key, {
      // The one algorithm `signSession` in `src/lib/auth.ts` signs with.
      algorithms: ['HS256'],
      issuer: 'whetstone',
      audience: 'whetstone-web',
    })
    return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null
  } catch {
    // An unreadable, expired or unsigned token is simply a signed-out reader.
    return null
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl

  const requestHeaders = new Headers(request.headers)
  // Headers this middleware sets and the server then trusts. A caller must
  // never be able to present them, so they are cleared off every request before
  // the real values go on.
  //
  // This used to clear the whole `x-ws-` prefix, which also removed `x-ws-csrf`
  // — the one header in that family the client is supposed to send. Every
  // mutating route then read it as absent and answered CSRF_FAILED, so the
  // entire /api surface refused writes. Only the injected names are stripped.
  for (const key of TRUSTED_INJECTED_HEADERS) requestHeaders.delete(key)
  requestHeaders.delete('x-request-id')

  const requestId = crypto.randomUUID()
  requestHeaders.set('x-request-id', requestId)
  requestHeaders.set('x-ws-path', `${pathname}${search}`)

  const userId = await hasValidSession(request.cookies.get(SESSION_COOKIE)?.value)
  if (userId) requestHeaders.set('x-ws-uid', userId)

  const response =
    !userId && isProtected(pathname)
      ? redirectToSignIn(request, `${pathname}${search}`)
      : NextResponse.next({ request: { headers: requestHeaders } })

  response.headers.set('x-request-id', requestId)

  // Double-submit CSRF: readable by script on purpose, so `apiFetch` can echo it
  // in the `x-ws-csrf` header that every mutating handler compares.
  if (!request.cookies.has(CSRF_COOKIE)) {
    response.cookies.set(CSRF_COOKIE, csrfToken(), {
      httpOnly: false,
      sameSite: 'lax',
      // By the request's real scheme, like the session cookie: see secureCookies.
      secure: secureCookies(request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol),
      path: '/',
      maxAge: CSRF_MAX_AGE_S,
    })
  }

  return response
}

function redirectToSignIn(request: NextRequest, next: string): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = '/sign-in'
  url.search = ''
  url.searchParams.set('next', next)
  return NextResponse.redirect(url, 307)
}

export const config = {
  /**
   * Everything except build output, the OG image route, and static files. The
   * negative lookahead keeps the edge function off assets entirely rather than
   * running and returning early.
   */
  matcher: [
    '/((?!_next/static|_next/image|api/og|favicon\\.ico|fonts/|images/|icons/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|woff2|txt|xml|json)$).*)',
  ],
}

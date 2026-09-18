import { timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { currentUser } from '@/server/queries/auth'
import type { Viewer } from '@/lib/types'
import { ApiError, forbidden, unauthenticated } from './errors'

/**
 * Who is making this request, and are they allowed to make it at all.
 *
 * Identity is always re-derived from the signed cookie. The `x-ws-*` headers
 * middleware sets are a convenience for rendering and are never trusted here,
 * which is the whole point of the two-tier model in ROUTES §1: middleware runs
 * on the edge and cannot see the revocation table, so it can redirect but it
 * can never authorise.
 */

/**
 * Identity for a request, honouring revocation.
 *
 * This used to read the cookie and verify its signature, which answers "is this
 * token authentic" but not "is this session still alive". A JWT stays
 * cryptographically valid until it expires, so a cookie revoked by a sign-out,
 * a password reset or a "sign out everywhere" kept working for up to thirty
 * days. `currentUser()` proves the cookie still has an unrevoked
 * `auth_sessions` row and that the row names the same account the token does,
 * which is the thing signature verification cannot do. It is React-cached, so
 * ten components asking during one render cost one pair of queries.
 */
export async function currentViewer(): Promise<Viewer | null> {
  return currentUser()
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await currentViewer()
  if (!viewer) throw unauthenticated()
  return viewer
}

/**
 * Authorisation, stated as a sentence rather than a boolean.
 *
 * Every call site names the resource and the reason, because the common bug in
 * an app this shape is a route that checks "is anyone signed in" and forgets to
 * check "may *this* person act on *this* row".
 */
export function assertOwns(
  viewer: Viewer,
  ownerId: string,
  message: string,
): void {
  if (viewer.id === ownerId) return
  if (viewer.role === 'moderator' || viewer.role === 'admin') return
  throw forbidden(message)
}

export function assertNotSelf(viewer: Viewer, subjectId: string, message: string): void {
  if (viewer.id === subjectId) throw forbidden(message)
}

/* -------------------------------------------------------------------------- *
 * CSRF
 * -------------------------------------------------------------------------- */

const CSRF_COOKIE = 'ws_csrf'
const CSRF_HEADER = 'x-ws-csrf'

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Double-submit, with an origin check underneath it.
 *
 * When the `ws_csrf` cookie is present the header must match it byte for byte.
 * When it is absent (a signed-out caller, or a session issued before the cookie
 * existed) the request still has to prove same-origin through `Origin` or
 * `Sec-Fetch-Site`, so the absence of a cookie is never an exemption. Every
 * browser sends at least one of the two with a POST, so a request carrying
 * neither and no cookie has proved nothing and is refused, as sign-out does.
 */
export async function assertCsrf(request: Request): Promise<void> {
  const site = request.headers.get('sec-fetch-site')
  if (site !== null && site !== 'same-origin' && site !== 'none') {
    throw new ApiError(
      'CSRF_FAILED',
      'This request arrived from another site, so it was not carried out. Open Whetstone directly and repeat the action there.',
    )
  }

  const origin = request.headers.get('origin')
  if (origin !== null) {
    const host = request.headers.get('host')
    let originHost: string | null = null
    try {
      originHost = new URL(origin).host
    } catch {
      originHost = null
    }
    if (host === null || originHost === null || originHost !== host) {
      throw new ApiError(
        'CSRF_FAILED',
        'This request arrived from another site, so it was not carried out. Open Whetstone directly and repeat the action there.',
      )
    }
  }

  const jar = await cookies()
  const expected = jar.get(CSRF_COOKIE)?.value
  if (!expected) {
    if (origin === null && site === null) {
      throw new ApiError(
        'CSRF_FAILED',
        'This request could not show that it came from Whetstone, so it was not carried out. Open Whetstone directly and repeat the action there.',
      )
    }
    return
  }

  const presented = request.headers.get(CSRF_HEADER)
  if (!presented || !constantTimeEquals(presented, expected)) {
    throw new ApiError(
      'CSRF_FAILED',
      'This request was missing its session token, which usually means the page has been open a long time. Reload the page and try the action again.',
    )
  }
}

export { CSRF_COOKIE, CSRF_HEADER }

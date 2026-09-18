/**
 * POST /api/auth/sign-out
 *
 * Revokes this device's `auth_sessions` row, clears the cookie, and redirects.
 * Revoking the row is the part that matters: the JWT in the cookie stays
 * cryptographically valid until it expires, and `requireUser()` refuses it from
 * the next request onwards because the row is gone.
 *
 * It is a route handler rather than a Server Action so that a plain
 * `<form method="post" action="/api/auth/sign-out">` signs out with JavaScript
 * disabled, from any surface, with no client bundle involved.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { clearSessionCookie } from '@/lib/auth'
import { revokeSession } from '@/server/repos/users'
import { currentSessionId, sameString } from '@/server/queries/auth'
import { safeNextPath } from '@/app/(auth)/schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Same-origin proof. Sign-out is a state change, so a cross-site form post must
 * not be able to trigger it. Every browser that can post a form sends `Origin`
 * or `Sec-Fetch-Site` with it, so a request carrying neither proves nothing and
 * is refused: skipping the check when `Origin` was absent let exactly the
 * requests that could not be checked through.
 */
function sameOrigin(request: NextRequest): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site !== null && site !== 'same-origin' && site !== 'none') return false

  const origin = request.headers.get('origin')
  if (origin === null) return site !== null
  const host = request.headers.get('host')
  let originHost = ''
  try {
    originHost = new URL(origin).host
  } catch {
    return false
  }
  return host !== null && sameString(originHost, host)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!sameOrigin(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'CSRF_FAILED',
          message: 'That sign-out request did not come from Whetstone, so it was not carried out.',
        },
      },
      { status: 403 },
    )
  }

  const sessionId = await currentSessionId()
  if (sessionId) revokeSession(sessionId)
  await clearSessionCookie()

  const form = await request.formData().catch(() => null)
  const target = safeNextPath(
    typeof form?.get('next') === 'string' ? String(form.get('next')) : undefined,
    '/',
  )

  // 303 so the browser follows with GET, which is what a form post needs.
  return NextResponse.redirect(new URL(target, request.nextUrl.origin), 303)
}

/** A link cannot sign you out: that is what makes prefetchers safe. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Signing out is a POST. Use the sign-out control in the account menu.',
      },
    },
    { status: 405, headers: { Allow: 'POST' } },
  )
}

/**
 * GET /api/auth/session
 *
 * Who is signed in, for the surfaces that cannot ask on the server. The
 * marketing pages are rendered statically and revalidated hourly, so their nav
 * learns about the reader here, after paint, and swaps "Sign in" for a way into
 * the product.
 *
 * It answers with the handle or `null` and nothing else. It uses the
 * revocation-aware check, so a cookie that was signed out elsewhere reads as
 * signed out here too, and it is never cached: a cached answer would show one
 * person's session to the next.
 */

import { currentClaimsLive } from '@/server/queries/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const claims = await currentClaimsLive()
  return Response.json(claims ? { handle: claims.handle } : null, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

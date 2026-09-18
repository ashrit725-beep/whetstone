/**
 * The authoritative server-side session.
 *
 * Middleware verifies the cookie's signature only; it cannot reach SQLite and
 * so can never be the authority on revocation or account status. This module
 * is that authority. Every protected Server Component, Server Action and route
 * handler calls `requireUser()`; every surface that merely personalises calls
 * `currentUser()`.
 *
 * Usage
 *   const user = await currentUser()            // SessionUser | null
 *   const user = await requireUser()            // redirects to /sign-in?next=…
 *   const viewerId = await currentUserId()      // string | null, for repo calls
 *
 * Both reads are wrapped in React `cache()`, so ten components calling
 * `currentUser()` in one render cost one pair of queries.
 */

import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { getUserById } from '@/server/repos/users'
import { getUserCard } from '@/server/repos/profiles'

/** Everything the chrome and the surfaces need about the person signed in. */
export interface SessionUser {
  readonly id: string
  readonly handle: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly email: string
  readonly isExpert: boolean
  /** Global credibility, 0–1000. The same number the profile renders. */
  readonly reputation: number
}

async function loadSessionUser(): Promise<SessionUser | null> {
  // Revocation and account status, in one query: `currentClaimsLive()` returns
  // claims only while the cookie still has an unrevoked `auth_sessions` row,
  // that row names the account the cookie does, and the account is active. A
  // device signed out elsewhere, or a suspended or deactivated account, stops
  // being signed in on its next request rather than when the token expires.
  const claims = await currentClaimsLive()
  if (!claims) return null

  const row = getUserById(claims.uid)
  if (!row) return null

  const card = getUserCard(row.id)
  if (!card) return null

  return {
    id: row.id,
    handle: card.handle,
    displayName: card.displayName,
    avatarUrl: card.avatarUrl,
    email: row.email,
    isExpert: card.isExpert,
    reputation: card.score,
  }
}

/** The signed-in user, or null. Safe to call from any Server Component. */
export const currentUser: () => Promise<SessionUser | null> = cache(loadSessionUser)

/** Just the id, for the `viewerId` argument every repository takes. */
export async function currentUserId(): Promise<string | null> {
  return (await currentUser())?.id ?? null
}

/**
 * The path the reader is on, as middleware recorded it (`pathname + search`).
 * Null when middleware did not run, which is the case for a request that the
 * matcher skipped.
 */
export const currentPath: () => Promise<string | null> = cache(
  async function loadCurrentPath(): Promise<string | null> {
    const h = await headers()
    const path = h.get('x-ws-path')
    return path && path.startsWith('/') ? path : null
  },
)

/** The request id middleware assigned. Quote it in an `ErrorState`. */
export async function currentRequestId(): Promise<string | null> {
  const h = await headers()
  return h.get('x-request-id')
}

/**
 * The signed-in user, or a redirect to sign-in that comes back here afterwards.
 *
 * Pass `nextPath` only when the destination after signing in is not the page
 * being rendered, for example when a layout guards a child route.
 */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await currentUser()
  if (user) return user

  const target = nextPath ?? (await currentPath())
  redirect(target ? `/sign-in?next=${encodeURIComponent(target)}` : '/sign-in')
}

/** `requireUser()` when all the caller wants is the id. */
export async function requireUserId(nextPath?: string): Promise<string> {
  return (await requireUser(nextPath)).id
}

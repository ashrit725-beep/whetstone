'use server'

/**
 * Follow and unfollow, as one idempotent toggle.
 *
 * The caller passes the state it wants rather than "flip it", so a double
 * submit from an impatient pointer cannot land the reader on the opposite of
 * what they asked for. The optimistic UI in `FollowButton` shows the requested
 * state immediately; this returns the state the database actually holds, and
 * React reconciles the two.
 */

import { actionRefusal } from './limits'
import { revalidatePath } from 'next/cache'
// Every write below authorises from `claims.uid`, so the claims must come from
// a session that is still live. A signature proves the cookie is authentic and
// nothing more: a JWT stays valid until it expires, so a cookie revoked by a
// sign-out or a password reset would otherwise keep authorising writes for up
// to thirty days. `currentClaimsLive()` puts the revocation check in front.
import { currentClaimsLive } from '@/server/queries/auth'
import { getViewer } from '@/server/repos/users'
import { followUser, getProfileByHandle, unfollowUser } from '@/server/repos/profiles'

export interface FollowResult {
  readonly ok: boolean
  readonly following: boolean
  /** Present only on failure: what broke, why it matters, what to do next. */
  readonly message?: string
}

export async function toggleFollow(handle: string, next: boolean): Promise<FollowResult> {
  const claims = await currentClaimsLive()
  const viewer = getViewer(claims?.uid ?? null)
  if (!viewer) {
    return {
      ok: false,
      following: false,
      message: 'Following needs a signed-in account, because the follow is stored against yours. Sign in and try again.',
    }
  }
  // A Server Action is a public endpoint; the type annotation is not a check.
  // A handle that is not a string used to throw inside `normalizeHandle`.
  if (typeof handle !== 'string' || typeof next !== 'boolean') {
    return {
      ok: false,
      following: false,
      message: 'That follow was not understood, so nothing changed. Reload the page and try again.',
    }
  }

  const profile = getProfileByHandle(handle, viewer.id)
  if (!profile) {
    return {
      ok: false,
      following: false,
      message: 'That handle no longer resolves to an account, so there is nothing to follow. Search for the person again.',
    }
  }
  if (profile.id === viewer.id) {
    return {
      ok: false,
      following: false,
      message: 'You cannot follow your own account. Your own projects already appear in your dashboard.',
    }
  }

  const held = actionRefusal('follow', viewer.id)
  if (held) return { ok: false, following: !next, message: held }

  const following = next ? followUser(viewer.id, profile.id) : unfollowUser(viewer.id, profile.id)

  revalidatePath(`/u/${profile.handle}`)
  revalidatePath(`/experts/${profile.handle}`)

  return { ok: true, following }
}

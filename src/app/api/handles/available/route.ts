import { z } from 'zod'
import { handleIsTaken, normalizeHandle } from '@/server/repos/users'
import { handler } from '@/server/api/handler'
import { LIMITS } from '@/server/api/limits'
import { Handle } from '@/server/api/schema'

/**
 * GET /api/handles/available?handle=
 *
 * Used by sign-up and by the change-handle field in settings.
 *
 * This route sits outside `/api/auth` on purpose: it is not an authentication
 * step, it is a form affordance, and it is reachable while signed in as well as
 * while signed out. A signed-in caller is excluded from the conflict check
 * against their own handle, so the field does not tell someone their own handle
 * is taken.
 *
 * It leaks, by design, whether a handle exists, which is unavoidable for a
 * public namespace: every handle is already readable at `/u/<handle>`. What it
 * must not become is an enumeration tool, so it is metered at thirty a minute
 * and never reports anything but a boolean and some alternatives.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HandleQuery = z.object({ handle: Handle })

/** Deterministic alternatives, so the same input always offers the same three. */
function suggestionsFor(handle: string, exceptUserId: string | undefined): string[] {
  const base = handle.replace(/-+$/, '').slice(0, 20)
  const candidates = [
    `${base}-dev`,
    `${base}-makes`,
    `${base}-studio`,
    `${base}2`,
    `${base}-hq`,
    `the-${base}`.slice(0, 24),
  ]
  const free: string[] = []
  for (const candidate of candidates) {
    if (candidate.length < 3 || candidate.length > 24) continue
    if (handleIsTaken(candidate, exceptUserId)) continue
    free.push(candidate)
    if (free.length === 3) break
  }
  return free
}

export const GET = handler({
  auth: 'optional',
  limit: LIMITS.handleAvailable,
  query: HandleQuery,
  run({ query, viewer }) {
    const handle = normalizeHandle(query.handle)
    const taken = handleIsTaken(handle, viewer?.id)

    return {
      handle,
      available: !taken,
      // Only offered when the answer is no. A list of alternatives beside a
      // free handle reads as a rejection the field did not make.
      suggestions: taken ? suggestionsFor(handle, viewer?.id) : [],
    }
  },
})

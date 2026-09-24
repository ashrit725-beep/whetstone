/**
 * Rate limits for Server Actions.
 *
 * The /api routes have always gone through `handler()`, which refuses to ship a
 * route without a limit. Server Actions are public endpoints too, reachable with
 * one POST, and until this file they had none: a script with a session could
 * post reviews, threads and votes as fast as SQLite would take them. The
 * new-account throttle in `@/server/api/limits` existed for exactly that case
 * and was never called.
 *
 * Deliberately not a 'use server' module: everything here runs inside an
 * action and must not be callable from the client on its own.
 */

import { consume, type LimitSpec } from '@/server/api/rate-limit'
import { LIMITS, throttled } from '@/server/api/limits'
import { accountAgeMs } from '@/server/queries/access'
import { retryPhrase } from '@/app/(auth)/schema'

const MINUTE = 60_000
const HOUR = 3_600_000

/**
 * Numbers are set well above anything a person does by hand: the busiest real
 * reviewer in the population writes nine notes on a heavy day. The floors stop
 * a held-down Enter key or a double-submit, not a person.
 */
export const ACTION_LIMITS = {
  review: { id: 'action.feedback.post', capacity: 30, windowMs: HOUR, floorMs: 5_000 },
  impression: { id: 'action.feedback.impression', capacity: 60, windowMs: HOUR },
  reply: { id: 'action.reply.post', capacity: 60, windowMs: HOUR, floorMs: 2_000 },
  ship: { id: 'action.feedback.ship', capacity: 60, windowMs: HOUR, floorMs: 2_000 },
  thread: { id: 'action.thread.post', capacity: 10, windowMs: HOUR, floorMs: 20_000 },
  report: { id: 'action.report', capacity: 20, windowMs: HOUR },
  project: { id: 'action.project.write', capacity: 60, windowMs: HOUR },
  publish: { id: 'action.project.publish', capacity: 10, windowMs: HOUR, floorMs: 10_000 },
  version: { id: 'action.project.version', capacity: 20, windowMs: HOUR, floorMs: 5_000 },
  round: { id: 'action.project.round', capacity: 10, windowMs: HOUR, floorMs: 5_000 },
  bounty: { id: 'action.bounty.post', capacity: 10, windowMs: HOUR, floorMs: 10_000 },
  bountyApply: { id: 'action.bounty.apply', capacity: 20, windowMs: HOUR, floorMs: 5_000 },
  /**
   * Every submit a composer makes, accepted or not, charged on the way in
   * before anything is parsed.
   *
   * It is the counterweight to the rule in `actionRefusal` below: a submit the
   * schema refuses must not spend the allowance for work that was never
   * posted, but it must still cost something, or a form that fails validation
   * becomes a free way to hammer this server. Set high enough that a person
   * correcting a form is never near it, and with no floor, so a quick second
   * try after a field error is not itself refused.
   */
  attempt: { id: 'action.attempt', capacity: 120, windowMs: HOUR },
  vote: LIMITS.vote,
  follow: LIMITS.follow,
  mark: { id: 'action.mark', capacity: 120, windowMs: MINUTE },
  // A rename frees the old handle for anyone to take, so cycling through them is capped.
  handle: { id: 'action.account.handle', capacity: 5, windowMs: HOUR, floorMs: 10_000 },
  aiCoach: LIMITS.aiCoach,
  aiIntake: LIMITS.aiIntake,
} as const satisfies Record<string, LimitSpec>

export type ActionLimit = keyof typeof ACTION_LIMITS

/** Limits that put new public content in front of other people. */
const PUBLIC_WRITES: ReadonlySet<ActionLimit> = new Set([
  'review',
  'reply',
  'thread',
  'publish',
  'version',
  'bounty',
  'bountyApply',
])

/**
 * Spends one unit of `limit` for this account. Returns null when the action may
 * go ahead, otherwise a sentence for the person saying when it can.
 *
 * Call this *after* the submitted input has validated, never before.
 *
 * A submit the server is about to refuse on its own schema costs the person
 * nothing and puts nothing in front of anybody, so it must not spend an hourly
 * allowance and must not arm a `floorMs` cooldown. Charging first meant a
 * thread posted with a nine-character title answered "give the thread a title
 * of at least 12 characters", and the corrected submit twenty seconds later
 * answered "that is more than one account can post in a short stretch" — the
 * limiter punishing a typo. The authentication actions have always been
 * ordered this way (`src/server/actions/auth.ts`: every one of them parses,
 * then charges), and sign-up says so in as many words about a taken handle.
 *
 * "Validated" means the schema, not the world: a channel that has closed, a
 * project somebody else owns or a bounty that has been withdrawn are all
 * answers this server had to look up, and they are charged, because they are
 * exactly what a script probes for.
 *
 * The one limit that is charged before validation is `attempt`, which exists
 * so that refusing to charge the others costs this server nothing.
 */
export function actionRefusal(limit: ActionLimit, userId: string): string | null {
  const base: LimitSpec = ACTION_LIMITS[limit]
  const spec = PUBLIC_WRITES.has(limit) ? throttled(base, accountAgeMs(userId)) : base
  const result = consume([spec], `uid:${userId}`)
  if (result.allowed) return null
  const when = retryPhrase(result.reset)
  if (!PUBLIC_WRITES.has(limit)) {
    return `That was faster than the site accepts, so it did not go through. Try again ${when}.`
  }
  // Two refusals, two sentences. A `floorMs` bucket holds exactly one token,
  // and no allowance in this table is that small, so the reported limit is what
  // tells them apart. The floor catches a second submit seconds after one that
  // worked; only the hourly bucket means what the second sentence says. Both
  // said "more than one account can post in a short stretch", which told
  // somebody who had posted once, a moment ago, that they had posted too much.
  return result.limit === 1 && spec.capacity > 1
    ? `That came in right behind your last post, so it was held back. Nothing you wrote was lost. You can post it ${when}.`
    : `That is more than one account can post in a short stretch, so this was held back. Nothing you wrote was lost. You can post it ${when}.`
}

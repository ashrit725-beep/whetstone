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
 */
export function actionRefusal(limit: ActionLimit, userId: string): string | null {
  const base: LimitSpec = ACTION_LIMITS[limit]
  const spec = PUBLIC_WRITES.has(limit) ? throttled(base, accountAgeMs(userId)) : base
  const result = consume([spec], `uid:${userId}`)
  if (result.allowed) return null
  const when = retryPhrase(result.reset)
  return PUBLIC_WRITES.has(limit)
    ? `That is more than one account can post in a short stretch, so this was held back. Nothing you wrote was lost. You can post it ${when}.`
    : `That was faster than the site accepts, so it did not go through. Try again ${when}.`
}

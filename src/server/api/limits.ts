import type { LimitSpec } from './rate-limit'

/**
 * Every rate limit in the product, in one table.
 *
 * ROUTES §3 sets these numbers. They live here rather than inline in each
 * handler so the policy can be read as a policy: a reviewer can see at a glance
 * that a vote is cheap and an AI call is not, and a new route cannot quietly
 * ship without one, because `handler()` requires the field.
 *
 * Two windows on one route are deliberate. `feedback.draft` is 240 an hour with
 * a two-second floor: autosave should be able to keep up with typing, and also
 * must not become a write amplifier when a key is held down.
 */

const MINUTE = 60_000
const HOUR = 3_600_000

export const LIMITS = {
  /** Typeahead. The client debounces 200 ms; this is the backstop. */
  search: { id: 'search', capacity: 60, windowMs: MINUTE },
  tags: { id: 'tags', capacity: 60, windowMs: MINUTE },

  notificationsList: { id: 'notifications.list', capacity: 120, windowMs: MINUTE },
  notificationsRead: { id: 'notifications.read', capacity: 60, windowMs: MINUTE },

  handleAvailable: { id: 'handle.available', capacity: 30, windowMs: MINUTE },

  vote: { id: 'vote', capacity: 60, windowMs: MINUTE },
  /**
   * One allowance across following people and following projects. They are the
   * same act from the platform's side (a subscription that produces
   * notifications), and sixty an hour is far above what following-as-you-browse
   * ever reaches.
   */
  follow: { id: 'follow', capacity: 60, windowMs: HOUR },
  bookmark: { id: 'bookmark', capacity: 120, windowMs: HOUR },

  draftSave: { id: 'feedback.draft', capacity: 240, windowMs: HOUR, floorMs: 2_000 },
  draftRead: { id: 'feedback.draft.read', capacity: 120, windowMs: MINUTE },
  /**
   * Discarding a draft carries no floor. It is what a successful submit does
   * next, and a two-second gate between "posted" and "draft cleared" would
   * strand a draft the reviewer has already sent.
   */
  draftDelete: { id: 'feedback.draft.delete', capacity: 120, windowMs: HOUR },

  health: { id: 'health', capacity: 60, windowMs: MINUTE },

  /**
   * The AI routes. Tighter on purpose: each one can reach a paid provider, and
   * the model-side cost ceiling in `@/server/ai` is a second, independent gate.
   * The coach also carries a four-second floor, because the composer calls it on
   * idle and a stuck client should cost one request, not a stream of them.
   */
  aiCoach: { id: 'ai.coach', capacity: 40, windowMs: HOUR, floorMs: 4_000 },
  aiCluster: { id: 'ai.cluster', capacity: 5, windowMs: HOUR, floorMs: 30_000 },
  aiIntake: { id: 'ai.intake', capacity: 12, windowMs: HOUR, floorMs: 10_000 },

  /** No route is unlimited. This is what an unlisted route would get. */
  default: { id: 'api.default', capacity: 300, windowMs: MINUTE },
} as const satisfies Record<string, LimitSpec>

/**
 * The new-account throttle, ROUTES §3.
 *
 * An account younger than a day gets half the capacity on anything that writes
 * public content. Spam accounts are minutes old; a real reviewer's first day is
 * not a day of sixty reviews, so the halving costs an honest user nothing.
 */
export const NEW_ACCOUNT_MS = 86_400_000

export function throttled(spec: LimitSpec, accountAgeMs: number): LimitSpec {
  if (accountAgeMs >= NEW_ACCOUNT_MS) return spec
  return { ...spec, capacity: Math.max(1, Math.floor(spec.capacity / 2)) }
}

import './guard'
import type { ProviderId } from './types'

/**
 * One circuit breaker per provider.
 *
 * When a provider is down, the expensive mistake is not the quality loss from
 * falling back to the deterministic path. It is the latency: a page that waits
 * thirty seconds for a timeout on every render is worse than one that answers
 * instantly from keywords. While the breaker is open the model path is skipped
 * with zero added latency.
 *
 * State is per process. A multi-process deploy gets one breaker per worker,
 * which converges on the same behaviour within a few requests and avoids a
 * shared-state round trip on the hot path.
 */

const FAILURE_THRESHOLD = 5
const FAILURE_WINDOW_MS = 60_000
const OPEN_MS = 300_000

type BreakerState = {
  failures: number[]
  openedAt?: number
  /** Set while a half-open probe is in flight, so only one request tests the water. */
  probing: boolean
}

const states = new Map<ProviderId, BreakerState>()

function stateOf(provider: ProviderId): BreakerState {
  const existing = states.get(provider)
  if (existing) return existing
  const created: BreakerState = { failures: [], probing: false }
  states.set(provider, created)
  return created
}

export type BreakerVerdict = 'closed' | 'open' | 'half_open'

export function breakerStatus(provider: ProviderId): BreakerVerdict {
  const state = stateOf(provider)
  if (state.openedAt === undefined) return 'closed'
  if (Date.now() - state.openedAt < OPEN_MS) return 'open'
  return 'half_open'
}

/**
 * True when a call may proceed. A half-open breaker admits exactly one probe;
 * every other caller is told no and takes the deterministic path immediately.
 */
export function breakerAllows(provider: ProviderId): boolean {
  const state = stateOf(provider)
  const status = breakerStatus(provider)
  if (status === 'closed') return true
  if (status === 'open') return false
  if (state.probing) return false
  state.probing = true
  return true
}

export function recordSuccess(provider: ProviderId): void {
  const state = stateOf(provider)
  state.failures = []
  state.openedAt = undefined
  state.probing = false
}

export function recordFailure(provider: ProviderId): void {
  const state = stateOf(provider)
  const nowMs = Date.now()
  state.probing = false
  state.failures = state.failures.filter((t) => nowMs - t < FAILURE_WINDOW_MS)
  state.failures.push(nowMs)
  if (state.failures.length >= FAILURE_THRESHOLD) {
    state.openedAt = nowMs
    state.failures = []
  }
}

/** Seconds until a half-open probe is allowed, for the operator page. */
export function breakerCooldownMs(provider: ProviderId): number {
  const state = stateOf(provider)
  if (state.openedAt === undefined) return 0
  return Math.max(0, OPEN_MS - (Date.now() - state.openedAt))
}

/** Test and operator hook: closes every breaker. */
export function resetBreakers(): void {
  states.clear()
}

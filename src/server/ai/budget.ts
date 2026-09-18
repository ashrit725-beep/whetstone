import './guard'
import { budgetConfig } from './config'
import { spendSince } from './store'
import type { BudgetScope } from './types'

/**
 * The spend guard.
 *
 * Three caps, all measured from the run ledger rather than estimated: a monthly
 * total, a per-user daily cap, and a per-project daily cap. Over any of them the
 * model path is skipped and the deterministic path runs. No user-facing feature
 * ever hard-fails on budget; the only visible difference is the provenance
 * label, and the operator sees the cap on the settings page.
 *
 * The ledger sum is cached for sixty seconds per scope, so a burst of calls does
 * not turn into a burst of aggregate queries.
 */

const TTL_MS = 60_000
const DAY_MS = 86_400_000

type Entry = { value: number; readAt: number }
const cache = new Map<string, Entry>()

function cachedSpend(key: string, sinceMs: number, scope: { userId?: string; projectId?: string }): number {
  const nowMs = Date.now()
  const hit = cache.get(key)
  if (hit && nowMs - hit.readAt < TTL_MS) return hit.value
  const value = spendSince(sinceMs, scope)
  cache.set(key, { value, readAt: nowMs })
  return value
}

function monthStart(): number {
  const d = new Date()
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
}

export type BudgetVerdict =
  | { allowed: true }
  | { allowed: false; scope: 'monthly' | 'user' | 'project'; spentMicros: number; capMicros: number }

export function checkBudget(scope: BudgetScope = {}): BudgetVerdict {
  const config = budgetConfig()
  const nowMs = Date.now()

  const monthly = cachedSpend(`month:${monthStart()}`, monthStart(), {})
  if (monthly >= config.monthlyMicros) {
    return { allowed: false, scope: 'monthly', spentMicros: monthly, capMicros: config.monthlyMicros }
  }

  if (scope.userId) {
    const since = nowMs - DAY_MS
    const spent = cachedSpend(`user:${scope.userId}`, since, { userId: scope.userId })
    if (spent >= config.perUserDailyMicros) {
      return { allowed: false, scope: 'user', spentMicros: spent, capMicros: config.perUserDailyMicros }
    }
  }

  if (scope.projectId) {
    const since = nowMs - DAY_MS
    const spent = cachedSpend(`project:${scope.projectId}`, since, { projectId: scope.projectId })
    if (spent >= config.perProjectDailyMicros) {
      return { allowed: false, scope: 'project', spentMicros: spent, capMicros: config.perProjectDailyMicros }
    }
  }

  return { allowed: true }
}

/**
 * Called after every model call so the next check sees fresh numbers without
 * waiting out the cache window. Cheap: an increment, not a query.
 */
export function noteSpend(micros: number, scope: BudgetScope = {}): void {
  bump(`month:${monthStart()}`, micros)
  if (scope.userId) bump(`user:${scope.userId}`, micros)
  if (scope.projectId) bump(`project:${scope.projectId}`, micros)
}

function bump(key: string, micros: number): void {
  const hit = cache.get(key)
  if (hit) hit.value += micros
}

export type BudgetSnapshot = {
  monthSpentMicros: number
  monthCapMicros: number
  /** 0 to 1. Crossing 1 moves every feature to its deterministic path. */
  fraction: number
}

/** What the operator page renders. Always a measured number, never a projection. */
export function budgetSnapshot(): BudgetSnapshot {
  const config = budgetConfig()
  const spent = cachedSpend(`month:${monthStart()}`, monthStart(), {})
  return {
    monthSpentMicros: spent,
    monthCapMicros: config.monthlyMicros,
    fraction: config.monthlyMicros === 0 ? 1 : spent / config.monthlyMicros,
  }
}

export function resetBudgetCache(): void {
  cache.clear()
}

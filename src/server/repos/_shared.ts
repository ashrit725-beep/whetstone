/**
 * Plumbing shared by every repository.
 *
 * Two rules hold across this whole directory and are enforced here rather than
 * remembered per file:
 *
 *   1. Values are always bound as parameters. Every `?` in this codebase is a
 *      bind slot. The only strings ever interpolated into SQL are identifiers
 *      this module builds itself (table aliases, column prefixes, a whitelisted
 *      ORDER BY fragment) — never a value that reached us from a request.
 *   2. Rows arrive from node:sqlite as plain objects. They are read through the
 *      typed accessors below instead of being cast, so a missing column reads
 *      as a null rather than crashing a page at render time.
 */

import type { Page, SeverityKey } from '@/lib/types'
import { SEVERITY_KEYS, tierFor } from '@/lib/taxonomy'
import type { UserCard } from '@/lib/types'

/** A raw result row. Read it with the accessors below. */
export type Row = Record<string, unknown>

/* ------------------------------------------------------------------------- *
 * Typed accessors
 * ------------------------------------------------------------------------- */

export function str(row: Row | undefined, key: string, fallback = ''): string {
  const v = row?.[key]
  return typeof v === 'string' ? v : fallback
}

export function strOrNull(row: Row | undefined, key: string): string | null {
  const v = row?.[key]
  return typeof v === 'string' && v.length > 0 ? v : null
}

export function num(row: Row | undefined, key: string, fallback = 0): number {
  const v = row?.[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'bigint') return Number(v)
  return fallback
}

export function numOrNull(row: Row | undefined, key: string): number | null {
  const v = row?.[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'bigint') return Number(v)
  return null
}

export function bool(row: Row | undefined, key: string): boolean {
  const v = row?.[key]
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'bigint') return v !== 0n
  return false
}

/** `content_warnings`, `platforms` and `payload` are all JSON text columns. */
export function jsonArray(row: Row | undefined, key: string): readonly string[] {
  const raw = strOrNull(row, key)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string')
  } catch {
    return []
  }
}

export function jsonObject(row: Row | undefined, key: string): Record<string, unknown> | null {
  const raw = strOrNull(row, key)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

/** Environment blobs are string maps; anything else in there is dropped. */
export function jsonStringMap(row: Row | undefined, key: string): Record<string, string> | null {
  const obj = jsonObject(row, key)
  if (!obj) return null
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') out[k] = v
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = String(v)
  }
  return Object.keys(out).length > 0 ? out : null
}

/* ------------------------------------------------------------------------- *
 * Numbers
 * ------------------------------------------------------------------------- */

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return n < 0 ? 0 : n > 1 ? 1 : n
}

export function clampNum(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return n < min ? min : n > max ? max : n
}

export const DAY_MS = 86_400_000
export const HOUR_MS = 3_600_000

/* ------------------------------------------------------------------------- *
 * Paging
 * ------------------------------------------------------------------------- */

export const DEFAULT_LIMIT = 24
export const MAX_LIMIT = 100

export function pageLimit(limit: number | undefined, fallback = DEFAULT_LIMIT): number {
  if (!limit || !Number.isFinite(limit)) return fallback
  return Math.trunc(clampNum(limit, 1, MAX_LIMIT))
}

export function encodeCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

export function decodeCursor(cursor: string | null | undefined): Row | null {
  if (!cursor) return null
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Row
    return null
  } catch {
    // A cursor that does not decode is treated as no cursor. A malformed
    // querystring should restart the list, never throw a page away.
    return null
  }
}

/**
 * Repositories fetch `limit + 1` rows and hand the result here. The extra row
 * is what proves there is a next page without a second COUNT query.
 */
export function toPage<T>(rows: T[], limit: number, makeCursor: (last: T) => string): Page<T> {
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const last = items[items.length - 1]
  return {
    items,
    hasMore,
    nextCursor: hasMore && last !== undefined ? makeCursor(last) : null,
  }
}

/** `?, ?, ?` for an IN list of known length. The values still bind separately. */
export function placeholders(count: number): string {
  return new Array(Math.max(0, count)).fill('?').join(', ')
}

/* ------------------------------------------------------------------------- *
 * User cards
 * ------------------------------------------------------------------------- */

/**
 * Select list for an embedded user card. `u`, `pr`, `rs` are table aliases and
 * `prefix` is a column prefix; all four are literals written by repository code,
 * never request data.
 */
export function userCardSelect(u: string, pr: string, rs: string, prefix: string): string {
  return [
    `${u}.id AS ${prefix}_id`,
    `${u}.handle AS ${prefix}_handle`,
    `${u}.is_expert AS ${prefix}_is_expert`,
    `${pr}.display_name AS ${prefix}_display_name`,
    `${pr}.avatar_url AS ${prefix}_avatar_url`,
    `${pr}.primary_role AS ${prefix}_primary_role`,
    `COALESCE(${rs}.total_score, 0) AS ${prefix}_score`,
  ].join(', ')
}

/** The two joins `userCardSelect` assumes, given the users alias. */
export function userCardJoin(u: string, pr: string, rs: string): string {
  return `LEFT JOIN profiles ${pr} ON ${pr}.user_id = ${u}.id
          LEFT JOIN reputation_scores ${rs} ON ${rs}.user_id = ${u}.id`
}

const PRIMARY_ROLES = new Set([
  'indie_dev', 'game_dev', 'founder', 'designer', 'video_creator', 'reviewer', 'other',
])

export function mapUserCard(row: Row, prefix: string): UserCard {
  const score = num(row, `${prefix}_score`)
  const tier = tierFor(score)
  const handle = str(row, `${prefix}_handle`)
  const roleRaw = strOrNull(row, `${prefix}_primary_role`)
  return {
    id: str(row, `${prefix}_id`),
    handle,
    // A profile row is guaranteed by the signup transaction, but a display name
    // is what renders; falling back to the handle keeps a row from going blank
    // if a profile is ever missing.
    displayName: str(row, `${prefix}_display_name`) || handle,
    avatarUrl: strOrNull(row, `${prefix}_avatar_url`),
    isExpert: bool(row, `${prefix}_is_expert`),
    primaryRole: roleRaw && PRIMARY_ROLES.has(roleRaw) ? (roleRaw as UserCard['primaryRole']) : null,
    score,
    tier: tier.key,
    tierLabel: tier.label,
  }
}

/** A card for a row where the user may have been deleted (`ON DELETE SET NULL`). */
export function mapUserCardOrNull(row: Row, prefix: string): UserCard | null {
  return strOrNull(row, `${prefix}_id`) ? mapUserCard(row, prefix) : null
}

/* ------------------------------------------------------------------------- *
 * Severity helpers
 * ------------------------------------------------------------------------- */

export function emptySeverityCounts(): Record<SeverityKey, number> {
  const out = {} as Record<SeverityKey, number>
  for (const k of SEVERITY_KEYS) out[k] = 0
  return out
}

export function isSeverityKey(value: string): value is SeverityKey {
  return (SEVERITY_KEYS as readonly string[]).includes(value)
}

/** Adds a count into a severity map, ignoring values the schema cannot produce. */
export function addSeverity(into: Record<SeverityKey, number>, key: string, count: number): void {
  if (isSeverityKey(key)) into[key] += count
}

/* ------------------------------------------------------------------------- *
 * Text
 * ------------------------------------------------------------------------- */

/** First N characters of a markdown body, without cutting mid-word. */
export function excerpt(body: string, max = 180): string {
  const flat = body.replace(/[#>*_`]/g, '').replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max).trimEnd()}…`
}

/**
 * FTS5 MATCH input. Bare user text can be a syntax error (an unbalanced quote,
 * a stray `NEAR`), which throws rather than returning nothing. Every token is
 * quoted and the last one gets a prefix `*`, so typing builds a live query.
 *
 * Control and format characters are separators, not text. SQLite reads the
 * MATCH argument as a C string, so a NUL arriving in `?q=` ended the expression
 * inside its own quote and raised `unterminated string`, which took the page to
 * its error state; and a token the tokeniser cannot index (`#`, `&&`) would
 * quietly narrow the query to nothing while looking like a term. Both are
 * dropped here, so a query made only of them returns `null` and the caller
 * reports that nothing matched.
 */
export function toFtsQuery(raw: string): string | null {
  const tokens = raw
    .toLowerCase()
    .replace(/["*(){}:^~-]|\p{Cc}|\p{Cf}/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => /[\p{L}\p{N}]/u.test(t))
    .slice(0, 12)
  if (tokens.length === 0) return null
  return tokens
    .map((t, i) => (i === tokens.length - 1 ? `"${t}"*` : `"${t}"`))
    .join(' AND ')
}

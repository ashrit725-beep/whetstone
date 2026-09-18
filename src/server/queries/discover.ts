/**
 * Discover-only reads that `src/server/repos/` does not expose.
 *
 * Three concerns that belong to this surface rather than to the repository:
 *
 *   1. `ProjectCard` carries the tagline, not the ask. CONTRACT §4.4 surface 2
 *      puts the real ask in the row, clipped to two lines in Literata, because
 *      a serif line in a row is the signal that a person wrote it. One query
 *      per page resolves the first ask for every row, so there is no N+1.
 *
 *   2. `listProjects` pages with an opaque cursor and does not report how many
 *      rows the filter matched. Discover has to: the result count is announced
 *      politely on every filter change, and "Load more" announces "20 more
 *      loaded, 60 of 148". So a slice is one page of the feed at an offset,
 *      under a clock the first page pinned, and its total is counted by
 *      `countProjects` over the very predicate the feed pages with.
 *
 *   3. The stored `hot_score` decays with the clock but is only written when a
 *      project changes. `keepHotScoresCurrent` brings every row to the same
 *      instant, off the request path.
 *
 * The saved-search table is created here too. It is a real table with a real
 * foreign key, created on first use so no migration step is added to a
 * schema.sql this file does not own.
 */

import { after } from 'next/server'
import type { FacetCounts, Millis, ProjectCard, ProjectFilters } from '@/lib/types'
import { db, all, get, run } from '@/server/db/client'
import { str, num } from '@/server/repos/_shared'
import type { Row } from '@/server/repos/_shared'
import {
  RANKED_FEED_DEPTH,
  countProjects,
  feedCursor,
  getFacetCounts,
  listProjects,
  recomputeHotScore,
  type FeedOrder,
} from '@/server/repos/projects'
import { now, uid } from '@/lib/utils'

/* ------------------------------------------------------------------ asks -- */

/**
 * The first ask for each of these projects, keyed by project id. One query for
 * the whole page. Projects with no ask are simply absent; the row falls back to
 * the tagline, which is also something the creator wrote.
 */
export function asksForProjects(projectIds: readonly string[]): ReadonlyMap<string, string> {
  const out = new Map<string, string>()
  if (projectIds.length === 0) return out
  const marks = projectIds.map(() => '?').join(', ')
  for (const r of all<Row>(
    `SELECT project_id, prompt, sort_order, created_at
       FROM project_asks
      WHERE project_id IN (${marks})
      ORDER BY sort_order, created_at`,
    [...projectIds],
  )) {
    const id = str(r, 'project_id')
    if (out.has(id)) continue
    const prompt = str(r, 'prompt')
    if (prompt.length > 0) out.set(id, prompt)
  }
  return out
}

/* ------------------------------------------------------------------ feed -- */

export type DiscoverSort = 'ranked' | 'newest' | 'needed' | 'discussed' | 'shipping'

const REPO_ORDER: Readonly<Record<DiscoverSort, FeedOrder>> = {
  ranked: 'ranked',
  newest: 'newest',
  needed: 'needs_eyes',
  discussed: 'most_reviewed',
  shipping: 'closest_to_shipping',
}

export interface FeedSlice {
  readonly items: readonly ProjectCard[]
  /**
   * Every project the filters match, counted, never capped. Under 'needed' it
   * is the needs-eyes pool within them, because that sort lists nothing else.
   */
  readonly total: number
  /**
   * How many of `total` this sort can list: all of them, except that the
   * ranked feed stops at `RANKED_FEED_DEPTH`.
   */
  readonly listed: number
  /** Where the next slice starts, or null when this slice reached the end. */
  readonly nextOffset: number | null
  /** The instant this feed is ranked against. Its later slices pass it back. */
  readonly clock: Millis
}

/**
 * One slice of the ordered feed for one filter set. A slice after the first
 * passes the first slice's `clock`, so the ranked feed is composed against the
 * same instant on every request and its offsets keep meaning the same rows.
 */
export function loadFeedSlice(
  filters: ProjectFilters,
  opts: {
    readonly sort: DiscoverSort
    readonly viewerId: string | null
    readonly offset: number
    readonly limit: number
    readonly clock?: Millis
  },
): FeedSlice {
  keepHotScoresCurrent()
  const order = REPO_ORDER[opts.sort]
  const clock = opts.clock ?? now()
  const offset = Math.max(0, opts.offset)

  const page = listProjects(filters, {
    viewerId: opts.viewerId,
    sort: order,
    limit: opts.limit,
    cursor: feedCursor(clock, offset),
  })
  const total = countListed(filters, opts.sort, opts.viewerId)

  return {
    items: page.items,
    total,
    listed: order === 'ranked' ? Math.min(total, RANKED_FEED_DEPTH) : total,
    nextOffset: page.hasMore ? offset + page.items.length : null,
    clock,
  }
}

/**
 * How many projects a filter set lists under a sort, counted. It is the result
 * count, and the empty state's "dropping this filter shows 212 projects" asks
 * it of the filters with one removed, so that sentence names a real number or
 * says nothing at all (§7.1.6).
 */
export function countListed(filters: ProjectFilters, sort: DiscoverSort, viewerId: string | null): number {
  return countProjects(filters, { viewerId, needsEyes: sort === 'needed' })
}

/**
 * The filter rail's counts, over the same rows the sort lists: under 'needed'
 * a chip counts only the needs-eyes pool, or ticking it would promise rows the
 * feed then does not show.
 */
export function facetsFor(filters: ProjectFilters, sort: DiscoverSort, viewerId: string | null): FacetCounts {
  return getFacetCounts(filters, { viewerId, needsEyes: sort === 'needed' })
}

/* ------------------------------------------------------------ hot scores -- */

/** How far the stored scores may drift from the present before all are redone. */
const HOT_SCORE_REFRESH_MS = 15 * 60_000

/** When this process last scheduled a full recompute; null before the first. */
let hotScoresScheduledAt: Millis | null = null

/**
 * `hot_score` carries a Freshness term, so a value is only as current as the
 * instant it was computed, and a project is only recomputed when it changes. On
 * their own, a quiet project would keep the freshness of the day it was last
 * touched and a busy one would be undercut by its own activity. So every
 * listed project is recomputed against one clock, at most every fifteen
 * minutes and once as soon as a process first serves the feed, after the
 * response has gone: a feed never waits for it.
 */
function keepHotScoresCurrent(): void {
  const at = now()
  if (hotScoresScheduledAt !== null && at - hotScoresScheduledAt < HOT_SCORE_REFRESH_MS) return
  hotScoresScheduledAt = at
  after(() => {
    try {
      recomputeHotScore()
    } catch (error) {
      // A missed refresh costs staleness, never a page; the next feed retries.
      hotScoresScheduledAt = null
      console.warn(`[discover] hot_score refresh failed: ${String(error)}`)
    }
  })
}

/* --------------------------------------------------------- saved searches -- */

export interface SavedSearch {
  readonly id: string
  readonly name: string
  /** The query string, without a leading "?". Replayed verbatim. */
  readonly queryString: string
  readonly createdAt: number
}

let tableReady = false

function ensureSavedSearchTable(): void {
  if (tableReady) return
  db().exec(
    `CREATE TABLE IF NOT EXISTS discover_saved_searches (
       id           TEXT PRIMARY KEY,
       user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
       name         TEXT NOT NULL,
       query_string TEXT NOT NULL,
       created_at   INTEGER NOT NULL
     ) STRICT;
     CREATE UNIQUE INDEX IF NOT EXISTS ux_discover_saved_searches_user_name
       ON discover_saved_searches (user_id, name);
     CREATE INDEX IF NOT EXISTS ix_discover_saved_searches_user
       ON discover_saved_searches (user_id, created_at DESC);`,
  )
  tableReady = true
}

export function listSavedSearches(userId: string): readonly SavedSearch[] {
  ensureSavedSearchTable()
  return all<Row>(
    `SELECT id, name, query_string, created_at
       FROM discover_saved_searches
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 20`,
    [userId],
  ).map((r) => ({
    id: str(r, 'id'),
    name: str(r, 'name'),
    queryString: str(r, 'query_string'),
    createdAt: num(r, 'created_at'),
  }))
}

export function savedSearchNameTaken(userId: string, name: string): boolean {
  ensureSavedSearchTable()
  const row = get<Row>(
    `SELECT id FROM discover_saved_searches WHERE user_id = ? AND name = ?`,
    [userId, name],
  )
  return row !== undefined
}

export function countSavedSearches(userId: string): number {
  ensureSavedSearchTable()
  const row = get<Row>(`SELECT COUNT(*) AS n FROM discover_saved_searches WHERE user_id = ?`, [userId])
  return num(row, 'n')
}

export function createSavedSearch(input: {
  readonly userId: string
  readonly name: string
  readonly queryString: string
}): string {
  ensureSavedSearchTable()
  const id = uid()
  run(
    `INSERT INTO discover_saved_searches (id, user_id, name, query_string, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, input.userId, input.name, input.queryString, now()],
  )
  return id
}

/** Returns false when the row was not this user's to remove. */
export function deleteSavedSearch(userId: string, id: string): boolean {
  ensureSavedSearchTable()
  const result = run(`DELETE FROM discover_saved_searches WHERE id = ? AND user_id = ?`, [id, userId])
  return result.changes > 0
}

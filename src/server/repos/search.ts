/**
 * Search, over the `projects_fts` external-content FTS5 index the schema
 * already maintains with triggers.
 *
 * User text never reaches MATCH raw. `toFtsQuery` quotes every token and
 * appends a prefix `*` to the last one, so an unbalanced quote or a stray NEAR
 * cannot become a syntax error, and typing builds a live query.
 *
 * Ranking is `bm25(projects_fts, 8, 4, 1)`: a title hit is worth eight times a
 * summary hit, because on a feedback platform people search for the name of the
 * thing far more often than for a phrase inside its description.
 */

import { all } from '@/server/db/client'
import type {
  Page,
  PageOptions,
  ProjectCard,
  ProjectSearchHit,
  ThreadCard,
} from '@/lib/types'
import {
  decodeCursor,
  encodeCursor,
  excerpt,
  num,
  pageLimit,
  str,
  toFtsQuery,
  toPage,
  type Row,
} from './_shared'
import { feedPredicate, listProjects, type ListProjectsOptions } from './projects'
import { listDiscussions } from './discussions'
import { listExperts } from './profiles'
import type { ExpertCard } from '@/lib/types'

const BM25_WEIGHTS = { title: 8, tagline: 4, summary: 1 } as const

/**
 * Column weights are numeric constants from this module, formatted into the SQL
 * rather than bound: FTS5 reads auxiliary-function weights at prepare time, and
 * `rank` is a reserved column name inside an FTS5 table, so the computed rank is
 * aliased to something else.
 */
const BM25 = `bm25(projects_fts, ${BM25_WEIGHTS.title}, ${BM25_WEIGHTS.tagline}, ${BM25_WEIGHTS.summary})`

export interface SearchProjectsOptions extends PageOptions {
  readonly viewerId?: string | null
  readonly typeSlug?: string | null
  readonly openOnly?: boolean
}

/**
 * Full-text project search. Two steps by design: FTS resolves and ranks the ids,
 * then the project repository builds the same card shape Discover renders, so a
 * search result and a feed row are never two different objects.
 *
 * The hits are drawn through the feed's own `feedPredicate`, so search lists
 * exactly the projects Discover lists for the same words (no NSFW row, nobody
 * the viewer has blocked or been blocked by) and every page is full: a row
 * cannot be ranked here and then dropped by the card builder.
 */
export function searchProjects(query: string, opts: SearchProjectsOptions = {}): Page<ProjectSearchHit> {
  const match = toFtsQuery(query)
  if (!match) return { items: [], hasMore: false, nextCursor: null }

  const limit = pageLimit(opts.limit, 20)
  const cursor = decodeCursor(opts.cursor)
  const offset = cursor ? num(cursor, 'o', 0) : 0
  const viewerId = opts.viewerId ?? null
  const where = feedPredicate(
    { typeSlug: opts.typeSlug ?? null, openOnly: opts.openOnly === true },
    { viewerId },
  )

  const hits = all<Row>(
    `SELECT p.id AS id,
            ${BM25} AS bm25_rank,
            snippet(projects_fts, 0, '<mark>', '</mark>', '…', 12) AS title_snippet,
            snippet(projects_fts, 2, '<mark>', '</mark>', '…', 24) AS body_snippet,
            p.title AS title, p.tagline AS tagline, p.summary_md AS summary
       FROM projects_fts
       JOIN projects p ON p.rowid = projects_fts.rowid
      WHERE projects_fts MATCH $match AND ${where.sql}
      ORDER BY bm25_rank
      LIMIT $limit OFFSET $offset`,
    [{ ...where.params, $match: match, $limit: limit + 1, $offset: offset }],
  )
  if (hits.length === 0) return { items: [], hasMore: false, nextCursor: null }

  const page = toPage(hits, limit, () => encodeCursor({ o: offset + limit }))
  const ids = page.items.map((r) => str(r, 'id'))

  // The cards come back through the feed's own builder, then are re-ordered
  // into the rank order FTS produced.
  const listOptions: ListProjectsOptions = {
    limit: ids.length,
    viewerId,
    sort: 'newest',
    reserveNeedsEyes: false,
  }
  const cards = listProjects({ projectIds: ids }, listOptions).items
  const byId = new Map<string, ProjectCard>(cards.map((c) => [c.id, c]))

  const items: ProjectSearchHit[] = []
  for (const r of page.items) {
    const card = byId.get(str(r, 'id'))
    if (!card) continue
    const titleSnippet = str(r, 'title_snippet')
    const bodySnippet = str(r, 'body_snippet')
    const matchedInTitle = titleSnippet.includes('<mark>')
    items.push({
      project: card,
      // bm25 returns a negative number where more negative is a better match.
      // Negating it gives a score that reads the way a score should.
      score: -num(r, 'bm25_rank'),
      matchedIn: matchedInTitle ? 'title' : bodySnippet.includes('<mark>') ? 'summary' : 'tagline',
      snippet: matchedInTitle ? titleSnippet : bodySnippet || excerpt(str(r, 'summary')),
    })
  }

  return { items, hasMore: page.hasMore, nextCursor: page.nextCursor }
}

export type SearchScope = 'all' | 'projects' | 'discussions' | 'experts'

export interface SearchResults {
  readonly query: string
  readonly scope: SearchScope
  readonly projects: Page<ProjectSearchHit>
  readonly discussions: Page<ThreadCard>
  readonly experts: Page<ExpertCard>
  readonly total: number
}

/**
 * Under 'all', discussions and reviewers are a short digest beside the
 * projects, so a long list of projects cannot bury the two discussions that
 * answer the question better.
 */
const DIGEST_LIMIT = { discussions: 5, experts: 3 } as const

/**
 * The `/search` surface. Under 'all' every kind is searched once, projects to
 * `limit` and the others to their digest, and the cursor is ignored: the three
 * kinds page differently and one cursor cannot continue all of them. Under one
 * scope only that kind is searched, `limit` rows at a time from `cursor`.
 */
export function search(
  query: string,
  opts: PageOptions & { readonly scope?: SearchScope; readonly viewerId?: string | null } = {},
): SearchResults {
  const scope = opts.scope ?? 'all'
  const empty = { items: [], hasMore: false, nextCursor: null } as const
  const page = (kind: Exclude<SearchScope, 'all'>): PageOptions =>
    scope !== 'all'
      ? { limit: opts.limit, cursor: opts.cursor }
      : { limit: kind === 'projects' ? opts.limit : DIGEST_LIMIT[kind] }

  const projects =
    scope === 'all' || scope === 'projects'
      ? searchProjects(query, { ...page('projects'), viewerId: opts.viewerId })
      : empty

  const discussions =
    scope === 'all' || scope === 'discussions'
      ? listDiscussions({ query, ...page('discussions') })
      : empty

  const experts =
    scope === 'all' || scope === 'experts'
      ? listExperts({ query }, page('experts'))
      : empty

  return {
    query,
    scope,
    projects,
    discussions,
    experts,
    total: projects.items.length + discussions.items.length + experts.items.length,
  }
}

/** Type-ahead: titles only, cheap enough to run on every keystroke. */
export function suggestProjects(query: string, limit = 6): readonly { id: string; slug: string; title: string }[] {
  const match = toFtsQuery(query)
  if (!match) return []
  return all<Row>(
    `SELECT p.id, p.slug, p.title
       FROM projects_fts
       JOIN projects p ON p.rowid = projects_fts.rowid
      WHERE projects_fts MATCH ?
        AND p.deleted_at IS NULL AND p.visibility = 'public' AND p.status = 'published'
      ORDER BY ${BM25}
      LIMIT ?`,
    [match, pageLimit(limit, 6)],
  ).map((r) => ({ id: str(r, 'id'), slug: str(r, 'slug'), title: str(r, 'title') }))
}

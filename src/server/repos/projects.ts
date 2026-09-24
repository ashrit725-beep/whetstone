/**
 * Projects: the Discover feed, the detail page, and the owner's own list.
 *
 * The feed implements design/TAXONOMY.md §4 in full:
 *
 *   Rank(p,u) = Quality(p)^0.8 · Need(p) · Freshness(p) · Urgency(p)
 *             · Fit(p,u) · Penalty(p)
 *
 * It runs as a scored pass rather than one enormous SQL expression. One
 * parameterised query draws a bounded candidate set with every ingredient the
 * formula needs, and `scoreCandidate` below applies the weights in TypeScript
 * where each term is readable and testable. Three properties fall out of that
 * arrangement and all of them matter:
 *
 *   The reserved "needs eyes" slots and the author-diversity penalty are
 *   position-dependent. They cannot be expressed in an ORDER BY at all, and
 *   composing the ordered feed once — before slicing a page out of it — is what
 *   makes paging exact rather than approximate.
 *
 *   The cursor pins the clock. Every page of one feed decays against the same
 *   instant, so a project cannot appear twice or be skipped because freshness
 *   moved between requests.
 *
 *   The other orderings (newest, most discussed, most needed, closest to
 *   shipping) are plain sort keys, so the database orders and pages them over
 *   every matching row. Only the ranked feed is composed, and only it has a
 *   depth: `RANKED_FEED_DEPTH`.
 *
 * Which rows match is decided in exactly one place, `feedPredicate`, which the
 * feed, its count and the filter rail's facet counts all read, so the number
 * announced above the list and the numbers beside every filter are counts of
 * the same rows the list pages through.
 */

import { all, get, run, tx } from '@/server/db/client'
import { now, slugify, uid } from '@/lib/utils'
import {
  FEED,
  GRIT_STAGES,
  QUALIFIED_SPECIFICITY,
  gritValue,
  stageLabel,
} from '@/lib/taxonomy'
import type {
  FacetCount,
  FacetCounts,
  FeedRankBreakdown,
  FeedbackState,
  MediaKind,
  Millis,
  Page,
  PageOptions,
  ProjectAskView,
  ProjectCard,
  ProjectDetail,
  ProjectFilters,
  ProjectLinkRow,
  ProjectMediaRow,
  ProjectOwnerRow,
  ProjectRow,
  ProjectStatus,
  ProjectTypeRow,
  ProjectUpdateView,
  ProjectVersionRow,
  ProjectVersionView,
  ProjectVisibility,
} from '@/lib/types'
import {
  DAY_MS,
  HOUR_MS,
  addSeverity,
  bool,
  clamp01,
  decodeCursor,
  emptySeverityCounts,
  encodeCursor,
  jsonArray,
  mapUserCard,
  num,
  numOrNull,
  pageLimit,
  placeholders,
  str,
  strOrNull,
  toFtsQuery,
  toPage,
  userCardJoin,
  userCardSelect,
  type Row,
} from './_shared'
import { axisAggregatesForProject } from './ratings'
import { recountTags, tagIdsForProject } from './tags'

/* ------------------------------------------------------------------------- *
 * The candidate query
 * ------------------------------------------------------------------------- */

interface Candidate {
  readonly id: string
  readonly ownerId: string
  readonly card: Omit<ProjectCard, 'needs' | 'tags' | 'rank'>
  /** Qualified reviews on the current version — `R_eff` in the Need term. */
  readonly qualified: number
  readonly creatorScore: number
  readonly briefCompleteness: number
  readonly helpfulMarks: number
  readonly repliedThreads: number
  readonly reviews: number
  readonly meaningfulUpdateAt: Millis
  readonly closesAt: Millis | null
  readonly feedbackState: FeedbackState
  readonly domainMatch: boolean
  readonly tagOverlap: boolean
  readonly alreadyReviewed: boolean
  readonly unansweredOld: number
}

/**
 * `ranked` is the composed feed. Every other ordering is a plain sort key:
 *
 *   newest               most recently published first
 *   most_reviewed        most notes received first
 *   needs_eyes           only the needs-eyes pool (open, at most
 *                        `FEED.needsEyesMaxReviews` qualified reviews on the
 *                        current build), fewest qualified reviews, then fewest
 *                        notes, then newest
 *   closest_to_shipping  highest grit first, then the one that moved last
 */
export type FeedOrder = 'ranked' | 'newest' | 'needs_eyes' | 'most_reviewed' | 'closest_to_shipping'

export interface ListProjectsOptions extends PageOptions {
  readonly viewerId?: string | null
  readonly viewerIsExpert?: boolean
  /** `ranked` is the Discover default; the others are explicit user choices. */
  readonly sort?: FeedOrder
  /** Include the per-term ranking breakdown on every card. */
  readonly explain?: boolean
  /** Reserve every 4th slot for the cold-start pool. On by default. */
  readonly reserveNeedsEyes?: boolean
}

/**
 * How deep the ranked feed goes. The formula is composed in TypeScript over a
 * window drawn by the stored `hot_score`, so the ranked feed lists at most this
 * many rows. The plain orderings have no depth: the database pages them.
 */
export const RANKED_FEED_DEPTH = 600

/**
 * Rows drawn for the reserved slots on top of the ranked window. A depth of 600
 * reserves 150 slots, and some of the pool is already inside the window.
 */
const NEEDS_EYES_POOL = 200

/**
 * The cursor for one position in one feed. Every page of a feed carries the
 * clock its first page was ranked against, so a caller that pages by offset
 * (Discover's "Load more") passes it back rather than re-ranking at a new
 * instant.
 */
export function feedCursor(clock: Millis, offset: number): string {
  return encodeCursor({ t: clock, o: offset })
}

/**
 * The Discover feed.
 *
 * Filters are all optional and all indexed: type and stage hit
 * `ix_projects_feed_facet`, needs and tags become semi-joins, and a text query
 * becomes an FTS5 semi-join rather than a LIKE scan.
 */
export function listProjects(
  filters: ProjectFilters = {},
  opts: ListProjectsOptions = {},
): Page<ProjectCard> {
  const limit = pageLimit(opts.limit, 24)
  const cursor = decodeCursor(opts.cursor)
  // The clock is pinned on the first page and carried forward, so every page of
  // one feed decays against the same instant.
  const clock = cursor ? num(cursor, 't', now()) : now()
  const offset = Math.max(0, cursor ? num(cursor, 'o', 0) : 0)
  const sort = opts.sort ?? 'ranked'

  let slice: readonly ScoredCandidate[]
  if (sort === 'ranked') {
    const window: CandidateWindow = { kind: 'ranked', withPool: opts.reserveNeedsEyes !== false }
    const ordered = orderFeed(loadCandidates(filters, opts, clock, window), opts, clock)
    slice = ordered.slice(offset, Math.min(offset + limit + 1, RANKED_FEED_DEPTH))
  } else {
    // One row past the page says whether there is another.
    const window: CandidateWindow = { kind: 'ordered', order: sort, offset, limit: limit + 1 }
    slice = loadCandidates(filters, opts, clock, window).map((c) => ({
      card: c.card,
      ownerId: c.ownerId,
      rank: { ...scoreCandidate(c, opts, clock), reserved: sort === 'needs_eyes' },
    }))
  }

  const page = toPage([...slice], limit, () => feedCursor(clock, offset + limit))
  const cards = hydrateCards(page.items.map((entry) => entry.card), page.items, opts.explain === true)
  return { items: cards, hasMore: page.hasMore, nextCursor: page.nextCursor }
}

/**
 * Exactly how many rows `listProjects` would page through for these filters,
 * counted rather than capped. `needsEyes` counts the pool the `needs_eyes`
 * ordering lists.
 */
export function countProjects(filters: ProjectFilters, scope: FeedScope = {}): number {
  const where = feedPredicate(filters, scope)
  return num(get<Row>(`SELECT COUNT(*) AS n FROM projects p WHERE ${where.sql}`, [where.params]), 'n')
}

interface ScoredCandidate {
  readonly card: Omit<ProjectCard, 'needs' | 'tags' | 'rank'>
  readonly ownerId: string
  readonly rank: FeedRankBreakdown
}

/* ------------------------------------------------------------------------- *
 * Which rows match
 * ------------------------------------------------------------------------- */

type FacetDimension = 'type' | 'stage' | 'needs' | 'tags'

export interface FeedScope {
  /** Blocks apply in both directions, and `excludeReviewedByViewer` needs a viewer. */
  readonly viewerId?: string | null
  /** Only the needs-eyes pool: what the `needs_eyes` ordering lists. */
  readonly needsEyes?: boolean
  /** A facet counts against every filter except its own; see `facetWhere`. */
  readonly omit?: FacetDimension
}

export interface Predicate {
  readonly sql: string
  /**
   * Named parameters, and only the ones `sql` reads: node:sqlite refuses a
   * named parameter the statement does not mention.
   */
  readonly params: Readonly<Record<string, unknown>>
}

/**
 * Qualified reviews on the current build: `R_eff` in the Need term, and the
 * test for the needs-eyes pool. One definition, read by the candidate query,
 * the pool, the count and the stored `hot_score` alike. A note on an earlier
 * build does not count, and nor does one attributed to no build while a current
 * build exists. Reads `$qualified` and the alias `p`.
 */
const QUALIFIED_ON_CURRENT = `(
  SELECT COUNT(*) FROM feedback fq
    LEFT JOIN project_versions cq ON cq.project_id = fq.project_id AND cq.is_current = 1
   WHERE fq.project_id = p.id AND fq.status = 'submitted' AND fq.deleted_at IS NULL
     AND COALESCE(fq.quality_score, 0) >= $qualified
     AND (cq.id IS NULL OR fq.version_id = cq.id))`

/**
 * The needs-eyes pool: open to new notes, and at most one qualified review on
 * the current build. A project that has closed its round, or taken it to
 * invited reviewers only, cannot be given the read the pool exists to find, and
 * the Need term already treats it as satisfied.
 */
const NEEDS_EYES = `p.feedback_state = 'open' AND ${QUALIFIED_ON_CURRENT} <= $needsMax`
const NEEDS_EYES_PARAMS = { $qualified: QUALIFIED_SPECIFICITY, $needsMax: FEED.needsEyesMaxReviews }

/** Grit from the stored stage key. The keys are this module's constants, never input. */
const GRIT_SQL = `(CASE p.stage_key ${GRIT_STAGES.map((g) => `WHEN '${g.key}' THEN ${String(g.grit)}`).join(' ')} ELSE 0 END)`

/**
 * The sort keys, over `projects p` and `project_stats st`. Each ends on the id,
 * so the order is total and an offset lands on the same row every time.
 */
const ORDER_SQL: Record<Exclude<FeedOrder, 'ranked'>, string> = {
  newest: 'p.published_at DESC, p.id DESC',
  most_reviewed: 'COALESCE(st.feedback_count, 0) DESC, p.published_at DESC, p.id DESC',
  needs_eyes: `${QUALIFIED_ON_CURRENT} ASC, COALESCE(st.feedback_count, 0) ASC, p.published_at DESC, p.id DESC`,
  closest_to_shipping: `${GRIT_SQL} DESC, COALESCE(st.last_activity_at, p.published_at) DESC, p.id DESC`,
}

/**
 * The WHERE clause, over the alias `p`, for everything a filter set and a
 * viewer can say about which projects are listed. The feed, `countProjects`,
 * `getFacetCounts` and project search all read it, which is what keeps their
 * numbers the same numbers.
 *
 * A filter that cannot match anything (a grit that is not a step, an empty id
 * list, a query with nothing searchable in it) becomes `0`, so every caller
 * gets an honest empty answer from the same query rather than a special case.
 */
export function feedPredicate(filters: ProjectFilters, scope: FeedScope = {}): Predicate {
  const where: string[] = ['p.deleted_at IS NULL']
  // Named parameters throughout: the candidate query this feeds has thirty bind
  // slots, and a positional list would be one edit away from a silent
  // mis-binding.
  const params: Record<string, unknown> = {}
  const viewerId = scope.viewerId ?? null
  const omit = scope.omit ?? null

  if (filters.ownerId) {
    // An owner looking at their own shelf sees drafts and private rows too.
    where.push('p.owner_id = $owner')
    params['$owner'] = filters.ownerId
  } else {
    where.push("p.visibility = 'public'", "p.status = 'published'")
  }

  if (omit !== 'type' && filters.typeSlug) {
    where.push('p.project_type_id = (SELECT id FROM project_types WHERE slug = $typeSlug)')
    params['$typeSlug'] = filters.typeSlug
  }
  if (omit !== 'stage') {
    if (filters.stageKey) {
      where.push('p.stage_key = $stageKey')
      params['$stageKey'] = filters.stageKey
    } else if (filters.grit) {
      // The grit numeral is the filter people actually click; it resolves to
      // the stage key the schema stores.
      const stage = GRIT_STAGES.find((g) => g.grit === filters.grit)
      if (stage) {
        where.push('p.stage_key = $stageKey')
        params['$stageKey'] = stage.key
      } else {
        where.push('0')
      }
    }
  }

  if (filters.projectIds) {
    const ids = filters.projectIds.filter((id) => id.length > 0)
    if (ids.length === 0) {
      where.push('0')
    } else {
      ids.forEach((value, i) => {
        params[`$pid${String(i)}`] = value
      })
      where.push(`p.id IN (${ids.map((_, i) => `$pid${String(i)}`).join(', ')})`)
    }
  }
  if (filters.openOnly) {
    where.push("p.feedback_state = 'open'")
  }
  if (!filters.includeNsfw) {
    where.push('p.is_nsfw = 0')
  }

  const needs = (filters.needs ?? []).filter((n) => n.length > 0)
  if (omit !== 'needs' && needs.length > 0) {
    needs.forEach((value, i) => {
      params[`$need${String(i)}`] = value
    })
    // Needs combine with OR: a reader ticking two asks wants either.
    where.push(
      `EXISTS (SELECT 1 FROM project_needs xn
                WHERE xn.project_id = p.id
                  AND xn.need_key IN (${needs.map((_, i) => `$need${String(i)}`).join(', ')}))`,
    )
  }

  const tagSlugs = (filters.tagSlugs ?? []).filter((t) => t.length > 0)
  if (omit !== 'tags' && tagSlugs.length > 0) {
    tagSlugs.forEach((value, i) => {
      params[`$tag${String(i)}`] = value
    })
    where.push(
      `EXISTS (SELECT 1 FROM project_tags xt
                 JOIN tags xg ON xg.id = xt.tag_id
                WHERE xt.project_id = p.id
                  AND xg.slug IN (${tagSlugs.map((_, i) => `$tag${String(i)}`).join(', ')}))`,
    )
  }

  if (filters.query) {
    const match = toFtsQuery(filters.query)
    if (match) {
      where.push('p.rowid IN (SELECT rowid FROM projects_fts WHERE projects_fts MATCH $fts)')
      params['$fts'] = match
    } else {
      where.push('0')
    }
  }

  if (viewerId) {
    params['$viewer'] = viewerId
    // Blocks filter in both directions: a block should not need two rows to work.
    where.push(
      `NOT EXISTS (SELECT 1 FROM user_blocks xb
                    WHERE (xb.blocker_id = $viewer AND xb.blocked_id = p.owner_id)
                       OR (xb.blocked_id = $viewer AND xb.blocker_id = p.owner_id))`,
    )
    if (filters.excludeReviewedByViewer) {
      where.push(
        `NOT EXISTS (SELECT 1 FROM feedback xr
                      WHERE xr.project_id = p.id AND xr.reviewer_id = $viewer
                        AND xr.status = 'submitted')`,
      )
    }
  }

  if (scope.needsEyes) {
    where.push(NEEDS_EYES)
    Object.assign(params, NEEDS_EYES_PARAMS)
  }

  return { sql: where.join(' AND '), params }
}

/* ------------------------------------------------------------------------- *
 * The candidate query
 * ------------------------------------------------------------------------- */

/**
 * Which candidates to draw.
 *
 *   ranked   the `RANKED_FEED_DEPTH` rows with the highest stored `hot_score`,
 *            plus (with the pool on) the neediest rows of the needs-eyes pool,
 *            so the reserved slots are filled from projects that genuinely have
 *            no reviews rather than from whichever of them happened to rank.
 *            Unordered: `orderFeed` composes them.
 *   ordered  one page of a plain ordering, in order. `limit: null` is every row.
 */
type CandidateWindow =
  | { readonly kind: 'ranked'; readonly withPool: boolean }
  | {
      readonly kind: 'ordered'
      readonly order: Exclude<FeedOrder, 'ranked'>
      readonly offset: number
      readonly limit: number | null
    }

/**
 * The window as a CTE of `(id, pos)`. The window is chosen over `projects` and
 * `project_stats` alone, so the heavy per-row subqueries of the candidate query
 * run only for the rows that are drawn, never for every row a sort has to look
 * at.
 */
function windowSql(filters: ProjectFilters, opts: ListProjectsOptions, window: CandidateWindow): Predicate {
  const viewerId = opts.viewerId ?? null

  if (window.kind === 'ordered') {
    const where = feedPredicate(filters, { viewerId, needsEyes: window.order === 'needs_eyes' })
    const orderBy = ORDER_SQL[window.order]
    return {
      sql: `SELECT p.id AS id, ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS pos
              FROM projects p
              LEFT JOIN project_stats st ON st.project_id = p.id
             WHERE ${where.sql}
             ORDER BY pos
             LIMIT $windowLimit OFFSET $windowOffset`,
      params: {
        ...where.params,
        // SQLite reads a negative LIMIT as no limit at all.
        $windowLimit: window.limit ?? -1,
        $windowOffset: Math.max(0, window.offset),
      },
    }
  }

  const where = feedPredicate(filters, { viewerId })
  const hot = `SELECT id, 0 AS pos FROM (
                 SELECT p.id FROM projects p
                  WHERE ${where.sql}
                  ORDER BY p.hot_score DESC, p.published_at DESC
                  LIMIT $depth)`
  if (!window.withPool) {
    return { sql: hot, params: { ...where.params, $depth: RANKED_FEED_DEPTH } }
  }
  return {
    sql: `${hot}
          UNION
          SELECT id, 0 AS pos FROM (
            SELECT p.id FROM projects p
              LEFT JOIN project_stats st ON st.project_id = p.id
             WHERE ${where.sql} AND ${NEEDS_EYES}
             ORDER BY ${ORDER_SQL.needs_eyes}
             LIMIT $pool)`,
    params: { ...where.params, ...NEEDS_EYES_PARAMS, $depth: RANKED_FEED_DEPTH, $pool: NEEDS_EYES_POOL },
  }
}

function loadCandidates(
  filters: ProjectFilters,
  opts: ListProjectsOptions,
  clock: Millis,
  window: CandidateWindow,
): readonly Candidate[] {
  const viewerId = opts.viewerId ?? null
  const win = windowSql(filters, opts, window)
  const params: Record<string, unknown> = { ...win.params, $qualified: QUALIFIED_SPECIFICITY }
  if (viewerId) params['$viewer'] = viewerId

  const viewerBlock = viewerId
    ? `EXISTS (SELECT 1 FROM feedback fd
                 JOIN projects pd ON pd.id = fd.project_id
                WHERE fd.reviewer_id = $viewer AND fd.status = 'submitted'
                  AND pd.project_type_id = p.project_type_id)                     AS domain_match,
       EXISTS (SELECT 1 FROM project_tags pt2
                 JOIN tag_follows tf ON tf.tag_id = pt2.tag_id
                WHERE pt2.project_id = p.id AND tf.user_id = $viewer)             AS tag_overlap,
       EXISTS (SELECT 1 FROM feedback fr
                WHERE fr.project_id = p.id AND fr.reviewer_id = $viewer
                  AND fr.status = 'submitted'
                  AND (cv.id IS NULL OR fr.version_id = cv.id))                   AS already_reviewed,
       EXISTS (SELECT 1 FROM project_follows pf
                WHERE pf.project_id = p.id AND pf.user_id = $viewer)              AS viewer_follows,
       EXISTS (SELECT 1 FROM project_bookmarks pb
                WHERE pb.project_id = p.id AND pb.user_id = $viewer)              AS viewer_bookmarked,`
    : `0 AS domain_match, 0 AS tag_overlap, 0 AS already_reviewed,
       0 AS viewer_follows, 0 AS viewer_bookmarked,`

  params['$unansweredCutoff'] = clock - FEED.unansweredAgeDays * DAY_MS

  const rows = all<Row>(
    `WITH win AS (${win.sql})
     SELECT
       p.id, p.slug, p.title, p.tagline, p.owner_id, p.stage_key, p.feedback_state,
       p.feedback_closes_at, p.published_at, p.is_nsfw, p.summary_md,
       pt.slug AS type_slug, pt.label AS type_label, pt.icon AS type_icon,
       ${userCardSelect('u', 'pr', 'rs', 'o')},
       COALESCE(rs.creator_score, 0)        AS creator_score,
       COALESCE(st.feedback_count, 0)       AS feedback_count,
       COALESCE(st.reviewer_count, 0)       AS reviewer_count,
       COALESCE(st.shipped_suggestions, 0)  AS shipped_suggestions,
       COALESCE(st.reply_rate, 0.0)         AS reply_rate,
       COALESCE(st.rating_avg, 0.0)         AS rating_avg,
       COALESCE(st.rating_count, 0)         AS rating_count,
       st.last_activity_at                  AS last_activity_at,
       cv.id                                AS current_version_id,
       cv.created_at                        AS current_version_at,
       cv.build_url                         AS current_build_url,
       cv.embed_url                         AS current_embed_url,
       pm.url AS cover_url, pm.thumb_url AS cover_thumb, pm.alt_text AS cover_alt,
       pm.media_kind AS cover_kind,
       ${viewerBlock}
       ${QUALIFIED_ON_CURRENT}                                                    AS qualified_reviews,
       (SELECT COUNT(*) FROM feedback fh
         WHERE fh.project_id = p.id AND fh.creator_marked_helpful = 1
           AND fh.status = 'submitted')                                           AS helpful_marks,
       (SELECT COUNT(*) FROM feedback fp2
         WHERE fp2.project_id = p.id AND fp2.first_reply_at IS NOT NULL
           AND fp2.status = 'submitted')                                          AS replied_threads,
       (SELECT COUNT(*) FROM feedback fu
         WHERE fu.project_id = p.id AND fu.status = 'submitted'
           AND fu.deleted_at IS NULL AND fu.first_reply_at IS NULL
           AND fu.submitted_at < $unansweredCutoff)                               AS unanswered_old,
       (SELECT COUNT(*) FROM project_asks pa WHERE pa.project_id = p.id)          AS ask_count,
       (SELECT COUNT(*) FROM project_needs pn2 WHERE pn2.project_id = p.id)       AS need_count,
       (SELECT COUNT(*) FROM project_tags pt3 WHERE pt3.project_id = p.id)        AS tag_count
     FROM win
     JOIN projects p ON p.id = win.id
     JOIN project_types pt ON pt.id = p.project_type_id
     JOIN users u ON u.id = p.owner_id
     ${userCardJoin('u', 'pr', 'rs')}
     LEFT JOIN project_stats st ON st.project_id = p.id
     LEFT JOIN project_versions cv ON cv.project_id = p.id AND cv.is_current = 1
     LEFT JOIN project_media pm ON pm.id = COALESCE(
       p.primary_media_id,
       (SELECT m2.id FROM project_media m2 WHERE m2.project_id = p.id
         ORDER BY m2.sort_order, m2.created_at LIMIT 1))
    ORDER BY win.pos`,
    [params],
  )

  return rows.map((r): Candidate => {
    const typeSlug = str(r, 'type_slug')
    const stageKey = str(r, 'stage_key')
    const publishedAt = numOrNull(r, 'published_at')
    const versionAt = numOrNull(r, 'current_version_at')
    const coverUrl = strOrNull(r, 'cover_url')

    // Q_brief: five things a first-time creator fully controls. Weighted
    // heavily in the formula on purpose, so the feed teaches a good ask on the
    // very first post rather than gating newcomers behind history.
    const briefParts = [
      num(r, 'ask_count') > 0,
      strOrNull(r, 'current_build_url') !== null || strOrNull(r, 'current_embed_url') !== null,
      (strOrNull(r, 'summary_md') ?? '').length >= 80,
      num(r, 'need_count') >= 2,
      num(r, 'tag_count') >= 1,
    ]

    return {
      id: str(r, 'id'),
      ownerId: str(r, 'owner_id'),
      qualified: num(r, 'qualified_reviews'),
      creatorScore: num(r, 'creator_score'),
      briefCompleteness: briefParts.filter(Boolean).length / briefParts.length,
      helpfulMarks: num(r, 'helpful_marks'),
      repliedThreads: num(r, 'replied_threads'),
      reviews: num(r, 'feedback_count'),
      meaningfulUpdateAt: Math.max(publishedAt ?? 0, versionAt ?? 0),
      closesAt: numOrNull(r, 'feedback_closes_at'),
      feedbackState: (str(r, 'feedback_state') || 'open') as FeedbackState,
      domainMatch: bool(r, 'domain_match'),
      tagOverlap: bool(r, 'tag_overlap'),
      alreadyReviewed: bool(r, 'already_reviewed'),
      unansweredOld: num(r, 'unanswered_old'),
      card: {
        id: str(r, 'id'),
        slug: str(r, 'slug'),
        title: str(r, 'title'),
        tagline: strOrNull(r, 'tagline'),
        typeSlug,
        typeLabel: str(r, 'type_label'),
        typeIcon: strOrNull(r, 'type_icon'),
        stageKey,
        stageLabel: stageLabel(typeSlug, stageKey),
        grit: gritValue(stageKey),
        owner: mapUserCard(r, 'o'),
        cover: coverUrl
          ? {
              url: coverUrl,
              thumbUrl: strOrNull(r, 'cover_thumb'),
              altText: str(r, 'cover_alt'),
              kind: (str(r, 'cover_kind') || 'image') as MediaKind,
            }
          : null,
        counts: {
          feedback: num(r, 'feedback_count'),
          reviewers: num(r, 'reviewer_count'),
          qualifiedReviews: num(r, 'qualified_reviews'),
          shipped: num(r, 'shipped_suggestions'),
        },
        replyRate: num(r, 'reply_rate'),
        ratingAvg: num(r, 'rating_avg'),
        ratingCount: num(r, 'rating_count'),
        feedbackState: (str(r, 'feedback_state') || 'open') as FeedbackState,
        publishedAt,
        lastActivityAt: numOrNull(r, 'last_activity_at'),
        isNsfw: bool(r, 'is_nsfw'),
        viewerHasReviewed: bool(r, 'already_reviewed'),
        viewerFollows: bool(r, 'viewer_follows'),
        viewerBookmarked: bool(r, 'viewer_bookmarked'),
      },
    }
  })
}

/* ------------------------------------------------------------------------- *
 * The formula
 * ------------------------------------------------------------------------- */

function scoreCandidate(c: Candidate, opts: ListProjectsOptions, clock: Millis): FeedRankBreakdown {
  // --- Quality = 0.5·Q_creator + 0.3·Q_brief + 0.2·Q_engagement -------------
  // Creators have reputation too: responsiveness, triage rate, ship rate.
  const qualityCreator = clamp01(c.creatorScore / FEED.creatorScoreDivisor)
  const qualityBrief = clamp01(c.briefCompleteness)
  // Do reviewers who go in find it worth it? Creator replies count double,
  // because a reply is the creator spending something, not just clicking.
  const qualityEngagement = clamp01(
    (c.helpfulMarks + 2 * c.repliedThreads) / (3 + c.reviews),
  )
  const quality = clamp01(
    FEED.qualityCreator * qualityCreator +
      FEED.qualityBrief * qualityBrief +
      FEED.qualityEngagement * qualityEngagement,
  )

  // --- Need = 1 + 1.6·exp(−R_eff / 3) --------------------------------------
  // Zero qualified reviews is a 2.6× boost, fading to ~1.06× at ten. Once the
  // creator closed the ask they got what they came for, and the project rotates
  // out at 0.3× rather than holding a slot it no longer needs.
  const need =
    c.feedbackState === 'open'
      ? 1 + FEED.needAmplitude * Math.exp(-c.qualified / FEED.needDecay)
      : FEED.needSatisfied

  // --- Freshness = 1 / (1 + (hours / 36)^1.4) ------------------------------
  // A meaningful update is a first publish, a new build, or a changed ask.
  // Comment activity is deliberately excluded: otherwise creators bump-farm
  // their own threads and the feed rewards noise.
  const hours = Math.max(0, (clock - c.meaningfulUpdateAt) / HOUR_MS)
  const freshness = 1 / (1 + Math.pow(hours / FEED.freshnessHalfLifeHours, FEED.freshnessExponent))

  // --- Urgency = 1 + 0.4·[deadline within 14 days] -------------------------
  const urgent =
    c.closesAt !== null &&
    c.closesAt > clock &&
    c.closesAt - clock <= FEED.urgencyWindowDays * DAY_MS
  const urgency = 1 + (urgent ? FEED.urgencyBonus : 0)

  // --- Fit -----------------------------------------------------------------
  // The shown-and-skipped term of the document needs an impressions table the
  // schema does not carry, so it is absent rather than faked.
  let fit =
    1 +
    (c.domainMatch ? FEED.fitDomainMatch : 0) +
    (c.tagOverlap ? FEED.fitTagOverlap : 0) +
    (opts.viewerIsExpert ? FEED.fitExpertAxis : 0)
  if (c.alreadyReviewed) fit *= FEED.fitAlreadyReviewed

  // --- Penalty -------------------------------------------------------------
  // The anti-extraction term is the ethical core of the ranking. Reviewer
  // attention is the scarce resource here, and a creator who takes it and never
  // answers loses reach fast. Author diversity is applied later, in
  // `orderFeed`, because it depends on position rather than on the row.
  const penalty = c.unansweredOld >= FEED.unansweredThreshold ? FEED.penaltyUnanswered : 1

  const score =
    Math.pow(quality, FEED.qualityExponent) * need * freshness * urgency * fit * penalty

  return {
    score,
    quality,
    qualityCreator,
    qualityBrief,
    qualityEngagement,
    need,
    freshness,
    urgency,
    fit,
    penalty,
    reserved: false,
  }
}

/**
 * Composes the whole ranked feed, then the caller slices a page out of it.
 *
 * Two guarantees from §4.5 override the raw ranking and both are positional:
 *
 *   Every 4th slot is drawn from the "needs eyes" pool — open projects with
 *   zero or one qualified review, sorted by Need · Fit alone, ignoring Quality
 *   entirely. Among equals the one with fewer notes of any kind goes first, then
 *   the newer one. Without this the feed is a rich-get-richer machine and the
 *   marketplace dies from the supply side.
 *
 *   A creator already holding a slot in the top 20 has their next row damped to
 *   0.6, so one prolific poster cannot own the page.
 *
 * ε-exploration from the document is deliberately not implemented: a random
 * term would make a server-rendered feed unreproducible between the page and
 * its own next cursor.
 */
function orderFeed(
  candidates: readonly Candidate[],
  opts: ListProjectsOptions,
  clock: Millis,
): readonly ScoredCandidate[] {
  const scored = candidates.map((c) => ({ c, rank: scoreCandidate(c, opts, clock) }))

  const main = [...scored].sort((a, b) =>
    b.rank.score !== a.rank.score ? b.rank.score - a.rank.score : a.c.id < b.c.id ? 1 : -1,
  )
  const pool = scored
    .filter(({ c }) => c.feedbackState === 'open' && c.qualified <= FEED.needsEyesMaxReviews)
    .sort(
      (a, b) =>
        b.rank.need * b.rank.fit - a.rank.need * a.rank.fit ||
        a.c.reviews - b.c.reviews ||
        (b.c.card.publishedAt ?? 0) - (a.c.card.publishedAt ?? 0) ||
        (a.c.id < b.c.id ? 1 : -1),
    )

  const reserve = opts.reserveNeedsEyes !== false
  const out: ScoredCandidate[] = []
  const used = new Set<string>()
  const ownerHits = new Map<string, number>()
  let mainIndex = 0
  let poolIndex = 0
  const total = main.length

  const push = (entry: { c: Candidate; rank: FeedRankBreakdown }, reserved: boolean): void => {
    const seen = ownerHits.get(entry.c.ownerId) ?? 0
    // Author diversity: the damping only applies inside the window it exists
    // to protect, so a creator is not punished forever for posting twice.
    const diversity = seen > 0 && out.length < FEED.authorDiversityWindow ? FEED.penaltyAuthorRepeat : 1
    ownerHits.set(entry.c.ownerId, seen + 1)
    used.add(entry.c.id)
    out.push({
      card: entry.c.card,
      ownerId: entry.c.ownerId,
      rank: {
        ...entry.rank,
        score: entry.rank.score * diversity,
        penalty: entry.rank.penalty * diversity,
        reserved,
      },
    })
  }

  while (out.length < total) {
    const isReservedSlot = reserve && (out.length + 1) % FEED.reservedSlotEvery === 0
    if (isReservedSlot) {
      while (poolIndex < pool.length && used.has(pool[poolIndex]?.c.id ?? '')) poolIndex += 1
      const pick = pool[poolIndex]
      if (pick) {
        poolIndex += 1
        push(pick, true)
        continue
      }
    }
    while (mainIndex < main.length && used.has(main[mainIndex]?.c.id ?? '')) mainIndex += 1
    const pick = main[mainIndex]
    if (!pick) break
    mainIndex += 1
    push(pick, false)
  }

  return out
}

/**
 * Needs and tags for one page of cards, in two queries rather than two per row.
 */
function hydrateCards(
  cards: readonly Omit<ProjectCard, 'needs' | 'tags' | 'rank'>[],
  scored: readonly ScoredCandidate[],
  explain: boolean,
): readonly ProjectCard[] {
  if (cards.length === 0) return []
  const ids = cards.map((c) => c.id)

  const needsByProject = new Map<string, { key: string; label: string }[]>()
  for (const r of all<Row>(
    `SELECT pn.project_id, pn.need_key, nk.label
       FROM project_needs pn
       JOIN need_kinds nk ON nk.need_key = pn.need_key
      WHERE pn.project_id IN (${placeholders(ids.length)})
      ORDER BY nk.sort_order`,
    ids,
  )) {
    const list = needsByProject.get(str(r, 'project_id')) ?? []
    list.push({ key: str(r, 'need_key'), label: str(r, 'label') })
    needsByProject.set(str(r, 'project_id'), list)
  }

  const tagsByProject = new Map<string, { slug: string; label: string }[]>()
  for (const r of all<Row>(
    `SELECT pt.project_id, t.slug, t.label
       FROM project_tags pt
       JOIN tags t ON t.id = pt.tag_id
      WHERE pt.project_id IN (${placeholders(ids.length)}) AND t.is_blocked = 0
      ORDER BY t.label`,
    ids,
  )) {
    const list = tagsByProject.get(str(r, 'project_id')) ?? []
    list.push({ slug: str(r, 'slug'), label: str(r, 'label') })
    tagsByProject.set(str(r, 'project_id'), list)
  }

  return cards.map((card, i) => ({
    ...card,
    needs: needsByProject.get(card.id) ?? [],
    tags: tagsByProject.get(card.id) ?? [],
    rank: explain ? (scored[i]?.rank ?? null) : null,
  }))
}

/* ------------------------------------------------------------------------- *
 * Facets
 * ------------------------------------------------------------------------- */

/**
 * Counts for the filter rail. Each facet counts against every active filter
 * except its own (`FeedScope.omit`), through the same `feedPredicate` the feed
 * pages with. That is what makes a count honest. "Needs: Art direction 212" has
 * to mean "212 of the projects you would see if you ticked it", so it must
 * respect the type, stage, tags, search, sort pool and blocks already applied;
 * and it must ignore the needs already ticked, because needs combine with OR
 * and ticking another one widens the feed rather than narrowing it. Four
 * grouped queries, no per-chip round trip.
 */
export function getFacetCounts(
  filters: ProjectFilters = {},
  scope: Omit<FeedScope, 'omit'> = {},
): FacetCounts {
  const byType = feedPredicate(filters, { ...scope, omit: 'type' })
  const types = all<Row>(
    `SELECT pt.slug AS key, pt.label AS label, COUNT(*) AS n
       FROM projects p JOIN project_types pt ON pt.id = p.project_type_id
      WHERE ${byType.sql}
      GROUP BY pt.slug, pt.label ORDER BY n DESC`,
    [byType.params],
  ).map(toFacet)

  const byStage = feedPredicate(filters, { ...scope, omit: 'stage' })
  const stages = all<Row>(
    `SELECT p.stage_key AS key, COUNT(*) AS n
       FROM projects p
      WHERE ${byStage.sql}
      GROUP BY p.stage_key`,
    [byStage.params],
  ).map((r) => ({
    key: str(r, 'key'),
    label: stageLabel(filters.typeSlug ?? '', str(r, 'key')),
    count: num(r, 'n'),
  }))

  const byNeed = feedPredicate(filters, { ...scope, omit: 'needs' })
  const needs = all<Row>(
    `SELECT nk.need_key AS key, nk.label AS label, COUNT(DISTINCT p.id) AS n
       FROM project_needs pn
       JOIN need_kinds nk ON nk.need_key = pn.need_key
       JOIN projects p ON p.id = pn.project_id
      WHERE ${byNeed.sql}
      GROUP BY nk.need_key, nk.label
      ORDER BY n DESC`,
    [byNeed.params],
  ).map(toFacet)

  const byTag = feedPredicate(filters, { ...scope, omit: 'tags' })
  const tags = all<Row>(
    `SELECT t.slug AS key, t.label AS label, COUNT(DISTINCT p.id) AS n
       FROM project_tags ptg
       JOIN tags t ON t.id = ptg.tag_id
       JOIN projects p ON p.id = ptg.project_id
      WHERE ${byTag.sql} AND t.is_blocked = 0
      GROUP BY t.slug, t.label
      ORDER BY n DESC
      LIMIT 20`,
    [byTag.params],
  ).map(toFacet)

  // Everything listed, whatever is filtered: the page uses this to tell "the
  // site is empty" apart from "your filters matched nothing".
  const total = countProjects({ includeNsfw: filters.includeNsfw }, { viewerId: scope.viewerId })
  return { types, stages, needs, tags, total }
}

function toFacet(r: Row): FacetCount {
  return { key: str(r, 'key'), label: str(r, 'label'), count: num(r, 'n') }
}

/* ------------------------------------------------------------------------- *
 * Detail
 * ------------------------------------------------------------------------- */

export interface GetProjectOptions {
  readonly viewerId?: string | null
  /** Disambiguates when two creators picked the same slug. */
  readonly ownerHandle?: string | null
}

/**
 * Everything the project page renders: the project, its creator, media, links,
 * the ask, needs, per-axis rating aggregates and feedback counts.
 *
 * Slugs are unique across the table (`ux_projects_slug`), so a bare `/p/<slug>`
 * resolves to exactly one project; the owner handle only narrows it further
 * when a caller has one in hand.
 */
export function getProjectBySlug(slug: string, opts: GetProjectOptions = {}): ProjectDetail | undefined {
  const viewerId = opts.viewerId ?? null
  const params: unknown[] = [slug]
  let ownerClause = ''
  if (opts.ownerHandle) {
    ownerClause = 'AND u.handle_normalized = ?'
    params.push(opts.ownerHandle.trim().toLowerCase().replace(/^@/, ''))
  }

  const row = get<Row>(
    `SELECT p.*, pt.slug AS type_slug, pt.label AS type_label, pt.icon AS type_icon,
            pt.embed_kind AS embed_kind,
            ${userCardSelect('u', 'pr', 'rs', 'o')},
            COALESCE(st.view_count, 0) AS view_count,
            COALESCE(st.feedback_count, 0) AS feedback_count,
            COALESCE(st.reviewer_count, 0) AS reviewer_count,
            COALESCE(st.expert_feedback_count, 0) AS expert_feedback_count,
            COALESCE(st.follower_count, 0) AS follower_count,
            COALESCE(st.bookmark_count, 0) AS bookmark_count,
            COALESCE(st.open_suggestions, 0) AS open_suggestions,
            COALESCE(st.shipped_suggestions, 0) AS shipped_suggestions,
            COALESCE(st.reply_rate, 0.0) AS reply_rate,
            st.last_feedback_at
       FROM projects p
       JOIN project_types pt ON pt.id = p.project_type_id
       JOIN users u ON u.id = p.owner_id
       ${userCardJoin('u', 'pr', 'rs')}
       LEFT JOIN project_stats st ON st.project_id = p.id
      WHERE p.slug = ? ${ownerClause} AND p.deleted_at IS NULL
      ORDER BY p.published_at DESC
      LIMIT 1`,
    params,
  )
  if (!row) return undefined

  const projectId = str(row, 'id')
  const typeSlug = str(row, 'type_slug')
  const stageKey = str(row, 'stage_key')
  const ownerId = str(row, 'owner_id')

  const versionRows = all<ProjectVersionRow>(
    `SELECT * FROM project_versions WHERE project_id = ? ORDER BY created_at DESC`,
    [projectId],
  )
  const versionCounts = new Map<string, number>()
  for (const r of all<Row>(
    `SELECT version_id, COUNT(*) AS n FROM feedback
      WHERE project_id = ? AND status = 'submitted' AND deleted_at IS NULL
        AND version_id IS NOT NULL
      GROUP BY version_id`,
    [projectId],
  )) {
    versionCounts.set(str(r, 'version_id'), num(r, 'n'))
  }
  const versions = versionRows.map((v) => mapVersion(v, versionCounts.get(v.id) ?? 0))
  const currentVersion = versions.find((v) => v.isCurrent) ?? null

  const media = all<ProjectMediaRow>(
    `SELECT * FROM project_media WHERE project_id = ? ORDER BY sort_order, created_at`,
    [projectId],
  )
  const links = all<ProjectLinkRow>(
    `SELECT * FROM project_links WHERE project_id = ? ORDER BY sort_order`,
    [projectId],
  )

  const asks = all<Row>(
    `SELECT pa.*, fc.label AS category_label
       FROM project_asks pa
       LEFT JOIN feedback_categories fc ON fc.id = pa.category_id
      WHERE pa.project_id = ?
      ORDER BY pa.sort_order, pa.created_at`,
    [projectId],
  ).map(
    (r): ProjectAskView => ({
      id: str(r, 'id'),
      prompt: str(r, 'prompt'),
      detailMd: strOrNull(r, 'detail_md'),
      isRequired: bool(r, 'is_required'),
      sortOrder: num(r, 'sort_order'),
      answerCount: num(r, 'answer_count'),
      categoryId: strOrNull(r, 'category_id'),
      categoryLabel: strOrNull(r, 'category_label'),
    }),
  )

  const needs = all<Row>(
    `SELECT pn.need_key, pn.detail, nk.label
       FROM project_needs pn
       JOIN need_kinds nk ON nk.need_key = pn.need_key
      WHERE pn.project_id = ?
      ORDER BY nk.sort_order`,
    [projectId],
  ).map((r) => ({ key: str(r, 'need_key'), label: str(r, 'label'), detail: strOrNull(r, 'detail') }))

  const tags = all<Row>(
    `SELECT t.id, t.slug, t.label FROM project_tags pt
       JOIN tags t ON t.id = pt.tag_id
      WHERE pt.project_id = ? AND t.is_blocked = 0
      ORDER BY t.label`,
    [projectId],
  ).map((r) => ({ id: str(r, 'id'), slug: str(r, 'slug'), label: str(r, 'label') }))

  const collaborators = all<Row>(
    `SELECT ${userCardSelect('u', 'pr', 'rs', 'c')}
       FROM project_collaborators pc
       JOIN users u ON u.id = pc.user_id
       ${userCardJoin('u', 'pr', 'rs')}
      WHERE pc.project_id = ? AND pc.accepted_at IS NOT NULL AND pc.member_role <> 'viewer'
      ORDER BY pc.created_at`,
    [projectId],
  ).map((r) => mapUserCard(r, 'c'))

  // One grouped query for the severity split, one row for the thread counts.
  const bySeverity = emptySeverityCounts()
  for (const r of all<Row>(
    `SELECT fp.severity AS severity, COUNT(*) AS n
       FROM feedback_points fp
       JOIN feedback f ON f.id = fp.feedback_id
      WHERE f.project_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL
      GROUP BY fp.severity`,
    [projectId],
  )) {
    addSeverity(bySeverity, str(r, 'severity'), num(r, 'n'))
  }

  const threadCounts = get<Row>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN first_reply_at IS NOT NULL THEN 1 ELSE 0 END) AS answered,
       SUM(CASE WHEN version_id IS NOT NULL AND version_id = ? THEN 1 ELSE 0 END) AS on_current
     FROM feedback
    WHERE project_id = ? AND status = 'submitted' AND deleted_at IS NULL`,
    [currentVersion?.id ?? null, projectId],
  )
  const total = num(threadCounts, 'total')
  const answered = num(threadCounts, 'answered')

  const isOwner = viewerId !== null && viewerId === ownerId
  const canEdit =
    isOwner ||
    (viewerId !== null &&
      get<Row>(
        `SELECT 1 AS hit FROM project_collaborators
          WHERE project_id = ? AND user_id = ? AND accepted_at IS NOT NULL
            AND member_role IN ('owner', 'collaborator')`,
        [projectId, viewerId],
      ) !== undefined)

  return {
    id: projectId,
    slug: str(row, 'slug'),
    title: str(row, 'title'),
    tagline: strOrNull(row, 'tagline'),
    summaryMd: strOrNull(row, 'summary_md'),
    typeSlug,
    typeLabel: str(row, 'type_label'),
    typeIcon: strOrNull(row, 'type_icon'),
    embedKind: (str(row, 'embed_kind') || 'none') as ProjectTypeRow['embed_kind'],
    stageKey,
    stageLabel: stageLabel(typeSlug, stageKey),
    grit: gritValue(stageKey),
    visibility: (str(row, 'visibility') || 'private') as ProjectVisibility,
    status: (str(row, 'status') || 'draft') as ProjectStatus,
    feedbackState: (str(row, 'feedback_state') || 'open') as FeedbackState,
    feedbackClosesAt: numOrNull(row, 'feedback_closes_at'),
    isNsfw: bool(row, 'is_nsfw'),
    contentWarnings: jsonArray(row, 'content_warnings'),
    publishedAt: numOrNull(row, 'published_at'),
    updatedAt: num(row, 'updated_at'),
    owner: mapUserCard(row, 'o'),
    collaborators,
    currentVersion,
    versions,
    media,
    links,
    asks,
    needs,
    tags,
    ratings: axisAggregatesForProject(projectId, str(row, 'project_type_id')),
    stats: {
      views: num(row, 'view_count'),
      feedback: num(row, 'feedback_count'),
      reviewers: num(row, 'reviewer_count'),
      expertFeedback: num(row, 'expert_feedback_count'),
      followers: num(row, 'follower_count'),
      bookmarks: num(row, 'bookmark_count'),
      openSuggestions: num(row, 'open_suggestions'),
      shippedSuggestions: num(row, 'shipped_suggestions'),
      replyRate: num(row, 'reply_rate'),
      lastFeedbackAt: numOrNull(row, 'last_feedback_at'),
    },
    feedbackCounts: {
      total,
      bySeverity,
      answered,
      unanswered: Math.max(0, total - answered),
      onCurrentVersion: num(threadCounts, 'on_current'),
    },
    viewer: {
      isOwner,
      canEdit,
      hasReviewed:
        viewerId !== null &&
        get<Row>(
          `SELECT 1 AS hit FROM feedback WHERE project_id = ? AND reviewer_id = ? AND status = 'submitted'`,
          [projectId, viewerId],
        ) !== undefined,
      hasDraft:
        viewerId !== null &&
        get<Row>(
          `SELECT 1 AS hit FROM feedback WHERE project_id = ? AND reviewer_id = ? AND status = 'draft'`,
          [projectId, viewerId],
        ) !== undefined,
      // The creator's own choices only: an award they made on one of this
      // project's bounties, or a playtest seat they sent as an invitation. A
      // seat taken through an open link is not an invitation.
      invitedToReview:
        viewerId !== null &&
        get<Row>(
          `SELECT 1 AS hit FROM bounty_awards ba JOIN bounties b ON b.id = ba.bounty_id
            WHERE b.project_id = ? AND ba.expert_id = ? AND ba.status NOT IN ('cancelled', 'expired')
           UNION ALL
           SELECT 1 FROM test_invitations ti JOIN test_rounds tr ON tr.id = ti.round_id
            WHERE tr.project_id = ? AND ti.user_id = ? AND ti.source = 'invite'
              AND ti.status IN ('pending', 'accepted', 'started', 'completed')
           LIMIT 1`,
          [projectId, viewerId, projectId, viewerId],
        ) !== undefined,
      follows:
        viewerId !== null &&
        get<Row>(`SELECT 1 AS hit FROM project_follows WHERE project_id = ? AND user_id = ?`, [
          projectId,
          viewerId,
        ]) !== undefined,
      bookmarked:
        viewerId !== null &&
        get<Row>(`SELECT 1 AS hit FROM project_bookmarks WHERE project_id = ? AND user_id = ?`, [
          projectId,
          viewerId,
        ]) !== undefined,
    },
  }
}

export function getProjectById(projectId: string): ProjectRow | undefined {
  return get<ProjectRow>(`SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL`, [projectId])
}

/** Owner-scoped read for the edit form. Returns undefined when they cannot edit it. */
export function getProjectForEdit(slug: string, userId: string): ProjectDetail | undefined {
  const detail = getProjectBySlug(slug, { viewerId: userId })
  if (!detail || !detail.viewer.canEdit) return undefined
  return detail
}

function mapVersion(v: ProjectVersionRow, feedbackCount: number): ProjectVersionView {
  let platforms: readonly string[] = []
  if (v.platforms) {
    try {
      const parsed: unknown = JSON.parse(v.platforms)
      if (Array.isArray(parsed)) platforms = parsed.filter((x): x is string => typeof x === 'string')
    } catch {
      platforms = []
    }
  }
  return {
    id: v.id,
    label: v.version_label,
    changelogMd: v.changelog_md,
    buildUrl: v.build_url,
    embedUrl: v.embed_url,
    platforms,
    isCurrent: v.is_current === 1,
    releasedAt: v.released_at,
    createdAt: v.created_at,
    feedbackCount,
  }
}

/* ------------------------------------------------------------------------- *
 * Owner lists
 * ------------------------------------------------------------------------- */

export function listMyProjects(
  userId: string,
  opts: { readonly limit?: number; readonly includeArchived?: boolean } = {},
): readonly ProjectOwnerRow[] {
  const rows = all<Row>(
    `SELECT p.*, pt.slug AS type_slug, pt.label AS type_label,
            COALESCE(st.feedback_count, 0) AS feedback_count,
            COALESCE(st.open_suggestions, 0) AS open_suggestions,
            COALESCE(st.shipped_suggestions, 0) AS shipped_suggestions,
            COALESCE(st.reply_rate, 0.0) AS reply_rate,
            (SELECT COUNT(*) FROM feedback f
              WHERE f.project_id = p.id AND f.status = 'submitted'
                AND f.deleted_at IS NULL AND f.inbox_state = 'new')      AS unread,
            (SELECT COUNT(*) FROM feedback f
              WHERE f.project_id = p.id AND f.status = 'submitted'
                AND f.deleted_at IS NULL AND f.first_reply_at IS NULL)   AS unanswered
       FROM projects p
       JOIN project_types pt ON pt.id = p.project_type_id
       LEFT JOIN project_stats st ON st.project_id = p.id
      WHERE p.owner_id = ? AND p.deleted_at IS NULL
        ${opts.includeArchived ? '' : "AND p.status <> 'archived'"}
      ORDER BY p.updated_at DESC
      LIMIT ?`,
    [userId, pageLimit(opts.limit, 50)],
  )

  return rows.map((r): ProjectOwnerRow => {
    const typeSlug = str(r, 'type_slug')
    const stageKey = str(r, 'stage_key')
    return {
      id: str(r, 'id'),
      slug: str(r, 'slug'),
      title: str(r, 'title'),
      typeLabel: str(r, 'type_label'),
      stageKey,
      stageLabel: stageLabel(typeSlug, stageKey),
      grit: gritValue(stageKey),
      status: (str(r, 'status') || 'draft') as ProjectStatus,
      visibility: (str(r, 'visibility') || 'private') as ProjectVisibility,
      feedbackState: (str(r, 'feedback_state') || 'open') as FeedbackState,
      publishedAt: numOrNull(r, 'published_at'),
      updatedAt: num(r, 'updated_at'),
      counts: {
        feedback: num(r, 'feedback_count'),
        unread: num(r, 'unread'),
        unanswered: num(r, 'unanswered'),
        openSuggestions: num(r, 'open_suggestions'),
        shipped: num(r, 'shipped_suggestions'),
      },
      replyRate: num(r, 'reply_rate'),
    }
  })
}

/** Public list for someone else's profile. */
export function listProjectsByUser(
  userId: string,
  opts: ListProjectsOptions = {},
): Page<ProjectCard> {
  return listProjects({ ownerId: userId }, { ...opts, sort: opts.sort ?? 'newest' })
}

/** Marketing surface. Published, reviewed, and answered: nothing invented. */
export function getFeaturedProjects(limit = 3, viewerId?: string | null): readonly ProjectCard[] {
  return listProjects(
    { openOnly: true },
    { limit, viewerId, sort: 'ranked', reserveNeedsEyes: false },
  ).items
}

/** The Discover empty state needs somewhere to send people. */
export function getStarterPicks(limit = 6, viewerId?: string | null): readonly ProjectCard[] {
  return listProjects({ openOnly: true }, { limit, viewerId, sort: 'needs_eyes' }).items
}

/* ------------------------------------------------------------------------- *
 * Devlog updates
 * ------------------------------------------------------------------------- */

export function listUpdates(
  args: { readonly projectId: string } & PageOptions,
): Page<ProjectUpdateView> {
  const limit = pageLimit(args.limit, 10)
  const cursor = decodeCursor(args.cursor)
  const at = cursor ? num(cursor, 'at') : null
  const rows = all<Row>(
    `SELECT pu.*, v.version_label, ${userCardSelect('u', 'pr', 'rs', 'a')}
       FROM project_updates pu
       JOIN users u ON u.id = pu.author_id
       ${userCardJoin('u', 'pr', 'rs')}
       LEFT JOIN project_versions v ON v.id = pu.version_id
      WHERE pu.project_id = ? AND pu.deleted_at IS NULL AND pu.published_at IS NOT NULL
        AND (? IS NULL OR pu.published_at < ?)
      ORDER BY pu.published_at DESC
      LIMIT ?`,
    [args.projectId, at, at, limit + 1],
  )
  const items = rows.map(
    (r): ProjectUpdateView => ({
      id: str(r, 'id'),
      title: str(r, 'title'),
      bodyMd: str(r, 'body_md'),
      publishedAt: numOrNull(r, 'published_at'),
      createdAt: num(r, 'created_at'),
      author: mapUserCard(r, 'a'),
      versionLabel: strOrNull(r, 'version_label'),
    }),
  )
  return toPage(items, limit, (last) => encodeCursor({ at: last.publishedAt ?? last.createdAt }))
}

/* ------------------------------------------------------------------------- *
 * Writes
 * ------------------------------------------------------------------------- */

export interface NewProjectInput {
  readonly ownerId: string
  readonly projectTypeId: string
  readonly title: string
  readonly tagline?: string | null
  readonly summaryMd?: string | null
  readonly stageKey: string
  readonly visibility?: ProjectVisibility
  readonly isNsfw?: boolean
  readonly contentWarnings?: readonly string[]
  readonly needs?: readonly { readonly key: string; readonly detail?: string | null }[]
  readonly tagIds?: readonly string[]
  readonly asks?: readonly { readonly prompt: string; readonly detailMd?: string | null; readonly categoryId?: string | null; readonly isRequired?: boolean }[]
}

/** Creates the project and its stats row together, plus needs, tags and the ask. */
export function createProject(input: NewProjectInput): string {
  const id = uid()
  const ts = now()
  return tx(() => {
    const slug = uniqueSlug(input.title)
    run(
      `INSERT INTO projects
         (id, owner_id, project_type_id, slug, title, tagline, summary_md, stage_key,
          visibility, status, feedback_state, is_nsfw, content_warnings,
          hot_score, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'open', ?, ?, 0.0, ?, ?)`,
      [
        id,
        input.ownerId,
        input.projectTypeId,
        slug,
        input.title.trim(),
        input.tagline ?? null,
        input.summaryMd ?? null,
        input.stageKey,
        input.visibility ?? 'private',
        input.isNsfw ? 1 : 0,
        input.contentWarnings && input.contentWarnings.length > 0
          ? JSON.stringify(input.contentWarnings)
          : null,
        ts,
        ts,
      ],
    )
    run(`INSERT INTO project_stats (project_id, computed_at) VALUES (?, ?)`, [id, ts])
    for (const need of input.needs ?? []) {
      run(
        `INSERT INTO project_needs (project_id, need_key, detail, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (project_id, need_key) DO NOTHING`,
        [id, need.key, need.detail ?? null, ts],
      )
    }
    for (const tagId of input.tagIds ?? []) {
      run(
        `INSERT INTO project_tags (project_id, tag_id, created_at) VALUES (?, ?, ?)
         ON CONFLICT (project_id, tag_id) DO NOTHING`,
        [id, tagId, ts],
      )
    }
    // A no-op for a draft, which counts nowhere until `publishProject`.
    recountTags(input.tagIds ?? [])
    ;(input.asks ?? []).forEach((ask, i) => {
      run(
        `INSERT INTO project_asks (id, project_id, category_id, prompt, detail_md, is_required, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uid(), id, ask.categoryId ?? null, ask.prompt, ask.detailMd ?? null, ask.isRequired ? 1 : 0, i, ts],
      )
    })
    return id
  })
}

export interface ProjectPatch {
  readonly title?: string
  readonly tagline?: string | null
  readonly summaryMd?: string | null
  readonly stageKey?: string
  readonly visibility?: ProjectVisibility
  readonly status?: ProjectStatus
  readonly feedbackState?: FeedbackState
  readonly feedbackClosesAt?: Millis | null
  readonly isNsfw?: boolean
  readonly primaryMediaId?: string | null
}

export function updateProject(projectId: string, patch: ProjectPatch): void {
  const sets: string[] = []
  const params: unknown[] = []
  const put = (column: string, value: unknown): void => {
    sets.push(`${column} = ?`)
    params.push(value)
  }
  if (patch.title !== undefined) put('title', patch.title.trim())
  if (patch.tagline !== undefined) put('tagline', patch.tagline)
  if (patch.summaryMd !== undefined) put('summary_md', patch.summaryMd)
  if (patch.stageKey !== undefined) put('stage_key', patch.stageKey)
  if (patch.visibility !== undefined) put('visibility', patch.visibility)
  if (patch.status !== undefined) put('status', patch.status)
  if (patch.feedbackState !== undefined) put('feedback_state', patch.feedbackState)
  if (patch.feedbackClosesAt !== undefined) put('feedback_closes_at', patch.feedbackClosesAt)
  if (patch.isNsfw !== undefined) put('is_nsfw', patch.isNsfw ? 1 : 0)
  if (patch.primaryMediaId !== undefined) put('primary_media_id', patch.primaryMediaId)
  if (sets.length === 0) return
  put('updated_at', now())
  params.push(projectId)
  run(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, params)
  recomputeHotScore(projectId)
}

/**
 * Publishing sets the timestamp the feed sorts on. The schema refuses a public
 * row without it, so this is the only correct way in.
 */
export function publishProject(projectId: string): void {
  const ts = now()
  tx(() => {
    run(
      `UPDATE projects
          SET status = 'published',
              visibility = CASE WHEN visibility = 'private' THEN 'public' ELSE visibility END,
              published_at = COALESCE(published_at, ?),
              updated_at = ?
        WHERE id = ?`,
      [ts, ts, projectId],
    )
    run(
      `UPDATE project_stats SET last_activity_at = ?, computed_at = ? WHERE project_id = ?`,
      [ts, ts, projectId],
    )
    recountTags(tagIdsForProject(projectId))
  })
  recomputeHotScore(projectId)
}

export interface NewVersionInput {
  readonly projectId: string
  readonly versionLabel: string
  readonly changelogMd?: string | null
  readonly buildUrl?: string | null
  readonly embedUrl?: string | null
  readonly platforms?: readonly string[]
  readonly makeCurrent?: boolean
}

/**
 * A new build is a meaningful update: it resets the Need term against the new
 * version and moves the project back up the feed, which is exactly what should
 * happen when there is something new to look at.
 */
export function addVersion(input: NewVersionInput): string {
  const id = uid()
  const ts = now()
  tx(() => {
    if (input.makeCurrent !== false) {
      run(`UPDATE project_versions SET is_current = 0 WHERE project_id = ? AND is_current = 1`, [
        input.projectId,
      ])
    }
    run(
      `INSERT INTO project_versions
         (id, project_id, version_label, changelog_md, build_url, embed_url, platforms,
          is_current, released_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.projectId,
        input.versionLabel,
        input.changelogMd ?? null,
        input.buildUrl ?? null,
        input.embedUrl ?? null,
        input.platforms && input.platforms.length > 0 ? JSON.stringify(input.platforms) : null,
        input.makeCurrent === false ? 0 : 1,
        ts,
        ts,
      ],
    )
    run(`UPDATE projects SET updated_at = ? WHERE id = ?`, [ts, input.projectId])
    run(`UPDATE project_stats SET last_activity_at = ?, computed_at = ? WHERE project_id = ?`, [
      ts,
      ts,
      input.projectId,
    ])
  })
  recomputeHotScore(input.projectId)
  return id
}

export function addMedia(input: {
  readonly projectId: string
  readonly versionId?: string | null
  readonly mediaKind: MediaKind
  readonly url: string
  readonly altText?: string | null
  readonly caption?: string | null
  readonly thumbUrl?: string | null
  readonly width?: number | null
  readonly height?: number | null
  readonly durationMs?: number | null
  readonly sortOrder?: number
}): string {
  const id = uid()
  run(
    `INSERT INTO project_media
       (id, project_id, version_id, media_kind, url, thumb_url, alt_text, caption,
        width, height, duration_ms, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.projectId,
      input.versionId ?? null,
      input.mediaKind,
      input.url,
      input.thumbUrl ?? null,
      input.altText ?? null,
      input.caption ?? null,
      input.width ?? null,
      input.height ?? null,
      input.durationMs ?? null,
      input.sortOrder ?? 0,
      now(),
    ],
  )
  return id
}

export function followProject(userId: string, projectId: string, notify: 'all' | 'versions' | 'none' = 'all'): void {
  tx(() => {
    const r = run(
      `INSERT INTO project_follows (user_id, project_id, notify, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, project_id) DO UPDATE SET notify = excluded.notify`,
      [userId, projectId, notify, now()],
    )
    if (r.changes > 0) {
      run(
        `UPDATE project_stats SET follower_count = (
           SELECT COUNT(*) FROM project_follows WHERE project_id = ?)
         WHERE project_id = ?`,
        [projectId, projectId],
      )
    }
  })
}

export function unfollowProject(userId: string, projectId: string): void {
  tx(() => {
    run(`DELETE FROM project_follows WHERE user_id = ? AND project_id = ?`, [userId, projectId])
    run(
      `UPDATE project_stats SET follower_count = (
         SELECT COUNT(*) FROM project_follows WHERE project_id = ?)
       WHERE project_id = ?`,
      [projectId, projectId],
    )
  })
}

export function bookmarkProject(userId: string, projectId: string, note?: string | null): void {
  tx(() => {
    run(
      `INSERT INTO project_bookmarks (user_id, project_id, note, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, project_id) DO UPDATE SET note = excluded.note`,
      [userId, projectId, note ?? null, now()],
    )
    run(
      `UPDATE project_stats SET bookmark_count = (
         SELECT COUNT(*) FROM project_bookmarks WHERE project_id = ?)
       WHERE project_id = ?`,
      [projectId, projectId],
    )
  })
}

export function unbookmarkProject(userId: string, projectId: string): void {
  tx(() => {
    run(`DELETE FROM project_bookmarks WHERE user_id = ? AND project_id = ?`, [userId, projectId])
    run(
      `UPDATE project_stats SET bookmark_count = (
         SELECT COUNT(*) FROM project_bookmarks WHERE project_id = ?)
       WHERE project_id = ?`,
      [projectId, projectId],
    )
  })
}

/**
 * The private shelf. Newest bookmark first, and drafts stay invisible.
 *
 * The page is cut from the bookmarks in the order they were saved and only then
 * handed to `listProjects` for the cards, whose own ordering is a feed sort:
 * left to it, the shelf came back in publish order whatever was saved last.
 */
export function listBookmarks(userId: string, opts: ListProjectsOptions = {}): Page<ProjectCard> {
  const limit = pageLimit(opts.limit, 24)
  const cursor = decodeCursor(opts.cursor)
  const offset = Math.max(0, cursor ? num(cursor, 'o', 0) : 0)
  const ids = all<Row>(
    `SELECT project_id FROM project_bookmarks WHERE user_id = ?
      ORDER BY created_at DESC, project_id LIMIT ? OFFSET ?`,
    [userId, limit + 1, offset],
  ).map((r) => str(r, 'project_id'))
  if (ids.length === 0) return { items: [], hasMore: false, nextCursor: null }

  const pageIds = ids.slice(0, limit)
  const cards = new Map(
    listProjects({ projectIds: pageIds }, { ...opts, cursor: null, limit, sort: 'newest', viewerId: userId }).items.map(
      (card) => [card.id, card],
    ),
  )
  const hasMore = ids.length > limit
  return {
    items: pageIds.flatMap((id) => cards.get(id) ?? []),
    hasMore,
    nextCursor: hasMore ? encodeCursor({ o: offset + limit }) : null,
  }
}

export function incrementViewCount(projectId: string): void {
  run(
    `UPDATE project_stats SET view_count = view_count + 1, last_activity_at = ? WHERE project_id = ?`,
    [now(), projectId],
  )
}

/**
 * `hot_score` is the stored pre-filter the ranked feed draws its window by, not
 * the ranking itself. It is the viewer-independent part of the very formula
 * `scoreCandidate` applies (Quality, Need, Freshness, Urgency and Penalty, with
 * Fit at 1), computed by that same function over the same candidate query, so
 * the window and the ranking cannot disagree about what a good row is. Only
 * the viewer's own Fit is left for read time, because it cannot live in a
 * shared column.
 *
 * Freshness moves with the clock, so every stored value is only as current as
 * the instant it was computed. A project is recomputed whenever it changes;
 * `keepHotScoresCurrent` in `src/server/queries/discover.ts` brings every row to
 * the same instant on a timer, and `scripts/recompute-hot.mts` does it by hand
 * after a data load.
 *
 * With no id, every listed project is recomputed, in one statement.
 */
export function recomputeHotScore(projectId?: string): void {
  const clock = now()
  const candidates = loadCandidates(
    { includeNsfw: true, ...(projectId ? { projectIds: [projectId] } : {}) },
    {},
    clock,
    { kind: 'ordered', order: 'newest', offset: 0, limit: null },
  )
  if (candidates.length === 0) return
  const scores = candidates.map((c) => [c.id, scoreCandidate(c, {}, clock).score])
  run(
    `UPDATE projects AS p SET hot_score = s.score
       FROM (SELECT value ->> 0 AS id, value ->> 1 AS score FROM json_each(?)) AS s
      WHERE p.id = s.id`,
    [JSON.stringify(scores)],
  )
}

/**
 * `slugify` collides whenever two members name their work the same thing, and
 * `/p/<slug>` is one namespace for all of them, so the search is global: the
 * unique index `ux_projects_slug` would reject anything narrower.
 */
function uniqueSlug(title: string): string {
  const base = slugify(title)
  let candidate = base
  for (let i = 2; i < 40; i++) {
    const taken = get<Row>(`SELECT 1 AS hit FROM projects WHERE slug = ?`, [candidate])
    if (!taken) return candidate
    candidate = `${base}-${i}`
  }
  return `${base}-${Date.now().toString(36)}`
}

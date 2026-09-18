/**
 * Public profiles, the social graph, and the expert marketplace listing.
 */

import { all, get, run, tx } from '@/server/db/client'
import { now, uid } from '@/lib/utils'
import { tierFor } from '@/lib/taxonomy'
import type {
  BadgeView,
  ExpertCard,
  ExpertProfileRow,
  Page,
  PageOptions,
  PrimaryRole,
  ProfileLinkRow,
  ProfileRow,
  ProfileView,
  UserCard,
  UserSettingsRow,
} from '@/lib/types'
import {
  bool,
  DEFAULT_LIMIT,
  decodeCursor,
  encodeCursor,
  mapUserCard,
  num,
  pageLimit,
  placeholders,
  str,
  strOrNull,
  toPage,
  userCardJoin,
  userCardSelect,
  type Row,
} from './_shared'

/* ------------------------------------------------------------------------- *
 * Reads
 * ------------------------------------------------------------------------- */

export function getProfileRow(userId: string): ProfileRow | undefined {
  return get<ProfileRow>(`SELECT * FROM profiles WHERE user_id = ?`, [userId])
}

export function getUserSettings(userId: string): UserSettingsRow | undefined {
  return get<UserSettingsRow>(`SELECT * FROM user_settings WHERE user_id = ?`, [userId])
}

/** The card rendered beside a review, a post or a project. */
export function getUserCard(userId: string): UserCard | undefined {
  const row = get<Row>(
    `SELECT ${userCardSelect('u', 'pr', 'rs', 'u')}
       FROM users u ${userCardJoin('u', 'pr', 'rs')}
      WHERE u.id = ? AND u.deleted_at IS NULL`,
    [userId],
  )
  return row ? mapUserCard(row, 'u') : undefined
}

/** Cards for many users in one query. Callers index the map by user id. */
export function getUserCards(userIds: readonly string[]): Map<string, UserCard> {
  const out = new Map<string, UserCard>()
  const ids = [...new Set(userIds)].filter((id) => id.length > 0)
  if (ids.length === 0) return out
  const rows = all<Row>(
    `SELECT ${userCardSelect('u', 'pr', 'rs', 'u')}
       FROM users u ${userCardJoin('u', 'pr', 'rs')}
      WHERE u.id IN (${placeholders(ids.length)})`,
    ids,
  )
  for (const r of rows) {
    const card = mapUserCard(r, 'u')
    out.set(card.id, card)
  }
  return out
}

/**
 * Everything the public profile page renders, in four queries: the person, their
 * links, their badges, and one aggregate row for the five counts.
 */
export function getProfileByHandle(handle: string, viewerId?: string | null): ProfileView | undefined {
  const normalized = handle.trim().toLowerCase().replace(/^@/, '')
  const row = get<Row>(
    `SELECT ${userCardSelect('u', 'pr', 'rs', 'u')},
            pr.bio, pr.location, pr.pronouns, pr.timezone, pr.banner_url,
            pr.availability, u.created_at AS joined_at, u.last_seen_at
       FROM users u ${userCardJoin('u', 'pr', 'rs')}
      WHERE u.handle_normalized = ? AND u.deleted_at IS NULL AND u.status = 'active'`,
    [normalized],
  )
  if (!row) return undefined

  const card = mapUserCard(row, 'u')
  const userId = card.id

  const counts = get<Row>(
    `SELECT
       (SELECT COUNT(*) FROM projects p
         WHERE p.owner_id = ? AND p.deleted_at IS NULL
           AND p.status = 'published' AND p.visibility = 'public')            AS projects,
       (SELECT COUNT(*) FROM feedback f
         WHERE f.reviewer_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL) AS reviews,
       (SELECT COUNT(*) FROM user_follows uf WHERE uf.followee_id = ?)        AS followers,
       (SELECT COUNT(*) FROM user_follows uf WHERE uf.follower_id = ?)        AS following,
       (SELECT COUNT(DISTINCT sg.id)
          FROM suggestions sg
          JOIN suggestion_sources ss ON ss.suggestion_id = sg.id
          JOIN feedback_points fp    ON fp.id = ss.point_id
          JOIN feedback f            ON f.id = fp.feedback_id
         WHERE f.reviewer_id = ? AND sg.status = 'shipped')                   AS shipped`,
    [userId, userId, userId, userId, userId],
  )

  const links = all<ProfileLinkRow>(
    `SELECT * FROM profile_links WHERE user_id = ? ORDER BY sort_order, created_at`,
    [userId],
  )

  const badges = all<Row>(
    `SELECT b.slug, b.label, b.description, b.tier, b.icon, ub.awarded_at
       FROM user_badges ub
       JOIN badges b ON b.id = ub.badge_id
      WHERE ub.user_id = ? AND ub.revoked_at IS NULL AND b.is_active = 1
      ORDER BY ub.awarded_at DESC`,
    [userId],
  ).map(
    (r): BadgeView => ({
      slug: str(r, 'slug'),
      label: str(r, 'label'),
      description: str(r, 'description'),
      tier: (str(r, 'tier') || 'bronze') as BadgeView['tier'],
      icon: strOrNull(r, 'icon'),
      awardedAt: num(r, 'awarded_at'),
    }),
  )

  return {
    ...card,
    bio: strOrNull(row, 'bio'),
    location: strOrNull(row, 'location'),
    pronouns: strOrNull(row, 'pronouns'),
    timezone: strOrNull(row, 'timezone'),
    bannerUrl: strOrNull(row, 'banner_url'),
    availability: (str(row, 'availability') || 'open') as ProfileView['availability'],
    joinedAt: num(row, 'joined_at'),
    lastSeenAt: row['last_seen_at'] === null ? null : num(row, 'last_seen_at'),
    links,
    counts: {
      projects: num(counts, 'projects'),
      reviews: num(counts, 'reviews'),
      followers: num(counts, 'followers'),
      following: num(counts, 'following'),
      shippedSuggestions: num(counts, 'shipped'),
    },
    badges,
    viewerFollows: viewerId ? isFollowing(viewerId, userId) : null,
    isSelf: viewerId === userId,
  }
}

/* ------------------------------------------------------------------------- *
 * Writes
 * ------------------------------------------------------------------------- */

export interface ProfilePatch {
  readonly displayName?: string
  readonly bio?: string | null
  readonly location?: string | null
  readonly pronouns?: string | null
  readonly timezone?: string | null
  readonly avatarUrl?: string | null
  readonly bannerUrl?: string | null
  readonly primaryRole?: PrimaryRole | null
  readonly availability?: 'open' | 'limited' | 'closed'
  readonly isSearchable?: boolean
}

/**
 * Only the fields present in the patch are written. Every column name below is
 * a literal from this file; the values bind.
 */
export function updateProfile(userId: string, patch: ProfilePatch): void {
  const sets: string[] = []
  const params: unknown[] = []
  const put = (column: string, value: unknown): void => {
    sets.push(`${column} = ?`)
    params.push(value)
  }
  if (patch.displayName !== undefined) put('display_name', patch.displayName.trim())
  if (patch.bio !== undefined) put('bio', patch.bio)
  if (patch.location !== undefined) put('location', patch.location)
  if (patch.pronouns !== undefined) put('pronouns', patch.pronouns)
  if (patch.timezone !== undefined) put('timezone', patch.timezone)
  if (patch.avatarUrl !== undefined) put('avatar_url', patch.avatarUrl)
  if (patch.bannerUrl !== undefined) put('banner_url', patch.bannerUrl)
  if (patch.primaryRole !== undefined) put('primary_role', patch.primaryRole)
  if (patch.availability !== undefined) put('availability', patch.availability)
  if (patch.isSearchable !== undefined) put('is_searchable', patch.isSearchable ? 1 : 0)
  if (sets.length === 0) return
  put('updated_at', now())
  params.push(userId)
  run(`UPDATE profiles SET ${sets.join(', ')} WHERE user_id = ?`, params)
}

export function replaceProfileLinks(
  userId: string,
  links: readonly { label: string; url: string; platform?: ProfileLinkRow['platform'] }[],
): void {
  tx(() => {
    run(`DELETE FROM profile_links WHERE user_id = ?`, [userId])
    links.forEach((link, i) => {
      run(
        `INSERT INTO profile_links (id, user_id, label, url, platform, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uid(), userId, link.label, link.url, link.platform ?? null, i, now()],
      )
    })
  })
}

export interface SettingsPatch {
  readonly theme?: UserSettingsRow['theme']
  readonly locale?: string
  readonly reducedMotion?: boolean
  readonly emailDigest?: UserSettingsRow['email_digest']
  readonly showNsfw?: boolean
  readonly dmPolicy?: UserSettingsRow['dm_policy']
}

export function updateSettings(userId: string, patch: SettingsPatch): void {
  const sets: string[] = []
  const params: unknown[] = []
  const put = (column: string, value: unknown): void => {
    sets.push(`${column} = ?`)
    params.push(value)
  }
  if (patch.theme !== undefined) put('theme', patch.theme)
  if (patch.locale !== undefined) put('locale', patch.locale)
  if (patch.reducedMotion !== undefined) put('reduced_motion', patch.reducedMotion ? 1 : 0)
  if (patch.emailDigest !== undefined) put('email_digest', patch.emailDigest)
  if (patch.showNsfw !== undefined) put('show_nsfw', patch.showNsfw ? 1 : 0)
  if (patch.dmPolicy !== undefined) put('dm_policy', patch.dmPolicy)
  if (sets.length === 0) return
  put('updated_at', now())
  params.push(userId)
  run(`UPDATE user_settings SET ${sets.join(', ')} WHERE user_id = ?`, params)
}

/* ------------------------------------------------------------------------- *
 * Social graph
 * ------------------------------------------------------------------------- */

export function isFollowing(followerId: string, followeeId: string): boolean {
  return (
    get<Row>(`SELECT 1 AS hit FROM user_follows WHERE follower_id = ? AND followee_id = ?`, [
      followerId,
      followeeId,
    ]) !== undefined
  )
}

/** Idempotent. Returns the state after the call, which is what a toggle needs. */
export function followUser(followerId: string, followeeId: string): boolean {
  if (followerId === followeeId) return false
  run(
    `INSERT INTO user_follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)
     ON CONFLICT (follower_id, followee_id) DO NOTHING`,
    [followerId, followeeId, now()],
  )
  return true
}

export function unfollowUser(followerId: string, followeeId: string): boolean {
  run(`DELETE FROM user_follows WHERE follower_id = ? AND followee_id = ?`, [followerId, followeeId])
  return false
}

export function listFollowers(userId: string, opts: PageOptions = {}): Page<UserCard> {
  return pageOfFollowers(userId, opts, 'followers')
}

export function listFollowing(userId: string, opts: PageOptions = {}): Page<UserCard> {
  return pageOfFollowers(userId, opts, 'following')
}

function pageOfFollowers(userId: string, opts: PageOptions, direction: 'followers' | 'following'): Page<UserCard> {
  const limit = pageLimit(opts.limit, DEFAULT_LIMIT)
  const cursor = decodeCursor(opts.cursor)
  const at = cursor ? num(cursor, 'at') : null
  // Both directions use the same index shape; the column pair is a literal.
  const [selfColumn, otherColumn] =
    direction === 'followers' ? ['followee_id', 'follower_id'] : ['follower_id', 'followee_id']
  const rows = all<Row>(
    `SELECT ${userCardSelect('u', 'pr', 'rs', 'u')}, uf.created_at AS at
       FROM user_follows uf
       JOIN users u ON u.id = uf.${otherColumn}
       ${userCardJoin('u', 'pr', 'rs')}
      WHERE uf.${selfColumn} = ? AND u.deleted_at IS NULL
        AND (? IS NULL OR uf.created_at < ?)
      ORDER BY uf.created_at DESC
      LIMIT ?`,
    [userId, at, at, limit + 1],
  )
  const mapped = rows.map((r) => ({ card: mapUserCard(r, 'u'), at: num(r, 'at') }))
  const page = toPage(mapped, limit, (last) => encodeCursor({ at: last.at }))
  return { items: page.items.map((m) => m.card), hasMore: page.hasMore, nextCursor: page.nextCursor }
}

export function blockUser(blockerId: string, blockedId: string, reason?: string | null): void {
  if (blockerId === blockedId) return
  run(
    `INSERT INTO user_blocks (blocker_id, blocked_id, reason, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
    [blockerId, blockedId, reason ?? null, now()],
  )
}

export function unblockUser(blockerId: string, blockedId: string): void {
  run(`DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?`, [blockerId, blockedId])
}

/** Ids the viewer blocked or was blocked by. Both directions filter a feed. */
export function blockedIdsFor(viewerId: string): readonly string[] {
  return all<Row>(
    `SELECT blocked_id AS id FROM user_blocks WHERE blocker_id = ?
     UNION
     SELECT blocker_id AS id FROM user_blocks WHERE blocked_id = ?`,
    [viewerId, viewerId],
  ).map((r) => str(r, 'id'))
}

/* ------------------------------------------------------------------------- *
 * Experts
 * ------------------------------------------------------------------------- */

export function getExpertProfileRow(userId: string): ExpertProfileRow | undefined {
  return get<ExpertProfileRow>(`SELECT * FROM expert_profiles WHERE user_id = ?`, [userId])
}

export function getExpertByHandle(handle: string): ExpertCard | undefined {
  const normalized = handle.trim().toLowerCase().replace(/^@/, '')
  const row = get<Row>(
    `SELECT ${userCardSelect('u', 'pr', 'rs', 'u')}, ep.*
       FROM expert_profiles ep
       JOIN users u ON u.id = ep.user_id
       ${userCardJoin('u', 'pr', 'rs')}
      WHERE u.handle_normalized = ? AND u.deleted_at IS NULL`,
    [normalized],
  )
  return row ? mapExpertCard(row) : undefined
}

export interface ExpertFilters {
  readonly expertiseSlug?: string | null
  readonly minRating?: number | null
  readonly maxBudgetCents?: number | null
  readonly maxTurnaroundHours?: number | null
  readonly query?: string | null
}

/**
 * The WHERE clause the listing and its count share.
 *
 * An area filter matches verified areas only. Listing is granted on a verified
 * area and the row's badge names verified areas, so matching a self-declared
 * one would put a reviewer under a heading their own row does not support.
 * Search reads the same evidence: the name, the handle, the headline, and the
 * areas someone checked, so "accessibility" finds the person verified in it.
 */
function expertWhere(filters: ExpertFilters): { where: string[]; params: unknown[] } {
  const where: string[] = ['ep.is_listed = 1', 'u.deleted_at IS NULL', "u.status = 'active'"]
  const params: unknown[] = []

  if (filters.expertiseSlug) {
    where.push(`EXISTS (SELECT 1 FROM expert_expertise ee
                          JOIN expertise_areas ea ON ea.id = ee.expertise_id
                         WHERE ee.user_id = ep.user_id AND ee.is_verified = 1 AND ea.slug = ?)`)
    params.push(filters.expertiseSlug)
  }
  if (filters.minRating != null) {
    where.push('ep.avg_rating >= ?')
    params.push(filters.minRating)
  }
  if (filters.maxBudgetCents != null) {
    where.push('(ep.min_bounty_cents IS NULL OR ep.min_bounty_cents <= ?)')
    params.push(filters.maxBudgetCents)
  }
  if (filters.maxTurnaroundHours != null) {
    where.push('(ep.turnaround_hours IS NULL OR ep.turnaround_hours <= ?)')
    params.push(filters.maxTurnaroundHours)
  }
  if (filters.query) {
    where.push(`(ep.headline LIKE ? OR pr.display_name LIKE ? OR u.handle LIKE ?
                 OR EXISTS (SELECT 1 FROM expert_expertise ee
                              JOIN expertise_areas ea ON ea.id = ee.expertise_id
                             WHERE ee.user_id = ep.user_id AND ee.is_verified = 1 AND ea.label LIKE ?))`)
    const like = `%${filters.query.trim()}%`
    params.push(like, like, like, like)
  }
  return { where, params }
}

/** How many reviewers `listExperts` would page through for the same filters. */
export function countExperts(filters: ExpertFilters = {}): number {
  const { where, params } = expertWhere(filters)
  const row = get<Row>(
    `SELECT COUNT(*) AS n
       FROM expert_profiles ep
       JOIN users u ON u.id = ep.user_id
       LEFT JOIN profiles pr ON pr.user_id = ep.user_id
      WHERE ${where.join(' AND ')}`,
    params,
  )
  return num(row, 'n')
}

/**
 * The marketplace listing. Ordered by the rating creators gave delivered work
 * rather than by self-declared level, because only one of those two is evidence,
 * and within one rating by how many accepted reviews stand behind it, so a 5.0
 * from five creators is not listed below a 5.0 from one.
 */
export function listExperts(filters: ExpertFilters = {}, opts: PageOptions = {}): Page<ExpertCard> {
  const limit = pageLimit(opts.limit, 12)
  const cursor = decodeCursor(opts.cursor)
  const { where, params } = expertWhere(filters)

  // Keyset on the same three columns the ORDER BY uses.
  if (cursor) {
    const r = num(cursor, 'r')
    const c = num(cursor, 'c')
    where.push(`(ep.avg_rating < ?
                 OR (ep.avg_rating = ? AND ep.completed_count < ?)
                 OR (ep.avg_rating = ? AND ep.completed_count = ? AND ep.user_id < ?))`)
    params.push(r, r, c, r, c, str(cursor, 'id'))
  }

  const rows = all<Row>(
    `SELECT ${userCardSelect('u', 'pr', 'rs', 'u')}, ep.*
       FROM expert_profiles ep
       JOIN users u ON u.id = ep.user_id
       ${userCardJoin('u', 'pr', 'rs')}
      WHERE ${where.join(' AND ')}
      ORDER BY ep.avg_rating DESC, ep.completed_count DESC, ep.user_id DESC
      LIMIT ?`,
    [...params, limit + 1],
  )

  const cards = rows.map(mapExpertCard)
  return toPage(cards, limit, (last) =>
    encodeCursor({ r: last.avgRating, c: last.completedCount, id: last.user.id }),
  )
}

function mapExpertCard(row: Row): ExpertCard {
  const user = mapUserCard(row, 'u')
  const expertise = all<Row>(
    `SELECT ea.slug, ea.label, ee.level, ee.is_verified
       FROM expert_expertise ee
       JOIN expertise_areas ea ON ea.id = ee.expertise_id
      WHERE ee.user_id = ?
      ORDER BY ee.is_verified DESC, ea.label`,
    [user.id],
  ).map((r) => ({
    slug: str(r, 'slug'),
    label: str(r, 'label'),
    level: (str(r, 'level') || 'practitioner') as 'familiar' | 'practitioner' | 'specialist',
    isVerified: bool(r, 'is_verified'),
  }))

  return {
    user,
    headline: str(row, 'headline'),
    pitchMd: strOrNull(row, 'pitch_md'),
    hourlyRateCents: row['hourly_rate_cents'] === null ? null : num(row, 'hourly_rate_cents'),
    minBountyCents: row['min_bounty_cents'] === null ? null : num(row, 'min_bounty_cents'),
    currency: str(row, 'currency', 'USD'),
    turnaroundHours: row['turnaround_hours'] === null ? null : num(row, 'turnaround_hours'),
    capacityPerWeek: num(row, 'capacity_per_week'),
    yearsExperience: row['years_experience'] === null ? null : num(row, 'years_experience'),
    isVerified: bool(row, 'is_verified'),
    completedCount: num(row, 'completed_count'),
    avgRating: num(row, 'avg_rating'),
    onTimeRate: num(row, 'on_time_rate'),
    expertise,
  }
}

export interface ExpertProfilePatch {
  readonly headline?: string
  readonly pitchMd?: string | null
  readonly hourlyRateCents?: number | null
  readonly minBountyCents?: number | null
  readonly currency?: string
  readonly turnaroundHours?: number | null
  readonly capacityPerWeek?: number
  readonly yearsExperience?: number | null
  readonly isListed?: boolean
}

export function upsertExpertProfile(userId: string, patch: ExpertProfilePatch): void {
  const ts = now()
  const existing = getExpertProfileRow(userId)
  if (!existing) {
    run(
      `INSERT INTO expert_profiles
         (user_id, headline, pitch_md, hourly_rate_cents, min_bounty_cents, currency,
          turnaround_hours, capacity_per_week, years_experience, is_listed, is_verified,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
      [
        userId,
        patch.headline ?? '',
        patch.pitchMd ?? null,
        patch.hourlyRateCents ?? null,
        patch.minBountyCents ?? null,
        patch.currency ?? 'USD',
        patch.turnaroundHours ?? null,
        patch.capacityPerWeek ?? 3,
        patch.yearsExperience ?? null,
        ts,
        ts,
      ],
    )
    return
  }
  const sets: string[] = []
  const params: unknown[] = []
  const put = (column: string, value: unknown): void => {
    sets.push(`${column} = ?`)
    params.push(value)
  }
  if (patch.headline !== undefined) put('headline', patch.headline)
  if (patch.pitchMd !== undefined) put('pitch_md', patch.pitchMd)
  if (patch.hourlyRateCents !== undefined) put('hourly_rate_cents', patch.hourlyRateCents)
  if (patch.minBountyCents !== undefined) put('min_bounty_cents', patch.minBountyCents)
  if (patch.currency !== undefined) put('currency', patch.currency)
  if (patch.turnaroundHours !== undefined) put('turnaround_hours', patch.turnaroundHours)
  if (patch.capacityPerWeek !== undefined) put('capacity_per_week', patch.capacityPerWeek)
  if (patch.yearsExperience !== undefined) put('years_experience', patch.yearsExperience)
  // The schema refuses a listed-but-unverified expert. The badge is the product.
  if (patch.isListed !== undefined) put('is_listed', patch.isListed && existing.is_verified === 1 ? 1 : 0)
  if (sets.length === 0) return
  put('updated_at', ts)
  params.push(userId)
  run(`UPDATE expert_profiles SET ${sets.join(', ')} WHERE user_id = ?`, params)
}

/** Marketing surface: three listed experts with delivered work behind them. */
export function getFeaturedExperts(limit = 3): readonly ExpertCard[] {
  const rows = all<Row>(
    `SELECT ${userCardSelect('u', 'pr', 'rs', 'u')}, ep.*
       FROM expert_profiles ep
       JOIN users u ON u.id = ep.user_id
       ${userCardJoin('u', 'pr', 'rs')}
      WHERE ep.is_listed = 1 AND ep.completed_count > 0 AND u.deleted_at IS NULL
      ORDER BY ep.avg_rating DESC, ep.completed_count DESC
      LIMIT ?`,
    [pageLimit(limit, 3)],
  )
  return rows.map(mapExpertCard)
}

/** Tier label for a bare score, so a card can render without a second lookup. */
export function tierLabelFor(score: number): string {
  return tierFor(score).label
}

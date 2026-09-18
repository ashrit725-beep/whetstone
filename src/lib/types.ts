/**
 * Whetstone row types and view models.
 *
 * Two layers, deliberately separated.
 *
 *   `*Row` types mirror a table in src/server/db/schema.sql exactly: INTEGER
 *   booleans stay 0 | 1, timestamps stay epoch milliseconds, nullable columns
 *   stay `| null`. They are what a repository casts a raw result to.
 *
 *   The view models are what repositories return. Joins are already resolved,
 *   counts are already included, booleans are already booleans. A page that
 *   renders one of these needs no follow-up query.
 */

import type {
  ActionabilityKey,
  EffortKey,
  GritStageKey,
  ItemKind,
  NeedKey,
  ProjectTypeSlug,
  ReputationTierKey,
  SeverityKey,
} from '@/lib/taxonomy'

/* ------------------------------------------------------------------------- *
 * Shared
 * ------------------------------------------------------------------------- */

/** Epoch milliseconds. Every timestamp in the schema is one of these. */
export type Millis = number

/** SQLite stores booleans as INTEGER with a CHECK. Row types keep the truth. */
export type Bit = 0 | 1

/**
 * Keyset paging. `cursor` is an opaque string produced by the repository that
 * issued it; callers pass it back untouched. Offsets are used only where the
 * schema cannot support a stable key.
 */
export interface PageOptions {
  readonly limit?: number
  readonly cursor?: string | null
}

export interface Page<T> {
  readonly items: readonly T[]
  /** Null when there is nothing after this page. */
  readonly nextCursor: string | null
  /** True when a further page exists. Saves the caller a null check on render. */
  readonly hasMore: boolean
}

/** The signed-in user, as every repository wants to receive them. */
export interface Viewer {
  readonly id: string
  readonly handle: string
  readonly isExpert: boolean
  readonly role: 'member' | 'moderator' | 'admin'
}

export type SortDirection = 'asc' | 'desc'

/* ------------------------------------------------------------------------- *
 * 1. Identity
 * ------------------------------------------------------------------------- */

export type UserRole = 'member' | 'moderator' | 'admin'
export type UserStatus = 'active' | 'suspended' | 'banned' | 'deactivated'

export interface UserRow {
  id: string
  email: string
  email_normalized: string
  email_verified_at: Millis | null
  password_hash: string | null
  handle: string
  handle_normalized: string
  role: UserRole
  status: UserStatus
  is_expert: Bit
  last_seen_at: Millis | null
  created_at: Millis
  updated_at: Millis
  deleted_at: Millis | null
}

export type PrimaryRole =
  | 'indie_dev'
  | 'game_dev'
  | 'founder'
  | 'designer'
  | 'video_creator'
  | 'reviewer'
  | 'other'

export interface ProfileRow {
  user_id: string
  display_name: string
  avatar_url: string | null
  banner_url: string | null
  bio: string | null
  location: string | null
  pronouns: string | null
  timezone: string | null
  primary_role: PrimaryRole | null
  availability: 'open' | 'limited' | 'closed'
  is_searchable: Bit
  created_at: Millis
  updated_at: Millis
}

export type LinkPlatform =
  | 'website' | 'github' | 'gitlab' | 'steam' | 'itch' | 'appstore'
  | 'playstore' | 'youtube' | 'twitch' | 'x' | 'bluesky' | 'mastodon'
  | 'linkedin' | 'discord' | 'other'

export interface ProfileLinkRow {
  id: string
  user_id: string
  label: string
  url: string
  platform: LinkPlatform | null
  sort_order: number
  created_at: Millis
}

export interface UserSettingsRow {
  user_id: string
  theme: 'system' | 'dark' | 'light'
  locale: string
  reduced_motion: Bit
  email_digest: 'off' | 'daily' | 'weekly'
  show_nsfw: Bit
  dm_policy: 'everyone' | 'followers' | 'nobody'
  updated_at: Millis
}

export interface AuthSessionRow {
  id: string
  user_id: string
  token_hash: string
  user_agent: string | null
  ip_hash: string | null
  created_at: Millis
  last_used_at: Millis
  expires_at: Millis
  revoked_at: Millis | null
}

/** The identity chip rendered beside every review, post and project. */
export interface UserCard {
  readonly id: string
  readonly handle: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly isExpert: boolean
  readonly primaryRole: PrimaryRole | null
  /** Global credibility, 0–1000. */
  readonly score: number
  readonly tier: ReputationTierKey
  readonly tierLabel: string
}

export interface ProfileView extends UserCard {
  readonly bio: string | null
  readonly location: string | null
  readonly pronouns: string | null
  readonly timezone: string | null
  readonly bannerUrl: string | null
  readonly availability: 'open' | 'limited' | 'closed'
  readonly joinedAt: Millis
  readonly lastSeenAt: Millis | null
  readonly links: readonly ProfileLinkRow[]
  readonly counts: {
    readonly projects: number
    readonly reviews: number
    readonly followers: number
    readonly following: number
    readonly shippedSuggestions: number
  }
  readonly badges: readonly BadgeView[]
  /** Null when nobody is signed in. */
  readonly viewerFollows: boolean | null
  readonly isSelf: boolean
}

export interface BadgeView {
  readonly slug: string
  readonly label: string
  readonly description: string
  readonly tier: 'bronze' | 'silver' | 'gold' | 'special'
  readonly icon: string | null
  readonly awardedAt: Millis
}

export interface SessionView {
  readonly id: string
  readonly userAgent: string | null
  readonly createdAt: Millis
  readonly lastUsedAt: Millis
  readonly expiresAt: Millis
  readonly isCurrent: boolean
}

/* ------------------------------------------------------------------------- *
 * 2. Reputation
 * ------------------------------------------------------------------------- */

export type ReputationFacet = 'reviewer' | 'creator' | 'community' | 'expert'

export type ReputationEventKind =
  | 'feedback_submitted' | 'feedback_marked_helpful' | 'feedback_upvoted'
  | 'feedback_applied' | 'suggestion_shipped' | 'bounty_completed'
  | 'test_round_completed' | 'discussion_upvoted' | 'accepted_answer'
  | 'project_published' | 'creator_replied' | 'streak_bonus'
  | 'report_upheld' | 'moderation_penalty' | 'manual_adjustment'

export type ReputationSubjectType =
  | 'feedback' | 'suggestion' | 'project' | 'bounty'
  | 'discussion_post' | 'test_round' | 'user'

export interface ReputationEventRow {
  id: string
  user_id: string
  facet: ReputationFacet
  kind: ReputationEventKind
  delta: number
  weight: number
  subject_type: ReputationSubjectType | null
  subject_id: string | null
  actor_id: string | null
  note: string | null
  created_at: Millis
}

export interface ReputationScoreRow {
  user_id: string
  reviewer_score: number
  creator_score: number
  community_score: number
  expert_score: number
  total_score: number
  level: number
  feedback_count: number
  helpful_count: number
  applied_count: number
  helpful_rate: number
  response_rate: number
  median_response_ms: number | null
  streak_days: number
  computed_at: Millis
}

/** One project type's credibility, with every term of §3.3 kept visible. */
export interface DomainCredibility {
  readonly domain: ProjectTypeSlug
  readonly label: string
  /** Effective, time-decayed review count `n_d`. */
  readonly effectiveReviews: number
  /** Raw review count, undecayed, for the "you wrote N reviews" line. */
  readonly reviewCount: number
  /** Decayed evidence `E_d`. */
  readonly evidence: number
  /** Plain mean value per review, `E_d / n_d`, before the shrink. */
  readonly rawMean: number
  /** Shrunk mean value per review `q̄_d`. */
  readonly meanValue: number
  /** Saturating volume term `V_d`. */
  readonly volumeTerm: number
  /** `C_d`, 0–1000. */
  readonly score: number
  readonly tier: ReputationTierKey
  readonly isExpert: boolean
}

/** The full reputation computation, legible rather than a black box. */
export interface ReputationComputation {
  readonly userId: string
  readonly computedAt: Millis
  /** Effective-count-weighted mean across domains, 0–1000. */
  readonly score: number
  /** `max(score, 0.5·peak·exp(−ln2·months/24))` — expertise survives a sabbatical. */
  readonly displayScore: number
  readonly peakScore: number
  readonly monthsSincePeak: number | null
  readonly tier: ReputationTierKey
  readonly tierLabel: string
  readonly level: number
  readonly domains: readonly DomainCredibility[]
  readonly totals: {
    readonly reviews: number
    readonly helpful: number
    readonly adopted: number
    readonly shipped: number
    readonly peerVotes: number
    readonly strikes: number
    readonly helpfulRate: number
    readonly adoptionRate: number
    readonly distinctCreators: number
    /** Herfindahl index over creators. Low means broad, high means a farm. */
    readonly creatorConcentration: number
  }
}

/** Per-review arithmetic, exposed so a profile can show the working. */
export interface ReviewValueBreakdown {
  readonly feedbackId: string
  readonly projectId: string
  readonly projectTitle: string
  /** The project owner. Herfindahl concentration is measured over these. */
  readonly creatorId: string
  readonly domain: ProjectTypeSlug
  readonly submittedAt: Millis
  /** Specificity `S_r`, 0–1. */
  readonly specificity: number
  /** Creator marked helpful. */
  readonly helpful: number
  /** Adoption `a_r`: shipped 1, planned 0.5, decayed 0.25. */
  readonly adoption: number
  /** Saturated trust-weighted peer votes `û_r`. */
  readonly peerVotes: number
  /** Creator marked not applicable. */
  readonly notApplicable: number
  /** Moderation strike: 0, 0.5, or 1. */
  readonly moderation: number
  /** Creator discrimination `κ(c)`. */
  readonly kappa: number
  /** Reciprocity damping `ρ(u,c)`. */
  readonly rho: number
  /** Time decay `w_time`. */
  readonly timeWeight: number
  /** Domain attribution `ω_d`. */
  readonly domainWeight: number
  /** `v_r`, clamped to ±4. */
  readonly value: number
}

export interface ExpertGateStatus {
  readonly domain: ProjectTypeSlug
  readonly passes: boolean
  readonly gates: readonly {
    readonly key: string
    readonly label: string
    readonly required: string
    readonly actual: string
    readonly passes: boolean
  }[]
}

/* ------------------------------------------------------------------------- *
 * 3. Taxonomy rows
 * ------------------------------------------------------------------------- */

export interface ProjectTypeRow {
  id: string
  slug: string
  label: string
  description: string | null
  icon: string | null
  embed_kind: 'none' | 'iframe' | 'video' | 'gallery' | 'build_download'
  sort_order: number
  is_active: Bit
  created_at: Millis
}

export interface ProjectStageRow {
  id: string
  project_type_id: string
  stage_key: string
  label: string
  description: string | null
  sort_order: number
}

export interface FeedbackCategoryRow {
  id: string
  project_type_id: string
  category_key: string
  label: string
  description: string | null
  prompt: string | null
  icon: string | null
  sort_order: number
  is_required: Bit
  is_active: Bit
}

export interface RatingAxisRow {
  id: string
  project_type_id: string
  axis_key: string
  label: string
  description: string | null
  low_label: string | null
  high_label: string | null
  scale_max: number
  weight: number
  sort_order: number
  is_active: Bit
}

export interface NeedKindRow {
  need_key: string
  label: string
  description: string | null
  icon: string | null
  sort_order: number
  is_active: Bit
}

export interface TagRow {
  id: string
  slug: string
  label: string
  kind: 'topic' | 'tech' | 'genre' | 'platform' | 'audience'
  usage_count: number
  is_blocked: Bit
  created_at: Millis
}

export interface TagView {
  readonly id: string
  readonly slug: string
  readonly label: string
  readonly kind: TagRow['kind']
  readonly usageCount: number
  readonly viewerFollows: boolean
}

export interface ExpertiseAreaRow {
  id: string
  slug: string
  label: string
  description: string | null
  parent_id: string | null
  is_active: Bit
}

/* ------------------------------------------------------------------------- *
 * 4. Projects
 * ------------------------------------------------------------------------- */

export type ProjectVisibility = 'private' | 'unlisted' | 'public'
export type ProjectStatus = 'draft' | 'published' | 'paused' | 'archived' | 'removed'
export type FeedbackState = 'open' | 'invite_only' | 'closed'

export interface ProjectRow {
  id: string
  owner_id: string
  project_type_id: string
  slug: string
  title: string
  tagline: string | null
  summary_md: string | null
  stage_key: string
  visibility: ProjectVisibility
  status: ProjectStatus
  feedback_state: FeedbackState
  feedback_closes_at: Millis | null
  is_nsfw: Bit
  content_warnings: string | null
  primary_media_id: string | null
  hot_score: number
  published_at: Millis | null
  created_at: Millis
  updated_at: Millis
  deleted_at: Millis | null
}

export interface ProjectVersionRow {
  id: string
  project_id: string
  version_label: string
  changelog_md: string | null
  build_url: string | null
  embed_url: string | null
  platforms: string | null
  is_current: Bit
  released_at: Millis | null
  created_at: Millis
}

export type MediaKind = 'image' | 'video' | 'gif' | 'audio' | 'embed' | 'file'

export interface ProjectMediaRow {
  id: string
  project_id: string
  version_id: string | null
  media_kind: MediaKind
  url: string
  thumb_url: string | null
  alt_text: string | null
  caption: string | null
  width: number | null
  height: number | null
  duration_ms: number | null
  byte_size: number | null
  mime_type: string | null
  sort_order: number
  created_at: Millis
}

export type ProjectLinkKind =
  | 'demo' | 'download' | 'repo' | 'store' | 'docs' | 'devlog' | 'discord' | 'other'

export interface ProjectLinkRow {
  id: string
  project_id: string
  link_kind: ProjectLinkKind
  label: string
  url: string
  sort_order: number
  click_count: number
}

export interface ProjectAskRow {
  id: string
  project_id: string
  category_id: string | null
  prompt: string
  detail_md: string | null
  is_required: Bit
  sort_order: number
  answer_count: number
  created_at: Millis
}

export interface ProjectStatsRow {
  project_id: string
  view_count: number
  feedback_count: number
  reviewer_count: number
  expert_feedback_count: number
  follower_count: number
  bookmark_count: number
  open_suggestions: number
  shipped_suggestions: number
  rating_count: number
  rating_avg: number
  reply_rate: number
  last_feedback_at: Millis | null
  last_activity_at: Millis | null
  computed_at: Millis
}

export interface ProjectUpdateRow {
  id: string
  project_id: string
  version_id: string | null
  author_id: string
  title: string
  body_md: string
  published_at: Millis | null
  created_at: Millis
  updated_at: Millis
  deleted_at: Millis | null
}

/** One Discover row. Everything the card renders, nothing it does not. */
export interface ProjectCard {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly tagline: string | null
  readonly typeSlug: string
  readonly typeLabel: string
  readonly typeIcon: string | null
  readonly stageKey: string
  readonly stageLabel: string
  readonly grit: number
  readonly owner: UserCard
  readonly cover: {
    readonly url: string
    readonly thumbUrl: string | null
    readonly altText: string
    readonly kind: MediaKind
  } | null
  readonly needs: readonly { readonly key: string; readonly label: string }[]
  readonly tags: readonly { readonly slug: string; readonly label: string }[]
  readonly counts: {
    readonly feedback: number
    readonly reviewers: number
    readonly qualifiedReviews: number
    readonly shipped: number
  }
  readonly replyRate: number
  readonly ratingAvg: number
  readonly ratingCount: number
  readonly feedbackState: FeedbackState
  readonly publishedAt: Millis | null
  readonly lastActivityAt: Millis | null
  readonly isNsfw: boolean
  /** Non-null only when the caller asked for ranking detail. */
  readonly rank: FeedRankBreakdown | null
  readonly viewerHasReviewed: boolean
  readonly viewerFollows: boolean
  readonly viewerBookmarked: boolean
}

/** Every term of the Discover formula, so a feed can be explained, not guessed at. */
export interface FeedRankBreakdown {
  readonly score: number
  readonly quality: number
  readonly qualityCreator: number
  readonly qualityBrief: number
  readonly qualityEngagement: number
  readonly need: number
  readonly freshness: number
  readonly urgency: number
  readonly fit: number
  readonly penalty: number
  /** True when the row came from the reserved "needs eyes" pool. */
  readonly reserved: boolean
}

export interface AxisAggregate {
  readonly axisId: string
  readonly axisKey: string
  readonly label: string
  readonly definition: string | null
  readonly lowLabel: string | null
  readonly highLabel: string | null
  readonly scaleMax: number
  readonly count: number
  /** Raw arithmetic mean. Null below one rating. */
  readonly rawMean: number | null
  /** Bayesian-shrunk mean, the number the UI shows once count is high enough. */
  readonly mean: number | null
  readonly min: number | null
  readonly max: number | null
  /** Counts at 1, 2, 3, 4, 5. */
  readonly distribution: readonly number[]
  /** False below MIN_RATINGS_FOR_HEADLINE: show the range and the raw ratings. */
  readonly showHeadline: boolean
}

export interface ProjectDetail {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly tagline: string | null
  readonly summaryMd: string | null
  readonly typeSlug: string
  readonly typeLabel: string
  readonly typeIcon: string | null
  readonly embedKind: ProjectTypeRow['embed_kind']
  readonly stageKey: string
  readonly stageLabel: string
  readonly grit: number
  readonly visibility: ProjectVisibility
  readonly status: ProjectStatus
  readonly feedbackState: FeedbackState
  readonly feedbackClosesAt: Millis | null
  readonly isNsfw: boolean
  readonly contentWarnings: readonly string[]
  readonly publishedAt: Millis | null
  readonly updatedAt: Millis
  readonly owner: UserCard
  readonly collaborators: readonly UserCard[]
  readonly currentVersion: ProjectVersionView | null
  readonly versions: readonly ProjectVersionView[]
  readonly media: readonly ProjectMediaRow[]
  readonly links: readonly ProjectLinkRow[]
  readonly asks: readonly ProjectAskView[]
  readonly needs: readonly { readonly key: string; readonly label: string; readonly detail: string | null }[]
  readonly tags: readonly { readonly id: string; readonly slug: string; readonly label: string }[]
  readonly ratings: readonly AxisAggregate[]
  readonly stats: {
    readonly views: number
    readonly feedback: number
    readonly reviewers: number
    readonly expertFeedback: number
    readonly followers: number
    readonly bookmarks: number
    readonly openSuggestions: number
    readonly shippedSuggestions: number
    readonly replyRate: number
    readonly lastFeedbackAt: Millis | null
  }
  readonly feedbackCounts: {
    readonly total: number
    readonly bySeverity: Readonly<Record<SeverityKey, number>>
    readonly answered: number
    readonly unanswered: number
    readonly onCurrentVersion: number
  }
  readonly viewer: {
    readonly isOwner: boolean
    readonly canEdit: boolean
    readonly hasReviewed: boolean
    readonly hasDraft: boolean
    /**
     * Chosen by the creator to review this project: holds a live bounty award
     * on it, or was invited into one of its playtest rounds. What admits a
     * reviewer while feedback is `invite_only`.
     */
    readonly invitedToReview: boolean
    readonly follows: boolean
    readonly bookmarked: boolean
  }
}

export interface ProjectVersionView {
  readonly id: string
  readonly label: string
  readonly changelogMd: string | null
  readonly buildUrl: string | null
  readonly embedUrl: string | null
  readonly platforms: readonly string[]
  readonly isCurrent: boolean
  readonly releasedAt: Millis | null
  readonly createdAt: Millis
  readonly feedbackCount: number
}

export interface ProjectAskView {
  readonly id: string
  readonly prompt: string
  readonly detailMd: string | null
  readonly isRequired: boolean
  readonly sortOrder: number
  readonly answerCount: number
  readonly categoryId: string | null
  readonly categoryLabel: string | null
}

export interface ProjectUpdateView {
  readonly id: string
  readonly title: string
  readonly bodyMd: string
  readonly publishedAt: Millis | null
  readonly createdAt: Millis
  readonly author: UserCard
  readonly versionLabel: string | null
}

/** The owner's row in /dashboard/projects. */
export interface ProjectOwnerRow {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly typeLabel: string
  readonly stageKey: string
  readonly stageLabel: string
  readonly grit: number
  readonly status: ProjectStatus
  readonly visibility: ProjectVisibility
  readonly feedbackState: FeedbackState
  readonly publishedAt: Millis | null
  readonly updatedAt: Millis
  readonly counts: {
    readonly feedback: number
    readonly unread: number
    readonly unanswered: number
    readonly openSuggestions: number
    readonly shipped: number
  }
  readonly replyRate: number
}

/* ------------------------------------------------------------------------- *
 * 5. Feedback
 * ------------------------------------------------------------------------- */

export type FeedbackOrigin = 'organic' | 'invited' | 'test_round' | 'bounty' | 'imported'
export type FeedbackStatus = 'draft' | 'submitted' | 'withdrawn' | 'removed'
export type InboxState = 'new' | 'read' | 'triaged' | 'actioned' | 'archived'
export type SentimentLabel = 'negative' | 'mixed' | 'neutral' | 'positive'

export interface FeedbackRow {
  id: string
  project_id: string
  project_type_id: string
  version_id: string | null
  reviewer_id: string
  round_id: string | null
  bounty_id: string | null
  origin: FeedbackOrigin
  status: FeedbackStatus
  visibility: 'public' | 'creator_only'
  headline: string | null
  summary_md: string | null
  time_spent_minutes: number | null
  environment: string | null
  point_count: number
  blocker_count: number
  sentiment_score: number | null
  sentiment_label: SentimentLabel | null
  quality_score: number | null
  helpful_count: number
  unhelpful_count: number
  reply_count: number
  inbox_state: InboxState
  creator_marked_helpful: Bit
  reviewer_is_expert: Bit
  first_reply_at: Millis | null
  submitted_at: Millis | null
  created_at: Millis
  updated_at: Millis
  deleted_at: Millis | null
}

export type AnchorKind = 'timecode' | 'route' | 'screen' | 'level' | 'selector'

export interface FeedbackPointRow {
  id: string
  feedback_id: string
  project_type_id: string
  category_id: string
  ask_id: string | null
  ordinal: number
  body_md: string
  severity: SeverityKey
  actionability: ActionabilityKey
  sentiment: -1 | 0 | 1
  anchor_kind: AnchorKind | null
  anchor_value: string | null
  timecode_ms: number | null
  repro_steps: string | null
  upvote_count: number
  is_resolved: Bit
  created_at: Millis
  updated_at: Millis
}

export interface FeedbackRatingRow {
  id: string
  feedback_id: string
  project_type_id: string
  axis_id: string
  rating_value: number
  comment: string | null
  created_at: Millis
}

export interface FeedbackAttachmentRow {
  id: string
  point_id: string
  media_kind: 'image' | 'video' | 'gif' | 'log' | 'file'
  url: string
  thumb_url: string | null
  alt_text: string | null
  byte_size: number | null
  mime_type: string | null
  created_at: Millis
}

export interface FeedbackReplyRow {
  id: string
  feedback_id: string
  point_id: string | null
  parent_reply_id: string | null
  author_id: string
  body_md: string
  is_creator: Bit
  created_at: Millis
  updated_at: Millis
  deleted_at: Millis | null
}

/** One structured item, ready to render in a thread or an inbox. */
export interface FeedbackPointView {
  readonly id: string
  readonly ordinal: number
  readonly bodyMd: string
  readonly severity: SeverityKey
  readonly severityCode: string | null
  readonly severityLabel: string
  readonly actionability: ActionabilityKey
  readonly actionabilityCode: string
  readonly actionabilityLabel: string
  readonly kind: ItemKind
  readonly sentiment: -1 | 0 | 1
  readonly categoryId: string
  readonly categoryKey: string
  readonly categoryLabel: string
  readonly anchor: {
    readonly kind: AnchorKind
    readonly value: string
    readonly timecodeMs: number | null
  } | null
  readonly reproSteps: string | null
  readonly upvoteCount: number
  readonly isResolved: boolean
  readonly attachments: readonly FeedbackAttachmentRow[]
  readonly themes: readonly { readonly id: string; readonly label: string }[]
  readonly askId: string | null
  readonly viewerUpvoted: boolean
  readonly createdAt: Millis
}

/** A whole review: the unit a creator triages, replies to and rewards. */
export interface FeedbackView {
  readonly id: string
  readonly projectId: string
  readonly projectSlug: string
  readonly projectTitle: string
  readonly typeSlug: string
  readonly reviewer: UserCard
  readonly origin: FeedbackOrigin
  readonly visibility: 'public' | 'creator_only'
  readonly headline: string | null
  readonly summaryMd: string | null
  readonly timeSpentMinutes: number | null
  readonly environment: Readonly<Record<string, string>> | null
  readonly versionId: string | null
  readonly versionLabel: string | null
  readonly points: readonly FeedbackPointView[]
  readonly ratings: readonly {
    readonly axisId: string
    readonly axisKey: string
    readonly label: string
    readonly value: number
    readonly scaleMax: number
    readonly comment: string | null
  }[]
  readonly counts: {
    readonly points: number
    readonly blockers: number
    readonly helpful: number
    readonly unhelpful: number
    readonly replies: number
  }
  readonly sentimentScore: number | null
  readonly sentimentLabel: SentimentLabel | null
  /** Specificity `S`, 0–1. Gates reputation; never gates posting. */
  readonly specificity: number
  readonly isQualified: boolean
  readonly inboxState: InboxState
  readonly creatorMarkedHelpful: boolean
  /** Where the creator stands: unanswered, replied, or resolved on the thread. */
  readonly responseState: 'unanswered' | 'replied' | 'resolved'
  readonly firstReplyAt: Millis | null
  readonly submittedAt: Millis | null
  readonly viewer: {
    readonly isReviewer: boolean
    readonly isCreator: boolean
    readonly vote: -1 | 0 | 1
  }
}

export interface FeedbackReplyView {
  readonly id: string
  readonly bodyMd: string
  readonly author: UserCard
  readonly isCreator: boolean
  readonly pointId: string | null
  readonly parentReplyId: string | null
  readonly createdAt: Millis
  readonly updatedAt: Millis
  readonly children: readonly FeedbackReplyView[]
}

/** Input to createFeedback. Validated by the caller; the repo trusts shape, not values. */
export interface NewFeedbackInput {
  readonly projectId: string
  readonly reviewerId: string
  readonly versionId?: string | null
  readonly roundId?: string | null
  readonly bountyId?: string | null
  readonly origin?: FeedbackOrigin
  readonly visibility?: 'public' | 'creator_only'
  readonly headline?: string | null
  readonly summaryMd?: string | null
  readonly timeSpentMinutes?: number | null
  readonly environment?: Readonly<Record<string, string>> | null
  /** Seconds the reviewer actually spent with the artifact. Feeds the dwell floor. */
  readonly dwellSeconds?: number | null
  /** False when the build or embed was never opened. Feeds the dwell floor. */
  readonly openedArtifact?: boolean
  readonly points: readonly NewFeedbackPointInput[]
  readonly ratings: readonly NewFeedbackRatingInput[]
}

export interface NewFeedbackPointInput {
  readonly categoryKey: string
  readonly bodyMd: string
  readonly severity: SeverityKey
  readonly actionability: ActionabilityKey
  readonly sentiment?: -1 | 0 | 1
  readonly askId?: string | null
  readonly anchorKind?: AnchorKind | null
  readonly anchorValue?: string | null
  readonly timecodeMs?: number | null
  readonly reproSteps?: string | null
  readonly attachments?: readonly {
    readonly mediaKind: FeedbackAttachmentRow['media_kind']
    readonly url: string
    readonly thumbUrl?: string | null
    readonly altText?: string | null
    readonly byteSize?: number | null
    readonly mimeType?: string | null
  }[]
}

export interface NewFeedbackRatingInput {
  readonly axisKey: string
  /** 1–5. Omit the axis entirely for "not enough exposure to rate". */
  readonly value: number
  readonly comment?: string | null
}

export interface CreateFeedbackResult {
  readonly feedbackId: string
  readonly pointIds: readonly string[]
  readonly specificity: number
  readonly isQualified: boolean
  readonly blockerCount: number
  readonly reputationDelta: number
  readonly notificationId: string | null
}

/* ------------------------------------------------------------------------- *
 * 6. Themes, the creator inbox, and suggestions
 * ------------------------------------------------------------------------- */

export interface FeedbackThemeRow {
  id: string
  project_id: string
  category_id: string | null
  label: string
  summary_md: string | null
  source: 'auto' | 'manual' | 'confirmed'
  point_count: number
  reviewer_count: number
  sentiment_score: number | null
  severity_score: number
  is_archived: Bit
  first_seen_at: Millis | null
  last_seen_at: Millis | null
  created_at: Millis
  updated_at: Millis
}

export interface ThemeRollupRow {
  readonly id: string
  readonly label: string
  readonly summaryMd: string | null
  readonly source: 'auto' | 'manual' | 'confirmed'
  readonly categoryId: string | null
  readonly categoryLabel: string | null
  readonly pointCount: number
  /** Distinct reviewers, never item count. "6 reviewers agree" is the claim. */
  readonly reviewerCount: number
  readonly severityScore: number
  readonly sentimentScore: number | null
  readonly bySeverity: Readonly<Record<SeverityKey, number>>
  /** True when reviewers disagree rather than agree. Never render it as agreement. */
  readonly contested: boolean
  readonly expertCount: number
  readonly firstSeenAt: Millis | null
  readonly lastSeenAt: Millis | null
  readonly openCount: number
  readonly resolvedCount: number
}

/** One query's worth of dashboard rollup, not a query per theme. */
export interface CreatorInbox {
  readonly projectId: string
  readonly projectSlug: string
  readonly projectTitle: string
  readonly themes: readonly ThemeRollupRow[]
  /** Points no theme claimed. The tail must not be invisible. */
  readonly unthemed: number
  readonly totals: {
    readonly reviews: number
    readonly points: number
    readonly reviewers: number
    readonly unread: number
    readonly unanswered: number
    readonly blockers: number
    readonly bySeverity: Readonly<Record<SeverityKey, number>>
    readonly byState: Readonly<Record<InboxState, number>>
  }
  readonly coverage: readonly {
    readonly askId: string
    readonly prompt: string
    readonly answerCount: number
  }[]
}

export type SuggestionStatus =
  | 'open' | 'under_review' | 'planned' | 'in_progress'
  | 'shipped' | 'declined' | 'duplicate' | 'wont_fix'

export interface SuggestionRow {
  id: string
  project_id: string
  theme_id: string | null
  category_id: string | null
  created_by: string
  title: string
  body_md: string | null
  status: SuggestionStatus
  status_note: string | null
  priority: 'low' | 'normal' | 'high' | 'critical'
  effort: EffortKey | null
  duplicate_of: string | null
  shipped_in_version_id: string | null
  vote_count: number
  source_count: number
  status_changed_at: Millis | null
  shipped_at: Millis | null
  created_at: Millis
  updated_at: Millis
}

export interface SuggestionView {
  readonly id: string
  readonly projectId: string
  readonly projectSlug: string
  readonly projectTitle: string
  readonly title: string
  readonly bodyMd: string | null
  readonly status: SuggestionStatus
  readonly statusLabel: string
  readonly statusNote: string | null
  readonly priority: SuggestionRow['priority']
  readonly effort: EffortKey | null
  readonly effortCode: string | null
  readonly effortLabel: string | null
  readonly quadrant: 'quick_win' | 'big_rock' | 'cheap_polish' | 'backlog'
  readonly themeId: string | null
  readonly themeLabel: string | null
  readonly categoryLabel: string | null
  readonly voteCount: number
  readonly sourceCount: number
  readonly contributors: readonly UserCard[]
  readonly shippedInVersion: string | null
  readonly shippedAt: Millis | null
  readonly statusChangedAt: Millis | null
  readonly createdAt: Millis
  readonly viewerVoted: boolean
}

export interface SuggestionTimelineEntry {
  readonly id: string
  readonly fromStatus: SuggestionStatus | null
  readonly toStatus: SuggestionStatus
  readonly note: string | null
  readonly actor: UserCard | null
  readonly createdAt: Millis
}

/* ------------------------------------------------------------------------- *
 * 7. Marketplace
 * ------------------------------------------------------------------------- */

export type BountyStatus = 'draft' | 'open' | 'in_progress' | 'delivered' | 'closed' | 'cancelled'
export type EscrowState = 'unfunded' | 'authorized' | 'held' | 'released' | 'refunded' | 'disputed'

export interface BountyRow {
  id: string
  project_id: string
  version_id: string | null
  created_by: string
  title: string
  brief_md: string
  expertise_id: string | null
  amount_cents: number
  currency: string
  platform_fee_bps: number
  seats: number
  seats_awarded: number
  turnaround_hours: number | null
  visibility: 'public' | 'invite_only'
  /** The one reviewer an invite-only bounty was sent to. */
  invited_user_id: string | null
  status: BountyStatus
  escrow_state: EscrowState
  escrow_ref: string | null
  closes_at: Millis | null
  created_at: Millis
  updated_at: Millis
}

export interface BountyView {
  readonly id: string
  readonly title: string
  readonly briefMd: string
  readonly amountCents: number
  readonly currency: string
  readonly seats: number
  readonly seatsAwarded: number
  readonly seatsOpen: number
  readonly turnaroundHours: number | null
  readonly status: BountyStatus
  readonly escrowState: EscrowState
  readonly isFunded: boolean
  readonly closesAt: Millis | null
  readonly createdAt: Millis
  readonly expertise: { readonly id: string; readonly slug: string; readonly label: string } | null
  readonly creator: UserCard
  readonly visibility: 'public' | 'invite_only'
  /** Who an invite-only bounty was sent to; null on a public one. */
  readonly invitee: UserCard | null
  readonly project: {
    readonly id: string
    readonly slug: string
    readonly title: string
    readonly typeLabel: string
    readonly stageLabel: string
    readonly grit: number
  }
  readonly applicationCount: number
  readonly viewerApplied: boolean
  readonly viewerCanApply: boolean
}

export interface ExpertProfileRow {
  user_id: string
  headline: string
  pitch_md: string | null
  hourly_rate_cents: number | null
  min_bounty_cents: number | null
  currency: string
  turnaround_hours: number | null
  capacity_per_week: number
  years_experience: number | null
  is_listed: Bit
  is_verified: Bit
  completed_count: number
  avg_rating: number
  on_time_rate: number
  created_at: Millis
  updated_at: Millis
}

export interface ExpertCard {
  readonly user: UserCard
  readonly headline: string
  readonly pitchMd: string | null
  readonly hourlyRateCents: number | null
  readonly minBountyCents: number | null
  readonly currency: string
  readonly turnaroundHours: number | null
  readonly capacityPerWeek: number
  readonly yearsExperience: number | null
  readonly isVerified: boolean
  readonly completedCount: number
  readonly avgRating: number
  readonly onTimeRate: number
  readonly expertise: readonly {
    readonly slug: string
    readonly label: string
    readonly level: 'familiar' | 'practitioner' | 'specialist'
    readonly isVerified: boolean
  }[]
}

/* ------------------------------------------------------------------------- *
 * 8. Community
 * ------------------------------------------------------------------------- */

export type ThreadKind = 'discussion' | 'question' | 'showcase' | 'announcement'
export type ThreadStatus = 'open' | 'answered' | 'locked' | 'archived' | 'removed'

export interface DiscussionChannelRow {
  id: string
  slug: string
  label: string
  description: string | null
  icon: string | null
  is_private: Bit
  is_archived: Bit
  sort_order: number
  thread_count: number
  created_at: Millis
}

export interface DiscussionThreadRow {
  id: string
  channel_id: string
  project_id: string | null
  author_id: string
  title: string
  body_md: string
  thread_kind: ThreadKind
  status: ThreadStatus
  accepted_post_id: string | null
  is_pinned: Bit
  post_count: number
  view_count: number
  score: number
  hot_score: number
  last_post_at: Millis | null
  created_at: Millis
  updated_at: Millis
  deleted_at: Millis | null
}

export interface DiscussionPostRow {
  id: string
  thread_id: string
  parent_post_id: string | null
  author_id: string
  body_md: string
  depth: number
  score: number
  is_accepted: Bit
  edited_at: Millis | null
  created_at: Millis
  deleted_at: Millis | null
}

export interface ThreadCard {
  readonly id: string
  readonly title: string
  readonly kind: ThreadKind
  readonly status: ThreadStatus
  readonly channel: { readonly id: string; readonly slug: string; readonly label: string }
  readonly author: UserCard
  readonly excerpt: string
  readonly postCount: number
  readonly viewCount: number
  readonly score: number
  readonly isPinned: boolean
  readonly hasAcceptedAnswer: boolean
  readonly project: { readonly slug: string; readonly title: string } | null
  readonly lastPostAt: Millis | null
  readonly createdAt: Millis
}

export interface ThreadDetail extends ThreadCard {
  readonly bodyMd: string
  readonly posts: readonly DiscussionPostView[]
  readonly viewerSubscribed: boolean
  readonly viewerIsAuthor: boolean
}

export interface DiscussionPostView {
  readonly id: string
  readonly bodyMd: string
  readonly author: UserCard
  readonly depth: number
  readonly score: number
  readonly isAccepted: boolean
  readonly parentPostId: string | null
  readonly editedAt: Millis | null
  readonly createdAt: Millis
  readonly viewerVote: -1 | 0 | 1
  readonly children: readonly DiscussionPostView[]
}

/* ------------------------------------------------------------------------- *
 * 9. Notifications
 * ------------------------------------------------------------------------- */

export type NotificationKind =
  | 'feedback_received' | 'feedback_reply' | 'feedback_helpful'
  | 'suggestion_status' | 'suggestion_shipped' | 'project_update'
  | 'new_version' | 'test_invite' | 'test_reminder'
  | 'bounty_application' | 'bounty_awarded' | 'bounty_delivered'
  | 'bounty_paid' | 'thread_reply' | 'answer_accepted' | 'mention'
  | 'new_follower' | 'badge_awarded' | 'verification_decision'
  | 'moderation_notice' | 'system'

export type NotificationSubjectType =
  | 'project' | 'project_version' | 'feedback' | 'feedback_point'
  | 'suggestion' | 'test_round' | 'bounty' | 'bounty_award'
  | 'discussion_thread' | 'discussion_post' | 'user' | 'badge'

export interface NotificationRow {
  id: string
  user_id: string
  actor_id: string | null
  kind: NotificationKind
  subject_type: NotificationSubjectType | null
  subject_id: string | null
  group_key: string | null
  title: string
  body: string | null
  url: string | null
  payload: string | null
  read_at: Millis | null
  emailed_at: Millis | null
  created_at: Millis
}

export interface NotificationView {
  readonly id: string
  readonly kind: NotificationKind
  readonly title: string
  readonly body: string | null
  readonly url: string | null
  readonly actor: UserCard | null
  readonly subjectType: NotificationSubjectType | null
  readonly subjectId: string | null
  readonly isRead: boolean
  readonly createdAt: Millis
  readonly payload: Readonly<Record<string, unknown>> | null
}

/* ------------------------------------------------------------------------- *
 * 10. Search, stats, filters
 * ------------------------------------------------------------------------- */

export interface ProjectSearchHit {
  readonly project: ProjectCard
  /** bm25 rank, lower is a better match. Negated into a score for display. */
  readonly score: number
  /** Field the strongest match came from. */
  readonly matchedIn: 'title' | 'tagline' | 'summary'
  /** Marked-up excerpt with the matched terms wrapped in <mark>. */
  readonly snippet: string
}

export interface ProjectFilters {
  readonly typeSlug?: string | null
  readonly stageKey?: string | null
  readonly grit?: number | null
  readonly needs?: readonly string[]
  readonly tagSlugs?: readonly string[]
  readonly query?: string | null
  readonly openOnly?: boolean
  readonly excludeReviewedByViewer?: boolean
  readonly ownerId?: string | null
  readonly includeNsfw?: boolean
  /** Restrict to an explicit id set, e.g. the viewer's bookmark shelf. */
  readonly projectIds?: readonly string[] | null
}

export type FeedSort = 'ranked' | 'newest' | 'needs_eyes' | 'most_reviewed'

export interface FacetCount {
  readonly key: string
  readonly label: string
  readonly count: number
}

export interface FacetCounts {
  readonly types: readonly FacetCount[]
  readonly stages: readonly FacetCount[]
  readonly needs: readonly FacetCount[]
  readonly tags: readonly FacetCount[]
  readonly total: number
}

export interface LandingStats {
  /** Projects that have received at least one qualified review. */
  readonly projectsSharpened: number
  readonly reviewsWritten: number
  readonly suggestionsShipped: number
  /** Null when no project has yet received a first review. */
  readonly medianTimeToFirstFeedbackMs: number | null
  readonly computedAt: Millis
}

export interface DashboardSummary {
  readonly projects: number
  readonly publishedProjects: number
  readonly feedbackReceived: number
  readonly unreadFeedback: number
  readonly unansweredFeedback: number
  readonly blockersOpen: number
  readonly reviewsWritten: number
  readonly helpfulMarks: number
  readonly shippedFromFeedback: number
  readonly replyRate: number
  readonly medianResponseMs: number | null
  readonly reputation: number
  readonly tier: ReputationTierKey
  readonly unreadNotifications: number
}

export interface ActivityEntry {
  readonly id: string
  readonly kind:
    | 'feedback_received' | 'feedback_written' | 'reply' | 'suggestion_shipped'
    | 'version_published' | 'project_published' | 'badge_awarded'
  readonly title: string
  readonly detail: string | null
  readonly url: string
  readonly actor: UserCard | null
  readonly at: Millis
}

export interface ProjectAnalytics {
  readonly projectId: string
  readonly range: '7d' | '30d' | '90d' | 'all'
  readonly views: number
  readonly feedbackCount: number
  readonly reviewerCount: number
  readonly qualifiedCount: number
  readonly replyRate: number
  readonly medianResponseMs: number | null
  readonly bySeverity: Readonly<Record<SeverityKey, number>>
  readonly byCategory: readonly { readonly key: string; readonly label: string; readonly count: number; readonly sentiment: number }[]
  readonly byVersion: readonly { readonly versionId: string; readonly label: string; readonly count: number; readonly ratingAvg: number | null }[]
  readonly axisTrend: readonly {
    readonly axisKey: string
    readonly label: string
    readonly points: readonly { readonly versionLabel: string; readonly mean: number | null; readonly count: number }[]
  }[]
  readonly timeline: readonly { readonly day: Millis; readonly feedback: number; readonly replies: number }[]
}

/** Values the type layer exports for callers that need the key unions inline. */
export type {
  ActionabilityKey,
  EffortKey,
  GritStageKey,
  ItemKind,
  NeedKey,
  ProjectTypeSlug,
  ReputationTierKey,
  SeverityKey,
}

# repos

> The data layer contract. Every exported function in `src/server/repos/`, its exact signature and its return shape, plus the taxonomy constants in `src/lib/taxonomy.ts` and the view-model types in `src/lib/types.ts`. A surface can be built against this document without opening the source.

## 0. How to use this layer

**Everything is synchronous.** `node:sqlite` is a synchronous driver, so no repository function returns a Promise. In a Server Component you call it directly, with no `await` and no `useEffect`.

```tsx
// app/(app)/discover/page.tsx  — a Server Component
import { listProjects, getFacetCounts } from '@/server/repos/projects'
import { currentClaims } from '@/lib/auth'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams                 // searchParams is async in Next 15
  const claims = await currentClaims()
  const feed = listProjects(
    { typeSlug: sp['type'] ?? null, needs: sp['need'] ? [sp['need']] : [] },
    { viewerId: claims?.uid ?? null, cursor: sp['cursor'] ?? null, limit: 24 },
  )
  const facets = getFacetCounts({ typeSlug: sp['type'] ?? null })
  return <Feed page={feed} facets={facets} />
}
```

**Rules this layer keeps so surfaces do not have to.**

1. **No N+1.** Every list function resolves its joins and counts for the whole page in a constant number of queries. A `ProjectCard` arrives with its owner, cover, needs, tags and counters already attached. A `FeedbackView` arrives with its points, attachments, themes, ratings and the viewer's own vote.
2. **Nothing is string-concatenated from a request.** Every value binds. The only interpolated strings are table aliases, column prefixes and whitelisted `ORDER BY` fragments written in the repository source.
3. **Booleans are booleans.** Row types keep the schema's `0 | 1`; view models expose `true | false`.
4. **Timestamps are epoch milliseconds** (`Millis = number`), never strings. Render them with `relativeTime` from `@/lib/utils`.
5. **Paging is keyset, and the cursor is opaque.** Pass `nextCursor` back untouched. A cursor that does not decode restarts the list rather than throwing.
6. **Missing is `undefined`, empty is `[]`.** A single-row read returns `T | undefined`; a list read returns `Page<T>` with `items: []`. Neither throws for "not found".
7. **Reads never write.** The two exceptions are named for it: `incrementViewCount` and `incrementThreadViews`.

**Paging shape**, used by every list:

```ts
interface PageOptions { limit?: number; cursor?: string | null }   // limit clamped 1–100
interface Page<T> { items: readonly T[]; nextCursor: string | null; hasMore: boolean }
```

**Viewer-aware reads.** Anything that renders a follow state, a vote, an "already reviewed" badge or a personalised rank takes `viewerId?: string | null`. Pass `null` for a logged-out visitor; the shape does not change, the viewer fields come back `false`.

**Errors.** Repositories throw only for programmer error (a missing project id passed to `createFeedback`) and for one deliberate product refusal, `SuggestionStatusError`, which carries the field to attach the message to.

---

## 1. `src/lib/taxonomy.ts` — the product IP

The single source of truth shared by the composer, the seed script and the repositories. Importing it never touches the database.

### 1.1 Project types

```ts
const PROJECT_TYPE_SLUGS: readonly [
  'game', 'web_app', 'mobile_app', 'website', 'video',
  'business_idea', 'hardware', 'design', 'writing', 'api_tool',
]
type ProjectTypeSlug = (typeof PROJECT_TYPE_SLUGS)[number]

const PROJECT_TYPES: Record<ProjectTypeSlug, ProjectTypeDef>

interface ProjectTypeDef {
  slug: string
  label: string
  description: string
  icon: string                    // lucide-react name
  embedKind: 'none' | 'iframe' | 'video' | 'gallery' | 'build_download'
  sortOrder: number
  axes: readonly AxisDef[]        // exactly five
  categories: readonly CategoryDef[]
  prompts: readonly string[]      // five elicitation questions
  stageLabels: Record<GritStageKey, string>
  requiredAnchor: 'timecode' | null   // 'timecode' on video: the composer blocks an untimed issue
}

interface AxisDef {
  key: string; label: string; definition: string
  family: 'value' | 'comprehension' | 'friction' | 'execution' | 'type_unique'
  lowLabel: string; highLabel: string     // written anchors; bare stars are banned
}
interface CategoryDef { key: string; label: string; description: string }
```

Helpers:

| Function | Returns |
|---|---|
| `projectType(slug: string)` | `ProjectTypeDef \| undefined` |
| `allProjectTypes()` | `readonly ProjectTypeDef[]`, in `sortOrder` |
| `isProjectTypeSlug(v: string)` | type guard |
| `axesFor(slug: string)` | `readonly AxisDef[]` |
| `categoriesFor(slug: string)` | `readonly CategoryDef[]` — the type's own list, then every `UNIVERSAL_CATEGORIES` entry whose key the type has not already defined |
| `promptsFor(slug: string)` | `readonly string[]` |
| `axisId(slug, axisKey)` | `'game:fun'` — the `rating_axes.id` convention |
| `categoryId(slug, catKey)` | `'game:core_loop'` — the `feedback_categories.id` convention |
| `splitTaxonomyId(id)` | `{ slug, key } \| undefined` |

`UNIVERSAL_CATEGORIES` (available on every type): `bug`, `confusion`, `friction`, `missing`, `delight`, `positioning`, `accessibility`, `performance`, `copy`.

### 1.2 Grit stages

One scale across all ten types. The numeral is the product's organising structure: the Discover filter, the detail rail, the composer selector, the profile strip.

```ts
const GRIT_STAGES: readonly [
  { key: 'concept',           grit: 120,  label: 'Concept',           strokeWidth: 3,    spacing: 16 },
  { key: 'prototype',         grit: 400,  label: 'Prototype',         strokeWidth: 2,    spacing: 8  },
  { key: 'beta',              grit: 1000, label: 'Beta',              strokeWidth: 1.25, spacing: 4  },
  { key: 'release_candidate', grit: 3000, label: 'Release candidate', strokeWidth: 0.75, spacing: 2  },
  { key: 'shipped',           grit: 8000, label: 'Shipped',           strokeWidth: 0.5,  spacing: 1  },
]
```

`strokeWidth` and `spacing` are the SVG hatch values from the design contract; take them from here so the rail, the chip and the filter cannot drift.

| Function | Returns |
|---|---|
| `gritStage(key)` | `GritStage \| undefined` |
| `gritValue(key)` | `number` (0 when unknown) |
| `isGritStageKey(v)` | type guard |
| `stageLabel(typeSlug, stageKey)` | the type's own wording, falling back to the canonical label. A game's `beta` reads "Playable beta"; a video's reads "Fine cut" |

### 1.3 Item vocabularies

```ts
SEVERITY_LEVELS       // key, code, label, definition, weight, rank
ACTIONABILITY_LEVELS  // key, code, label, definition, example, rank
EFFORT_LEVELS         // key, code, label, definition, rank
ITEM_KINDS            // key, label, icon
REPRO_FREQUENCIES     // key, label
NEED_KINDS            // key, label, description, icon, sortOrder
EXPERTISE_AREAS       // slug, label, parent, description
```

Two reconciliations between design/TAXONOMY.md and the schema, resolved here once:

**Severity.** The schema stores five values. `blocker` = S0, `major` = S1, `minor` = S2 (the document's Moderate and Minor merged), `nit` = S3, and `praise` carries no severity code at all — it is the marker for a keep-this item. Weights `8 / 4 / 1.5 / 0.5 / 0` drive the theme severity rollup.

**Actionability.** The schema's five values expand the document's four by splitting the reaction level: `observation` A0, `opinion` A1 (a preference), `suggestion` A2 (directional), `actionable` A3 (a named change), `repro` A4 (a change plus an artifact).

**Reach** (`everyone` / `most` / `some` / `just-me`) has no column in the schema and is therefore not persisted. Priority is computed from severity against effort, with corroboration read from `feedback_points.upvote_count`.

| Function | Returns |
|---|---|
| `severity(key)` / `actionability(key)` / `effort(key)` | the level object, or `undefined` |
| `severityWeight(key)` | `number` |
| `severityRank(key)` | `0` blocker … `4` praise, for sorting |
| `deriveItemKind({ severity, actionability, hasReproSteps, sentiment })` | `ItemKind` |
| `priorityQuadrant(severityKey, effortKey \| null)` | `'quick_win' \| 'big_rock' \| 'cheap_polish' \| 'backlog'` |
| `tierFor(score: number)` | `{ key, label, min, max, level }` |
| `shrinkAxisMean(sum, count, typeMean?)` | Bayesian-shrunk axis mean |

### 1.4 Tuned constants

`RATING_SCALE_MAX` · `AXIS_SHRINKAGE_K` (4) · `MIN_RATINGS_FOR_HEADLINE` (4) · `AXIS_GLOBAL_PRIOR` · `SPECIFICITY_WEIGHTS` · `QUALIFIED_SPECIFICITY` (0.5) · `DWELL_FLOOR_SECONDS` (90) · `DWELL_FLOOR_CAP` (0.4) · `GENERIC_PHRASES` · `REPUTATION` · `REPUTATION_TIERS` · `EXPERT_GATES` · `FEED` · `THEME` · `EFFORT_GUESS_CREDIBILITY_FLOOR` (300).

---

## 2. `src/server/repos/projects.ts`

### `listProjects(filters?, opts?): Page<ProjectCard>`

The Discover feed. Implements design/TAXONOMY.md §4 in full.

```ts
interface ProjectFilters {
  typeSlug?: string | null
  stageKey?: string | null
  grit?: number | null                // 120 | 400 | 1000 | 3000 | 8000; resolves to a stage key
  needs?: readonly string[]           // any-of
  tagSlugs?: readonly string[]        // any-of
  query?: string | null               // FTS5 semi-join, not a LIKE scan
  openOnly?: boolean
  excludeReviewedByViewer?: boolean
  ownerId?: string | null             // an owner's own shelf: includes drafts and private rows
  includeNsfw?: boolean
  projectIds?: readonly string[] | null
}

interface ListProjectsOptions extends PageOptions {
  viewerId?: string | null
  viewerIsExpert?: boolean
  sort?: 'ranked' | 'newest' | 'needs_eyes' | 'most_reviewed'   // default 'ranked'
  explain?: boolean                   // fill ProjectCard.rank with every term
  reserveNeedsEyes?: boolean          // default true
}
```

**The formula.** `Rank(p,u) = Quality^0.8 · Need · Freshness · Urgency · Fit · Penalty`.

| Term | Implementation |
|---|---|
| `Quality` | `0.5·Q_creator + 0.3·Q_brief + 0.2·Q_engagement`. `Q_creator = clamp01(creator_score / 800)`. `Q_brief` is five things a first-time creator fully controls: an ask exists, the current build has a link or embed, the summary is at least 80 characters, two or more needs are declared, at least one tag. `Q_engagement = clamp01((helpful_marks + 2·threads_with_creator_reply) / (3 + reviews))`. |
| `Need` | `1 + 1.6·exp(−R_eff / 3)` where `R_eff` is qualified reviews (`quality_score ≥ 0.5`) on the **current version**. Zero reviews is `2.60×`, ten is `1.06×`. A project whose `feedback_state` is no longer `open` drops to `0.3×` and rotates out. |
| `Freshness` | `1 / (1 + (hours_since_meaningful_update / 36)^1.4)`. A meaningful update is a first publish or a new version. Comments do not count, so a creator cannot bump-farm their own thread. |
| `Urgency` | `1 + 0.4` when `feedback_closes_at` is inside 14 days. |
| `Fit` | `1 + 0.5·domain_match + 0.3·tag_overlap + 0.2·[viewer is an expert]`, then `×0.15` when the viewer already reviewed this version. |
| `Penalty` | `×0.3` when five or more reviews older than seven days are unanswered (the anti-extraction term), and `×0.6` on a creator's second and later row inside the top 20 (author diversity). |

**Reserved slots.** Every 4th position is drawn from the "needs eyes" pool: projects with zero or one qualified review, ordered by `Need · Fit` with `Quality` ignored entirely. `ProjectCard.rank.reserved` is `true` on those rows. Set `reserveNeedsEyes: false` to turn it off (the marketing rail does).

**Deliberately not implemented:** ε-exploration (a random term makes a server-rendered page disagree with its own next cursor) and the shown-and-skipped Fit damper (no impressions table in the schema). Both are noted in the source.

**Paging.** The cursor carries the clock and an offset into the composed feed, so every page of one feed decays against the same instant and no row appears twice. The candidate scan is capped at 600 rows; past that, search is the right tool.

Returns `ProjectCard`:

```ts
interface ProjectCard {
  id: string; slug: string; title: string; tagline: string | null
  typeSlug: string; typeLabel: string; typeIcon: string | null
  stageKey: string; stageLabel: string; grit: number
  owner: UserCard
  cover: { url: string; thumbUrl: string | null; altText: string; kind: MediaKind } | null
  needs: readonly { key: string; label: string }[]
  tags: readonly { slug: string; label: string }[]
  counts: { feedback: number; reviewers: number; qualifiedReviews: number; shipped: number }
  replyRate: number; ratingAvg: number; ratingCount: number
  feedbackState: 'open' | 'invite_only' | 'closed'
  publishedAt: Millis | null; lastActivityAt: Millis | null; isNsfw: boolean
  rank: FeedRankBreakdown | null        // non-null only with explain: true
  viewerHasReviewed: boolean; viewerFollows: boolean; viewerBookmarked: boolean
}

interface FeedRankBreakdown {
  score: number; quality: number
  qualityCreator: number; qualityBrief: number; qualityEngagement: number
  need: number; freshness: number; urgency: number; fit: number; penalty: number
  reserved: boolean
}
```

### `getProjectBySlug(slug, opts?): ProjectDetail | undefined`

```ts
interface GetProjectOptions { viewerId?: string | null; ownerHandle?: string | null }
```

Slugs are unique per owner, not globally (`ux_projects_owner_slug`). With no `ownerHandle` this resolves to the most recently published match, which is what a bare `/p/<slug>` has to do. Pass `ownerHandle` from a `/@handle/<slug>` route to disambiguate.

Returns the project, its creator and accepted collaborators, every version with its own feedback count, media, links, the ask, needs, tags, **per-axis rating aggregates**, feedback counts by severity, and the viewer's relationship to it.

```ts
interface ProjectDetail {
  id; slug; title; tagline; summaryMd
  typeSlug; typeLabel; typeIcon; embedKind
  stageKey; stageLabel; grit
  visibility; status; feedbackState; feedbackClosesAt; isNsfw; contentWarnings: readonly string[]
  publishedAt; updatedAt
  owner: UserCard; collaborators: readonly UserCard[]
  currentVersion: ProjectVersionView | null; versions: readonly ProjectVersionView[]
  media: readonly ProjectMediaRow[]; links: readonly ProjectLinkRow[]
  asks: readonly ProjectAskView[]
  needs: readonly { key; label; detail }[]
  tags: readonly { id; slug; label }[]
  ratings: readonly AxisAggregate[]
  stats: { views; feedback; reviewers; expertFeedback; followers; bookmarks;
           openSuggestions; shippedSuggestions; replyRate; lastFeedbackAt }
  feedbackCounts: { total; bySeverity: Record<SeverityKey, number>;
                    answered; unanswered; onCurrentVersion }
  viewer: { isOwner; canEdit; hasReviewed; hasDraft; follows; bookmarked }
}
```

`AxisAggregate` carries `count`, `rawMean`, the shrunk `mean`, `min`, `max`, a `distribution` array and `showHeadline`. **Render the headline number only when `showHeadline` is true**; below four ratings show the range and the individual ratings instead.

### The rest of `projects.ts`

| Function | Returns | Notes |
|---|---|---|
| `getFacetCounts(filters?)` | `FacetCounts` | Four grouped queries for the filter rail: `{ types, stages, needs, tags, total }`, each a `FacetCount { key, label, count }` |
| `getProjectById(projectId)` | `ProjectRow \| undefined` | raw row |
| `getProjectForEdit(slug, userId)` | `ProjectDetail \| undefined` | `undefined` when the user cannot edit it, so the route needs no second permission check |
| `listMyProjects(userId, { limit?, includeArchived? })` | `readonly ProjectOwnerRow[]` | per project: feedback, unread, unanswered, open suggestions, shipped, reply rate |
| `listProjectsByUser(userId, opts?)` | `Page<ProjectCard>` | public profile tab |
| `getFeaturedProjects(limit?, viewerId?)` | `readonly ProjectCard[]` | marketing rail; omit the strip rather than pad it |
| `getStarterPicks(limit?, viewerId?)` | `readonly ProjectCard[]` | the Discover empty state, drawn from the needs-eyes pool |
| `listUpdates({ projectId, limit?, cursor? })` | `Page<ProjectUpdateView>` | devlog |
| `createProject(input: NewProjectInput)` | `string` (id) | one transaction: project, stats row, needs, tags, asks. Slug is uniquified per owner |
| `updateProject(projectId, patch: ProjectPatch)` | `void` | only present fields are written |
| `publishProject(projectId)` | `void` | sets `published_at`, which the feed sorts on and the schema requires |
| `addVersion(input: NewVersionInput)` | `string` (id) | resets Need against the new build and moves the project back up the feed |
| `addMedia(input)` | `string` (id) | images and gifs must carry `altText`; the schema refuses otherwise |
| `followProject` / `unfollowProject` | `void` | keeps `follower_count` honest |
| `bookmarkProject` / `unbookmarkProject` | `void` | private shelf, no notification |
| `listBookmarks(userId, opts?)` | `Page<ProjectCard>` | |
| `incrementViewCount(projectId)` | `void` | |
| `recomputeHotScore(projectId?)` | `void` | the stored, viewer-independent pre-filter the candidate scan orders by. Call after a publish, a version or a review; call with no argument on a cadence |

---

## 3. `src/server/repos/feedback.ts`

### `createFeedback(input: NewFeedbackInput): CreateFeedbackResult`

One transaction covering the review container, every point and attachment, the axis ratings, the ask answer counters, the project counter cache, the reputation ledger entry and the creator's notification.

```ts
interface NewFeedbackInput {
  projectId: string
  reviewerId: string
  versionId?: string | null          // defaults to the project's current version
  roundId?: string | null
  bountyId?: string | null
  origin?: 'organic' | 'invited' | 'test_round' | 'bounty' | 'imported'
  visibility?: 'public' | 'creator_only'
  headline?: string | null
  summaryMd?: string | null
  timeSpentMinutes?: number | null
  environment?: Record<string, string> | null
  dwellSeconds?: number | null       // seconds with the artifact — feeds the dwell floor
  openedArtifact?: boolean           // false when the build or embed was never opened
  points: readonly NewFeedbackPointInput[]
  ratings: readonly NewFeedbackRatingInput[]   // omit an axis entirely for "not enough exposure"
}

interface NewFeedbackPointInput {
  categoryKey: string                // the key, not the id; the repo builds '<typeSlug>:<key>'
  bodyMd: string
  severity: SeverityKey
  actionability: ActionabilityKey
  sentiment?: -1 | 0 | 1             // defaults from severity
  askId?: string | null
  anchorKind?: 'timecode' | 'route' | 'screen' | 'level' | 'selector' | null
  anchorValue?: string | null
  timecodeMs?: number | null
  reproSteps?: string | null         // required when actionability is 'repro'
  attachments?: readonly { mediaKind; url; thumbUrl?; altText?; byteSize?; mimeType? }[]
}

interface CreateFeedbackResult {
  feedbackId: string
  pointIds: readonly string[]
  specificity: number                // S, 0–1
  isQualified: boolean               // S ≥ 0.5
  blockerCount: number
  reputationDelta: number            // 0 when the daily rep-bearing cap was already spent
  notificationId: string | null      // null when the reviewer is the owner
}
```

An `actionability: 'repro'` point with no steps is downgraded to `'actionable'` rather than rejected, because the schema refuses the first and losing the report is worse than losing the label.

### Specificity

```ts
computeSpecificity(input, vocabulary?): SpecificityBreakdown   // the review's S_r
pointSpecificity(point, vocabulary?): SpecificityBreakdown     // one item
projectVocabulary(projectId): ProjectVocabulary                // ReadonlySet<string>

interface SpecificityBreakdown {
  score: number; struct: number; evidence: number; anchor: number; lex: number
  dwellCapped: boolean
}
```

`S = clamp01(0.30·s_struct + 0.25·s_evidence + 0.25·s_anchor + 0.20·s_lex)`, then the dwell floor caps it at `0.4` when the session was under 90 seconds or the artifact was never opened. `s_lex` is capped at 20% of the total on purpose: it can nudge, it can never decide.

Call `pointSpecificity` live in the composer to show a reviewer what the item they are writing is currently worth. **S gates rewards and never blocks posting** — a thin item still posts and still appears in the thread.

### `listFeedbackForProject(projectId, opts?): Page<FeedbackView>`

```ts
interface ListFeedbackOptions extends PageOptions {
  sort?: 'most_helpful' | 'newest' | 'most_severe'   // default 'most_helpful'
  categoryId?: string | null
  severity?: SeverityKey | null
  versionId?: string | null
  expertsOnly?: boolean
  unansweredOnly?: boolean
  viewerId?: string | null
  includePrivate?: boolean     // owners and collaborators also see creator_only reviews
}
```

Each `FeedbackView` carries `responseState: 'unanswered' | 'replied' | 'resolved'`, so the creator's state on the thread needs no second query. `resolved` means the review was actioned or every one of its points is resolved.

```ts
interface FeedbackView {
  id; projectId; projectSlug; projectTitle; typeSlug
  reviewer: UserCard
  origin; visibility; headline; summaryMd; timeSpentMinutes
  environment: Record<string, string> | null
  versionId: string | null; versionLabel: string | null
  points: readonly FeedbackPointView[]
  ratings: readonly { axisId; axisKey; label; value; scaleMax; comment }[]
  counts: { points; blockers; helpful; unhelpful; replies }
  sentimentScore: number | null; sentimentLabel: SentimentLabel | null
  specificity: number; isQualified: boolean
  inboxState: 'new' | 'read' | 'triaged' | 'actioned' | 'archived'
  creatorMarkedHelpful: boolean
  responseState: 'unanswered' | 'replied' | 'resolved'
  firstReplyAt: Millis | null; submittedAt: Millis | null
  viewer: { isReviewer: boolean; isCreator: boolean; vote: -1 | 0 | 1 }
}

interface FeedbackPointView {
  id; ordinal; bodyMd
  severity: SeverityKey; severityCode: string | null; severityLabel: string
  actionability: ActionabilityKey; actionabilityCode: string; actionabilityLabel: string
  kind: ItemKind; sentiment: -1 | 0 | 1
  categoryId; categoryKey; categoryLabel
  anchor: { kind: AnchorKind; value: string; timecodeMs: number | null } | null
  reproSteps: string | null
  upvoteCount: number; isResolved: boolean
  attachments: readonly FeedbackAttachmentRow[]
  themes: readonly { id: string; label: string }[]
  askId: string | null; viewerUpvoted: boolean; createdAt: Millis
}
```

### `getCreatorInbox(projectId): CreatorInbox | undefined`

The dashboard rollup, grouped by theme, in three constant queries: the themes with their severity split, the project totals, and ask coverage. Never one query per theme.

```ts
interface CreatorInbox {
  projectId; projectSlug; projectTitle
  themes: readonly ThemeRollupRow[]
  unthemed: number                       // the tail must not be invisible
  totals: {
    reviews; points; reviewers; unread; unanswered; blockers
    bySeverity: Record<SeverityKey, number>
    byState: Record<InboxState, number>
  }
  coverage: readonly { askId: string; prompt: string; answerCount: number }[]
}

interface ThemeRollupRow {
  id; label; summaryMd; source: 'auto' | 'manual' | 'confirmed'
  categoryId; categoryLabel
  pointCount: number
  reviewerCount: number        // DISTINCT reviewers, never item count
  severityScore: number; sentimentScore: number | null
  bySeverity: Record<SeverityKey, number>
  contested: boolean           // sentiment split above σ; render it as disagreement
  expertCount: number
  firstSeenAt; lastSeenAt; openCount; resolvedCount
}
```

**`reviewerCount` is distinct reviewers.** "Six reviewers agree" and "one person said it six times" must never render the same way. **`contested` is a design decision surfaced**, not noise to average: when it is true, show the split, not a mean.

### The rest of `feedback.ts`

| Function | Returns | Notes |
|---|---|---|
| `getFeedback(feedbackId, viewerId?)` | `FeedbackView \| undefined` | |
| `listReviewsByUser(userId, { viewerId?, limit?, cursor? })` | `Page<FeedbackView>` | public reviews only |
| `listInboxFeedback(userId, filters: InboxFilters)` | `Page<FeedbackView>` | across every project the user owns. Filters: `projectId`, `state`, `severity`, `unansweredOnly`, `expertsOnly`, `sort` (default `most_severe`) |
| `getInboxCounts(userId, projectId?)` | `InboxCounts` | `{ total, byState, unanswered, blockers, fromExperts }`, one grouped query |
| `listPointsInTheme(themeId, viewerId?)` | `readonly FeedbackPointView[]` | worst severity first, then corroboration |
| `setInboxState(feedbackId, state)` | `void` | |
| `markHelpful(feedbackId, helpful)` | `void` | worth less the more freely a creator gives it, and worth zero on a bounty-paid review |
| `voteFeedback(feedbackId, voterId, -1 \| 0 \| 1)` | `void` | `0` clears the vote |
| `votePoint(pointId, voterId, on)` | `number` (new count) | "I hit this too" |
| `setPointResolved(pointId, resolved)` | `void` | |
| `createReply(input: NewReplyInput)` | `string` (id) | writes `first_reply_at` once, refreshes the project reply rate, notifies the other party, credits the creator's ledger |
| `listReplies(feedbackId)` | `readonly FeedbackReplyView[]` | already nested one level deep |
| `getDraft(projectId, reviewerId)` | `FeedbackRow \| undefined` | one open draft per build |
| `listMyDrafts(reviewerId)` | `readonly Row[]` | `{ id, project_id, updated_at, slug, title }` |
| `withdrawFeedback(feedbackId, reviewerId)` | `boolean` | |
| `compareBySeverity(a, b)` | `number` | sort comparator for a list you already hold |
| `recomputeThemeScores(projectId)` | `void` | blockers dominate, corroboration multiplies |

---

## 4. `src/server/repos/reputation.ts`

### `computeReputation(userId, opts?): ReputationComputation`

design/TAXONOMY.md §3, term by term, in TypeScript so the profile can show the working.

```ts
interface ComputeOptions { at?: Millis; fresh?: boolean }   // `fresh` skips the 30s memo
```

Per review `r`:

```
v_r = S_r·( 1.0·κ(c)·ρ(u,c)·h_r + 1.8·κ(c)·a_r + 0.8·û_r ) − 0.6·d_r − 4.0·m_r,  clamped ±4
```

* `S_r` — specificity, stored on the row at write time. Every positive term multiplies by it, so unstructured praise earns approximately nothing however warmly it is received.
* `h_r` — the creator's helpful mark. **Zeroed on a bounty-paid review**: money cannot buy the mark.
* `a_r` — adoption: `shipped` 1.0, `planned` or `in_progress` 0.5, decaying to 0.25 after 120 days.
* `û_r = log1p(max(u_r,0)) / log1p(25)` where votes are weighted by voter credibility, `min(C/500, 1.5)` each.
* `κ(c) = 0.4 + 0.6·(1 − |2p_helpful − 1|)` with a Beta(2,2) prior. A creator who marks everything helpful has their signal cut to 40% of face value.
* `ρ(u,c) = 1 / (1 + 2·min(x_u→c, x_c→u))` over 180 days. One-way admiration is untouched; mutual back-scratching collapses after two or three exchanges.
* `d_r` — the schema has no "not applicable" column, so this reads as a review the creator archived without replying and without marking helpful.
* `m_r` — a live moderation action against the review: 0.5 for warn/hide/unlist, 1.0 for remove/ban/suspend/penalty.

Then per domain, with a nine-month half-life:

```
n_d = Σ w_time·ω_d      E_d = Σ w_time·ω_d·v_r      q̄_d = E_d / (n_d + 8)
V_d = n_d / (n_d + 20)  C_d = 1000·clamp01(0.65·norm(q̄_d) + 0.35·V_d)
C   = Σ n_d·C_d / Σ n_d
```

`ω_d` is 1.0. The document's 0.7 / 0.3 cross-tag weights need a project to declare a second type and the schema gives it exactly one.

```ts
interface ReputationComputation {
  userId; computedAt
  score: number            // 0–1000
  displayScore: number     // max(score, 0.5·peak·exp(−ln2·months/24)) — a sabbatical does not erase expertise
  peakScore: number; monthsSincePeak: number | null
  tier: ReputationTierKey; tierLabel: string; level: number
  domains: readonly DomainCredibility[]      // sorted, highest first
  totals: { reviews; helpful; adopted; shipped; peerVotes; strikes;
            helpfulRate; adoptionRate; distinctCreators; creatorConcentration }
}

interface DomainCredibility {
  domain: ProjectTypeSlug; label: string
  effectiveReviews: number; reviewCount: number; evidence: number
  meanValue: number; volumeTerm: number
  score: number; tier: ReputationTierKey; isExpert: boolean
}
```

**Render the per-domain bars, not only the headline.** Expertise is per domain by design; a single number is the thing this system exists to avoid.

### The rest of `reputation.ts`

| Function | Returns | Notes |
|---|---|---|
| `perReviewValues(userId, at?)` | `readonly ReviewValueBreakdown[]` | one row per review with `specificity`, `helpful`, `adoption`, `peerVotes`, `kappa`, `rho`, `timeWeight`, `value`. This is what `/u/[handle]/reputation` renders so the score is legible rather than a black box |
| `computeCreatorStanding(userId)` | `CreatorStanding` | `{ score, replyRate, triageRate, shipRate, reviewsReceived, medianResponseMs }`. Creators have reputation too, and it is made of what reviewers care about |
| `getReputation(userId)` | `ReputationScoreRow \| undefined` | the stored rollup every card and leaderboard reads |
| `persistReputation(userId, at?)` | `ReputationScoreRow` | recomputes from evidence and writes the rollup. Safe on a cadence, on demand, or after a weighting change |
| `domainsForUser(userId)` | `readonly DomainCredibility[]` | the bars alone |
| `checkExpertGates(userId, domain, at?)` | `ExpertGateStatus` | every numeric gate with its requirement and its actual value. The human-confirmation gate is deliberately not modelled: no formula should own it |
| `recordReputationEvent(input)` | `string \| null` | append-only ledger, idempotent on `(user, kind, subject)`. `null` when it already existed |
| `listReputationEvents(userId, opts?)` | `Page<ReputationLedgerEntry>` | answers "why did I lose 40 points?" |
| `repBearingReviewsToday(userId, at?)` | `number` | |
| `isRepBearing(userId, at?)` | `boolean` | past six qualified reviews a day a review still posts and still shows in the thread, it just earns nothing |
| `reviewStreakDays(userId, at?)` | `number` | |
| `listLeaderboard({ facet?, limit?, cursor? })` | `Page<LeaderboardEntry>` | facet is `reviewer` (default), `creator`, `community` or `expert` |
| `invalidateReputation(userId)` | `void` | drops the 30-second memo |

---

## 5. `src/server/repos/search.ts`

| Function | Returns |
|---|---|
| `searchProjects(query, opts?: SearchProjectsOptions)` | `Page<ProjectSearchHit>` |
| `search(query, { scope?, limit?, cursor?, viewerId? })` | `SearchResults` |
| `suggestProjects(query, limit?)` | `readonly { id, slug, title }[]` |

Runs against the `projects_fts` external-content FTS5 table the schema already maintains with triggers. Ranking is `bm25(projects_fts, 8, 4, 1)`: a title hit is worth eight times a summary hit.

User text never reaches `MATCH` raw. Every token is quoted and the last gets a prefix `*`, so an unbalanced quote cannot become a syntax error and typing builds a live query. A query that tokenises to nothing returns an empty page rather than throwing.

```ts
interface ProjectSearchHit {
  project: ProjectCard              // the same card Discover renders
  score: number                     // negated bm25: higher is a better match
  matchedIn: 'title' | 'tagline' | 'summary'
  snippet: string                   // matched terms wrapped in <mark>
}

interface SearchResults {
  query: string; scope: 'all' | 'projects' | 'discussions' | 'experts'
  projects: Page<ProjectSearchHit>
  discussions: Page<ThreadCard>
  experts: Page<ExpertCard>
  total: number
}
```

The snippet contains `<mark>` tags. Sanitise before rendering, or render the plain text and highlight client-side.

---

## 6. `src/server/repos/suggestions.ts`

| Function | Returns | Notes |
|---|---|---|
| `listSuggestions(filters: SuggestionFilters)` | `Page<SuggestionView>` | by `projectId` or by `ownerId`; `status`, `themeId`; `sort` is `top` (default), `newest` or `recently_moved` |
| `listPublicSuggestions({ projectId, ... })` | `Page<SuggestionView>` | the public roadmap board |
| `getSuggestion(id, viewerId?)` | `SuggestionView \| undefined` | |
| `getSuggestionCounts({ projectId?, ownerId? })` | `SuggestionCounts` | `{ total, byStatus }` for the board columns |
| `listSuggestionTimeline(id)` | `readonly SuggestionTimelineEntry[]` | immutable history, newest first |
| `createSuggestion(input: NewSuggestionInput)` | `string` (id) | `sourcePointIds` is the evidence link that lets the product tell a reviewer their March note shipped in v0.5 |
| `linkSources(id, pointIds, linkedBy)` | `void` | |
| `setSuggestionStatus(input: StatusChangeInput)` | `SuggestionRow` | see below |
| `voteSuggestion(id, voterId, on)` | `number` (new count) | |
| `setSuggestionEffort(id, effort)` | `void` | |
| `statusLabel(status)` | `string` | |

`setSuggestionStatus` throws `SuggestionStatusError` — which carries `field: 'note' | 'version' | 'duplicate'` — when the product rules are not met:

* `declined` or `wont_fix` with no note. Declining owes the reviewer a reason.
* `shipped` with neither a version nor a note. Shipping has to link something, or follow-through is claimable rather than auditable.
* `duplicate` with no `duplicateOf`.

On success it writes, in one transaction: the row, the immutable `suggestion_events` entry, a notification to every contributing reviewer, and on `shipped` a reputation credit to each of them.

```ts
interface SuggestionView {
  id; projectId; projectSlug; projectTitle
  title; bodyMd
  status: SuggestionStatus; statusLabel: string; statusNote: string | null
  priority: 'low' | 'normal' | 'high' | 'critical'
  effort: EffortKey | null; effortCode: string | null; effortLabel: string | null
  quadrant: 'quick_win' | 'big_rock' | 'cheap_polish' | 'backlog'
  themeId; themeLabel; categoryLabel
  voteCount; sourceCount
  contributors: readonly UserCard[]     // the reviewers whose notes fed it
  shippedInVersion: string | null; shippedAt; statusChangedAt; createdAt
  viewerVoted: boolean
}
```

---

## 7. `src/server/repos/users.ts` and `profiles.ts`

### users.ts

| Function | Returns |
|---|---|
| `getUserById(id)` / `getUserByHandle(handle)` / `getUserByEmail(email)` | `UserRow \| undefined` (the email read includes the password hash: sign-in only) |
| `getViewer(userId \| null)` | `Viewer \| null` — `null` for a suspended, banned or deleted account, so a revoked user cannot keep acting on a live cookie |
| `handleIsTaken(handle, exceptUserId?)` / `emailIsTaken(email)` | `boolean` |
| `createUser(input: NewUserInput)` | `UserRow` — one transaction creating the user, profile, settings and reputation rows |
| `touchLastSeen` · `setPasswordHash` · `markEmailVerified` · `setHandle` · `setExpertFlag` | `void` |
| `createSession(input)` · `getLiveSession(id)` · `touchSession(id)` · `revokeSession(id)` | session records behind the stateless cookie |
| `revokeAllSessions(userId, exceptSessionId?)` | `number` — how many devices were signed out, so the UI can state the real number before submit |
| `listSessions(userId, currentSessionId?)` | `readonly SessionView[]` |
| `createAuthToken(input)` · `getAuthTokenState(tokenHash)` · `consumeAuthToken(tokenHash)` | single-use secrets. `getAuthTokenState` returns `'valid' \| 'expired' \| 'consumed' \| 'unknown'` so an expired link never renders a form the user fills out for nothing |
| `normalizeEmail(email)` / `normalizeHandle(handle)` | `string` |

### profiles.ts

| Function | Returns |
|---|---|
| `getProfileByHandle(handle, viewerId?)` | `ProfileView \| undefined` — the whole public profile in four queries |
| `getUserCard(userId)` | `UserCard \| undefined` |
| `getUserCards(userIds)` | `Map<string, UserCard>` — many in one query |
| `getProfileRow` / `getUserSettings` | raw rows |
| `updateProfile(userId, patch)` · `updateSettings(userId, patch)` · `replaceProfileLinks(userId, links)` | `void` |
| `isFollowing(a, b)` · `followUser` · `unfollowUser` | `boolean` — the state after the call, which is what a toggle needs |
| `listFollowers(userId, opts?)` / `listFollowing(userId, opts?)` | `Page<UserCard>` |
| `blockUser` · `unblockUser` | `void` |
| `blockedIdsFor(viewerId)` | `readonly string[]` — both directions |
| `getExpertByHandle(handle)` | `ExpertCard \| undefined` |
| `listExperts(filters: ExpertFilters, opts?)` | `Page<ExpertCard>` — filters on expertise slug, minimum rating, budget, turnaround, name |
| `upsertExpertProfile(userId, patch)` | `void` — the schema refuses a listed but unverified expert; the patch enforces it |
| `getFeaturedExperts(limit?)` | `readonly ExpertCard[]` — listed experts with delivered work behind them |
| `tierLabelFor(score)` | `string` |

`UserCard` is the identity chip beside every review, post and project: `{ id, handle, displayName, avatarUrl, isExpert, primaryRole, score, tier, tierLabel }`.

---

## 8. `src/server/repos/notifications.ts`

| Function | Returns | Notes |
|---|---|---|
| `notify(input: NotifyInput)` | `string \| null` | `null` when the recipient turned this kind off in-app. `groupKey` collapses "12 people voted" into one freshly dated row. Plain statements only, so it composes inside a caller's transaction |
| `notifyMany(userIds, input)` | `number` | skips the actor |
| `listNotifications(userId, { filter?, limit?, cursor? })` | `Page<NotificationView>` | filter is `'all'`, `'unread'`, or a `NotificationKind` |
| `getUnreadCount(userId)` | `number` | the bell badge |
| `markRead(id, userId)` / `markAllRead(userId)` | `boolean` / `number` | scoped by user id as well as row id |
| `getNotification(id, userId)` | `NotificationRow \| undefined` | |
| `getNotificationPrefs(userId, kinds)` | `readonly NotificationPreference[]` | defaults live in code; `isDefault` says whether the row is stored |
| `setNotificationPref(userId, kind, patch)` | `void` | |
| `listPendingEmails(limit?)` / `markEmailed(id, at?)` | the email worker's queue | |

---

## 9. `src/server/repos/discussions.ts`

Threads have no slug column, so they are addressed by id. The channel has a slug and that is the URL segment above the thread.

| Function | Returns |
|---|---|
| `listChannels()` / `getChannel(slug)` | `readonly DiscussionChannelRow[]` / `DiscussionChannelRow \| undefined` |
| `listDiscussions(filters: ThreadFilters)` | `Page<ThreadCard>` — `channelSlug`, `projectId`, `kind`, `query`; `sort` is `hot` (default), `newest`, `unanswered` or `top` |
| `getDiscussion(threadId, viewerId?)` | `ThreadDetail \| undefined` — the thread and its whole reply tree, in two queries |
| `listPosts(threadId, viewerId, sort?)` | `readonly DiscussionPostView[]` — already nested, accepted answer first |
| `createThread(input)` / `createPost(input)` | `string` (id) — the author is subscribed explicitly, so muting works |
| `votePost(postId, voterId, -1 \| 0 \| 1)` | `number` (new score) |
| `acceptAnswer(threadId, postId, actorId)` | `boolean` — only on a question, only by its author |
| `setSubscription(threadId, userId, state)` | `void` |
| `incrementThreadViews(threadId)` | `void` |
| `recomputeThreadHotScores(at?)` | `void` |

A reply deeper than the schema's four levels flattens onto the last level rather than being refused: losing a reply is worse than nesting it one step shallower than the person intended.

---

## 10. `src/server/repos/bounties.ts`

`bounties.status` is the work's state machine; `escrow_state` is the money's. They are separate because funded work can still be cancelled and delivered work can still be unpaid.

| Function | Returns | Notes |
|---|---|---|
| `listBounties(filters: BountyFilters)` | `Page<BountyView>` | open and public by default; `expertiseSlug`, `minAmountCents`, `status`, `projectId`, `createdBy` |
| `getBounty(id, viewerId?)` | `BountyView \| undefined` | `viewerCanApply` already accounts for ownership, status, seats and a prior application |
| `listMyBounties(userId, { status? })` | `Page<BountyView>` | |
| `listApplications(bountyId)` | `readonly BountyApplicationView[]` | |
| `applyToBounty(input)` | `string` (id) | re-applying updates the pitch rather than erroring |
| `createBounty(input)` | `string` (id) | created unfunded and in draft; the schema refuses to advertise unfunded work |
| `recordEscrowEvent(input)` | `boolean` | appends the ledger row and advances the cached state in one transaction. `false` when `idempotencyKey` already moved this money, so a retried webhook is a no-op |
| `openBounty(id)` | `void` | only from `authorized` or `held` |
| `awardBounty({ bountyId, expertId, applicationId?, actorId })` | `string` (award id) | |
| `deliverBounty(awardId, feedbackId)` | `void` | the schema refuses "delivered" with nothing to read |
| `acceptDelivery({ awardId, actorId, rating?, review? })` | `void` | acceptance is what schedules payment, and the schema enforces that ordering |
| `listRequests(userId, { role?, status?, limit?, cursor? })` | `Page<RequestView>` | `role: 'expert'` is work you took, `'creator'` is work you bought |
| `getEarningsLedger(userId, { rangeDays?, ... })` | `EarningsLedger` | every figure summed from award rows; nothing modelled or averaged |
| `listEscrowEvents(bountyId)` | `readonly Row[]` | |
| `getBountyFeeSchedule()` | `FeeSchedule` | real arithmetic on real example amounts, for the pricing page |
| `feeFor(amountCents, bps)` | `number` | |

---

## 11. `src/server/repos/ratings.ts`, `tags.ts`, `stats.ts`

### ratings.ts

| Function | Returns |
|---|---|
| `axisAggregatesForProject(projectId, projectTypeId)` | `readonly AxisAggregate[]` — every axis of the type, including ones nobody rated |
| `typeMeans(projectTypeId)` | `Map<axisId, number>` — the shrinkage prior |
| `axisTrendByVersion(projectId, projectTypeId)` | `readonly AxisTrend[]` — how each axis moved build over build |
| `listRatingsForFeedback(feedbackId)` | `readonly FeedbackRatingRow[]` |
| `recomputeProjectRating(projectId, at?)` | `void` — rewrites the denormalised headline, weighted by each axis's `weight` |

An axis nobody rated is information; it stays in the list. "Not enough exposure to rate" is the absence of a row and is never counted as a 3.

### tags.ts

| Function | Returns |
|---|---|
| `listProjectTypes()` / `getProjectType(idOrSlug)` | taxonomy rows from the database |
| `listStages(typeId)` / `listCategories(typeId)` / `listAxes(typeId)` | `readonly …Row[]` |
| `listNeedKinds()` / `listExpertiseAreas()` | `readonly …Row[]` |
| `getComposerVocabulary(projectTypeId)` | `ComposerVocabulary \| undefined` — axes with their written anchors, categories, prompts, `requiredAnchor` and the grit stages, in one call. Falls back to the code taxonomy if a type was seeded thin, because a composer with no categories is a dead end |
| `getTagBySlug(slug)` / `listTags({ kind?, limit? })` / `getTagsByIds(ids)` | tag rows |
| `trendingTags(limit?, viewerId?)` | `readonly TagView[]` — usage count only, no invented velocity |
| `getRelatedTags(tagSlugs, limit?)` | `readonly TagRow[]` — co-occurrence |
| `searchTags(query, limit?)` | `readonly TagRow[]` |
| `ensureTags(labels, kind?)` | `readonly string[]` (ids), creating what does not exist |
| `followTag` / `unfollowTag` / `listFollowedTags` | the interest graph that makes a new reviewer's feed useful before they follow anyone |
| `recountTagUsage()` | `void` — reconciles the denormalised counter |

### stats.ts

| Function | Returns | Notes |
|---|---|---|
| `getLandingStats()` | `LandingStats` | `{ projectsSharpened, reviewsWritten, suggestionsShipped, medianTimeToFirstFeedbackMs, computedAt }`. Median, not mean. `medianTimeToFirstFeedbackMs` is `null` when no project has had a first review; hide the strip rather than render a zero |
| `getDashboardSummary(userId)` | `DashboardSummary` | the whole header in three queries |
| `getRecentActivity(userId, { limit? })` | `readonly ActivityEntry[]` | one UNION over the four tables that produce activity, ordered once |
| `getProjectAnalytics(projectId, { range? })` | `ProjectAnalytics \| undefined` | `range` is `'7d' \| '30d' \| '90d' \| 'all'`. Severity split, category split with sentiment, per-version counts and rating, per-axis trend, and a daily timeline |
| `severityBreakdown(projectId)` | `Record<SeverityKey, number>` | |

Every figure on this surface is computed from real rows. Where there is nothing to report these functions return `null` and the UI says so in words.

---

## 12. `src/server/repos/_shared.ts`

Plumbing, exported because a surface occasionally needs it.

`encodeCursor` / `decodeCursor` · `toPage` · `pageLimit` · `placeholders` · `clamp01` / `clampNum` · `excerpt(body, max?)` · `toFtsQuery(raw)` · `emptySeverityCounts()` / `isSeverityKey` / `addSeverity` · `mapUserCard` / `mapUserCardOrNull` / `userCardSelect` / `userCardJoin` · the row accessors `str`, `strOrNull`, `num`, `numOrNull`, `bool`, `jsonArray`, `jsonObject`, `jsonStringMap` · `DAY_MS`, `HOUR_MS`, `DEFAULT_LIMIT`, `MAX_LIMIT`.

---

## 13. Known gaps, stated rather than hidden

| Gap | Why | What happens instead |
|---|---|---|
| `Reach` (everyone / most / some / just-me) | No column in the schema | Priority is severity against effort; corroboration comes from `upvote_count` |
| ε-exploration in the feed | A random term makes a server-rendered page disagree with its own next cursor | The reserved needs-eyes slots carry the whole cold-start guarantee |
| Shown-and-skipped Fit damper | No impressions table | Absent rather than faked |
| Impression cap per project per day | Same | Same |
| `ω_d` cross-tag attribution (0.7 / 0.3) | A project declares exactly one type | The primary weight 1.0 is the only one live |
| `d_r`, creator "not applicable" | No column | Read as a review archived with no reply and no helpful mark |
| Reviews-wanted target for the Need term | No column | `feedback_state` leaving `open` is the signal that the creator got what they came for |
| Thread tags | No `thread_tags` table | Discussions filter by channel, kind and project |
| Theme clustering itself | Belongs to the AI layer | The repositories read, score and roll up `feedback_themes`; `recomputeThemeScores` maintains the severity rollup |

---

## 14. Verification performed

* **Types.** All 16 files type-check clean under the project's own `strict` + `noUncheckedIndexedAccess` settings, checked through the compiler API with `noEmit` so nothing raced on `.next/`.
* **SQL.** Every statement in this layer was executed against a real SQLite database built from `src/server/db/schema.sql`: taxonomy seeded from `taxonomy.ts`, three users, four projects, two reviews, a shipped suggestion, a discussion thread with an accepted answer, and a funded bounty through award.
* **Behaviour confirmed by that run:** `createFeedback` wrote the container, three points, four ratings, the ask counter, the ledger entry and the creator notification in one transaction (`S = 0.543`, qualified, one blocker); the dwell floor capped a 20-second drive-by review; `getCreatorInbox` returned totals and ask coverage in three queries; `computeReputation` produced a per-domain score with `κ`, `ρ` and time decay separable per review; the feed's two pages had zero overlap and the author-diversity penalty fired on the second row by the same creator; escrow idempotency turned a repeated webhook into a no-op; `PRAGMA foreign_key_check` came back clean.
* **Portability.** No TypeScript parameter properties, enums or namespaces anywhere in this layer, so every file loads under `node --experimental-strip-types` — which is how `npm run db:seed` runs.

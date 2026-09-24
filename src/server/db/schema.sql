-- ============================================================================
-- Whetstone — relational schema
-- ============================================================================
-- Conventions (hold everywhere, no exceptions):
--   * ids            TEXT, uuidv4/uuidv7 generated in the app layer.
--   * timestamps     INTEGER, unix epoch MILLISECONDS. Never TEXT dates.
--   * booleans       INTEGER 0/1 with an explicit CHECK.
--   * enums          TEXT + CHECK (...) — readable in a shell, portable to a
--                    Postgres CHECK or native enum without data migration.
--   * money          INTEGER minor units (cents) + ISO-4217 currency. No floats.
--   * soft delete    deleted_at INTEGER NULL on user-visible content only.
--   * STRICT         every table is STRICT so SQLite refuses type-confused writes
--                    the way Postgres would. `sed 's/ STRICT//'` to port.
--
-- This file is executed with exec() on every boot (see client.ts), so every
-- statement is IF NOT EXISTS and the file contains no transaction control.
--
-- Postgres port checklist:
--   1. strip ` STRICT`
--   2. DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
--      -> DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint
--   3. INTEGER -> BIGINT for timestamps/counters, TEXT stays TEXT
--   4. drop the FTS5 section at the bottom, replace with tsvector + GIN
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. META
-- ---------------------------------------------------------------------------

-- Single-row-per-key store for the migration pointer and cheap global flags, so
-- a deploy can tell whether the file it just exec'd is newer than the database.
CREATE TABLE IF NOT EXISTS schema_meta (
  meta_key    TEXT PRIMARY KEY,
  meta_value  TEXT NOT NULL,
  updated_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;

INSERT INTO schema_meta (meta_key, meta_value)
VALUES ('schema_version', '1')
ON CONFLICT (meta_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1. IDENTITY & ACCESS
-- ---------------------------------------------------------------------------

-- The account. Deliberately thin: credentials, role, lifecycle. Everything a
-- visitor sees lives in `profiles`, so a public page never selects a password
-- hash by accident and profile churn never touches the auth hot path.
CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY,
  email              TEXT NOT NULL,
  email_normalized   TEXT NOT NULL,              -- lower(trim(email)), the uniqueness key
  email_verified_at  INTEGER,
  password_hash      TEXT,                       -- NULL for OAuth-only accounts
  handle             TEXT NOT NULL,              -- @handle, immutable-ish, used in URLs
  handle_normalized  TEXT NOT NULL,
  role               TEXT NOT NULL DEFAULT 'member'
                       CHECK (role IN ('member', 'moderator', 'admin')),
  status             TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'suspended', 'banned', 'deactivated')),
  is_expert          INTEGER NOT NULL DEFAULT 0 CHECK (is_expert IN (0, 1)),
  last_seen_at       INTEGER,
  created_at         INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at         INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  deleted_at         INTEGER,
  -- A suspension without a moderation record is how abuse investigations get lost.
  CHECK (status <> 'banned' OR deleted_at IS NULL)
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email  ON users (email_normalized);
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_handle ON users (handle_normalized);
CREATE INDEX IF NOT EXISTS ix_users_expert ON users (is_expert, last_seen_at DESC)
  WHERE is_expert = 1 AND status = 'active';

-- Everything rendered on a public profile. 1:1 with users but split so it can be
-- cached, denormalized, and served without touching the credentials row.
CREATE TABLE IF NOT EXISTS profiles (
  user_id        TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  display_name   TEXT NOT NULL,
  avatar_url     TEXT,
  banner_url     TEXT,
  bio            TEXT,
  location       TEXT,
  pronouns       TEXT,
  timezone       TEXT,                            -- IANA name, for scheduling test rounds
  primary_role   TEXT CHECK (primary_role IN
                   ('indie_dev', 'game_dev', 'founder', 'designer',
                    'video_creator', 'reviewer', 'other')),
  availability   TEXT NOT NULL DEFAULT 'open'
                   CHECK (availability IN ('open', 'limited', 'closed')),
  is_searchable  INTEGER NOT NULL DEFAULT 1 CHECK (is_searchable IN (0, 1)),
  created_at     INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at     INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;

-- Arbitrary many external links (site, GitHub, Steam, itch, YouTube) without a
-- column-per-platform migration every time a new platform matters.
CREATE TABLE IF NOT EXISTS profile_links (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  url         TEXT NOT NULL,
  platform    TEXT CHECK (platform IN
                ('website', 'github', 'gitlab', 'steam', 'itch', 'appstore',
                 'playstore', 'youtube', 'twitch', 'x', 'bluesky', 'mastodon',
                 'linkedin', 'discord', 'other')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;

CREATE INDEX IF NOT EXISTS ix_profile_links_user ON profile_links (user_id, sort_order);

-- Per-user preferences that are nobody else's business (theme, locale, digest
-- cadence). Separate from profiles so a public profile query never reads them.
CREATE TABLE IF NOT EXISTS user_settings (
  user_id             TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  theme               TEXT NOT NULL DEFAULT 'system'
                        CHECK (theme IN ('system', 'dark', 'light')),
  locale              TEXT NOT NULL DEFAULT 'en',
  reduced_motion      INTEGER NOT NULL DEFAULT 0 CHECK (reduced_motion IN (0, 1)),
  email_digest        TEXT NOT NULL DEFAULT 'weekly'
                        CHECK (email_digest IN ('off', 'daily', 'weekly')),
  show_nsfw           INTEGER NOT NULL DEFAULT 0 CHECK (show_nsfw IN (0, 1)),
  dm_policy           TEXT NOT NULL DEFAULT 'followers'
                        CHECK (dm_policy IN ('everyone', 'followers', 'nobody')),
  updated_at          INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;

-- Server-side session records. The cookie is a stateless JWT, but a JWT alone
-- cannot be revoked; this table is what makes "sign out all devices", the active
-- device list, and post-breach invalidation possible. Auth checks the jti here.
CREATE TABLE IF NOT EXISTS auth_sessions (
  id             TEXT PRIMARY KEY,               -- = the JWT jti
  user_id        TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash     TEXT NOT NULL,                  -- sha256 of the cookie value, never the value
  user_agent     TEXT,
  ip_hash        TEXT,                           -- hashed: useful for anomaly checks, not PII-at-rest
  created_at     INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  last_used_at   INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  expires_at     INTEGER NOT NULL,
  revoked_at     INTEGER,
  CHECK (expires_at > created_at)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_auth_sessions_user ON auth_sessions (user_id, last_used_at DESC);
CREATE INDEX IF NOT EXISTS ix_auth_sessions_gc   ON auth_sessions (expires_at) WHERE revoked_at IS NULL;

-- One table for every single-use secret (email verification, password reset,
-- magic link, email change). Same shape, same expiry sweep, one code path.
CREATE TABLE IF NOT EXISTS auth_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  purpose     TEXT NOT NULL CHECK (purpose IN
                ('email_verify', 'password_reset', 'magic_link', 'email_change')),
  token_hash  TEXT NOT NULL,
  payload     TEXT,                              -- JSON, e.g. the requested new email
  created_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  expires_at  INTEGER NOT NULL,
  consumed_at INTEGER,
  CHECK (expires_at > created_at)
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_auth_tokens_hash ON auth_tokens (token_hash);
CREATE INDEX IF NOT EXISTS ix_auth_tokens_user ON auth_tokens (user_id, purpose)
  WHERE consumed_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. REPUTATION & BADGES
-- ---------------------------------------------------------------------------

-- Append-only ledger of everything that ever moved reputation. Reputation must
-- be auditable ("why did I lose 40 points?") and recomputable from zero after a
-- weighting change, which a single mutable integer can never support.
CREATE TABLE IF NOT EXISTS reputation_events (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  facet         TEXT NOT NULL CHECK (facet IN
                  ('reviewer', 'creator', 'community', 'expert')),
  kind          TEXT NOT NULL CHECK (kind IN
                  ('feedback_submitted', 'feedback_marked_helpful', 'feedback_upvoted',
                   'feedback_applied', 'suggestion_shipped', 'bounty_completed',
                   'test_round_completed', 'discussion_upvoted', 'accepted_answer',
                   'project_published', 'creator_replied', 'streak_bonus',
                   'report_upheld', 'moderation_penalty', 'manual_adjustment')),
  delta         INTEGER NOT NULL,                -- signed points; 0 is never a valid event
  weight        REAL NOT NULL DEFAULT 1.0,       -- decays with age at read time
  subject_type  TEXT CHECK (subject_type IN
                  ('feedback', 'suggestion', 'project', 'bounty',
                   'discussion_post', 'test_round', 'user')),
  subject_id    TEXT,                            -- intentionally un-FK'd: see note below
  actor_id      TEXT REFERENCES users (id) ON DELETE SET NULL,
  note          TEXT,
  created_at    INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  CHECK (delta <> 0)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_rep_events_user  ON reputation_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_rep_events_facet ON reputation_events (user_id, facet, created_at DESC);
-- Idempotency: one event per (user, kind, subject). Replaying a webhook or a
-- backfill cannot double-credit.
CREATE UNIQUE INDEX IF NOT EXISTS ux_rep_events_dedup
  ON reputation_events (user_id, kind, subject_type, subject_id)
  WHERE subject_id IS NOT NULL;

-- Materialized rollup of the ledger. Every profile card, leaderboard, expert
-- listing and feed-ranking term reads this; recomputing a sum over the ledger on
-- each read would not survive the first popular reviewer.
CREATE TABLE IF NOT EXISTS reputation_scores (
  user_id             TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  reviewer_score      INTEGER NOT NULL DEFAULT 0,
  creator_score       INTEGER NOT NULL DEFAULT 0,
  community_score     INTEGER NOT NULL DEFAULT 0,
  expert_score        INTEGER NOT NULL DEFAULT 0,
  total_score         INTEGER NOT NULL DEFAULT 0,
  level               INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 10),
  -- Quality ratios, denormalized for the reviewer leaderboard and expert search.
  feedback_count      INTEGER NOT NULL DEFAULT 0,
  helpful_count       INTEGER NOT NULL DEFAULT 0,
  applied_count       INTEGER NOT NULL DEFAULT 0,
  helpful_rate        REAL NOT NULL DEFAULT 0.0 CHECK (helpful_rate BETWEEN 0.0 AND 1.0),
  response_rate       REAL NOT NULL DEFAULT 0.0 CHECK (response_rate BETWEEN 0.0 AND 1.0),
  median_response_ms  INTEGER,
  streak_days         INTEGER NOT NULL DEFAULT 0,
  computed_at         INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;

CREATE INDEX IF NOT EXISTS ix_rep_scores_reviewer ON reputation_scores (reviewer_score DESC);
CREATE INDEX IF NOT EXISTS ix_rep_scores_total    ON reputation_scores (total_score DESC);

-- Badge definitions, editable without a deploy. Rows are referenced by slug in
-- copy and by id in grants.
CREATE TABLE IF NOT EXISTS badges (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL,
  description  TEXT NOT NULL,
  icon         TEXT,
  tier         TEXT NOT NULL DEFAULT 'bronze'
                 CHECK (tier IN ('bronze', 'silver', 'gold', 'special')),
  facet        TEXT CHECK (facet IN ('reviewer', 'creator', 'community', 'expert')),
  is_active    INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at   INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;

-- Grants. Separate from badges so a badge's copy can change without touching
-- millions of grant rows, and so revocation is a row update with a reason.
CREATE TABLE IF NOT EXISTS user_badges (
  user_id     TEXT NOT NULL REFERENCES users (id)  ON DELETE CASCADE,
  badge_id    TEXT NOT NULL REFERENCES badges (id) ON DELETE CASCADE,
  awarded_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  revoked_at  INTEGER,
  reason      TEXT,
  PRIMARY KEY (user_id, badge_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_user_badges_badge ON user_badges (badge_id) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. TAXONOMY
-- ---------------------------------------------------------------------------
-- The taxonomy tables are data, not code. A game and a landing page need
-- different feedback categories and different rating axes; hard-coding either
-- one means a deploy every time a new project type is supported.

-- Top-level kind of thing being shipped. Drives which categories, axes and
-- stages the composer and filters offer.
CREATE TABLE IF NOT EXISTS project_types (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,            -- 'game', 'web_app', 'mobile_app', 'video', ...
  label         TEXT NOT NULL,
  description   TEXT,
  icon          TEXT,
  embed_kind    TEXT NOT NULL DEFAULT 'none'
                  CHECK (embed_kind IN ('none', 'iframe', 'video', 'gallery', 'build_download')),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at    INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;

-- Stage vocabulary, per type: a game goes concept -> prototype -> alpha -> beta,
-- a video goes rough_cut -> fine_cut. `sort_order` is what the Discover stage
-- filter sorts by, so it must be data rather than a hard-coded array.
CREATE TABLE IF NOT EXISTS project_stages (
  id               TEXT PRIMARY KEY,
  project_type_id  TEXT NOT NULL REFERENCES project_types (id) ON DELETE CASCADE,
  stage_key        TEXT NOT NULL,
  label            TEXT NOT NULL,
  description      TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  UNIQUE (project_type_id, stage_key)
) STRICT;

-- The category vocabulary the structured composer is scoped by: for a game,
-- fun / balance / controls / onboarding / performance. `prompt` is the helper
-- text shown in the composer, `is_required` drives composer validation.
CREATE TABLE IF NOT EXISTS feedback_categories (
  id               TEXT NOT NULL,
  project_type_id  TEXT NOT NULL REFERENCES project_types (id) ON DELETE CASCADE,
  category_key     TEXT NOT NULL,
  label            TEXT NOT NULL,
  description      TEXT,
  prompt           TEXT,                          -- "What made you want to play one more round?"
  icon             TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_required      INTEGER NOT NULL DEFAULT 0 CHECK (is_required IN (0, 1)),
  is_active        INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  PRIMARY KEY (id),
  UNIQUE (project_type_id, category_key),
  -- Composite key exists solely as an FK target: it is what lets a feedback
  -- point prove, in the database, that its category belongs to its project's
  -- type. See feedback_points.
  UNIQUE (id, project_type_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_feedback_categories_type
  ON feedback_categories (project_type_id, sort_order) WHERE is_active = 1;

-- Numeric rating dimensions, also per type (a game rates Fun and Balance; a
-- landing page rates Clarity and Trust). `weight` feeds the composite score used
-- in feed ranking; `scale_max` lets an axis be 1-5 or 1-10 without a new table.
CREATE TABLE IF NOT EXISTS rating_axes (
  id               TEXT NOT NULL,
  project_type_id  TEXT NOT NULL REFERENCES project_types (id) ON DELETE CASCADE,
  axis_key         TEXT NOT NULL,
  label            TEXT NOT NULL,
  description      TEXT,
  low_label        TEXT,                          -- accessible endpoints for the slider
  high_label       TEXT,
  scale_max        INTEGER NOT NULL DEFAULT 5 CHECK (scale_max IN (5, 10)),
  weight           REAL NOT NULL DEFAULT 1.0 CHECK (weight >= 0.0),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_active        INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  PRIMARY KEY (id),
  UNIQUE (project_type_id, axis_key),
  UNIQUE (id, project_type_id)                    -- FK target, same reason as above
) STRICT;

CREATE INDEX IF NOT EXISTS ix_rating_axes_type
  ON rating_axes (project_type_id, sort_order) WHERE is_active = 1;

-- The "needs" filter vocabulary on Discover — what kind of help a creator is
-- asking for. Global rather than per-type: "needs playtesters" reads the same
-- everywhere, and a cross-type filter is the whole point of the facet.
CREATE TABLE IF NOT EXISTS need_kinds (
  need_key     TEXT PRIMARY KEY,                  -- 'playtesters', 'copy_review', 'pricing', ...
  label        TEXT NOT NULL,
  description  TEXT,
  icon         TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
) STRICT;

-- Free-ish tags (genre, tech, platform). `usage_count` is denormalized so the
-- tag picker and trending rail do not aggregate project_tags on every render.
CREATE TABLE IF NOT EXISTS tags (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'topic'
                 CHECK (kind IN ('topic', 'tech', 'genre', 'platform', 'audience')),
  usage_count  INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  is_blocked   INTEGER NOT NULL DEFAULT 0 CHECK (is_blocked IN (0, 1)),
  created_at   INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;

CREATE INDEX IF NOT EXISTS ix_tags_trending ON tags (usage_count DESC) WHERE is_blocked = 0;

-- Curated expertise vocabulary for the expert marketplace. Kept separate from
-- `tags` on purpose: matching a paid request to a verified expert must not be
-- steerable by user-created tags.
CREATE TABLE IF NOT EXISTS expertise_areas (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL,
  description  TEXT,
  parent_id    TEXT REFERENCES expertise_areas (id) ON DELETE SET NULL,
  is_active    INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
) STRICT;

CREATE INDEX IF NOT EXISTS ix_expertise_parent ON expertise_areas (parent_id);

-- ---------------------------------------------------------------------------
-- 4. PROJECTS
-- ---------------------------------------------------------------------------

-- The work in progress. Carries its own `hot_score` (rather than leaving it in
-- project_stats) because the feed's partial indexes have to live on this table
-- for the ranked scan to be index-only.
CREATE TABLE IF NOT EXISTS projects (
  id                 TEXT PRIMARY KEY,
  owner_id           TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  project_type_id    TEXT NOT NULL REFERENCES project_types (id) ON DELETE RESTRICT,
  slug               TEXT NOT NULL,
  title              TEXT NOT NULL,
  tagline            TEXT,
  summary_md         TEXT,
  stage_key          TEXT NOT NULL,
  visibility         TEXT NOT NULL DEFAULT 'private'
                       CHECK (visibility IN ('private', 'unlisted', 'public')),
  status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'published', 'paused', 'archived', 'removed')),
  feedback_state     TEXT NOT NULL DEFAULT 'open'
                       CHECK (feedback_state IN ('open', 'invite_only', 'closed')),
  feedback_closes_at INTEGER,
  is_nsfw            INTEGER NOT NULL DEFAULT 0 CHECK (is_nsfw IN (0, 1)),
  content_warnings   TEXT,                        -- JSON array of strings
  primary_media_id   TEXT,                        -- no FK: would be circular with project_media
  hot_score          REAL NOT NULL DEFAULT 0.0,
  published_at       INTEGER,
  created_at         INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at         INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  deleted_at         INTEGER,
  -- A project cannot be publicly listed without a publish timestamp; the feed
  -- sorts on it and a NULL would silently drop the row.
  CHECK (visibility <> 'public' OR published_at IS NOT NULL),
  CHECK (status <> 'published' OR published_at IS NOT NULL),
  CHECK (feedback_closes_at IS NULL OR feedback_closes_at > created_at),
  -- Stage must belong to this project's type.
  FOREIGN KEY (project_type_id, stage_key)
    REFERENCES project_stages (project_type_id, stage_key) ON DELETE RESTRICT,
  -- FK target for every child that needs to prove type agreement (feedback).
  UNIQUE (id, project_type_id)
) STRICT;

-- One project per slug, across the whole table, because `/p/<slug>` is one
-- global namespace. Under the old owner-scoped rule a second member naming
-- their work the same thing took over the first member's address, and every
-- link, bookmark and notification pointing at the older project landed on a
-- stranger's page.
--
-- A database written under the old rule is renamed into the new one first, so
-- the index below can be created against it. The earliest publication keeps the
-- bare slug and the later ones are suffixed, which is the shape the application
-- hands out for a name already taken; the id tail is the tie-break, so a
-- suffixed slug can never collide with a project that already owns one. Both
-- statements are no-ops once the data is clean, which is every boot but the one
-- that migrates.
UPDATE projects AS p
   SET slug = d.fresh
  FROM (SELECT id,
               slug || '-' || SUBSTR(REPLACE(id, '-', ''), 1, 8) AS fresh,
               ROW_NUMBER() OVER (
                 PARTITION BY slug ORDER BY COALESCE(published_at, created_at), id
               ) AS seat
          FROM projects) AS d
 WHERE p.id = d.id AND d.seat > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_projects_slug ON projects (slug);
DROP INDEX IF EXISTS ux_projects_owner_slug;

-- Feed: "hot" ranking. The predicate is constant, so the index holds only
-- feed-eligible rows and the scan is a straight descending walk.
CREATE INDEX IF NOT EXISTS ix_projects_feed_hot
  ON projects (hot_score DESC, published_at DESC)
  WHERE visibility = 'public' AND status = 'published' AND deleted_at IS NULL;

-- Feed: "newest".
CREATE INDEX IF NOT EXISTS ix_projects_feed_new
  ON projects (published_at DESC)
  WHERE visibility = 'public' AND status = 'published' AND deleted_at IS NULL;

-- Feed: type + stage facets, still ranked.
CREATE INDEX IF NOT EXISTS ix_projects_feed_facet
  ON projects (project_type_id, stage_key, hot_score DESC)
  WHERE visibility = 'public' AND status = 'published' AND deleted_at IS NULL;

-- "Projects still accepting feedback" — the highest-intent filter on Discover.
CREATE INDEX IF NOT EXISTS ix_projects_feed_open
  ON projects (hot_score DESC)
  WHERE visibility = 'public' AND status = 'published'
    AND feedback_state = 'open' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_projects_owner ON projects (owner_id, updated_at DESC)
  WHERE deleted_at IS NULL;

-- A build/cut/deploy. Feedback anchors to a version, not a project — otherwise
-- month-old "the jump feels floaty" notes sit next to notes about a build where
-- the jump was already retuned, and the inbox becomes untrustworthy.
CREATE TABLE IF NOT EXISTS project_versions (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  version_label  TEXT NOT NULL,                   -- 'v0.4.2', 'Build 118', 'Cut 3'
  changelog_md   TEXT,
  build_url      TEXT,
  embed_url      TEXT,
  platforms      TEXT,                            -- JSON array: ['win','mac','web']
  is_current     INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
  released_at    INTEGER,
  created_at     INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  UNIQUE (project_id, version_label)
) STRICT;

-- Exactly one current version per project, enforced rather than hoped for.
CREATE UNIQUE INDEX IF NOT EXISTS ux_project_versions_current
  ON project_versions (project_id) WHERE is_current = 1;
CREATE INDEX IF NOT EXISTS ix_project_versions_project
  ON project_versions (project_id, created_at DESC);

-- Gallery/embed items. Ordered, captioned, and alt-texted — `alt_text` is NOT
-- NULL for images because WCAG 2.2 AA is a constraint, not a nice-to-have, and a
-- nullable column makes missing alt text the default.
CREATE TABLE IF NOT EXISTS project_media (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  version_id   TEXT REFERENCES project_versions (id) ON DELETE SET NULL,
  media_kind   TEXT NOT NULL CHECK (media_kind IN
                 ('image', 'video', 'gif', 'audio', 'embed', 'file')),
  url          TEXT NOT NULL,
  thumb_url    TEXT,
  alt_text     TEXT,
  caption      TEXT,
  width        INTEGER,
  height       INTEGER,
  duration_ms  INTEGER,
  byte_size    INTEGER,
  mime_type    TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  -- Decorative media is not a thing in a project gallery: every image carries a
  -- description or it does not get stored.
  CHECK (media_kind NOT IN ('image', 'gif') OR (alt_text IS NOT NULL AND length(alt_text) > 0)),
  CHECK (duration_ms IS NULL OR duration_ms > 0)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_project_media_project ON project_media (project_id, sort_order);

-- Outbound links shown on the detail page (try it, source, store, devlog).
-- Separate from media because they are navigation, not gallery content, and they
-- need their own click accounting.
CREATE TABLE IF NOT EXISTS project_links (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  link_kind   TEXT NOT NULL CHECK (link_kind IN
                ('demo', 'download', 'repo', 'store', 'docs', 'devlog', 'discord', 'other')),
  label       TEXT NOT NULL,
  url         TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0 CHECK (click_count >= 0)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_project_links_project ON project_links (project_id, sort_order);

-- "The ask" — the specific questions a creator wants answered, written before
-- any feedback arrives. Structured rather than a prose blob so the composer can
-- render one answer field per ask and the inbox can report coverage per ask.
CREATE TABLE IF NOT EXISTS project_asks (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  category_id  TEXT REFERENCES feedback_categories (id) ON DELETE SET NULL,
  prompt       TEXT NOT NULL,
  detail_md    TEXT,
  is_required  INTEGER NOT NULL DEFAULT 0 CHECK (is_required IN (0, 1)),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  answer_count INTEGER NOT NULL DEFAULT 0 CHECK (answer_count >= 0),
  created_at   INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;

CREATE INDEX IF NOT EXISTS ix_project_asks_project ON project_asks (project_id, sort_order);

-- What help the project is asking for. A join table (not a JSON column) so the
-- Discover "needs" facet is an index seek instead of a full scan with a LIKE.
CREATE TABLE IF NOT EXISTS project_needs (
  project_id  TEXT NOT NULL REFERENCES projects (id)   ON DELETE CASCADE,
  need_key    TEXT NOT NULL REFERENCES need_kinds (need_key) ON DELETE CASCADE,
  detail      TEXT,
  created_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  PRIMARY KEY (project_id, need_key)
) STRICT;

-- Reverse direction for the facet: need -> projects.
CREATE INDEX IF NOT EXISTS ix_project_needs_key ON project_needs (need_key, project_id);

-- Tagging. Same reasoning as project_needs; also the source of truth that
-- tags.usage_count is derived from.
CREATE TABLE IF NOT EXISTS project_tags (
  project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags (id)     ON DELETE CASCADE,
  created_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  PRIMARY KEY (project_id, tag_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_project_tags_tag ON project_tags (tag_id, project_id);

-- Team projects. Without this, permission checks are `owner_id = me` and a
-- two-person studio cannot both triage the inbox.
CREATE TABLE IF NOT EXISTS project_collaborators (
  project_id   TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users (id)    ON DELETE CASCADE,
  member_role  TEXT NOT NULL DEFAULT 'collaborator'
                 CHECK (member_role IN ('owner', 'collaborator', 'viewer')),
  invited_by   TEXT REFERENCES users (id) ON DELETE SET NULL,
  accepted_at  INTEGER,
  created_at   INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  PRIMARY KEY (project_id, user_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_project_collaborators_user ON project_collaborators (user_id);

-- Devlog posts. Feed the "what changed since your feedback" notification and
-- give followers a reason to come back between versions.
CREATE TABLE IF NOT EXISTS project_updates (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects (id)         ON DELETE CASCADE,
  version_id  TEXT REFERENCES project_versions (id)          ON DELETE SET NULL,
  author_id   TEXT NOT NULL REFERENCES users (id)            ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body_md     TEXT NOT NULL,
  published_at INTEGER,
  created_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  deleted_at  INTEGER
) STRICT;

CREATE INDEX IF NOT EXISTS ix_project_updates_project
  ON project_updates (project_id, published_at DESC) WHERE deleted_at IS NULL;

-- Counter cache, 1:1 with projects. Feed cards show six counters; computing them
-- per card would mean six aggregates per row per page. Updated in the same
-- transaction as the event that moves them.
CREATE TABLE IF NOT EXISTS project_stats (
  project_id            TEXT PRIMARY KEY REFERENCES projects (id) ON DELETE CASCADE,
  view_count            INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  feedback_count        INTEGER NOT NULL DEFAULT 0 CHECK (feedback_count >= 0),
  reviewer_count        INTEGER NOT NULL DEFAULT 0 CHECK (reviewer_count >= 0),
  expert_feedback_count INTEGER NOT NULL DEFAULT 0 CHECK (expert_feedback_count >= 0),
  follower_count        INTEGER NOT NULL DEFAULT 0 CHECK (follower_count >= 0),
  bookmark_count        INTEGER NOT NULL DEFAULT 0 CHECK (bookmark_count >= 0),
  open_suggestions      INTEGER NOT NULL DEFAULT 0 CHECK (open_suggestions >= 0),
  shipped_suggestions   INTEGER NOT NULL DEFAULT 0 CHECK (shipped_suggestions >= 0),
  rating_count          INTEGER NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  rating_avg            REAL   NOT NULL DEFAULT 0.0,
  -- Creator responsiveness: the strongest signal that feedback here is worth
  -- writing, and a ranking term in its own right.
  reply_rate            REAL   NOT NULL DEFAULT 0.0 CHECK (reply_rate BETWEEN 0.0 AND 1.0),
  last_feedback_at      INTEGER,
  last_activity_at      INTEGER,
  computed_at           INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;

CREATE INDEX IF NOT EXISTS ix_project_stats_rating ON project_stats (rating_avg DESC, rating_count DESC);

-- Private "read it later" list. Distinct from a follow: a bookmark is a personal
-- shelf and generates no notifications, a follow is a subscription.
CREATE TABLE IF NOT EXISTS project_bookmarks (
  user_id     TEXT NOT NULL REFERENCES users (id)    ON DELETE CASCADE,
  project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  note        TEXT,
  created_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  PRIMARY KEY (user_id, project_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_project_bookmarks_project ON project_bookmarks (project_id);

-- ---------------------------------------------------------------------------
-- 5. PROGRAMS — beta rounds and bounties
-- ---------------------------------------------------------------------------
-- Declared before feedback because feedback points back at them (a submission
-- knows which round or bounty produced it), and the settlement tables that point
-- the other way live in section 9.

-- A time-boxed, scoped call for testers on one build. Rounds are what turn
-- "anyone please try this" into a cohort with a protocol and a deadline.
CREATE TABLE IF NOT EXISTS test_rounds (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects (id)        ON DELETE CASCADE,
  version_id        TEXT REFERENCES project_versions (id)         ON DELETE SET NULL,
  created_by        TEXT NOT NULL REFERENCES users (id)           ON DELETE CASCADE,
  title             TEXT NOT NULL,
  brief_md          TEXT,
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'recruiting', 'running', 'closed', 'cancelled')),
  seats             INTEGER CHECK (seats IS NULL OR seats > 0),
  seats_taken       INTEGER NOT NULL DEFAULT 0 CHECK (seats_taken >= 0),
  is_nda            INTEGER NOT NULL DEFAULT 0 CHECK (is_nda IN (0, 1)),
  reward_kind       TEXT NOT NULL DEFAULT 'none'
                      CHECK (reward_kind IN ('none', 'credit', 'key', 'cash', 'reputation')),
  starts_at         INTEGER,
  ends_at           INTEGER,
  created_at        INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at        INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CHECK (seats IS NULL OR seats_taken <= seats)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_test_rounds_project ON test_rounds (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_test_rounds_open    ON test_rounds (ends_at)
  WHERE status = 'recruiting';

-- The protocol: the ordered things a tester is asked to do. Makes results
-- comparable across testers, which unstructured "tell us what you think" never is.
CREATE TABLE IF NOT EXISTS test_round_tasks (
  id            TEXT PRIMARY KEY,
  round_id      TEXT NOT NULL REFERENCES test_rounds (id) ON DELETE CASCADE,
  category_id   TEXT REFERENCES feedback_categories (id)  ON DELETE SET NULL,
  title         TEXT NOT NULL,
  instructions  TEXT,
  success_hint  TEXT,
  is_required   INTEGER NOT NULL DEFAULT 1 CHECK (is_required IN (0, 1)),
  sort_order    INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE INDEX IF NOT EXISTS ix_test_round_tasks_round ON test_round_tasks (round_id, sort_order);

-- One row per tester per round, carrying the whole lifecycle from invite to
-- completion. Merging invitation and participation avoids two tables that must
-- agree about whether someone is in the round.
CREATE TABLE IF NOT EXISTS test_invitations (
  id            TEXT PRIMARY KEY,
  round_id      TEXT NOT NULL REFERENCES test_rounds (id) ON DELETE CASCADE,
  user_id       TEXT REFERENCES users (id) ON DELETE CASCADE,   -- NULL until an email invite is claimed
  email         TEXT,
  invited_by    TEXT REFERENCES users (id) ON DELETE SET NULL,
  source        TEXT NOT NULL DEFAULT 'invite'
                  CHECK (source IN ('invite', 'applied', 'open_link', 'matched')),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'declined', 'started',
                                    'completed', 'expired', 'revoked')),
  nda_signed_at INTEGER,
  invite_token  TEXT,
  responded_at  INTEGER,
  started_at    INTEGER,
  completed_at  INTEGER,
  expires_at    INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  -- An invitation has to reach somebody.
  CHECK (user_id IS NOT NULL OR email IS NOT NULL),
  CHECK (status <> 'completed' OR completed_at IS NOT NULL),
  CHECK (status <> 'started'   OR started_at   IS NOT NULL),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
  -- NDA enforcement (no 'started' without nda_signed_at on an NDA round) needs
  -- the parent round's is_nda flag, which a row-local CHECK cannot reach; it is
  -- enforced in the accept-invitation transaction.
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_test_invitations_user
  ON test_invitations (round_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_test_invitations_email
  ON test_invitations (round_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_test_invitations_token
  ON test_invitations (invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_test_invitations_inbox
  ON test_invitations (user_id, status, created_at DESC);

-- A paid request for feedback: creator posts an amount, scope and deadline.
-- `escrow_state` is the money's state machine and is intentionally separate from
-- `status` (the work's state machine) — funded work can still be cancelled, and
-- delivered work can still be unpaid.
CREATE TABLE IF NOT EXISTS bounties (
  id                 TEXT PRIMARY KEY,
  project_id         TEXT NOT NULL REFERENCES projects (id)       ON DELETE CASCADE,
  version_id         TEXT REFERENCES project_versions (id)        ON DELETE SET NULL,
  created_by         TEXT NOT NULL REFERENCES users (id)          ON DELETE CASCADE,
  title              TEXT NOT NULL,
  brief_md           TEXT NOT NULL,
  expertise_id       TEXT REFERENCES expertise_areas (id)         ON DELETE SET NULL,
  amount_cents       INTEGER NOT NULL CHECK (amount_cents > 0),
  currency           TEXT NOT NULL DEFAULT 'USD' CHECK (length(currency) = 3),
  platform_fee_bps   INTEGER NOT NULL DEFAULT 1000
                       CHECK (platform_fee_bps BETWEEN 0 AND 5000),
  seats              INTEGER NOT NULL DEFAULT 1 CHECK (seats > 0),
  seats_awarded      INTEGER NOT NULL DEFAULT 0 CHECK (seats_awarded >= 0),
  turnaround_hours   INTEGER CHECK (turnaround_hours IS NULL OR turnaround_hours > 0),
  visibility         TEXT NOT NULL DEFAULT 'public'
                       CHECK (visibility IN ('public', 'invite_only')),
  -- The one reviewer an invite-only bounty was sent to: only they can apply,
  -- and only they and the poster see it listed. NULL on a public bounty. The
  -- application adds this column to databases built before it existed, which
  -- is why it carries no default and no check of its own.
  invited_user_id    TEXT REFERENCES users (id)                   ON DELETE SET NULL,
  status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'open', 'in_progress',
                                         'delivered', 'closed', 'cancelled')),
  escrow_state       TEXT NOT NULL DEFAULT 'unfunded'
                       CHECK (escrow_state IN ('unfunded', 'authorized', 'held',
                                               'released', 'refunded', 'disputed')),
  escrow_ref         TEXT,                        -- 'esc_' and ten hex; every ledger row reuses it
  closes_at          INTEGER,
  created_at         INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at         INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  CHECK (seats_awarded <= seats),
  -- Never advertise work that is not backed by money already held.
  CHECK (status NOT IN ('open', 'in_progress') OR escrow_state IN ('authorized', 'held')),
  CHECK (escrow_state = 'unfunded' OR escrow_ref IS NOT NULL)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_bounties_project ON bounties (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_bounties_market
  ON bounties (expertise_id, amount_cents DESC, closes_at)
  WHERE status = 'open' AND visibility = 'public';

-- An expert's pitch for a bounty. Kept distinct from the award so declined and
-- withdrawn pitches survive as history (and as marketplace supply signal).
CREATE TABLE IF NOT EXISTS bounty_applications (
  id             TEXT PRIMARY KEY,
  bounty_id      TEXT NOT NULL REFERENCES bounties (id) ON DELETE CASCADE,
  applicant_id   TEXT NOT NULL REFERENCES users (id)    ON DELETE CASCADE,
  pitch_md       TEXT,
  quoted_cents   INTEGER CHECK (quoted_cents IS NULL OR quoted_cents > 0),
  eta_hours      INTEGER CHECK (eta_hours IS NULL OR eta_hours > 0),
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'shortlisted', 'accepted',
                                     'declined', 'withdrawn', 'expired')),
  created_at     INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at     INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  UNIQUE (bounty_id, applicant_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_bounty_apps_bounty    ON bounty_applications (bounty_id, status);
CREATE INDEX IF NOT EXISTS ix_bounty_apps_applicant ON bounty_applications (applicant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 6. FEEDBACK
-- ---------------------------------------------------------------------------

-- One review session: who, on which build, in what context, with what overall
-- read. The container exists separately from its points so the creator's inbox
-- has a unit to triage, reply to, rate and reward — points alone would give the
-- inbox no natural row.
CREATE TABLE IF NOT EXISTS feedback (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL,
  project_type_id     TEXT NOT NULL,              -- denormalized to anchor the category FK chain
  version_id          TEXT REFERENCES project_versions (id) ON DELETE SET NULL,
  reviewer_id         TEXT NOT NULL REFERENCES users (id)   ON DELETE CASCADE,
  round_id            TEXT REFERENCES test_rounds (id)      ON DELETE SET NULL,
  bounty_id           TEXT REFERENCES bounties (id)         ON DELETE SET NULL,
  origin              TEXT NOT NULL DEFAULT 'organic'
                        CHECK (origin IN ('organic', 'invited', 'test_round', 'bounty', 'imported')),
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'submitted', 'withdrawn', 'removed')),
  visibility          TEXT NOT NULL DEFAULT 'public'
                        CHECK (visibility IN ('public', 'creator_only')),
  headline            TEXT,
  summary_md          TEXT,
  -- Context makes a report reproducible: 20 minutes on a Steam Deck is a
  -- different data point from 2 minutes in a browser tab.
  time_spent_minutes  INTEGER CHECK (time_spent_minutes IS NULL OR time_spent_minutes >= 0),
  environment         TEXT,                        -- JSON: {os, device, browser, gpu, build}
  -- Rollup fields, recomputed from feedback_points on write. The inbox sorts and
  -- filters on these; aggregating points per row would make the inbox O(n*m).
  point_count         INTEGER NOT NULL DEFAULT 0 CHECK (point_count >= 0),
  blocker_count       INTEGER NOT NULL DEFAULT 0 CHECK (blocker_count >= 0),
  sentiment_score     REAL CHECK (sentiment_score IS NULL OR sentiment_score BETWEEN -1.0 AND 1.0),
  sentiment_label     TEXT CHECK (sentiment_label IN
                        ('negative', 'mixed', 'neutral', 'positive')),
  quality_score       REAL,                        -- signal score used for ordering and reputation
  helpful_count       INTEGER NOT NULL DEFAULT 0 CHECK (helpful_count >= 0),
  unhelpful_count     INTEGER NOT NULL DEFAULT 0 CHECK (unhelpful_count >= 0),
  reply_count         INTEGER NOT NULL DEFAULT 0 CHECK (reply_count >= 0),
  -- Creator-side triage state. This is the column the dashboard inbox is built on.
  inbox_state         TEXT NOT NULL DEFAULT 'new'
                        CHECK (inbox_state IN ('new', 'read', 'triaged', 'actioned', 'archived')),
  creator_marked_helpful INTEGER NOT NULL DEFAULT 0 CHECK (creator_marked_helpful IN (0, 1)),
  reviewer_is_expert  INTEGER NOT NULL DEFAULT 0 CHECK (reviewer_is_expert IN (0, 1)),
  first_reply_at      INTEGER,
  submitted_at        INTEGER,
  created_at          INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at          INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  deleted_at          INTEGER,
  -- Submitted means submitted: a NULL timestamp here would corrupt every
  -- response-time metric downstream.
  CHECK (status <> 'submitted' OR submitted_at IS NOT NULL),
  CHECK (origin <> 'bounty' OR bounty_id IS NOT NULL),
  CHECK (origin <> 'test_round' OR round_id IS NOT NULL),
  -- Proves the project row agrees about the type (see feedback_points).
  FOREIGN KEY (project_id, project_type_id)
    REFERENCES projects (id, project_type_id) ON DELETE CASCADE,
  UNIQUE (id, project_type_id)
) STRICT;

-- A reviewer gets one open draft per version; finishing it is what unblocks the
-- next one. Submitted reviews are unconstrained (a second pass on a later build
-- is exactly what should happen). COALESCE is load-bearing: NULLs compare
-- distinct in a unique index, so a bare version_id column would let a reviewer
-- accumulate unlimited "no specific build" drafts.
CREATE UNIQUE INDEX IF NOT EXISTS ux_feedback_one_draft
  ON feedback (reviewer_id, project_id, COALESCE(version_id, '')) WHERE status = 'draft';

-- Creator inbox, default order.
CREATE INDEX IF NOT EXISTS ix_feedback_inbox
  ON feedback (project_id, inbox_state, submitted_at DESC)
  WHERE status = 'submitted' AND deleted_at IS NULL;

-- Project detail page: public thread, best-first.
CREATE INDEX IF NOT EXISTS ix_feedback_public
  ON feedback (project_id, quality_score DESC, submitted_at DESC)
  WHERE status = 'submitted' AND visibility = 'public' AND deleted_at IS NULL;

-- Inbox triage: unanswered blockers first, the single most valuable query in the
-- product.
CREATE INDEX IF NOT EXISTS ix_feedback_blockers
  ON feedback (project_id, blocker_count DESC, submitted_at DESC)
  WHERE status = 'submitted' AND first_reply_at IS NULL AND deleted_at IS NULL;

-- The Discover candidate pass counts, per project, how many notes the creator
-- marked helpful and how many got a reply. Without these the planner has
-- nothing to search on and scans the whole feedback table once per candidate:
-- at 33k notes across 3.5k projects that measured 16.5 seconds, and 14ms with
-- them. Partial, because both counts only ever ask about submitted notes.
CREATE INDEX IF NOT EXISTS ix_feedback_helpful_by_project ON feedback (project_id)
  WHERE creator_marked_helpful = 1 AND status = 'submitted';

CREATE INDEX IF NOT EXISTS ix_feedback_replied_by_project ON feedback (project_id)
  WHERE first_reply_at IS NOT NULL AND status = 'submitted';

-- Discover's candidate pass counts, per candidate, how many of its notes clear
-- the quality bar and were written against the current build. ix_feedback_public
-- cannot serve it: that index is partial on visibility = 'public' and this
-- subquery does not ask about visibility, so the planner fell back to
-- ix_feedback_inbox and walked every note on the project. Over 300 candidates
-- that measured 131ms, and 7.6ms with this one.
CREATE INDEX IF NOT EXISTS ix_feedback_quality_by_project ON feedback (project_id, quality_score)
  WHERE status = 'submitted' AND deleted_at IS NULL;

-- Discover asks two questions per candidate about the signed-in reader: has
-- this person already reviewed this project, and have they reviewed anything of
-- this type. ix_feedback_reviewer cannot answer either: it is partial on
-- deleted_at IS NULL and these subqueries do not mention deleted_at, so the
-- planner fell back to a full scan of `feedback` once per candidate row. Over
-- 300 candidates against 32,704 notes that measured 14.1 seconds for the first
-- and 0.7 for the second; with this index they are 2.2ms and 3.0ms. Signed-out
-- readers never paid it, which is why it survived every measurement taken from
-- a cold curl.
CREATE INDEX IF NOT EXISTS ix_feedback_reviewer_project ON feedback (reviewer_id, project_id)
  WHERE status = 'submitted';

CREATE INDEX IF NOT EXISTS ix_feedback_reviewer
  ON feedback (reviewer_id, submitted_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_feedback_version ON feedback (version_id);
CREATE INDEX IF NOT EXISTS ix_feedback_round   ON feedback (round_id)  WHERE round_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_feedback_bounty  ON feedback (bounty_id) WHERE bounty_id IS NOT NULL;

-- The atom of structured feedback: one observation, in one category, with a
-- severity and an actionability grade. Severity is how much it hurts;
-- actionability is how close it is to a task — they are independent axes, and
-- collapsing them into one field is what makes feedback unusable.
CREATE TABLE IF NOT EXISTS feedback_points (
  id               TEXT PRIMARY KEY,
  feedback_id      TEXT NOT NULL,
  project_type_id  TEXT NOT NULL,
  category_id      TEXT NOT NULL,
  ask_id           TEXT REFERENCES project_asks (id) ON DELETE SET NULL,
  ordinal          INTEGER NOT NULL DEFAULT 0,
  body_md          TEXT NOT NULL,
  severity         TEXT NOT NULL DEFAULT 'minor'
                     CHECK (severity IN ('praise', 'nit', 'minor', 'major', 'blocker')),
  actionability    TEXT NOT NULL DEFAULT 'observation'
                     CHECK (actionability IN ('observation', 'opinion', 'suggestion',
                                              'actionable', 'repro')),
  sentiment        INTEGER NOT NULL DEFAULT 0 CHECK (sentiment IN (-1, 0, 1)),
  -- Where in the artifact: a timestamp in a video, a route in an app, a level in
  -- a game. Without an anchor, half of all feedback is "the thing near the end".
  anchor_kind      TEXT CHECK (anchor_kind IN ('timecode', 'route', 'screen', 'level', 'selector')),
  anchor_value     TEXT,
  timecode_ms      INTEGER CHECK (timecode_ms IS NULL OR timecode_ms >= 0),
  repro_steps      TEXT,
  upvote_count     INTEGER NOT NULL DEFAULT 0 CHECK (upvote_count >= 0),
  is_resolved      INTEGER NOT NULL DEFAULT 0 CHECK (is_resolved IN (0, 1)),
  created_at       INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at       INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  -- A 'repro' point without steps is a bug report with the bug missing.
  CHECK (actionability <> 'repro' OR (repro_steps IS NOT NULL AND length(repro_steps) > 0)),
  CHECK (anchor_kind IS NULL OR anchor_value IS NOT NULL),
  -- The chain: point -> feedback (same type) -> category (same type). This is
  -- what makes "a Fun rating on a landing page" unrepresentable rather than
  -- merely discouraged.
  FOREIGN KEY (feedback_id, project_type_id)
    REFERENCES feedback (id, project_type_id) ON DELETE CASCADE,
  FOREIGN KEY (project_type_id, category_id)
    REFERENCES feedback_categories (project_type_id, id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX IF NOT EXISTS ix_feedback_points_feedback ON feedback_points (feedback_id, ordinal);
CREATE INDEX IF NOT EXISTS ix_feedback_points_category ON feedback_points (category_id, severity);
CREATE INDEX IF NOT EXISTS ix_feedback_points_ask      ON feedback_points (ask_id) WHERE ask_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_feedback_points_open
  ON feedback_points (category_id, created_at DESC) WHERE is_resolved = 0;

-- Per-axis numeric ratings inside a submission. A row per axis (not a JSON blob)
-- so per-axis averages, distributions and trend-over-versions are plain SQL.
CREATE TABLE IF NOT EXISTS feedback_ratings (
  id               TEXT PRIMARY KEY,
  feedback_id      TEXT NOT NULL,
  project_type_id  TEXT NOT NULL,
  axis_id          TEXT NOT NULL,
  rating_value     INTEGER NOT NULL CHECK (rating_value BETWEEN 1 AND 10),
  comment          TEXT,
  created_at       INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  UNIQUE (feedback_id, axis_id),
  FOREIGN KEY (feedback_id, project_type_id)
    REFERENCES feedback (id, project_type_id) ON DELETE CASCADE,
  FOREIGN KEY (project_type_id, axis_id)
    REFERENCES rating_axes (project_type_id, id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX IF NOT EXISTS ix_feedback_ratings_axis ON feedback_ratings (axis_id, rating_value);

-- Screenshots, clips and logs attached to a specific point. Attached to the
-- point rather than the submission because "this is the frame where it breaks"
-- loses all its value one level up.
CREATE TABLE IF NOT EXISTS feedback_attachments (
  id           TEXT PRIMARY KEY,
  point_id     TEXT NOT NULL REFERENCES feedback_points (id) ON DELETE CASCADE,
  media_kind   TEXT NOT NULL CHECK (media_kind IN ('image', 'video', 'gif', 'log', 'file')),
  url          TEXT NOT NULL,
  thumb_url    TEXT,
  alt_text     TEXT,
  byte_size    INTEGER,
  mime_type    TEXT,
  created_at   INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  CHECK (media_kind NOT IN ('image', 'gif') OR (alt_text IS NOT NULL AND length(alt_text) > 0))
) STRICT;

CREATE INDEX IF NOT EXISTS ix_feedback_attachments_point ON feedback_attachments (point_id);

-- "This helped me too" from the community. One row per voter per submission;
-- the counters on `feedback` are derived from it and the uniqueness constraint
-- is what makes them trustworthy.
CREATE TABLE IF NOT EXISTS feedback_votes (
  feedback_id  TEXT NOT NULL REFERENCES feedback (id) ON DELETE CASCADE,
  voter_id     TEXT NOT NULL REFERENCES users (id)    ON DELETE CASCADE,
  vote_value   INTEGER NOT NULL CHECK (vote_value IN (-1, 1)),
  created_at   INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  PRIMARY KEY (feedback_id, voter_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_feedback_votes_voter ON feedback_votes (voter_id, created_at DESC);

-- "I hit this too" on a single point. Separate from feedback_votes because
-- corroborating one specific observation is a different claim from rating a
-- whole review, and the suggestion tracker ranks on this count.
CREATE TABLE IF NOT EXISTS feedback_point_votes (
  point_id    TEXT NOT NULL REFERENCES feedback_points (id) ON DELETE CASCADE,
  voter_id    TEXT NOT NULL REFERENCES users (id)           ON DELETE CASCADE,
  created_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  PRIMARY KEY (point_id, voter_id)
) STRICT;

-- Conversation on a review, optionally pinned to one point, optionally nested
-- one reply deep. This is where "can you reproduce that?" happens, and it is the
-- source of the response-rate metric creators are ranked on.
CREATE TABLE IF NOT EXISTS feedback_replies (
  id               TEXT PRIMARY KEY,
  feedback_id      TEXT NOT NULL REFERENCES feedback (id)        ON DELETE CASCADE,
  point_id         TEXT REFERENCES feedback_points (id)          ON DELETE CASCADE,
  parent_reply_id  TEXT REFERENCES feedback_replies (id)         ON DELETE CASCADE,
  author_id        TEXT NOT NULL REFERENCES users (id)           ON DELETE CASCADE,
  body_md          TEXT NOT NULL,
  is_creator       INTEGER NOT NULL DEFAULT 0 CHECK (is_creator IN (0, 1)),
  created_at       INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at       INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  deleted_at       INTEGER
) STRICT;

CREATE INDEX IF NOT EXISTS ix_feedback_replies_thread
  ON feedback_replies (feedback_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_feedback_replies_point  ON feedback_replies (point_id);
CREATE INDEX IF NOT EXISTS ix_feedback_replies_parent ON feedback_replies (parent_reply_id);

-- ---------------------------------------------------------------------------
-- 7. THEMES & THE SUGGESTION TRACKER
-- ---------------------------------------------------------------------------

-- A named cluster of related points within one project ("tutorial is too long").
-- The dashboard's "grouped by theme" view and the sentiment rollup both read
-- this; keeping themes per-project keeps clustering cheap and labels meaningful.
CREATE TABLE IF NOT EXISTS feedback_themes (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects (id)   ON DELETE CASCADE,
  category_id      TEXT REFERENCES feedback_categories (id) ON DELETE SET NULL,
  label            TEXT NOT NULL,
  summary_md       TEXT,
  source           TEXT NOT NULL DEFAULT 'auto'
                     CHECK (source IN ('auto', 'manual', 'confirmed')),
  point_count      INTEGER NOT NULL DEFAULT 0 CHECK (point_count >= 0),
  reviewer_count   INTEGER NOT NULL DEFAULT 0 CHECK (reviewer_count >= 0),
  sentiment_score  REAL CHECK (sentiment_score IS NULL OR sentiment_score BETWEEN -1.0 AND 1.0),
  severity_score   REAL NOT NULL DEFAULT 0.0,
  is_archived      INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
  first_seen_at    INTEGER,
  last_seen_at     INTEGER,
  created_at       INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at       INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;

-- The rollup view: themes that hurt most, first.
CREATE INDEX IF NOT EXISTS ix_feedback_themes_rollup
  ON feedback_themes (project_id, severity_score DESC, point_count DESC)
  WHERE is_archived = 0;
CREATE INDEX IF NOT EXISTS ix_feedback_themes_category ON feedback_themes (category_id);

-- Many-to-many: a point can support more than one theme, and `confidence` lets
-- an auto-clustered membership be shown differently from a confirmed one.
CREATE TABLE IF NOT EXISTS feedback_point_themes (
  theme_id    TEXT NOT NULL REFERENCES feedback_themes (id) ON DELETE CASCADE,
  point_id    TEXT NOT NULL REFERENCES feedback_points (id) ON DELETE CASCADE,
  confidence  REAL NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0.0 AND 1.0),
  assigned_by TEXT REFERENCES users (id) ON DELETE SET NULL,   -- NULL = assigned by the clusterer
  created_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  PRIMARY KEY (theme_id, point_id)
) STRICT;

-- Reverse lookup: which themes does this point belong to.
CREATE INDEX IF NOT EXISTS ix_point_themes_point ON feedback_point_themes (point_id);

-- The promise the tracker makes to reviewers: feedback becomes a tracked item
-- with a visible status. This is the object creators triage toward and reviewers
-- get notified about — deliberately distinct from a feedback point, because one
-- suggestion usually answers many points from many people.
CREATE TABLE IF NOT EXISTS suggestions (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES projects (id)         ON DELETE CASCADE,
  theme_id       TEXT REFERENCES feedback_themes (id)           ON DELETE SET NULL,
  category_id    TEXT REFERENCES feedback_categories (id)       ON DELETE SET NULL,
  created_by     TEXT NOT NULL REFERENCES users (id)            ON DELETE CASCADE,
  title          TEXT NOT NULL,
  body_md        TEXT,
  status         TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'under_review', 'planned', 'in_progress',
                                     'shipped', 'declined', 'duplicate', 'wont_fix')),
  status_note    TEXT,
  priority       TEXT NOT NULL DEFAULT 'normal'
                   CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  effort         TEXT CHECK (effort IN ('xs', 's', 'm', 'l', 'xl')),
  duplicate_of   TEXT REFERENCES suggestions (id) ON DELETE SET NULL,
  shipped_in_version_id TEXT REFERENCES project_versions (id) ON DELETE SET NULL,
  vote_count     INTEGER NOT NULL DEFAULT 0 CHECK (vote_count >= 0),
  source_count   INTEGER NOT NULL DEFAULT 0 CHECK (source_count >= 0),
  status_changed_at INTEGER,
  shipped_at     INTEGER,
  created_at     INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at     INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  -- Terminal states owe an explanation or a timestamp; silence is what makes a
  -- public roadmap feel like a black hole.
  CHECK (status <> 'shipped' OR shipped_at IS NOT NULL),
  CHECK (status NOT IN ('declined', 'wont_fix') OR status_note IS NOT NULL),
  CHECK (status <> 'duplicate' OR duplicate_of IS NOT NULL),
  CHECK (duplicate_of IS NULL OR duplicate_of <> id)
) STRICT;

-- The public roadmap board: one index seek per status column.
CREATE INDEX IF NOT EXISTS ix_suggestions_board
  ON suggestions (project_id, status, vote_count DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_suggestions_theme  ON suggestions (theme_id);
CREATE INDEX IF NOT EXISTS ix_suggestions_shipped
  ON suggestions (project_id, shipped_at DESC) WHERE status = 'shipped';

-- Evidence links: which feedback points this suggestion came from. This is what
-- lets the product tell a reviewer "the note you wrote in March shipped in
-- v0.5" — the single most effective retention mechanic on the platform.
CREATE TABLE IF NOT EXISTS suggestion_sources (
  suggestion_id  TEXT NOT NULL REFERENCES suggestions (id)     ON DELETE CASCADE,
  point_id       TEXT NOT NULL REFERENCES feedback_points (id) ON DELETE CASCADE,
  linked_by      TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at     INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  PRIMARY KEY (suggestion_id, point_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_suggestion_sources_point ON suggestion_sources (point_id);

-- Immutable status history. A roadmap whose history can be quietly rewritten is
-- not a commitment; this table is what "planned in June, shipped in August" is
-- rendered from, and what credits contributors at ship time.
CREATE TABLE IF NOT EXISTS suggestion_events (
  id             TEXT PRIMARY KEY,
  suggestion_id  TEXT NOT NULL REFERENCES suggestions (id) ON DELETE CASCADE,
  actor_id       TEXT REFERENCES users (id) ON DELETE SET NULL,
  from_status    TEXT,
  to_status      TEXT NOT NULL,
  note           TEXT,
  created_at     INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  CHECK (from_status IS NULL OR from_status <> to_status)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_suggestion_events_suggestion
  ON suggestion_events (suggestion_id, created_at DESC);

-- Community demand signal on the tracker. One vote per person, enforced by the
-- primary key rather than by application discipline.
CREATE TABLE IF NOT EXISTS suggestion_votes (
  suggestion_id  TEXT NOT NULL REFERENCES suggestions (id) ON DELETE CASCADE,
  voter_id       TEXT NOT NULL REFERENCES users (id)       ON DELETE CASCADE,
  created_at     INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  PRIMARY KEY (suggestion_id, voter_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_suggestion_votes_voter ON suggestion_votes (voter_id);

-- ---------------------------------------------------------------------------
-- 8. EXPERTS & VERIFICATION
-- ---------------------------------------------------------------------------

-- The marketplace listing for a reviewer selling their time: rate, turnaround,
-- capacity. Separate from `profiles` because most users never have one, and the
-- marketplace queries only this table.
CREATE TABLE IF NOT EXISTS expert_profiles (
  user_id           TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  headline          TEXT NOT NULL,
  pitch_md          TEXT,
  hourly_rate_cents INTEGER CHECK (hourly_rate_cents IS NULL OR hourly_rate_cents > 0),
  min_bounty_cents  INTEGER CHECK (min_bounty_cents IS NULL OR min_bounty_cents > 0),
  currency          TEXT NOT NULL DEFAULT 'USD' CHECK (length(currency) = 3),
  turnaround_hours  INTEGER CHECK (turnaround_hours IS NULL OR turnaround_hours > 0),
  capacity_per_week INTEGER NOT NULL DEFAULT 3 CHECK (capacity_per_week >= 0),
  years_experience  INTEGER CHECK (years_experience IS NULL OR years_experience >= 0),
  is_listed         INTEGER NOT NULL DEFAULT 0 CHECK (is_listed IN (0, 1)),
  is_verified       INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
  -- Denormalized marketplace sort keys; recomputed with reputation.
  completed_count   INTEGER NOT NULL DEFAULT 0 CHECK (completed_count >= 0),
  avg_rating        REAL NOT NULL DEFAULT 0.0 CHECK (avg_rating BETWEEN 0.0 AND 5.0),
  on_time_rate      REAL NOT NULL DEFAULT 0.0 CHECK (on_time_rate BETWEEN 0.0 AND 1.0),
  created_at        INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at        INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  -- Unverified experts are not listed; the badge is the product.
  CHECK (is_listed = 0 OR is_verified = 1)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_expert_profiles_market
  ON expert_profiles (avg_rating DESC, completed_count DESC)
  WHERE is_listed = 1;

-- What an expert is an expert in, with a self-declared level. The marketplace's
-- primary filter, so it is a join table with its own index, not a JSON column.
CREATE TABLE IF NOT EXISTS expert_expertise (
  user_id       TEXT NOT NULL REFERENCES users (id)            ON DELETE CASCADE,
  expertise_id  TEXT NOT NULL REFERENCES expertise_areas (id)  ON DELETE CASCADE,
  level         TEXT NOT NULL DEFAULT 'practitioner'
                  CHECK (level IN ('familiar', 'practitioner', 'specialist')),
  is_verified   INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
  PRIMARY KEY (user_id, expertise_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_expert_expertise_area
  ON expert_expertise (expertise_id, level) WHERE is_verified = 1;

-- The application to be verified, with its evidence and the reviewer's decision.
-- Exists as its own record so a rejection can be appealed and a decision can be
-- audited months later.
CREATE TABLE IF NOT EXISTS verification_requests (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id)           ON DELETE CASCADE,
  expertise_id  TEXT REFERENCES expertise_areas (id)          ON DELETE SET NULL,
  claim_md      TEXT NOT NULL,
  evidence      TEXT,                              -- JSON array of {kind, url, note}
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'in_review', 'approved',
                                    'rejected', 'withdrawn')),
  reviewer_id   TEXT REFERENCES users (id) ON DELETE SET NULL,
  decision_note TEXT,
  decided_at    INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at    INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  CHECK (status NOT IN ('approved', 'rejected') OR decided_at IS NOT NULL),
  CHECK (status <> 'rejected' OR decision_note IS NOT NULL)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_verification_queue ON verification_requests (status, created_at);
CREATE INDEX IF NOT EXISTS ix_verification_user  ON verification_requests (user_id, created_at DESC);

-- The granted credential — what renders as the verified badge. Separate from the
-- request because credentials expire and get revoked independently of the
-- application that produced them.
CREATE TABLE IF NOT EXISTS verification_credentials (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id)                  ON DELETE CASCADE,
  request_id    TEXT REFERENCES verification_requests (id)           ON DELETE SET NULL,
  expertise_id  TEXT REFERENCES expertise_areas (id)                 ON DELETE SET NULL,
  credential    TEXT NOT NULL,                     -- 'domain_expert', 'shipped_titles', 'employer'
  issued_by     TEXT REFERENCES users (id) ON DELETE SET NULL,
  issued_at     INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  expires_at    INTEGER,
  revoked_at    INTEGER,
  revoke_reason TEXT,
  CHECK (expires_at IS NULL OR expires_at > issued_at),
  CHECK (revoked_at IS NULL OR revoke_reason IS NOT NULL)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_verification_credentials_user
  ON verification_credentials (user_id) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- 9. SETTLEMENT — test results, bounty awards, escrow ledger
-- ---------------------------------------------------------------------------

-- Per-task outcome for one tester. Turns a round into comparable data
-- ("7 of 9 testers failed task 3") instead of nine prose reports.
CREATE TABLE IF NOT EXISTS test_task_results (
  id             TEXT PRIMARY KEY,
  invitation_id  TEXT NOT NULL REFERENCES test_invitations (id) ON DELETE CASCADE,
  task_id        TEXT NOT NULL REFERENCES test_round_tasks (id) ON DELETE CASCADE,
  point_id       TEXT REFERENCES feedback_points (id)           ON DELETE SET NULL,
  outcome        TEXT NOT NULL CHECK (outcome IN
                   ('completed', 'completed_with_help', 'failed', 'skipped', 'blocked')),
  duration_ms    INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  difficulty     INTEGER CHECK (difficulty IS NULL OR difficulty BETWEEN 1 AND 5),
  note           TEXT,
  created_at     INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  UNIQUE (invitation_id, task_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_test_task_results_task ON test_task_results (task_id, outcome);

-- How an expert gets paid: a tokenized reference held by the payment processor.
-- No card numbers, no bank details — the column is deliberately a reference and
-- nothing else.
CREATE TABLE IF NOT EXISTS payout_methods (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider     TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal', 'wise', 'manual')),
  external_ref TEXT NOT NULL,
  display_name TEXT,                                -- 'Visa •••• 4242'
  currency     TEXT NOT NULL DEFAULT 'USD' CHECK (length(currency) = 3),
  is_default   INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  verified_at  INTEGER,
  created_at   INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  deleted_at   INTEGER
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payout_default
  ON payout_methods (user_id) WHERE is_default = 1 AND deleted_at IS NULL;

-- The accepted engagement: this expert, this bounty, this delivered review, this
-- money. One row per seat. It is the join between the work and the payment, and
-- the only place both states are visible at once.
CREATE TABLE IF NOT EXISTS bounty_awards (
  id                 TEXT PRIMARY KEY,
  bounty_id          TEXT NOT NULL REFERENCES bounties (id)             ON DELETE CASCADE,
  application_id     TEXT REFERENCES bounty_applications (id)           ON DELETE SET NULL,
  expert_id          TEXT NOT NULL REFERENCES users (id)                ON DELETE RESTRICT,
  feedback_id        TEXT REFERENCES feedback (id)                      ON DELETE SET NULL,
  payout_method_id   TEXT REFERENCES payout_methods (id)                ON DELETE SET NULL,
  amount_cents       INTEGER NOT NULL CHECK (amount_cents > 0),
  fee_cents          INTEGER NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  currency           TEXT NOT NULL DEFAULT 'USD' CHECK (length(currency) = 3),
  status             TEXT NOT NULL DEFAULT 'assigned'
                       CHECK (status IN ('assigned', 'in_progress', 'delivered',
                                         'accepted', 'revision_requested',
                                         'disputed', 'cancelled', 'expired')),
  payout_state       TEXT NOT NULL DEFAULT 'pending'
                       CHECK (payout_state IN ('pending', 'scheduled', 'paid',
                                               'refunded', 'failed')),
  creator_rating     INTEGER CHECK (creator_rating IS NULL OR creator_rating BETWEEN 1 AND 5),
  creator_review     TEXT,
  due_at             INTEGER,
  delivered_at       INTEGER,
  accepted_at        INTEGER,
  paid_at            INTEGER,
  created_at         INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at         INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  CHECK (fee_cents < amount_cents),
  -- Delivered means there is something to look at.
  CHECK (status NOT IN ('delivered', 'accepted') OR feedback_id IS NOT NULL),
  CHECK (status <> 'delivered' OR delivered_at IS NOT NULL),
  CHECK (status <> 'accepted'  OR accepted_at  IS NOT NULL),
  -- Money only moves after the creator accepts the work.
  CHECK (payout_state <> 'paid' OR (accepted_at IS NOT NULL AND paid_at IS NOT NULL)),
  UNIQUE (bounty_id, expert_id)
) STRICT;

-- One review, one bounty. A review that has already been delivered cannot be
-- handed to a second award and paid for twice; the delivery path refuses it
-- first, and this is the line under that refusal.
CREATE UNIQUE INDEX IF NOT EXISTS ux_bounty_awards_feedback ON bounty_awards (feedback_id)
  WHERE feedback_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_bounty_awards_expert  ON bounty_awards (expert_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_bounty_awards_bounty  ON bounty_awards (bounty_id, status);
CREATE INDEX IF NOT EXISTS ix_bounty_awards_overdue ON bounty_awards (due_at)
  WHERE status IN ('assigned', 'in_progress');
CREATE INDEX IF NOT EXISTS ix_bounty_awards_payable ON bounty_awards (payout_state, accepted_at)
  WHERE payout_state IN ('pending', 'scheduled');

-- Append-only money ledger. `bounties.escrow_state` is a cache of the last row
-- here; this table is the record. Never updated, never deleted — a financial
-- state you cannot replay is a financial state you cannot defend.
CREATE TABLE IF NOT EXISTS bounty_escrow_events (
  id            TEXT PRIMARY KEY,
  bounty_id     TEXT NOT NULL REFERENCES bounties (id)      ON DELETE RESTRICT,
  award_id      TEXT REFERENCES bounty_awards (id)          ON DELETE SET NULL,
  event_kind    TEXT NOT NULL CHECK (event_kind IN
                  ('authorize', 'capture', 'hold', 'release', 'partial_release',
                   'refund', 'chargeback', 'dispute_open', 'dispute_resolve', 'fee')),
  from_state    TEXT,
  to_state      TEXT NOT NULL CHECK (to_state IN
                  ('unfunded', 'authorized', 'held', 'released', 'refunded', 'disputed')),
  amount_cents  INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency      TEXT NOT NULL DEFAULT 'USD' CHECK (length(currency) = 3),
  provider_ref  TEXT,
  actor_id      TEXT REFERENCES users (id) ON DELETE SET NULL,
  idempotency_key TEXT,
  note          TEXT,
  created_at    INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;

CREATE INDEX IF NOT EXISTS ix_escrow_events_bounty ON bounty_escrow_events (bounty_id, created_at);
-- Retried webhooks must not move money twice.
CREATE UNIQUE INDEX IF NOT EXISTS ux_escrow_idempotency
  ON bounty_escrow_events (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 10. COMMUNITY DISCUSSIONS
-- ---------------------------------------------------------------------------

-- Top-level forum areas ("Playtesting", "Pricing", "Show your work"). A table
-- rather than an enum so moderators can open and archive areas without a deploy.
CREATE TABLE IF NOT EXISTS discussion_channels (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL,
  description  TEXT,
  icon         TEXT,
  is_private   INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0, 1)),
  is_archived  INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  thread_count INTEGER NOT NULL DEFAULT 0 CHECK (thread_count >= 0),
  created_at   INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;

-- A conversation. Optionally attached to a project, which is how a discussion
-- started from a project page stays connected to it.
CREATE TABLE IF NOT EXISTS discussion_threads (
  id               TEXT PRIMARY KEY,
  channel_id       TEXT NOT NULL REFERENCES discussion_channels (id) ON DELETE CASCADE,
  project_id       TEXT REFERENCES projects (id) ON DELETE SET NULL,
  author_id        TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  body_md          TEXT NOT NULL,
  thread_kind      TEXT NOT NULL DEFAULT 'discussion'
                     CHECK (thread_kind IN ('discussion', 'question', 'showcase', 'announcement')),
  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'answered', 'locked', 'archived', 'removed')),
  accepted_post_id TEXT,                          -- no FK: circular with discussion_posts
  is_pinned        INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
  post_count       INTEGER NOT NULL DEFAULT 0 CHECK (post_count >= 0),
  view_count       INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  score            INTEGER NOT NULL DEFAULT 0,
  hot_score        REAL NOT NULL DEFAULT 0.0,
  last_post_at     INTEGER,
  created_at       INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at       INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  deleted_at       INTEGER,
  -- Only questions get answered.
  CHECK (accepted_post_id IS NULL OR thread_kind = 'question')
) STRICT;

CREATE INDEX IF NOT EXISTS ix_threads_channel
  ON discussion_threads (channel_id, is_pinned DESC, hot_score DESC, last_post_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_threads_project ON discussion_threads (project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_threads_unanswered
  ON discussion_threads (channel_id, created_at DESC)
  WHERE thread_kind = 'question' AND status = 'open' AND deleted_at IS NULL;

-- Replies, one level of nesting via parent_post_id. `depth` is stored so the
-- renderer can cap nesting without walking the chain per post.
CREATE TABLE IF NOT EXISTS discussion_posts (
  id              TEXT PRIMARY KEY,
  thread_id       TEXT NOT NULL REFERENCES discussion_threads (id) ON DELETE CASCADE,
  parent_post_id  TEXT REFERENCES discussion_posts (id)            ON DELETE CASCADE,
  author_id       TEXT NOT NULL REFERENCES users (id)              ON DELETE CASCADE,
  body_md         TEXT NOT NULL,
  depth           INTEGER NOT NULL DEFAULT 0 CHECK (depth BETWEEN 0 AND 4),
  score           INTEGER NOT NULL DEFAULT 0,
  is_accepted     INTEGER NOT NULL DEFAULT 0 CHECK (is_accepted IN (0, 1)),
  edited_at       INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  deleted_at      INTEGER
) STRICT;

CREATE INDEX IF NOT EXISTS ix_posts_thread ON discussion_posts (thread_id, created_at)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_posts_parent ON discussion_posts (parent_post_id);
CREATE INDEX IF NOT EXISTS ix_posts_author ON discussion_posts (author_id, created_at DESC);
-- One accepted answer per thread.
CREATE UNIQUE INDEX IF NOT EXISTS ux_posts_accepted
  ON discussion_posts (thread_id) WHERE is_accepted = 1;

-- Votes on discussion content. Concrete FK to posts rather than a polymorphic
-- target, so a deleted post takes its votes with it.
CREATE TABLE IF NOT EXISTS post_votes (
  post_id     TEXT NOT NULL REFERENCES discussion_posts (id) ON DELETE CASCADE,
  voter_id    TEXT NOT NULL REFERENCES users (id)            ON DELETE CASCADE,
  vote_value  INTEGER NOT NULL CHECK (vote_value IN (-1, 1)),
  created_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  PRIMARY KEY (post_id, voter_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_post_votes_voter ON post_votes (voter_id);

-- Who to notify on a new reply, including people who never posted. Explicit
-- rather than inferred from authorship so muting a thread is possible.
CREATE TABLE IF NOT EXISTS thread_subscriptions (
  thread_id   TEXT NOT NULL REFERENCES discussion_threads (id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users (id)              ON DELETE CASCADE,
  state       TEXT NOT NULL DEFAULT 'subscribed'
                CHECK (state IN ('subscribed', 'muted')),
  last_read_at INTEGER,
  created_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  PRIMARY KEY (thread_id, user_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_thread_subs_user ON thread_subscriptions (user_id)
  WHERE state = 'subscribed';

-- ---------------------------------------------------------------------------
-- 11. SOCIAL GRAPH
-- ---------------------------------------------------------------------------
-- Three narrow tables instead of one polymorphic `follows`. A polymorphic
-- subject_id cannot carry a foreign key, which means deleting a project silently
-- leaves dangling follows and the follower counts drift. These are also the
-- tables the personalized feed joins against, and narrow beats generic there.

-- User -> user. Drives the "from people you follow" feed and the follower count.
CREATE TABLE IF NOT EXISTS user_follows (
  follower_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  followee_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_user_follows_followee ON user_follows (followee_id, created_at DESC);

-- User -> project. A subscription: new versions and updates notify these people.
CREATE TABLE IF NOT EXISTS project_follows (
  user_id     TEXT NOT NULL REFERENCES users (id)    ON DELETE CASCADE,
  project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  notify      TEXT NOT NULL DEFAULT 'all'
                CHECK (notify IN ('all', 'versions', 'none')),
  created_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  PRIMARY KEY (user_id, project_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_project_follows_project ON project_follows (project_id);

-- User -> tag. The interest graph that makes a new reviewer's Discover feed
-- useful before they have followed a single person.
CREATE TABLE IF NOT EXISTS tag_follows (
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags (id)  ON DELETE CASCADE,
  created_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  PRIMARY KEY (user_id, tag_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_tag_follows_tag ON tag_follows (tag_id);

-- Blocks. Filters the feed, suppresses notifications, and prevents bounty
-- matching. Checked on read paths, so it stays small and indexed both ways.
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  blocked_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reason      TEXT,
  created_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_user_blocks_blocked ON user_blocks (blocked_id);

-- ---------------------------------------------------------------------------
-- 12. NOTIFICATIONS
-- ---------------------------------------------------------------------------

-- The bell. Subject is polymorphic on purpose — a notification points at
-- fourteen different kinds of row and is disposable, so a dangling reference
-- after a hard delete is a rendering fallback, not a data-integrity failure.
-- `group_key` collapses "12 people voted" into one row.
CREATE TABLE IF NOT EXISTS notifications (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  actor_id      TEXT REFERENCES users (id) ON DELETE SET NULL,   -- NULL = system
  kind          TEXT NOT NULL CHECK (kind IN
                  ('feedback_received', 'feedback_reply', 'feedback_helpful',
                   'suggestion_status', 'suggestion_shipped', 'project_update',
                   'new_version', 'test_invite', 'test_reminder',
                   'bounty_application', 'bounty_awarded', 'bounty_delivered',
                   'bounty_paid', 'thread_reply', 'answer_accepted', 'mention',
                   'new_follower', 'badge_awarded', 'verification_decision',
                   'moderation_notice', 'system')),
  subject_type  TEXT CHECK (subject_type IN
                  ('project', 'project_version', 'feedback', 'feedback_point',
                   'suggestion', 'test_round', 'bounty', 'bounty_award',
                   'discussion_thread', 'discussion_post', 'user', 'badge')),
  subject_id    TEXT,
  group_key     TEXT,
  title         TEXT NOT NULL,
  body          TEXT,
  url           TEXT,
  payload       TEXT,                              -- JSON for rich rendering
  read_at       INTEGER,
  emailed_at    INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;

-- The bell badge and the unread list, both index-only.
CREATE INDEX IF NOT EXISTS ix_notifications_unread
  ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_notifications_all
  ON notifications (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_group
  ON notifications (user_id, group_key) WHERE group_key IS NOT NULL AND read_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_notifications_email_queue
  ON notifications (created_at) WHERE emailed_at IS NULL;

-- Per-kind, per-channel opt-outs. A row exists only where the user has changed
-- the default, so the table stays tiny and the defaults live in code.
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  in_app      INTEGER NOT NULL DEFAULT 1 CHECK (in_app IN (0, 1)),
  email       INTEGER NOT NULL DEFAULT 1 CHECK (email IN (0, 1)),
  push        INTEGER NOT NULL DEFAULT 0 CHECK (push IN (0, 1)),
  updated_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  PRIMARY KEY (user_id, kind)
) STRICT;

-- ---------------------------------------------------------------------------
-- 13. MODERATION & AUDIT
-- ---------------------------------------------------------------------------

-- User-filed reports. Polymorphic target, and here the tradeoff is accepted
-- knowingly: a report must survive the deletion of the thing it is about, or the
-- fastest way to erase an abuse investigation is to delete the post.
CREATE TABLE IF NOT EXISTS content_reports (
  id             TEXT PRIMARY KEY,
  reporter_id    TEXT REFERENCES users (id) ON DELETE SET NULL,
  target_type    TEXT NOT NULL CHECK (target_type IN
                   ('project', 'project_media', 'feedback', 'feedback_point',
                    'feedback_reply', 'discussion_thread', 'discussion_post',
                    'suggestion', 'user', 'bounty')),
  target_id      TEXT NOT NULL,
  target_owner_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  reason         TEXT NOT NULL CHECK (reason IN
                   ('spam', 'harassment', 'hate', 'sexual', 'violence',
                    'self_harm', 'ip_violation', 'off_topic', 'low_effort',
                    'undisclosed_paid', 'vote_manipulation', 'other')),
  detail         TEXT,
  status         TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'triaged', 'upheld', 'dismissed', 'duplicate')),
  resolver_id    TEXT REFERENCES users (id) ON DELETE SET NULL,
  resolution_note TEXT,
  resolved_at    INTEGER,
  created_at     INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  CHECK (status NOT IN ('upheld', 'dismissed') OR resolved_at IS NOT NULL)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_reports_queue  ON content_reports (status, created_at);
CREATE INDEX IF NOT EXISTS ix_reports_target ON content_reports (target_type, target_id);
CREATE INDEX IF NOT EXISTS ix_reports_owner  ON content_reports (target_owner_id, created_at DESC);
-- One open report per person per thing; duplicates are noise, not signal.
CREATE UNIQUE INDEX IF NOT EXISTS ux_reports_dedup
  ON content_reports (reporter_id, target_type, target_id) WHERE status = 'open';

-- What a moderator actually did, including expiry for temporary sanctions. The
-- record a suspended user is owed and an appeal is decided from.
CREATE TABLE IF NOT EXISTS moderation_actions (
  id            TEXT PRIMARY KEY,
  moderator_id  TEXT REFERENCES users (id) ON DELETE SET NULL,
  report_id     TEXT REFERENCES content_reports (id) ON DELETE SET NULL,
  target_type   TEXT NOT NULL,
  target_id     TEXT NOT NULL,
  subject_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  action        TEXT NOT NULL CHECK (action IN
                  ('none', 'warn', 'hide', 'unlist', 'remove', 'lock',
                   'shadowban', 'suspend', 'ban', 'restore', 'reputation_penalty')),
  reason        TEXT NOT NULL,
  public_note   TEXT,
  expires_at    INTEGER,
  reverted_at   INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;

CREATE INDEX IF NOT EXISTS ix_mod_actions_subject ON moderation_actions (subject_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_mod_actions_target  ON moderation_actions (target_type, target_id);
CREATE INDEX IF NOT EXISTS ix_mod_actions_expiry  ON moderation_actions (expires_at)
  WHERE expires_at IS NOT NULL AND reverted_at IS NULL;

-- Append-only record of privileged and state-changing operations across the
-- whole system — role changes, escrow movements, suggestion status edits,
-- verification decisions. Separate from moderation_actions: that is the
-- moderator's decision, this is the system's memory.
CREATE TABLE IF NOT EXISTS audit_log (
  id           TEXT PRIMARY KEY,
  actor_id     TEXT REFERENCES users (id) ON DELETE SET NULL,
  actor_role   TEXT,
  action       TEXT NOT NULL,                      -- 'project.publish', 'bounty.release', ...
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  before_json  TEXT,
  after_json   TEXT,
  ip_hash      TEXT,
  user_agent   TEXT,
  created_at   INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;

CREATE INDEX IF NOT EXISTS ix_audit_entity ON audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_actor  ON audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_time   ON audit_log (created_at DESC);

-- ---------------------------------------------------------------------------
-- 14. SEARCH  (SQLite-only — replace with tsvector + GIN on Postgres)
-- ---------------------------------------------------------------------------
-- External-content FTS5 over projects: the index stores only the terms, the rows
-- stay in `projects`, and the triggers keep the two in step.

CREATE VIRTUAL TABLE IF NOT EXISTS projects_fts USING fts5(
  title,
  tagline,
  summary_md,
  content = 'projects',
  content_rowid = 'rowid',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS trg_projects_fts_ai AFTER INSERT ON projects BEGIN
  INSERT INTO projects_fts (rowid, title, tagline, summary_md)
  VALUES (new.rowid, new.title, new.tagline, new.summary_md);
END;

CREATE TRIGGER IF NOT EXISTS trg_projects_fts_ad AFTER DELETE ON projects BEGIN
  INSERT INTO projects_fts (projects_fts, rowid, title, tagline, summary_md)
  VALUES ('delete', old.rowid, old.title, old.tagline, old.summary_md);
END;

CREATE TRIGGER IF NOT EXISTS trg_projects_fts_au AFTER UPDATE ON projects BEGIN
  INSERT INTO projects_fts (projects_fts, rowid, title, tagline, summary_md)
  VALUES ('delete', old.rowid, old.title, old.tagline, old.summary_md);
  INSERT INTO projects_fts (rowid, title, tagline, summary_md)
  VALUES (new.rowid, new.title, new.tagline, new.summary_md);
END;

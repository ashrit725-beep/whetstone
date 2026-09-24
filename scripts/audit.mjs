/**
 * Does every number the product prints agree with the rows underneath it?
 *
 * Counters are denormalised all over this schema because the read paths need
 * them, which means each one can drift from its source. This asks the same
 * question of every one of them: count the rows, compare to the column, and
 * fail loudly on any disagreement. Run it after any change to the seed or the
 * population, and before claiming the data is sound.
 *
 *   node scripts/audit.mjs [--db path]
 *
 * It reads `--db` if given, otherwise DATABASE_PATH like the app does, so a
 * rehearsed rebuild can be audited without opening the file the running
 * servers hold. Nothing here writes.
 */

import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
// The feed's own constants and the hand-written content, read from the files
// the application and the seed read, so a retuned threshold moves the check.
import { FEED, REPUTATION_TIERS } from '../src/lib/taxonomy.ts'
import { PROJECTS } from '../src/server/db/seed-data.ts'
// Which categories bear on which rating axis, as the population writes them,
// and which of them name a fault rather than a subject.
import { AXIS_EVIDENCE, FAULT_CATEGORIES } from './scale/vocab.mjs'
// The writer's own definition of a run of words long enough to be a tell, so
// the check and the generator cannot drift apart.
import { PAGE_RUN, runsOf } from './scale/compose.mjs'

const dbFlag = process.argv.indexOf('--db')
const db = new DatabaseSync(
  path.resolve(
    process.cwd(),
    dbFlag === -1 ? (process.env.DATABASE_PATH ?? 'data/whetstone.db') : process.argv[dbFlag + 1],
  ),
)
const checks = []
const check = (label, sql, params = []) => checks.push({ label, n: db.prepare(sql).get(...params).n })

/** The instant the database was built as of, which is what "recent" is measured from. */
const BUILT = Number(db.prepare(`SELECT meta_value AS v FROM schema_meta WHERE meta_key = 'seeded_at'`).get()?.v ?? Date.now())
const HOUR = 3_600_000

/* -- counters against their rows ---------------------------------------- */
check('feedback.reply_count vs replies',
  `SELECT COUNT(*) n FROM feedback f WHERE f.reply_count <>
     (SELECT COUNT(*) FROM feedback_replies r WHERE r.feedback_id = f.id AND r.deleted_at IS NULL)`)
check('feedback.point_count vs points',
  `SELECT COUNT(*) n FROM feedback f WHERE f.point_count <>
     (SELECT COUNT(*) FROM feedback_points p WHERE p.feedback_id = f.id)`)
check('feedback.blocker_count vs points',
  `SELECT COUNT(*) n FROM feedback f WHERE f.blocker_count <>
     (SELECT COUNT(*) FROM feedback_points p WHERE p.feedback_id = f.id AND p.severity = 'blocker')`)
// The creator's first answer, which is what the application records.
check('feedback.first_reply_at vs replies',
  `SELECT COUNT(*) n FROM feedback f WHERE f.first_reply_at IS NOT
     (SELECT MIN(r.created_at) FROM feedback_replies r
       WHERE r.feedback_id = f.id AND r.deleted_at IS NULL AND r.is_creator = 1)`)
check('feedback_points.upvote_count vs votes',
  `SELECT COUNT(*) n FROM feedback_points p WHERE p.upvote_count <>
     (SELECT COUNT(*) FROM feedback_point_votes v WHERE v.point_id = p.id)`)
// Counted the way the application counts on every submit: submitted reviews
// that have not been deleted.
check('project_stats.feedback_count vs notes',
  `SELECT COUNT(*) n FROM project_stats s WHERE s.feedback_count <>
     (SELECT COUNT(*) FROM feedback f WHERE f.project_id = s.project_id AND f.status = 'submitted' AND f.deleted_at IS NULL)`)
check('project_stats.reviewer_count vs notes',
  `SELECT COUNT(*) n FROM project_stats s WHERE s.reviewer_count <>
     (SELECT COUNT(DISTINCT f.reviewer_id) FROM feedback f
       WHERE f.project_id = s.project_id AND f.status = 'submitted' AND f.deleted_at IS NULL)`)
check('project_asks.answer_count vs points',
  `SELECT COUNT(*) n FROM project_asks a WHERE a.answer_count <>
     (SELECT COUNT(*) FROM feedback_points p WHERE p.ask_id = a.id)`)
check('discussion_channels.thread_count vs threads',
  `SELECT COUNT(*) n FROM discussion_channels c WHERE c.thread_count <>
     (SELECT COUNT(*) FROM discussion_threads t
       WHERE t.channel_id = c.id AND t.deleted_at IS NULL AND t.status <> 'removed')`)
check('discussion_threads.post_count vs posts',
  `SELECT COUNT(*) n FROM discussion_threads t WHERE t.post_count <>
     (SELECT COUNT(*) FROM discussion_posts p WHERE p.thread_id = t.id AND p.deleted_at IS NULL)`)
check('discussion_threads.last_post_at vs posts',
  `SELECT COUNT(*) n FROM discussion_threads t WHERE t.last_post_at IS NOT
     (SELECT MAX(p.created_at) FROM discussion_posts p WHERE p.thread_id = t.id AND p.deleted_at IS NULL)`)
// votePost() rewrites a thread's score to the sum of its posts' on every vote,
// so any other stored number jumps on the first vote and reorders Top.
check('discussion_threads.score vs posts',
  `SELECT COUNT(*) n FROM discussion_threads t WHERE t.score <>
     (SELECT COALESCE(SUM(p.score), 0) FROM discussion_posts p WHERE p.thread_id = t.id AND p.deleted_at IS NULL)`)

/* -- referential and logical soundness ----------------------------------- */
check('answered threads with no accepted post',
  `SELECT COUNT(*) n FROM discussion_threads WHERE status = 'answered' AND accepted_post_id IS NULL`)
check('accepted_post_id pointing at nothing',
  `SELECT COUNT(*) n FROM discussion_threads t WHERE t.accepted_post_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM discussion_posts p WHERE p.id = t.accepted_post_id)`)
check('accepted post not flagged accepted',
  `SELECT COUNT(*) n FROM discussion_threads t JOIN discussion_posts p ON p.id = t.accepted_post_id
    WHERE p.is_accepted = 0`)
check('accepted post in the wrong thread',
  `SELECT COUNT(*) n FROM discussion_threads t JOIN discussion_posts p ON p.id = t.accepted_post_id
    WHERE p.thread_id <> t.id`)
check('replies dated before their note',
  `SELECT COUNT(*) n FROM feedback_replies r JOIN feedback f ON f.id = r.feedback_id
    WHERE r.created_at < f.submitted_at`)
check('notes dated before their project',
  `SELECT COUNT(*) n FROM feedback f JOIN projects p ON p.id = f.project_id
    WHERE f.submitted_at < p.published_at`)
check('posts dated before their thread',
  `SELECT COUNT(*) n FROM discussion_posts p JOIN discussion_threads t ON t.id = p.thread_id
    WHERE p.created_at < t.created_at`)
check('projects published before their owner joined',
  `SELECT COUNT(*) n FROM projects p JOIN users u ON u.id = p.owner_id
    WHERE p.published_at < u.created_at`)
// `/p/<slug>` is one namespace for every member, so a slug belongs to one
// project or the older one becomes unreachable at its own address. The unique
// index says so too; this catches a generator that stopped agreeing with it
// before the index refuses to be built.
check('project slugs shared by more than one project',
  `SELECT COUNT(*) n FROM (SELECT slug FROM projects GROUP BY slug HAVING COUNT(*) > 1)`)
check('project slugs a URL cannot carry',
  `SELECT COUNT(*) n FROM projects WHERE slug <> LOWER(slug) OR slug GLOB '*[^a-z0-9-]*'
     OR slug LIKE '-%' OR slug LIKE '%-' OR LENGTH(slug) = 0`)
check('threads whose last post precedes them',
  `SELECT COUNT(*) n FROM discussion_threads WHERE last_post_at IS NOT NULL AND last_post_at < created_at`)
check('rows updated before they were created',
  `SELECT (SELECT COUNT(*) FROM projects WHERE updated_at < created_at)
        + (SELECT COUNT(*) FROM feedback WHERE updated_at < created_at)
        + (SELECT COUNT(*) FROM discussion_threads WHERE updated_at < created_at) AS n`)
check('people last seen before they joined',
  `SELECT COUNT(*) n FROM users WHERE last_seen_at IS NOT NULL AND last_seen_at < created_at`)
// "The future" has to come from a clock, not from the data being checked: the
// first version of this took the latest review as its definition of now, so a
// row dated after every other row could never fail it. Every timestamp column
// in every table is covered, except the ones that are deadlines by design.
{
  const NOW_MS = Date.now()
  const AHEAD = new Set(['expires_at', 'ends_at', 'closes_at', 'due_at', 'feedback_closes_at'])
  let n = 0
  for (const { name } of db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).all()) {
    for (const column of db.prepare(`PRAGMA table_info(${name})`).all()) {
      if (!column.name.endsWith('_at') || AHEAD.has(column.name)) continue
      n += db.prepare(`SELECT COUNT(*) AS n FROM ${name} WHERE ${column.name} > ?`).get(NOW_MS).n
    }
  }
  checks.push({ label: 'anything dated after this moment', n })
}
check('people reviewing their own project',
  `SELECT COUNT(*) n FROM feedback f JOIN projects p ON p.id = f.project_id WHERE f.reviewer_id = p.owner_id`)
check('people agreeing with their own point',
  `SELECT COUNT(*) n FROM feedback_point_votes v JOIN feedback_points p ON p.id = v.point_id
     JOIN feedback f ON f.id = p.feedback_id WHERE v.voter_id = f.reviewer_id`)
// Severity and sentiment come from the same tone in the generator, so comparing
// them to each other can never fail. What can fail is the text disagreeing with
// the label it was filed under, which is what a reader actually sees.
check('a change request filed under Delight',
  `SELECT COUNT(*) n FROM feedback_points p JOIN feedback_categories c ON c.id = p.category_id
    WHERE c.label LIKE '%Delight%' AND p.severity IN ('major', 'blocker')`)
check('praise filed under a fault category',
  `SELECT COUNT(*) n FROM feedback_points p JOIN feedback_categories c ON c.id = p.category_id
    WHERE (c.label LIKE '%Bug%' OR c.label LIKE '%defect%') AND p.severity = 'praise'`)
check('shipped suggestions naming no build',
  `SELECT COUNT(*) n FROM suggestions s
    WHERE s.status = 'shipped' AND s.shipped_in_version_id IS NULL
      AND EXISTS (SELECT 1 FROM project_versions v WHERE v.project_id = s.project_id)`)
check('asks on a project that does not exist',
  `SELECT COUNT(*) n FROM project_asks a WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = a.project_id)`)
check('needs naming a kind that does not exist',
  `SELECT COUNT(*) n FROM project_needs pn WHERE NOT EXISTS
     (SELECT 1 FROM need_kinds k WHERE k.need_key = pn.need_key)`)
check('profiles without a user',
  `SELECT COUNT(*) n FROM profiles pr WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = pr.user_id)`)
check('published projects with no ask',
  `SELECT COUNT(*) n FROM projects p WHERE p.status = 'published'
     AND NOT EXISTS (SELECT 1 FROM project_asks a WHERE a.project_id = p.id)`)
check('text still carrying an unfilled slot',
  `SELECT (SELECT COUNT(*) FROM projects WHERE title LIKE '%{%' OR tagline LIKE '%{%' OR summary_md LIKE '%{%')
        + (SELECT COUNT(*) FROM project_asks WHERE prompt LIKE '%{%')
        + (SELECT COUNT(*) FROM feedback WHERE headline LIKE '%{%' OR summary_md LIKE '%{%')
        + (SELECT COUNT(*) FROM feedback_points WHERE body_md LIKE '%{%')
        + (SELECT COUNT(*) FROM feedback_replies WHERE body_md LIKE '%{%')
        + (SELECT COUNT(*) FROM discussion_threads WHERE title LIKE '%{%' OR body_md LIKE '%{%')
        + (SELECT COUNT(*) FROM discussion_posts WHERE body_md LIKE '%{%')
        + (SELECT COUNT(*) FROM profiles WHERE bio LIKE '%{%') AS n`)

check('suggestions.vote_count vs votes',
  `SELECT COUNT(*) n FROM suggestions s WHERE s.vote_count <>
     (SELECT COUNT(*) FROM suggestion_votes v WHERE v.suggestion_id = s.id)`)
check('suggestions.source_count vs sources',
  `SELECT COUNT(*) n FROM suggestions s WHERE s.source_count <>
     (SELECT COUNT(*) FROM suggestion_sources src WHERE src.suggestion_id = s.id)`)
check('shipped suggestions with no ship date',
  `SELECT COUNT(*) n FROM suggestions WHERE status = 'shipped' AND shipped_at IS NULL`)
check('refused suggestions with no reason',
  `SELECT COUNT(*) n FROM suggestions WHERE status IN ('declined', 'wont_fix') AND status_note IS NULL`)
check('suggestions sourced from another project',
  `SELECT COUNT(*) n FROM suggestion_sources src
     JOIN suggestions s ON s.id = src.suggestion_id
     JOIN feedback_points fp ON fp.id = src.point_id
     JOIN feedback f ON f.id = fp.feedback_id
    WHERE f.project_id <> s.project_id`)
check('suggestions shipped in another project build',
  `SELECT COUNT(*) n FROM suggestions s JOIN project_versions v ON v.id = s.shipped_in_version_id
    WHERE v.project_id <> s.project_id`)
check('projects with more than one current build',
  `SELECT COUNT(*) n FROM (SELECT project_id FROM project_versions WHERE is_current = 1
                            GROUP BY project_id HAVING COUNT(*) > 1)`)
// A build legitimately predates the day the project was posted here: people
// work before they ask for feedback, and six of the hand-written projects do
// exactly that. What cannot happen is a build older than its author.
check('builds released before their author joined',
  `SELECT COUNT(*) n FROM project_versions v
     JOIN projects p ON p.id = v.project_id
     JOIN users u ON u.id = p.owner_id
    WHERE v.released_at < u.created_at`)
check('accepted answers nobody agreed with',
  `SELECT COUNT(*) n FROM discussion_posts WHERE is_accepted = 1 AND score = 0`)

/* -- counters with nothing underneath them -------------------------------- */

// A number the product prints has to be a count of rows somebody can point at.
// These were all invented beside the rows rather than from them, so the first
// real vote or reply would have recomputed the column and collapsed the number.
check('helpful_count with no votes behind it',
  `SELECT COUNT(*) n FROM feedback f WHERE f.helpful_count <>
     (SELECT COUNT(*) FROM feedback_votes v WHERE v.feedback_id = f.id AND v.vote_value = 1)`)
check('post score with no votes behind it',
  `SELECT COUNT(*) n FROM discussion_posts p WHERE p.score <>
     (SELECT COALESCE(SUM(v.vote_value), 0) FROM post_votes v WHERE v.post_id = p.id)`)
check('project_stats.follower_count vs follows',
  `SELECT COUNT(*) n FROM project_stats s WHERE s.follower_count <>
     (SELECT COUNT(*) FROM project_follows pf WHERE pf.project_id = s.project_id)`)
check('project_stats.bookmark_count vs bookmarks',
  `SELECT COUNT(*) n FROM project_stats s WHERE s.bookmark_count <>
     (SELECT COUNT(*) FROM project_bookmarks pb WHERE pb.project_id = s.project_id)`)
// A follow and a bookmark are standing subscriptions to a page, and a follow
// also puts the project's title into somebody's bell on every new build. Work
// its owner has not published is not a page anyone else may subscribe to: a row
// here from a stranger is how somebody who guessed a slug learns the name of an
// unfinished project, and then keeps being told about it.
//
// Who "anyone else" is, is canSeeProject()'s answer rather than a looser one of
// our own: the owner and the collaborators can always open the row, everybody
// else only once it is published and not private. So a subscription that
// function would refuse is a row the product can no longer produce — including
// the two shapes a status-only test misses, a published-but-private project and
// a collaborator who is not the owner.
const unseenBy = (table) =>
  `SELECT COUNT(*) n FROM ${table} s JOIN projects p ON p.id = s.project_id
    WHERE s.user_id <> p.owner_id
      AND NOT EXISTS (SELECT 1 FROM project_collaborators c
                       WHERE c.project_id = p.id AND c.user_id = s.user_id)
      AND (p.deleted_at IS NOT NULL OR p.status <> 'published' OR p.visibility = 'private')`
check('follows on work their follower cannot open', unseenBy('project_follows'))
check('bookmarks on work their reader cannot open', unseenBy('project_bookmarks'))
check('reputation feedback_count vs reviews written',
  `SELECT COUNT(*) n FROM reputation_scores r WHERE r.feedback_count <>
     (SELECT COUNT(*) FROM feedback f WHERE f.reviewer_id = r.user_id AND f.status = 'submitted')`)
check('reputation helpful_count vs helpful marks',
  `SELECT COUNT(*) n FROM reputation_scores r WHERE r.helpful_count <>
     (SELECT COUNT(*) FROM feedback f WHERE f.reviewer_id = r.user_id
        AND f.status = 'submitted' AND f.creator_marked_helpful = 1)`)
// The headline figure is reviewer credibility (persistReputation writes
// total_score = reviewer_score); creator and community standing are shown beside
// it, never added in. An additive total reached 1,517 on a 1,000 scale and put a
// different number on the card than on the reputation tab.
check('reputation headline is not the reviewer credibility',
  `SELECT COUNT(*) n FROM reputation_scores WHERE total_score <> reviewer_score`)
check('reputation figures outside the 0..1000 scale',
  `SELECT COUNT(*) n FROM reputation_scores
    WHERE reviewer_score NOT BETWEEN 0 AND 1000 OR creator_score NOT BETWEEN 0 AND 1000
       OR community_score NOT BETWEEN 0 AND 1000 OR expert_score NOT BETWEEN 0 AND 1000
       OR total_score NOT BETWEEN 0 AND 1000`)
// Every card prints the tier beside the number, both out of this one row, so a
// level that does not follow from the score puts "New" next to 147.
check('reputation level disagreeing with the tier its score falls in',
  `SELECT COUNT(*) n FROM reputation_scores WHERE level <> (CASE ${REPUTATION_TIERS
    .map((t) => `WHEN total_score >= ${t.min} THEN ${t.level}`)
    .reverse()
    .join(' ')} ELSE 1 END)`)
check('reputation helpful_rate disagreeing with its own counts',
  `SELECT COUNT(*) n FROM reputation_scores
    WHERE (feedback_count = 0 AND helpful_rate <> 0.0)
       OR (feedback_count > 0
           AND ABS(helpful_rate - (CAST(helpful_count AS REAL) / feedback_count)) > 0.01)`)
// A rollup is a cache of the evidence, and the application refreshes it on
// every write that could move it. One older than its own newest event is a
// write path that recorded the evidence and never rewrote the summary — which
// is how an account can read "New · 0 credibility" on a thread while its own
// reputation tab computes a real score from the same rows.
check('reputation rollups older than the evidence they summarise',
  `SELECT COUNT(*) n FROM reputation_scores r
    WHERE r.computed_at < COALESCE(
      (SELECT MAX(e.created_at) FROM reputation_events e WHERE e.user_id = r.user_id), 0)
       OR r.computed_at < COALESCE(
      (SELECT MAX(f.submitted_at) FROM feedback f
        WHERE f.reviewer_id = r.user_id AND f.status = 'submitted'), 0)`)
// Every card reads this row through COALESCE(rs.total_score, 0), so a member
// without one is indistinguishable from a member worth nothing.
check('members with no reputation rollup at all',
  `SELECT COUNT(*) n FROM users u WHERE u.deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM reputation_scores r WHERE r.user_id = u.id)`)

/* -- values on the scale the application reads ---------------------------- */

// quality_score is specificity on 0..1: clamp01() reads it and the qualified
// threshold is 0.5. Writing it on a 0..100 scale clamped every note to a full
// meter, which is both wrong and identical on every row.
check('quality_score outside the 0..1 scale',
  `SELECT COUNT(*) n FROM feedback WHERE quality_score IS NOT NULL
     AND (quality_score < 0 OR quality_score > 1)`)
// The public thread's default tab is "Most helpful", and its order is
// helpful_count, then quality_score, then submitted_at — the three columns
// ix_feedback_public is built on. Almost no note has ever been voted helpful,
// so on a normal project the whole order is the second and third keys. A note
// with no quality score drops out of the middle of it and falls through to the
// last resort, which is the primary key, which is a random UUID: the best note
// on the project can then be printed last and cut off by the five-note preview.
// With this check and 'two reviews of one project at one instant' below, the
// order is total and the same on every load.
check('submitted reviews with no quality score to sort on',
  `SELECT COUNT(*) n FROM feedback
    WHERE status = 'submitted' AND deleted_at IS NULL AND quality_score IS NULL`)
// A headline and a summary do different jobs, and the profile's review row
// prints one directly above the other. The same sentence in both is that
// sentence twice in one card — and because the row falls back to the first
// point's body when there is no summary, the honest shape when a reviewer has
// written only an impression is a headline and no summary at all.
check('reviews whose summary is a copy of their own headline',
  `SELECT COUNT(*) n FROM feedback
    WHERE headline IS NOT NULL AND summary_md IS NOT NULL
      AND TRIM(headline) = TRIM(summary_md)`)
check('notes badged expert by a non-expert',
  `SELECT COUNT(*) n FROM feedback f JOIN users u ON u.id = f.reviewer_id
    WHERE f.reviewer_is_expert = 1 AND u.is_expert = 0`)

/* -- nothing predates the person who wrote it ----------------------------- */

check('reviews written before their reviewer joined',
  `SELECT COUNT(*) n FROM feedback f JOIN users u ON u.id = f.reviewer_id
    WHERE f.submitted_at < u.created_at`)
check('replies written before their author joined',
  `SELECT COUNT(*) n FROM feedback_replies r JOIN users u ON u.id = r.author_id
    WHERE r.created_at < u.created_at`)
check('posts written before their author joined',
  `SELECT COUNT(*) n FROM discussion_posts p JOIN users u ON u.id = p.author_id
    WHERE p.created_at < u.created_at`)
check('threads started before their author joined',
  `SELECT COUNT(*) n FROM discussion_threads t JOIN users u ON u.id = t.author_id
    WHERE t.created_at < u.created_at`)
check('point votes cast before the voter joined',
  `SELECT COUNT(*) n FROM feedback_point_votes v JOIN users u ON u.id = v.voter_id
    WHERE v.created_at < u.created_at`)
check('note votes cast before the voter joined',
  `SELECT COUNT(*) n FROM feedback_votes v JOIN users u ON u.id = v.voter_id
    WHERE v.created_at < u.created_at`)
check('post votes cast before the voter joined',
  `SELECT COUNT(*) n FROM post_votes v JOIN users u ON u.id = v.voter_id
    WHERE v.created_at < u.created_at`)
check('notes naming a build released after them',
  `SELECT COUNT(*) n FROM feedback f JOIN project_versions v ON v.id = f.version_id
    WHERE v.released_at > f.submitted_at`)

/* -- time: no pile-ups, and a present that is alive ----------------------- */

// Any date that ran past the present used to be clamped to it, which stacked
// fourteen thousand reviews on one millisecond and made "Newest" meaningless.
// A handful of rows can share an instant by coincidence; dozens cannot.
{
  const SHARED = [
    ['feedback', 'submitted_at'], ['feedback_replies', 'created_at'], ['feedback_votes', 'created_at'],
    ['feedback_point_votes', 'created_at'], ['discussion_threads', 'created_at'], ['discussion_posts', 'created_at'],
    ['post_votes', 'created_at'], ['projects', 'published_at'], ['project_versions', 'released_at'],
    ['suggestions', 'created_at'], ['suggestion_votes', 'created_at'], ['users', 'created_at'],
    ['bounties', 'created_at'], ['bounty_applications', 'created_at'],
  ]
  let n = 0
  for (const [table, column] of SHARED) {
    const top = db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} IS NOT NULL GROUP BY ${column} ORDER BY n DESC LIMIT 1`).get()
    if ((top?.n ?? 0) > 4) {
      n += top.n
      console.log(`        ${table}.${column}: ${top.n} rows share one instant`)
    }
  }
  checks.push({ label: 'more than four rows sharing one instant', n })
}
check('two reviews of one project at one instant',
  `SELECT COUNT(*) n FROM (SELECT 1 FROM feedback GROUP BY project_id, submitted_at HAVING COUNT(*) > 1)`)
// A community whose last review, reply or post is days old reads as abandoned.
{
  const since = BUILT - 48 * HOUR
  const quiet = [['feedback', 'submitted_at'], ['feedback_replies', 'created_at'], ['discussion_posts', 'created_at'], ['feedback_votes', 'created_at']]
    .filter(([table, column]) => db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} > ? AND ${column} <= ?`).get(since, BUILT).n === 0)
  for (const [table] of quiet) console.log(`        nothing in ${table} in the 48 hours before the build`)
  checks.push({ label: 'no activity in the 48 hours before the build', n: quiet.length })
}
// The four weeks before the build are what the landing chart draws. No day may
// be a spike or a hole next to the rest: each sits within 0.6 to 1.6 times the
// median day.
{
  const DAY = 24 * HOUR
  const today = Math.floor(BUILT / DAY)
  const counts = []
  for (let d = today - 28; d < today; d++) {
    counts.push(db.prepare(`SELECT COUNT(*) AS n FROM feedback WHERE status = 'submitted' AND submitted_at >= ? AND submitted_at < ?`)
      .get(d * DAY, (d + 1) * DAY).n)
  }
  const median = [...counts].sort((a, b) => a - b)[14]
  const odd = counts.filter((c) => c < median * 0.6 || c > median * 1.6).length
  checks.push({ label: 'a day in the last four weeks far off the rest', n: odd + (median === 0 ? 1 : 0) })
}
check('note votes cast before their note',
  `SELECT COUNT(*) n FROM feedback_votes v JOIN feedback f ON f.id = v.feedback_id WHERE v.created_at < f.submitted_at`)
check('point votes cast before their point',
  `SELECT COUNT(*) n FROM feedback_point_votes v JOIN feedback_points p ON p.id = v.point_id WHERE v.created_at < p.created_at`)
check('post votes cast before their post',
  `SELECT COUNT(*) n FROM post_votes v JOIN discussion_posts p ON p.id = v.post_id WHERE v.created_at < p.created_at`)
check('suggestion votes cast before their suggestion',
  `SELECT COUNT(*) n FROM suggestion_votes v JOIN suggestions s ON s.id = v.suggestion_id WHERE v.created_at < s.created_at`)
// A creator links later notes to a suggestion as they arrive, so a source can
// postdate the suggestion; it cannot be linked before it was written.
check('suggestion sources linked before the point or the suggestion existed',
  `SELECT COUNT(*) n FROM suggestion_sources src JOIN suggestions s ON s.id = src.suggestion_id
     JOIN feedback_points p ON p.id = src.point_id WHERE src.created_at < p.created_at OR src.created_at < s.created_at`)
check('ratings dated apart from their review',
  `SELECT COUNT(*) n FROM feedback_ratings r JOIN feedback f ON f.id = r.feedback_id WHERE r.created_at <> f.submitted_at`)

/* -- ratings --------------------------------------------------------------- */

// The five questions every review answers are the product's promise, and the
// disagreement plots are built from these rows. Some reviewers skip them, but
// most do not.
{
  const r = db.prepare(`SELECT (SELECT COUNT(*) FROM feedback WHERE status = 'submitted') AS total,
                               (SELECT COUNT(DISTINCT feedback_id) FROM feedback_ratings) AS rated`).get()
  checks.push({ label: 'fewer than four reviews in five carrying ratings', n: Math.max(0, Math.ceil(r.total * 0.8) - r.rated) })
}
check('ratings outside their axis scale',
  `SELECT COUNT(*) n FROM feedback_ratings r JOIN rating_axes a ON a.id = r.axis_id
    WHERE r.rating_value < 1 OR r.rating_value > a.scale_max`)
// A rating is a verdict between the axis's two written anchors, so it has to
// agree with what the same review says about that axis: nobody files a crash
// and rates stability "Solid throughout", or praises the controls, files
// nothing serious against them, and rates game feel "Mushy, mistimed".
{
  db.exec(`CREATE TEMP TABLE axis_evidence (type_slug TEXT, axis_key TEXT, category_id TEXT)`)
  const add = db.prepare(`INSERT INTO axis_evidence VALUES (?, ?, ?)`)
  for (const [type, axes] of Object.entries(AXIS_EVIDENCE)) {
    for (const [axis, keys] of Object.entries(axes)) for (const key of keys) add.run(type, axis, `${type}:${key}`)
  }
  check('ratings contradicting what their own review says about the axis',
    `WITH said AS (
       SELECT fp.feedback_id, a.id AS axis_id, a.scale_max,
              MAX(fp.severity = 'blocker') AS blocker,
              MAX(fp.severity = 'praise') AS praise,
              MAX(fp.severity IN ('blocker', 'major')) AS serious
         FROM feedback_points fp
         JOIN axis_evidence ev ON ev.category_id = fp.category_id
         JOIN project_types pt ON pt.slug = ev.type_slug
         JOIN rating_axes a ON a.project_type_id = pt.id AND a.axis_key = ev.axis_key
        GROUP BY fp.feedback_id, a.id)
     SELECT COUNT(*) n FROM said s
       JOIN feedback_ratings r ON r.feedback_id = s.feedback_id AND r.axis_id = s.axis_id
      WHERE (s.blocker = 1 AND r.rating_value = s.scale_max)
         OR (s.praise = 1 AND s.serious = 0 AND r.rating_value = 1)`)
}

/* -- what one point card says about itself --------------------------------- */

// A point card prints its category, its severity and its actionability in one
// block above the sentence, so the three have to agree with each other and with
// what is written underneath. Two ways they can contradict:
//
//   * a compliment filed under a category that names a fault — "Broken link",
//     severity "Keep this", body "Clean, technically: no glitches";
//   * a blocker typed "Preference", which the taxonomy defines as "a judgment
//     with a direction, but no named change" — a blocker is not a taste.
{
  const faults = [...FAULT_CATEGORIES]
  check('compliments filed under a category that names a fault',
    `SELECT COUNT(*) n FROM feedback_points p
       JOIN feedback_categories c ON c.id = p.category_id
      WHERE p.severity = 'praise'
        AND c.category_key IN (${faults.map(() => '?').join(', ')})`,
    faults)
}
check('faults the same card calls a matter of preference',
  `SELECT COUNT(*) n FROM feedback_points
    WHERE severity IN ('blocker', 'major') AND actionability = 'opinion'`)
// Counted the way recomputeProjectRating() counts.
check('project_stats.rating_count vs ratings',
  `SELECT COUNT(*) n FROM project_stats s WHERE s.rating_count <>
     (SELECT COUNT(*) FROM feedback_ratings r JOIN feedback f ON f.id = r.feedback_id
       WHERE f.project_id = s.project_id AND f.status = 'submitted' AND f.deleted_at IS NULL)`)
check('project_stats.rating_avg vs ratings',
  `SELECT COUNT(*) n FROM project_stats s WHERE ABS(s.rating_avg - COALESCE(
     (SELECT SUM(r.rating_value * a.weight * (5.0 / a.scale_max)) / SUM(a.weight)
        FROM feedback_ratings r JOIN feedback f ON f.id = r.feedback_id JOIN rating_axes a ON a.id = r.axis_id
       WHERE f.project_id = s.project_id AND f.status = 'submitted' AND f.deleted_at IS NULL), 0)) > 0.006`)

/* -- the rest of what a project page prints -------------------------------- */

check('project_stats.expert_feedback_count vs notes',
  `SELECT COUNT(*) n FROM project_stats s WHERE s.expert_feedback_count <>
     (SELECT COUNT(*) FROM feedback f WHERE f.project_id = s.project_id AND f.status = 'submitted'
        AND f.deleted_at IS NULL AND f.reviewer_is_expert = 1)`)
check('project_stats.last_feedback_at vs notes',
  `SELECT COUNT(*) n FROM project_stats s WHERE s.last_feedback_at IS NOT
     (SELECT MAX(f.submitted_at) FROM feedback f WHERE f.project_id = s.project_id AND f.status = 'submitted' AND f.deleted_at IS NULL)`)
check('project_stats.reply_rate vs notes',
  `SELECT COUNT(*) n FROM project_stats s WHERE ABS(s.reply_rate - COALESCE(
     (SELECT CAST(SUM(CASE WHEN f.first_reply_at IS NOT NULL THEN 1 ELSE 0 END) AS REAL) / NULLIF(COUNT(*), 0)
        FROM feedback f WHERE f.project_id = s.project_id AND f.status = 'submitted' AND f.deleted_at IS NULL), 0)) > 0.001`)
check('project_stats suggestion counts vs suggestions',
  `SELECT COUNT(*) n FROM project_stats s
    WHERE s.open_suggestions <> (SELECT COUNT(*) FROM suggestions g WHERE g.project_id = s.project_id
                                   AND g.status IN ('open', 'under_review', 'planned', 'in_progress'))
       OR s.shipped_suggestions <> (SELECT COUNT(*) FROM suggestions g WHERE g.project_id = s.project_id AND g.status = 'shipped')`)
check('projects past prototype with no build',
  `SELECT COUNT(*) n FROM projects p WHERE p.stage_key IN ('beta', 'release_candidate', 'shipped')
     AND NOT EXISTS (SELECT 1 FROM project_versions v WHERE v.project_id = p.id)`)

/* -- tags ------------------------------------------------------------------ */

check('tags.usage_count vs projects carrying them',
  `SELECT COUNT(*) n FROM tags t WHERE t.usage_count <>
     (SELECT COUNT(*) FROM project_tags pt JOIN projects p ON p.id = pt.project_id
       WHERE pt.tag_id = t.id AND p.status = 'published' AND p.visibility = 'public' AND p.deleted_at IS NULL)`)
{
  const r = db.prepare(`SELECT COUNT(*) AS total,
                               SUM(NOT EXISTS (SELECT 1 FROM project_tags pt WHERE pt.project_id = p.id)) AS bare
                          FROM projects p WHERE p.status = 'published' AND p.visibility = 'public' AND p.deleted_at IS NULL`).get()
  checks.push({ label: 'more than one public project in seven untagged', n: Math.max(0, r.bare - Math.floor(r.total / 7)) })
}
check('projects with more than five tags',
  `SELECT COUNT(*) n FROM (SELECT project_id FROM project_tags GROUP BY project_id HAVING COUNT(*) > 5)`)

/* -- the paid-review market ------------------------------------------------ */

// The list badges an area as verified and the profile shows the evidence, and
// both read these rows: a verified area with no credential behind it is a
// badge the profile cannot back up.
check('verified areas with no credential',
  `SELECT COUNT(*) n FROM expert_expertise e WHERE e.is_verified = 1 AND NOT EXISTS
     (SELECT 1 FROM verification_credentials c WHERE c.user_id = e.user_id AND c.expertise_id = e.expertise_id
        AND c.revoked_at IS NULL)`)
check('listed experts with no verified area',
  `SELECT COUNT(*) n FROM expert_profiles ep WHERE ep.is_listed = 1 AND NOT EXISTS
     (SELECT 1 FROM expert_expertise e WHERE e.user_id = ep.user_id AND e.is_verified = 1)`)
check('expert flag without a verified profile, or the reverse',
  `SELECT COUNT(*) n FROM users u WHERE u.is_expert <>
     (SELECT COUNT(*) FROM expert_profiles ep WHERE ep.user_id = u.id AND ep.is_verified = 1)`)
check('expert completed_count vs accepted awards',
  `SELECT COUNT(*) n FROM expert_profiles ep WHERE ep.completed_count <>
     (SELECT COUNT(*) FROM bounty_awards a WHERE a.expert_id = ep.user_id AND a.status = 'accepted')`)
check('expert avg_rating vs creator ratings',
  `SELECT COUNT(*) n FROM expert_profiles ep WHERE ABS(ep.avg_rating - COALESCE(
     (SELECT AVG(CAST(a.creator_rating AS REAL)) FROM bounty_awards a
       WHERE a.expert_id = ep.user_id AND a.creator_rating IS NOT NULL), 0)) > 0.006`)
check('expert on_time_rate vs deliveries',
  `SELECT COUNT(*) n FROM expert_profiles ep WHERE ABS(ep.on_time_rate - COALESCE(
     (SELECT AVG(CASE WHEN a.delivered_at <= a.due_at THEN 1.0 ELSE 0.0 END) FROM bounty_awards a
       WHERE a.expert_id = ep.user_id AND a.status = 'accepted'), 0)) > 0.006`)
check('bounties.seats_awarded vs awards',
  `SELECT COUNT(*) n FROM bounties b WHERE b.seats_awarded <> (SELECT COUNT(*) FROM bounty_awards a WHERE a.bounty_id = b.id)`)
check('award amount or fee off the bounty',
  `SELECT COUNT(*) n FROM bounty_awards a JOIN bounties b ON b.id = a.bounty_id
    WHERE a.amount_cents <> b.amount_cents
       OR a.fee_cents <> MIN(b.amount_cents - 1, CAST(ROUND(b.amount_cents * b.platform_fee_bps / 10000.0) AS INTEGER))`)
check('released money that does not add up',
  `SELECT COUNT(*) n FROM bounties b WHERE b.escrow_state = 'released' AND b.amount_cents <>
     (SELECT COALESCE(SUM(e.amount_cents), 0) FROM bounty_escrow_events e
       WHERE e.bounty_id = b.id AND e.event_kind IN ('release', 'fee'))`)
check('escrow state vs its last event',
  `SELECT COUNT(*) n FROM bounties b WHERE b.escrow_state <> COALESCE(
     (SELECT e.to_state FROM bounty_escrow_events e WHERE e.bounty_id = b.id ORDER BY e.created_at DESC, e.rowid DESC LIMIT 1),
     'unfunded')`)
check('bounty status vs its award',
  `SELECT COUNT(*) n FROM bounties b LEFT JOIN bounty_awards a ON a.bounty_id = b.id
    WHERE (b.status IN ('draft', 'open', 'cancelled') AND a.id IS NOT NULL)
       OR (b.status = 'in_progress' AND (a.id IS NULL OR a.status NOT IN ('assigned', 'in_progress')))
       OR (b.status = 'delivered' AND (a.id IS NULL OR a.status <> 'delivered'))
       OR (b.status = 'closed' AND a.id IS NOT NULL AND (a.status <> 'accepted' OR a.payout_state <> 'paid'))`)
check('paid reviews that are not the awarded work',
  `SELECT COUNT(*) n FROM bounty_awards a JOIN bounties b ON b.id = a.bounty_id JOIN feedback f ON f.id = a.feedback_id
    WHERE f.reviewer_id <> a.expert_id OR f.project_id <> b.project_id OR f.origin <> 'bounty' OR f.bounty_id IS NOT b.id
       OR f.submitted_at < a.created_at OR f.submitted_at > a.delivered_at`)
// The other direction of the same link. `origin` and `bounty_id` are what the
// reputation formula reads to refuse a paying creator's helpful mark — "money
// cannot buy the helpful mark" — so a review that claims to be paid and has no
// award behind it would be silently excused from the rule.
check('reviews filed as paid with no award behind them',
  `SELECT COUNT(*) n FROM feedback f
    WHERE (f.origin = 'bounty') <> (f.bounty_id IS NOT NULL)
       OR (f.bounty_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM bounty_awards a WHERE a.feedback_id = f.id))`)
// One review, one bounty. Work already delivered and paid for cannot be handed
// to a second award and collect twice; ux_bounty_awards_feedback refuses the
// row now, and this names the rows to look at in a database written before it.
check('reviews paid for by more than one bounty',
  `SELECT COUNT(*) n FROM (SELECT feedback_id FROM bounty_awards
     WHERE feedback_id IS NOT NULL GROUP BY feedback_id HAVING COUNT(*) > 1)`)
check('open bounties past their closing date',
  `SELECT COUNT(*) n FROM bounties WHERE status = 'open' AND closes_at IS NOT NULL AND closes_at < ${BUILT}`)
check('market rows dated before their bounty',
  `SELECT (SELECT COUNT(*) FROM bounty_applications x JOIN bounties b ON b.id = x.bounty_id WHERE x.created_at < b.created_at)
        + (SELECT COUNT(*) FROM bounty_awards x JOIN bounties b ON b.id = x.bounty_id WHERE x.created_at < b.created_at)
        + (SELECT COUNT(*) FROM bounty_escrow_events x JOIN bounties b ON b.id = x.bounty_id WHERE x.created_at < b.created_at) AS n`)
// Posting authorises and holds in one action, so advertised work sits on
// money that is held, and a bounty seeded long ago reads like one posted today.
check('advertised bounties whose money is not held',
  `SELECT COUNT(*) n FROM bounties WHERE status IN ('open', 'in_progress', 'delivered') AND escrow_state <> 'held'`)
// escrowRefFor() opens 'esc_' and ten hex characters with the first movement
// and every later row reuses it, so one id answers for the whole ledger.
check('escrow references not shaped or shared the way the application files them',
  `SELECT (SELECT COUNT(*) FROM bounties WHERE escrow_ref IS NOT NULL
             AND (length(escrow_ref) <> 14 OR escrow_ref NOT GLOB 'esc_[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'))
        + (SELECT COUNT(*) FROM bounty_escrow_events e JOIN bounties b ON b.id = e.bounty_id
            WHERE e.provider_ref IS NOT b.escrow_ref) AS n`)
// acceptDelivery() writes the release and then the fee, in one action.
check('fees dated before the release they were taken from',
  `SELECT COUNT(*) n FROM bounty_escrow_events f JOIN bounty_escrow_events r
       ON r.award_id = f.award_id AND r.event_kind = 'release'
    WHERE f.event_kind = 'fee' AND f.created_at < r.created_at`)
// The ledger prints these notes beside the rows, worded as the actions word
// them: "10 per cent of the $240 bounty.", not a second "Platform fee".
check('ledger notes worded unlike the application writes them',
  `SELECT COUNT(*) n FROM bounty_escrow_events e JOIN bounties b ON b.id = e.bounty_id
    WHERE (e.event_kind = 'release' AND e.note IS NOT 'Released to the reviewer after acceptance.')
       OR (e.event_kind = 'fee' AND (e.note IS NULL OR e.note NOT LIKE
            CAST(ROUND(e.amount_cents * 100.0 / b.amount_cents) AS INTEGER) || ' per cent of the $% bounty.'))
       OR (e.event_kind = 'refund' AND e.note IS NULL)
       OR (e.event_kind IN ('authorize', 'hold') AND e.note IS NOT NULL)`)
// An invite-only bounty is for one named reviewer, and only they can apply.
check('invite-only bounties with no invitee, or public ones naming one',
  `SELECT COUNT(*) n FROM bounties
    WHERE (visibility = 'invite_only' AND invited_user_id IS NULL)
       OR (visibility = 'public' AND invited_user_id IS NOT NULL)`)
check('applications to an invite-only bounty from anyone but its invitee',
  `SELECT COUNT(*) n FROM bounty_applications x JOIN bounties b ON b.id = x.bounty_id
    WHERE b.visibility = 'invite_only' AND x.applicant_id IS NOT b.invited_user_id`)
check('credentials issued before their holder joined',
  `SELECT COUNT(*) n FROM verification_credentials c JOIN users u ON u.id = c.user_id WHERE c.issued_at < u.created_at`)

/* -- the hand-written projects -------------------------------------------- */

// The feed cuts a project's reach to FEED.penaltyUnanswered once
// FEED.unansweredThreshold of its reviews have sat unanswered for a week. The
// hand-written projects are the ones the product is shown through, and their
// creators answer their reviewers, so none of them may be near that line. It
// is measured on every unanswered review whatever its age, because today's
// reviews are a week old next week and the database keeps being used.
{
  // Slugs are a single namespace now, so each hand-written project is still
  // matched on its owner: that is what proves the row found is the seeded one
  // and not a generated project that happened to be named the same thing.
  const own = PROJECTS.map((p) => `${p.ownerHandle}/${p.slug}`)
  const rows = db.prepare(
    `SELECT p.slug, COUNT(*) AS n FROM feedback f
       JOIN projects p ON p.id = f.project_id JOIN users u ON u.id = p.owner_id
      WHERE u.handle || '/' || p.slug IN (${own.map(() => '?').join(', ')})
        AND f.status = 'submitted' AND f.deleted_at IS NULL AND f.first_reply_at IS NULL
      GROUP BY p.id HAVING COUNT(*) >= ?`,
  ).all(...own, FEED.unansweredThreshold)
  for (const r of rows) console.log(`        ${r.slug}: ${r.n} reviews unanswered`)
  checks.push({ label: 'hand-written projects near the unanswered-review penalty', n: rows.length })
}

/* -- wording --------------------------------------------------------------- */

// Nothing anyone reads may suggest the content is not real. Every text column
// in every table is read, except link_kind, whose 'demo' is the schema's own
// name for a link to a playable build and is never printed.
{
  const FORBIDDEN = /\b(mock|mocks|mocked|mock-ups?|mockups?|fakes?|faked|demos?|samples?|sampled|placeholders?|lorem|ipsum|dummy|test data|simulat\w*|in this build)\b/i
  const SKIP = new Set(['project_links.link_kind'])
  let n = 0
  for (const { name } of db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).all()) {
    for (const column of db.prepare(`PRAGMA table_info(${name})`).all()) {
      if (!/TEXT/i.test(column.type) || SKIP.has(`${name}.${column.name}`)) continue
      for (const row of db.prepare(`SELECT ${column.name} AS v FROM ${name} WHERE ${column.name} IS NOT NULL`).all()) {
        const hit = FORBIDDEN.exec(String(row.v))
        if (hit === null) continue
        if (n < 6) console.log(`        ${name}.${column.name}: "…${String(row.v).slice(Math.max(0, hit.index - 40), hit.index + 40)}…"`)
        n++
      }
    }
  }
  checks.push({ label: 'wording that implies the content is not real', n })
}

// Two pieces of generated text meeting on the same word ("letting on on a
// TV", "the export fails fails") is a seam a reader sees at once. Code spans
// are exempt: `seal-lint lint` is a command.
{
  const REPEATED_WORD = /\b(\w{2,})\s+\1\b/i
  const COLUMNS = [
    ['projects', 'title'], ['projects', 'tagline'], ['projects', 'summary_md'], ['project_asks', 'prompt'],
    ['feedback', 'headline'], ['feedback', 'summary_md'], ['feedback_points', 'body_md'], ['feedback_replies', 'body_md'],
    ['discussion_threads', 'title'], ['discussion_threads', 'body_md'], ['discussion_posts', 'body_md'],
    ['profiles', 'bio'], ['suggestions', 'title'], ['bounties', 'title'], ['bounties', 'brief_md'], ['bounty_applications', 'pitch_md'],
  ]
  let n = 0
  for (const [table, column] of COLUMNS) {
    for (const row of db.prepare(`SELECT ${column} AS v FROM ${table} WHERE ${column} IS NOT NULL`).all()) {
      const text = String(row.v).replace(/`[^`]*`/g, ' ')
      const hit = REPEATED_WORD.exec(text)
      if (hit === null) continue
      if (n < 6) console.log(`        ${table}.${column}: "…${text.slice(Math.max(0, hit.index - 30), hit.index + 30)}…"`)
      n++
    }
  }
  checks.push({ label: 'text repeating a word where two pieces meet', n })
}

/**
 * No project page says the same eight words twice.
 *
 * A reader meets one project at a time: its notes, their headlines, their
 * bodies, all on one scroll. Two reviewers reaching for the same sentence there
 * is the one thing that makes a page of notes read as one writer rather than
 * twelve, and it is not caught by the corpus-wide word ledger, which budgets a
 * phrase across thirty thousand notes without caring where it lands.
 *
 * Measured on the text a reader actually sees on `/p/<slug>`: every submitted
 * note's headline and summary, every one of its points, and the replies hanging
 * under it. A run repeated inside a single note and its own replies is not
 * counted — that thread is one exchange, and the per-note sets already refuse a
 * verbatim repeat — only a run that turns up under two different notes on the
 * same page.
 */
{
  const rows = db.prepare(
    `SELECT f.project_id AS pid, f.id AS fid, p.body_md AS v
       FROM feedback_points p JOIN feedback f ON f.id = p.feedback_id
      WHERE f.status = 'submitted' AND f.deleted_at IS NULL
      UNION ALL
     SELECT f.project_id, f.id, f.headline FROM feedback f
      WHERE f.status = 'submitted' AND f.deleted_at IS NULL AND f.headline IS NOT NULL
      UNION ALL
     SELECT f.project_id, f.id, f.summary_md FROM feedback f
      WHERE f.status = 'submitted' AND f.deleted_at IS NULL AND f.summary_md IS NOT NULL
      UNION ALL
     SELECT f.project_id, f.id, r.body_md FROM feedback_replies r
       JOIN feedback f ON f.id = r.feedback_id
      WHERE r.deleted_at IS NULL AND f.status = 'submitted' AND f.deleted_at IS NULL`,
  ).all()
  const pages = new Map()
  for (const r of rows) {
    let page = pages.get(r.pid)
    if (page === undefined) { page = []; pages.set(r.pid, page) }
    page.push(r)
  }
  let n = 0
  for (const page of pages.values()) {
    const spent = new Map()
    let hit = null
    for (const r of page) {
      for (const run of new Set(runsOf(r.v))) {
        const owner = spent.get(run)
        if (owner === undefined) spent.set(run, r.fid)
        else if (owner !== r.fid) hit ??= run
      }
    }
    if (hit === null) continue
    if (n < 6) console.log(`        ${page[0].pid.slice(0, 8)}: two notes both say "${hit}"`)
    n++
  }
  checks.push({ label: `project pages where ${PAGE_RUN} words repeat across two notes`, n })
}

/* -- notification targets ------------------------------------------------- */

/**
 * Every notification link has to point at a route that exists.
 *
 * They were written as inline strings next to each notify() call, against route
 * shapes the app never had: /projects/… where the route is /p/…, /discussions/…
 * where it is /c/…, and /earnings, /requests/:id, /p/:slug/tracker and
 * /dashboard/inbox/:id, which are not routes at all. Every notification of
 * those kinds was a dead link in the one surface whose whole job is to bring
 * somebody back. This walks the route tree on disk and checks each stored URL
 * against it, so a rename breaks the audit rather than the bell.
 */
const ROUTES = (() => {
  const out = []
  const walk = (dir, route) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const name = entry.name
      // (group) segments do not appear in the URL; @slot and _private never do.
      const next =
        name.startsWith('(') ? route
        : name.startsWith('@') || name.startsWith('_') ? null
        : `${route}/${name}`
      if (next === null) continue
      const dirPath = path.join(dir, name)
      if (fs.existsSync(path.join(dirPath, 'page.tsx'))) out.push(next)
      walk(dirPath, next)
    }
  }
  const appDir = path.resolve(process.cwd(), 'src/app')
  if (fs.existsSync(path.join(appDir, 'page.tsx'))) out.push('/')
  walk(appDir, '')
  return out
})()

/** Does a concrete path match a route pattern with [dynamic] segments? */
function routeExists(pathname) {
  const parts = pathname.split('/').filter(Boolean)
  return ROUTES.some((route) => {
    const pattern = route.split('/').filter(Boolean)
    if (pattern.length !== parts.length) return false
    return pattern.every((seg, i) => seg.startsWith('[') || seg === parts[i])
  })
}

{
  const rows = db.prepare('SELECT DISTINCT url FROM notifications WHERE url IS NOT NULL').all()
  const dead = []
  for (const r of rows) {
    const pathname = String(r.url).split('#')[0].split('?')[0]
    if (!routeExists(pathname)) dead.push(String(r.url))
  }
  checks.push({ label: 'notification links pointing at no route', n: dead.length })
  if (dead.length > 0) {
    for (const d of [...new Set(dead)].slice(0, 6)) console.log(`        dead: ${d}`)
  }
}

// A notification names the work it is about, so it is also a way to learn a
// title. The follow check above keeps a stranger from subscribing to work they
// may not open; this is the other end of the same thread, because a bell row
// outlives the subscription that produced it and says the name again every time
// the bell is opened. Deleted work is left out on purpose: the schema calls a
// dangling subject a rendering fallback, and work that was public when the row
// was written is not a leak.
check('notifications naming work their reader cannot open',
  `SELECT COUNT(*) n FROM notifications nt
     JOIN projects p ON p.id = CASE nt.subject_type
       WHEN 'project' THEN nt.subject_id
       WHEN 'project_version' THEN (SELECT v.project_id FROM project_versions v WHERE v.id = nt.subject_id)
     END
    WHERE nt.user_id <> p.owner_id
      AND p.deleted_at IS NULL
      AND (p.status <> 'published' OR p.visibility = 'private')
      AND NOT EXISTS (SELECT 1 FROM project_collaborators c
                       WHERE c.project_id = p.id AND c.user_id = nt.user_id)`)

/**
 * Following a project is the promise to hear about its next build, and the bell
 * is where that promise is kept: postVersion() fans a `new_version` row out to
 * every follower whose subscription is 'all' or 'versions'.
 *
 * It is the one fan-out a built world can be missing with every page still
 * looking right, because a notification nobody was sent shows up nowhere — so
 * it needs a check of its own. Counted per (build, follower) pair, the way
 * notifyMany() writes them, and only for a follow already standing when the
 * build landed. The owner is not a recipient of their own build, and a follower
 * who turned the kind off in-app was never going to get the row.
 */
check('builds their followers were never told about',
  `SELECT COUNT(*) n FROM project_versions v
     JOIN project_follows pf ON pf.project_id = v.project_id
     JOIN projects p ON p.id = v.project_id
    WHERE pf.notify IN ('all', 'versions')
      AND pf.user_id <> p.owner_id
      AND pf.created_at <= v.released_at
      AND NOT EXISTS (SELECT 1 FROM notification_preferences np
                       WHERE np.user_id = pf.user_id AND np.kind = 'new_version' AND np.in_app = 0)
      AND NOT EXISTS (SELECT 1 FROM notifications nt
                       WHERE nt.user_id = pf.user_id AND nt.kind = 'new_version'
                         AND nt.subject_type = 'project_version' AND nt.subject_id = v.id)`)

/**
 * Every notification kind in the database has to be one the running product can
 * write, and every stored switch has to govern one.
 *
 * A row of a kind nothing produces is a notification that could only have come
 * from the build, and the surface whose whole job is to bring somebody back is
 * the worst place to keep one. A preference row for such a kind is worse: the
 * member turns the switch off, nothing changes, and turning it back on changes
 * nothing either.
 *
 * Both sides are read out of the tree rather than listed here, so wiring a
 * producer or retiring one moves the check. The vocabulary is the CHECK on
 * notifications.kind, which is what the database will actually accept; a
 * producer is the kind named anywhere under src/server, which is the only place
 * a notify() call lives. Naming it is counted as writing it, which is the
 * lenient reading on purpose: this is here to catch a kind nothing has ever
 * heard of, not to referee how a call site spells its argument.
 */
const NOTIFICATION_KINDS = (() => {
  const schema = fs.readFileSync(path.resolve(process.cwd(), 'src/server/db/schema.sql'), 'utf8')
  const table = /CREATE TABLE IF NOT EXISTS notifications \(([\s\S]*?)\n\) STRICT;/.exec(schema)?.[1] ?? ''
  const list = /kind\s+TEXT NOT NULL CHECK \(kind IN\s*\(([\s\S]*?)\)\)/.exec(table)?.[1] ?? ''
  return [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
})()

const PRODUCED = (() => {
  const seen = new Set()
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) { walk(full); continue }
      if (!entry.name.endsWith('.ts')) continue
      const source = fs.readFileSync(full, 'utf8')
      for (const kind of NOTIFICATION_KINDS) if (source.includes(`'${kind}'`)) seen.add(kind)
    }
  }
  walk(path.resolve(process.cwd(), 'src/server'))
  return seen
})()

{
  // If the two regexes above stop matching the schema, every kind reads as
  // produced and the two checks below pass on anything. Say so instead.
  checks.push({ label: 'notification kinds the audit could not read out of the schema', n: NOTIFICATION_KINDS.length === 0 ? 1 : 0 })

  const orphans = NOTIFICATION_KINDS.filter((kind) => !PRODUCED.has(kind))
  for (const [label, table] of [
    ['notifications of a kind nothing in the product writes', 'notifications'],
    ['notification switches that silence nothing', 'notification_preferences'],
  ]) {
    const rows = orphans.length === 0 ? [] : db.prepare(
      `SELECT kind, COUNT(*) AS n FROM ${table}
        WHERE kind IN (${orphans.map(() => '?').join(', ')}) GROUP BY kind ORDER BY kind`,
    ).all(...orphans)
    for (const r of rows) console.log(`        ${table}.${r.kind}: ${r.n} rows, and no producer under src/server`)
    checks.push({ label, n: rows.reduce((sum, r) => sum + Number(r.n), 0) })
  }
}

/* -- report --------------------------------------------------------------- */
let failed = 0
const width = Math.max(...checks.map((c) => c.label.length))
for (const c of checks) {
  if (c.n > 0) failed++
  console.log(`  ${c.n > 0 ? 'FAIL' : 'ok  '}  ${c.label.padEnd(width)}  ${c.n === 0 ? '' : String(c.n) + ' bad rows'}`)
}
console.log(`\n  ${checks.length - failed} of ${checks.length} checks pass`)
process.exit(failed === 0 ? 0 : 1)

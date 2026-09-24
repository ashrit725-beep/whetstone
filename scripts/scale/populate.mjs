/**
 * Grow the population to the size the product is meant to run at.
 *
 * The hand-written rows stay exactly as they are and stay the most-reviewed
 * work in the index; this adds the community around them. Everything is
 * generated from one seeded PRNG, so the same command against the same seed
 * produces the same people every time.
 *
 * Distributions are deliberately uneven, because real ones are:
 *   - a power law on reviews per project, so most projects have a handful and a
 *     few have dozens, rather than everything landing on the mean;
 *   - a small core of busy members who write most of the reviews and cast most
 *     of the votes, and a long tail who turn up now and then;
 *   - activity that thins out the further back you go, since the population
 *     grew over time rather than arriving at once.
 *
 * Time comes from clock.mjs, which is the one place that decides when things
 * happen. The present is the instant the seed was resolved against, read from
 * schema_meta, so the hand-written rows and these agree on what "now" is, and
 * nothing is ever dated after it: a reply that would have been written next
 * week simply has not been written yet.
 *
 * Words and structure come from two separate seeded streams. This file decides
 * structure: who reviews what, when, how many points, which category, which
 * severity. writer.mjs decides the words, so a sentence can be reworded
 * without moving a single count or date.
 *
 * Run: node scripts/scale/populate.mjs [--users 5000] [--projects 3500] [--db path]
 *
 * It grows `--db` if given, otherwise DATABASE_PATH like the app does, so a
 * population can be rehearsed against a copy without touching the file the
 * running servers hold open.
 */

import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { createHash } from 'node:crypto'
import * as V from './vocab.mjs'
import { Writer } from './writer.mjs'
import { makeClock, makeRoster, DAY, HOUR, MINUTE } from './clock.mjs'
import { tagsFor, everyTag } from './tags.mjs'
import { AREAS_BY_TYPE, AREA_FITS, PAYOUT } from './market.mjs'

/* ------------------------------------------------------------ determinism */

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(0x5748_4554) // "WHET"
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))
/** Heavier at the low end: most things are small, a few are not. */
const power = (lo, hi, k = 2.4) => lo + Math.floor(Math.pow(rnd(), k) * (hi - lo + 1))
const chance = (p) => rnd() < p
/** `n` distinct items from `arr`, in random order. */
const someOf = (arr, n) => {
  const copy = arr.slice()
  const out = []
  while (out.length < n && copy.length > 0) out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0])
  return out
}
/** A standard normal draw, for the spread of an opinion around its centre. */
const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd())

/** Stable id from a name, so re-running does not duplicate a row. */
const idFor = (kind, key) =>
  createHash('sha1').update(`${kind}:${key}`).digest('hex').slice(0, 32)
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')

/* ----------------------------------------------------------------- shaping */

const args = process.argv.slice(2)
const argOf = (n, d) => {
  const i = args.indexOf(`--${n}`)
  return i === -1 ? d : Number(args[i + 1])
}
const WANT_USERS = argOf('users', 5000)
const WANT_PROJECTS = argOf('projects', 3500)

const dbFlag = args.indexOf('--db')
const DB = path.resolve(
  process.cwd(),
  dbFlag === -1 ? (process.env.DATABASE_PATH ?? 'data/whetstone.db') : args[dbFlag + 1],
)
const db = new DatabaseSync(DB)
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA synchronous = NORMAL')
db.exec('PRAGMA foreign_keys = ON')

// Running this twice on one database used to add a second population on top of
// the first: users are INSERT OR IGNORE, but projects, notes and threads got
// fresh ids and doubled. It grows a freshly seeded database, once.
{
  const seeded = db.prepare('SELECT COUNT(*) AS n FROM users').get().n
  if (seeded > 200) {
    console.error(
      `This database already has ${seeded.toLocaleString('en')} members, so it has been populated. ` +
        'Run `npm run db:rebuild` to seed and populate from scratch.',
    )
    process.exit(1)
  }
}

/* -------------------------------------------------------------------- time */

// The present is the instant the seed resolved its hand-written rows against.
// Taking it from the newest review instead, as this once did, froze the whole
// community a day or more before anyone opened it.
const seededAt = db.prepare(`SELECT meta_value AS v FROM schema_meta WHERE meta_key = 'seeded_at'`).get()?.v
const NOW = seededAt === undefined ? Math.floor(Date.now() / MINUTE) * MINUTE : Number(seededAt)
const clock = makeClock(NOW, rnd)

const types = db.prepare('SELECT id, slug FROM project_types').all()
const stages = ['concept', 'prototype', 'beta', 'release_candidate', 'shipped']
/** Kinds of work a reviewer can respond to before anything is built. */
const ON_PAPER = new Set(['business_idea', 'design'])
/**
 * Categories, split by what they can honestly hold. Every type carries a
 * "Delight, keep this" category, and filing a complaint under it, or a
 * compliment under "Bug or defect", is a contradiction on the face of the card.
 */
const categoriesByType = new Map()
for (const t of types) {
  const rows = db
    .prepare('SELECT id, category_key FROM feedback_categories WHERE project_type_id = ?')
    .all(t.id)
  const delight = rows.filter((r) => r.category_key === 'delight').map((r) => r.id)
  const faults = rows.filter((r) => V.FAULT_CATEGORIES.has(r.category_key)).map((r) => r.id)
  const plain = rows.filter((r) => r.category_key !== 'delight').map((r) => r.id)
  const calm = plain.filter((id) => !faults.includes(id))
  categoriesByType.set(t.id, {
    praise: delight.length > 0 ? delight : plain,
    issue: plain.length > 0 ? plain : delight,
    neutral: calm.length > 0 ? calm : plain,
    all: rows.map((r) => r.id),
  })
}

/** The axes a review of each type is rated on, in the order the form asks them. */
const axesByType = new Map()
/** For each axis, the categories whose points bear on it (V.AXIS_EVIDENCE), as category ids. */
const evidenceByAxis = new Map()
for (const t of types) {
  const axes = db.prepare(
    'SELECT id, axis_key, scale_max FROM rating_axes WHERE project_type_id = ? AND is_active = 1 ORDER BY sort_order',
  ).all(t.id)
  axesByType.set(t.id, axes)
  for (const axis of axes) {
    // Category ids are `<type>:<key>`, the convention src/lib/taxonomy.ts sets.
    evidenceByAxis.set(axis.id, new Set((V.AXIS_EVIDENCE[t.slug]?.[axis.axis_key] ?? []).map((key) => `${t.slug}:${key}`)))
  }
}

// Every tag this run can hand out has to be one the product already knows.
{
  const known = new Set(db.prepare('SELECT slug FROM tags').all().map((r) => r.slug))
  const missing = [...everyTag()].filter((slug) => !known.has(slug))
  if (missing.length > 0) {
    console.error(`These tags are not in the seed vocabulary (src/server/db/seed-data.ts): ${missing.join(', ')}`)
    process.exit(1)
  }
}
const tagIdBySlug = new Map(db.prepare('SELECT id, slug FROM tags').all().map((r) => [r.slug, r.id]))

const existingHandles = new Set(db.prepare('SELECT handle_normalized AS h FROM users').all().map((r) => r.h))
const existingSlugs = new Set(db.prepare('SELECT slug FROM projects').all().map((r) => r.slug))

const slugify = (s) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

/**
 * How a note's overall verdict shapes what is inside it. A note headlined as
 * negative that turns out to be three compliments is the kind of thing you
 * cannot unsee, so the tone of the points follows the tone of the note.
 */
const TONE_MIX = {
  positive: ['praise', 'praise', 'praise', 'neutral', 'neutral', 'issue'],
  mixed: ['issue', 'issue', 'neutral', 'neutral', 'praise', 'praise'],
  negative: ['issue', 'issue', 'issue', 'issue', 'issue', 'neutral', 'neutral', 'praise'],
}

/** Where a note's ratings sit before the reviewer's own lean and the project's own strengths move them. */
const RATING_CENTRE = { positive: 4.1, mixed: 3.1, negative: 2.1 }

/** Category labels, which decide what a point is about. */
const labelById = new Map(db.prepare('SELECT id, label FROM feedback_categories').all().map((r) => [r.id, r.label]))

/**
 * The words. Its own seed, its own stream: see writer.mjs. The expected sizes
 * set how often a five-word run may recur in each kind of text before the
 * writer has to find another way to say it.
 */
const writer = new Writer(0x5752_4954, {
  projects: WANT_PROJECTS, asks: Math.round(WANT_PROJECTS * 1.4), needs: Math.round(WANT_PROJECTS * 0.6),
  bios: Math.round(WANT_USERS * 0.72), notes: WANT_PROJECTS * 9, points: WANT_PROJECTS * 22, replies: WANT_PROJECTS * 2.4,
  builds: Math.round(WANT_PROJECTS * 1.2), suggestions: Math.round(WANT_PROJECTS * 0.3), declines: 200,
  threads: 720, posts: 3600,
  experts: 120, claims: 200, bounties: 260, applications: 700, creatorReviews: 200,
})
writer.reserveNames(db.prepare('SELECT display_name AS n FROM profiles').all().map((r) => r.n))
writer.reserveTitles(
  db.prepare('SELECT title FROM projects').all().map((r) => r.title),
  db.prepare('SELECT slug FROM projects').all().map((r) => r.slug),
)
/** Where each generated person lives, which shapes how they write. Seeded people have no entry. */
const regionById = new Map()
const personaOf = (id) => writer.personaFor(id, regionById.get(id) ?? null)

/* ------------------------------------------------------------------- write */

const ins = {
  user: db.prepare(`INSERT OR IGNORE INTO users (id, email, email_normalized, handle, handle_normalized, password_hash, email_verified_at, created_at, updated_at, last_seen_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?)`),
  profile: db.prepare(`INSERT INTO profiles (user_id, display_name, bio, location, primary_role, created_at, updated_at)
                       VALUES (?,?,?,?,?,?,?)`),
  rep: db.prepare(`INSERT OR IGNORE INTO reputation_scores (user_id, reviewer_score, creator_score, total_score, feedback_count, helpful_count, computed_at)
                   VALUES (?,?,?,?,?,?,?)`),
  project: db.prepare(`INSERT INTO projects (id, owner_id, project_type_id, slug, title, tagline, summary_md, stage_key, visibility, status, feedback_state, published_at, created_at, updated_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`),
  ask: db.prepare(`INSERT INTO project_asks (id, project_id, prompt, detail_md, is_required, sort_order, created_at)
                   VALUES (?,?,?,?,?,?,?)`),
  need: db.prepare(`INSERT OR IGNORE INTO project_needs (project_id, need_key, detail, created_at)
                   VALUES (?,?,?,?)`),
  tag: db.prepare('INSERT OR IGNORE INTO project_tags (project_id, tag_id, created_at) VALUES (?,?,?)'),
  feedback: db.prepare(`INSERT INTO feedback (id, project_id, project_type_id, reviewer_id, bounty_id, origin, status, visibility, headline, summary_md, time_spent_minutes, point_count, blocker_count, sentiment_score, sentiment_label, quality_score, helpful_count, reply_count, inbox_state, reviewer_is_expert, submitted_at, created_at, updated_at)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`),
  point: db.prepare(`INSERT INTO feedback_points (id, feedback_id, project_type_id, category_id, ordinal, body_md, severity, actionability, sentiment, created_at, updated_at)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?)`),
  rating: db.prepare(`INSERT INTO feedback_ratings (id, feedback_id, project_type_id, axis_id, rating_value, created_at)
                      VALUES (?,?,?,?,?,?)`),
}

// Generated members are authors, not logins: they get no password. Copying the
// seed account's hash onto them made every one of them open to anyone who knew
// that one password.
const hash = null

console.log(`Growing the population. The present is ${new Date(NOW).toISOString()}.`)

/* -------------------------------------------------------------- the people */

const people = []
db.exec('BEGIN IMMEDIATE')
let madeUsers = 0
for (let i = 0; people.length < WANT_USERS && i < WANT_USERS * 3; i++) {
  const who = writer.person(existingHandles)
  const handle = who.handle
  existingHandles.add(handle)

  const id = idFor('user', handle)
  const joined = clock.grown('people')
  regionById.set(id, who.region)
  const persona = personaOf(id)

  // Last seen is filled in at the end, from the last thing each person did.
  ins.user.run(
    id, `${handle}@whetstone.example`, `${handle}@whetstone.example`, handle, handle,
    hash, joined, joined, joined, joined,
  )
  ins.profile.run(
    id, who.display,
    chance(0.72) ? writer.bio(who, persona) : null,
    chance(0.6) ? who.city : null, who.roleKey, joined, joined,
  )

  // The row goes in empty. Reputation is the sum of what somebody actually did
  // here, and none of it exists yet: writing a score now and the reviews later
  // produces a leaderboard whose numbers have nothing underneath them. The
  // recompute pass at the end fills every column from the rows.
  ins.rep.run(id, 0, 0, 0, 0, 0, NOW)

  people.push({ id, handle, joined })
  madeUsers++
}
db.exec('COMMIT')
console.log(`  people      ${madeUsers}`)

// `is_expert` comes along because a note badged "expert" has to be written by
// one. `busy` is how much each person does: a few do a great deal, most do a
// little, and the seeded members, who are the regulars, sit near the top.
const allPeople = db.prepare('SELECT id, created_at AS joined, is_expert AS expert FROM users').all()
const generatedIds = new Set(people.map((p) => p.id))
for (const person of allPeople) {
  person.busy = generatedIds.has(person.id) ? Math.min(40, Math.pow(1 - rnd(), -0.85)) : 12
}
const personById = new Map(allPeople.map((p) => [p.id, p]))
const roster = makeRoster(allPeople, rnd)

/* ------------------------------------------------------------ the projects */

const projects = []
db.exec('BEGIN IMMEDIATE')
let madeProjects = 0
let madeTags = 0
for (let i = 0; projects.length < WANT_PROJECTS && i < WANT_PROJECTS * 3; i++) {
  // When it was posted comes first, then somebody who was a member by then.
  const published = clock.grown('work')
  const owner = roster.presentAt(published)
  if (owner === null) continue
  const type = types[Math.floor(rnd() * types.length)]

  // A concept is "an idea written down; nothing is built yet", and generated
  // reviews are written against something a reviewer opened and used. So only
  // the kinds of work reviewed on paper, a plan or a set of sketches, sit at
  // the concept stage; everything else starts at a prototype.
  const stage = ON_PAPER.has(type.slug) ? stages[power(0, 4, 1.5)] : stages[1 + power(0, 3, 1.6)]
  // The writer hands out each title once, so two projects never share a name
  // and a slug never needs a suffix to be unique.
  const wp = writer.project(type.slug, { persona: personaOf(owner.id) }, stage)
  const title = wp.title
  const slug = slugify(title)
  if (existingSlugs.has(slug)) continue
  existingSlugs.add(slug)

  const id = idFor('project', slug)
  // A project is a draft for a while before it is posted, never before its
  // author had an account.
  const created = Math.max(owner.joined + 10 * MINUTE, published - Math.floor(rnd() * 3 * DAY))

  ins.project.run(
    id, owner.id, type.id, slug, title, wp.tagline, wp.summary,
    stage, 'public', 'published',
    chance(0.78) ? 'open' : chance(0.5) ? 'invite_only' : 'closed',
    published, created, published,
  )
  // One ask is the norm; a third of creators post a second, a tenth a third.
  // Each is composed independently, so a project with three asks reads as three
  // separate questions rather than one template printed three times.
  const askCount = chance(0.33) ? (chance(0.3) ? 3 : 2) : 1
  for (let a = 0; a < askCount; a++) {
    const prompt = writer.ask(wp)
    ins.ask.run(
      a === 0 ? idFor('ask', slug) : idFor('ask', `${slug}:${a}`),
      id, prompt, null, a === 0 ? 1 : 0, a, published,
    )
  }

  // What kind of help the project is after. Discover filters on these and the
  // feed prints them, so an empty table meant every row fell back to the same
  // "Any read" line. A small minority genuinely specify nothing.
  if (!chance(0.08)) {
    const pool = V.NEEDS_BY_TYPE[type.slug] ?? V.NEEDS_BY_TYPE.web_app
    const want = chance(0.55) ? 1 : chance(0.72) ? 2 : 3
    const chosen = new Set()
    for (let k = 0; k < want * 4 && chosen.size < want; k++) chosen.add(pick(pool))
    for (const key of chosen) {
      ins.need.run(id, key, chance(0.38) ? writer.needDetail(wp, key) : null, published)
    }
  }

  // Tags are read off the project's own world, so a roguelike made in Godot
  // says so. A few creators never tag anything.
  if (!chance(0.06)) {
    for (const slug of tagsFor(type.slug, wp.world, chance, id)) {
      ins.tag.run(id, tagIdBySlug.get(slug), created)
      madeTags++
    }
  }

  // Anything past a concept was posted with a build to try. It usually went
  // out a little before the project was posted here, never before its author
  // joined.
  const hasBuild = stage === 'concept' ? false : stage === 'prototype' ? chance(0.8) : true
  const opening = hasBuild ? Math.max(owner.joined + HOUR, published - Math.floor(rnd() * 12 * DAY)) : null

  projects.push({ id, typeId: type.id, typeSlug: type.slug, ownerId: owner.id, published, stage, opening, wp })
  madeProjects++
}
db.exec('COMMIT')
console.log(`  projects    ${madeProjects}, ${madeTags} tags`)

// Exactly the projects this run created, so every pass below can say "mine"
// rather than guess. Several updates used to run across the whole table and
// overwrite the hand-written rows they had no business touching.
db.exec('CREATE TEMP TABLE IF NOT EXISTS generated_project (id TEXT PRIMARY KEY)')
db.exec('DELETE FROM generated_project')
{
  const mark = db.prepare('INSERT OR IGNORE INTO generated_project (id) VALUES (?)')
  db.exec('BEGIN IMMEDIATE')
  for (const p of projects) mark.run(p.id)
  db.exec('COMMIT')
}

/* ------------------------------------------------------------ the feedback */

/** Points worth showing a vote count against, collected for the passes below. */
const pointSeeds = []
/** What each note is about, so the replies to it can say so. */
const noteInfo = new Map()
/** How generously each reviewer rates, drawn once so it is the same on every project. */
const leanOf = new Map()
/** Where each project is strong and weak, one offset per axis, shared by every reviewer. */
const strengthOf = new Map()
/**
 * Sentence frames already spent on a project, so the writer does not hand the
 * same one to two reviewers. It is per project, not per note, because the
 * repetition a reader notices is the one on the page in front of them: two
 * notes on one project ending "the cheap fix is probably…" reads as generated
 * text, while the same frame on another project is simply a way of putting it.
 */
const framesByProject = new Map()
/**
 * How good each project is, on -1..1, drawn once. Reviews of one project are
 * not independent coin flips: a good one draws mostly warm notes and a weak
 * one mostly critical ones, which is what keeps a crowd of reviewers from
 * spanning the whole scale on every project.
 */
const meritOf = new Map()
const merit = (projectId) => {
  let q = meritOf.get(projectId)
  if (q === undefined) {
    q = Math.max(-1, Math.min(1, gauss() * 0.6))
    meritOf.set(projectId, q)
  }
  return q
}
let madeNotes = 0
let madePoints = 0
let madeRatings = 0

/**
 * The ratings a note carries: one per axis of its type, centred on the note's
 * own verdict, moved by the project's real strengths and weaknesses (which
 * every reviewer sees) and by how generous this reviewer is (which follows them
 * everywhere). That combination is what produces honest disagreement: seven
 * people agreeing on a project's weak axis and splitting on its strong one.
 *
 * Each axis is then moved by what the note itself says about it: a rating is a
 * verdict between the axis's written anchors, so the reviewer who filed a
 * crash rates stability towards "Crashed or stuttered", and the one who kept a
 * line of praise for the controls rates game feel towards "Precise". A blocker
 * filed anywhere still costs every axis a little.
 *
 * Some reviewers skip the ratings, and some skip an axis they had no exposure
 * to, which the product shows as the absence of a rating rather than a 3.
 */
function rate(p, reviewerId, sentiment, plan, at, fid) {
  if (!chance(0.9)) return
  const axes = axesByType.get(p.typeId) ?? []
  let lean = leanOf.get(reviewerId)
  if (lean === undefined) {
    lean = Math.max(-0.9, Math.min(0.9, gauss() * 0.3))
    leanOf.set(reviewerId, lean)
  }
  let strength = strengthOf.get(p.id)
  if (strength === undefined) {
    strength = axes.map(() => Math.max(-1, Math.min(1, gauss() * 0.35)))
    strengthOf.set(p.id, strength)
  }
  // Half what this note concluded, half what the project is.
  const centre = RATING_CENTRE[sentiment] * 0.55 + (3.2 + 1.1 * merit(p.id)) * 0.45
  const blocked = plan.some((pl) => pl.severity === 'blocker')
  axes.forEach((axis, i) => {
    if (chance(0.05)) return
    const evidence = evidenceByAxis.get(axis.id)
    const onAxis = plan.filter((pl) => evidence?.has(pl.cat)).map((pl) => pl.severity)
    const said = onAxis.reduce((sum, severity) => sum + (V.AXIS_PULL[severity] ?? 0), 0)
    let v = centre + lean + strength[i] + gauss() * 0.38 + Math.max(-1.2, Math.min(0.8, said)) - (blocked ? 0.2 : 0)
    // Now and then somebody sees something nobody else did.
    if (chance(0.008)) v += chance(0.5) ? 2 : -2
    // Whatever the mood, nobody files a blocker against an axis and then rates
    // it above the middle of its scale, or praises it with nothing serious filed
    // against it and rates it at the bottom.
    const ceiling = onAxis.includes('blocker') ? Math.ceil(axis.scale_max / 2) : axis.scale_max
    const floor = onAxis.includes('praise') && !onAxis.some((s) => s === 'blocker' || s === 'major') ? 2 : 1
    const value = Math.max(floor, Math.min(ceiling, Math.round(v)))
    ins.rating.run(idFor('rating', `${fid}:${axis.id}`), fid, p.typeId, axis.id, value, at)
    madeRatings++
  })
}

/**
 * One review: its points, then the headline and summary written from them,
 * then its ratings. The organic reviews and the paid ones the market delivers
 * both come through here, so a paid review is written like any other, only
 * longer.
 */
function writeNote(p, r, at, { id, origin = 'organic', bountyId = null, expert = 0, paid = false }) {
  const points = paid ? between(3, 5) : between(1, 4)
  const blockers = chance(paid ? 0.3 : 0.22) ? between(1, 2) : 0
  // Two warm notes and two mixed for every critical one on an average
  // project, leaning with how good this one is.
  const q = merit(p.id)
  const weights = [Math.max(0.15, 2 + 1.8 * q), 2, Math.max(0.15, 1 - 0.95 * q)]
  const roll = rnd() * (weights[0] + weights[1] + weights[2])
  const sentiment = roll < weights[0] ? 'positive' : roll < weights[0] + weights[1] ? 'mixed' : 'negative'
  const minutes = paid ? between(60, 240) : between(5, 95)
  // quality_score is specificity on 0..1: `clamp01()` reads it and
  // QUALIFIED_SPECIFICITY is 0.5. Writing 40..95 here meant every generated
  // note clamped to 1 and rendered as a full specificity meter.
  const quality = Math.round((paid ? 0.55 + rnd() * 0.4 : 0.24 + Math.pow(rnd(), 1.4) * 0.68) * 1000) / 1000

  // What each point is: its tone, and a severity and category that agree
  // with it. Severity is drawn from the tone rather than independently, so
  // a point asking for a change never arrives under the label "Keep this".
  const cats = categoriesByType.get(p.typeId)
  const plan = []
  if (cats !== undefined && cats.all.length > 0) {
    const tones = Array.from({ length: points }, () => pick(TONE_MIX[sentiment] ?? TONE_MIX.mixed))
    // The verdict has to be visible in what the note says: a negative note
    // carries at least one problem, a positive one at least one thing to
    // keep, and a mixed one with room for both has both.
    if (sentiment === 'negative' && !tones.includes('issue')) tones[0] = 'issue'
    if (sentiment === 'positive' && !tones.includes('praise')) tones[0] = 'praise'
    if (sentiment === 'mixed' && points >= 2) {
      if (!tones.includes('issue')) tones[points - 1] = 'issue'
      if (!tones.includes('praise')) tones[0] = 'praise'
    }
    for (let q = 0; q < points; q++) {
      const tone = tones[q]
      // A blocker is a blocker whatever the wording, but nothing else is
      // allowed to disagree with what the sentence actually says.
      const severity = q < blockers && tone === 'issue' ? 'blocker' : pick(V.TONE_SEVERITY[tone])
      // Praise mostly lands in the one category meant for it; everything
      // else is kept out of that category entirely.
      const pool = tone === 'praise' ? (chance(0.72) ? cats.praise : cats.neutral) : cats[tone]
      const cat = pool.length > 0 ? pool[Math.floor(rnd() * pool.length)] : cats.all[0]
      // Actionability follows the severity that was just drawn, not the tone
      // alone: tone decides how the sentence reads, severity decides whether a
      // change is owed, and only the second of those can make "Preference" a
      // lie on the card.
      const decisive = severity === 'blocker' || severity === 'major'
      const actionability = pick(decisive ? V.DECISIVE_ACTIONABILITY : V.TONE_ACTIONABILITY[tone])
      plan.push({ tone, severity, cat, actionability })
    }
  }

  // Then the words, in this reviewer's voice. The points are written first
  // so the note's opening paragraph can name what its worst point is about.
  const persona = personaOf(r.id)
  const avoid = new Set()
  let frames = framesByProject.get(p.id)
  if (frames === undefined) {
    frames = new Set()
    framesByProject.set(p.id, frames)
  }
  const written = plan.map((pl) => writer.point(p.wp, persona, { tone: pl.tone, severity: pl.severity, label: labelById.get(pl.cat) ?? '', avoid, frames }))
  const note = writer.note(p.wp, persona, sentiment, minutes, written)
  noteInfo.set(id, note)

  // A point's sentiment follows its severity, and the note's score is the
  // mean of its points', the way the seed scores the hand-written ones.
  const pointSentiment = plan.map((pl) => (pl.severity === 'praise' ? 1 : pl.severity === 'blocker' || pl.severity === 'major' ? -1 : 0))
  const score = plan.length === 0 ? null : Math.round((pointSentiment.reduce((a, b) => a + b, 0) / plan.length) * 100) / 100
  const blockerCount = plan.filter((pl) => pl.severity === 'blocker').length

  ins.feedback.run(
    id, p.id, p.typeId, r.id, bountyId, origin, 'submitted', 'public',
    note.headline, note.summary,
    minutes, plan.length, blockerCount, score, sentiment,
    // helpful_count, reply_count and inbox_state are left at their resting
    // values and computed from the votes and replies that actually get
    // written, further down.
    quality, 0, 0,
    'new', expert,
    at, at, at,
  )
  madeNotes++

  for (let q = 0; q < plan.length; q++) {
    const pid = idFor('point', `${id}:${String(q)}`)
    ins.point.run(pid, id, p.typeId, plan[q].cat, q, written[q].text, plan[q].severity, plan[q].actionability, pointSentiment[q], at, at)
    pointSeeds.push({ id: pid, at, reviewer: r.id, owner: p.ownerId, project: p.id })
    madePoints++
  }
  rate(p, r.id, sentiment, plan, at, id)
}

db.exec('BEGIN IMMEDIATE')
for (const p of projects) {
  // Most projects collect a handful; a few collect a crowd. The newest have
  // only had time for the first few.
  const want = power(0, 40, 2.4)
  const used = new Set([p.ownerId])
  for (let k = 0; k < want; k++) {
    const at = clock.after(p.published, 'note')
    if (at > NOW) continue
    // Somebody who was a member by then, and the busy ones more often.
    const r = roster.activeAt(at)
    if (r === null || used.has(r.id)) continue
    used.add(r.id)
    writeNote(p, r, at, { id: idFor('feedback', `${p.id}:${r.id}`), expert: 0 })
  }
}
db.exec('COMMIT')
console.log(`  notes       ${madeNotes}`)
console.log(`  points      ${madePoints}`)
console.log(`  ratings     ${madeRatings}`)

/* ------------------------------------------------------------- the agreeing */

/**
 * "Nobody else hit this" printed under all eighty thousand points said the
 * wrong thing about a place where reviewers are meant to find the same things.
 * Every vote here is a real row belonging to a real reviewer, cast after the
 * thing it agrees with and never after the present, and the counter on the
 * point is then computed from those rows, the same way the application
 * computes it when somebody clicks agree.
 */
const insPointVote = db.prepare(
  'INSERT OR IGNORE INTO feedback_point_votes (point_id, voter_id, created_at) VALUES (?,?,?)',
)
const insNoteVote = db.prepare(
  'INSERT OR IGNORE INTO feedback_votes (feedback_id, voter_id, vote_value, created_at) VALUES (?,?,?,?)',
)

db.exec('BEGIN IMMEDIATE')
let madeVotes = 0
for (const seed of pointSeeds) {
  // Most points stand alone. Roughly a third get agreement, and a few get a lot.
  if (!chance(0.31)) continue
  const agreeing = power(1, 9, 2.2)
  for (let k = 0; k < agreeing; k++) {
    const at = clock.after(seed.at, 'vote')
    if (at > NOW) continue
    const voter = roster.activeAt(at)
    // You cannot agree with your own point, and the creator is not a reviewer.
    if (voter === null || voter.id === seed.reviewer || voter.id === seed.owner) continue
    insPointVote.run(seed.id, voter.id, at)
    madeVotes++
  }
}
db.exec('COMMIT')

// "N people found this helpful" with no votes behind it is the same defect as a
// reply counter with no replies: the first real vote recomputes the column and
// the number collapses. These are rows.
db.exec('BEGIN IMMEDIATE')
let madeNoteVotes = 0
// Only the notes this run made, asked for in SQL rather than filtered against a
// map that is built further down. The hand-written notes already carry the
// votes their authors were given.
const notesForVotes = db.prepare(
  `SELECT id, project_id, reviewer_id, submitted_at FROM feedback
    WHERE project_id IN (SELECT id FROM generated_project)`,
).all()
for (const n of notesForVotes) {
  if (!chance(0.42)) continue
  const agreeing = power(1, 14, 2.3)
  for (let k = 0; k < agreeing; k++) {
    const at = clock.after(n.submitted_at, 'vote')
    if (at > NOW) continue
    const voter = roster.activeAt(at)
    if (voter === null || voter.id === n.reviewer_id) continue
    insNoteVote.run(n.id, voter.id, 1, at)
    madeNoteVotes++
  }
}
db.exec('COMMIT')
console.log(`  note votes  ${madeNoteVotes}`)

db.exec('BEGIN IMMEDIATE')
// Every counter below is counted from the rows beneath it rather than decided
// before those rows exist.
db.exec(`
  UPDATE feedback SET
    helpful_count = (SELECT COUNT(*) FROM feedback_votes v
                      WHERE v.feedback_id = feedback.id AND v.vote_value = 1),
    point_count   = (SELECT COUNT(*) FROM feedback_points fp WHERE fp.feedback_id = feedback.id),
    blocker_count = (SELECT COUNT(*) FROM feedback_points fp
                      WHERE fp.feedback_id = feedback.id AND fp.severity = 'blocker')
`)
// upvote_count is derived for every point, which is correct for all of them.
db.exec(`
  UPDATE feedback_points SET
    upvote_count = (SELECT COUNT(*) FROM feedback_point_votes v WHERE v.point_id = feedback_points.id)
`)
db.exec('COMMIT')
console.log(`  agreements  ${madeVotes}`)

/* -------------------------------------------------- the other half of it */

/**
 * Replies, and the counters that depend on them.
 *
 * Whetstone is a place where creators answer their reviewers, so a database
 * where nobody ever replies describes a different product. Every reply here is
 * a real row; reply_count, first_reply_at, inbox_state and the ask answer
 * counts are then derived from those rows rather than picked, so no number in
 * the product disagrees with what is underneath it.
 */

const owners = new Map(projects.map((p) => [p.id, p.ownerId]))
const writtenProject = new Map(projects.map((p) => [p.id, p.wp]))
// Every note in the table, filtered below by whether its project is one of the
// ones this script made. The hand-written projects already carry the replies
// their authors wrote, and nothing here should talk over them.
const notes = db.prepare(
  'SELECT id, project_id, reviewer_id, submitted_at FROM feedback',
).all()

const insReply = db.prepare(
  `INSERT INTO feedback_replies (id, feedback_id, point_id, parent_reply_id, author_id, body_md, is_creator, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?)`,
)

db.exec('BEGIN IMMEDIATE')
let madeReplies = 0
let answered = 0
for (const n of notes) {
  const owner = owners.get(n.project_id)
  if (owner === undefined || owner === n.reviewer_id) continue
  // Roughly a third of notes get an answer. Creators who answer at all tend to
  // answer quickly; the rest never come back. A note from this morning may
  // simply not have been answered yet.
  if (!chance(0.34)) continue
  const firstAt = clock.after(n.submitted_at, 'reply')
  if (firstAt > NOW) continue

  const rootId = idFor('reply', `${n.id}:0`)
  const wp = writtenProject.get(n.project_id)
  const info = noteInfo.get(n.id) ?? null
  insReply.run(rootId, n.id, null, null, owner, writer.reply(wp, personaOf(owner), 0, info), 1, firstAt, firstAt)
  madeReplies++
  answered++

  // The reviewer comes back about four times in ten, and occasionally the
  // creator has the last word after that.
  if (chance(0.42)) {
    const backAt = clock.after(firstAt, 'answer')
    if (backAt <= NOW) {
      insReply.run(
        idFor('reply', `${n.id}:1`), n.id, null, rootId, n.reviewer_id,
        writer.reply(wp, personaOf(n.reviewer_id), 1, info), 0, backAt, backAt,
      )
      madeReplies++
      if (chance(0.18)) {
        const lastAt = clock.after(backAt, 'answer')
        if (lastAt <= NOW) {
          insReply.run(
            idFor('reply', `${n.id}:2`), n.id, null, rootId, owner,
            writer.reply(wp, personaOf(owner), 2, info), 1, lastAt, lastAt,
          )
          madeReplies++
        }
      }
    }
  }
}
db.exec('COMMIT')
console.log(`  replies     ${madeReplies} on ${answered} notes`)

db.exec('BEGIN IMMEDIATE')
db.exec(`
  UPDATE feedback SET
    reply_count    = (SELECT COUNT(*) FROM feedback_replies fr
                       WHERE fr.feedback_id = feedback.id AND fr.deleted_at IS NULL),
    -- The creator's first answer, as the application records it.
    first_reply_at = (SELECT MIN(fr.created_at) FROM feedback_replies fr
                       WHERE fr.feedback_id = feedback.id AND fr.deleted_at IS NULL AND fr.is_creator = 1)
  WHERE EXISTS (SELECT 1 FROM feedback_replies fr WHERE fr.feedback_id = feedback.id)
`)
// A creator who wrote back has read the note. Some of those they act on, and a
// smaller share they mark as the ones worth having.
db.exec(`
  UPDATE feedback SET inbox_state = 'triaged'
   WHERE first_reply_at IS NOT NULL AND inbox_state = 'new'
`)
db.exec(`
  UPDATE feedback SET inbox_state = 'actioned'
   WHERE first_reply_at IS NOT NULL AND (rowid % 5) < 2
`)
db.exec(`
  UPDATE feedback SET inbox_state = 'read'
   WHERE first_reply_at IS NULL AND (rowid % 10) < 3
`)
db.exec(`
  UPDATE feedback SET creator_marked_helpful = 1
   WHERE first_reply_at IS NOT NULL AND (rowid % 3) = 0
`)
// A point inside a note the creator acted on is the point that moved.
db.exec(`
  UPDATE feedback_points SET is_resolved = 1
   WHERE feedback_id IN (SELECT id FROM feedback WHERE inbox_state = 'actioned')
     AND (rowid % 2) = 0
`)
db.exec('COMMIT')

// Points answer asks. Without this every ask on every project reads "Open",
// which on a project with thirty notes against it is plainly untrue.
db.exec('BEGIN IMMEDIATE')
db.exec(`
  UPDATE feedback_points SET ask_id = (
    SELECT pa.id FROM project_asks pa
      JOIN feedback f ON f.id = feedback_points.feedback_id
     WHERE pa.project_id = f.project_id
     ORDER BY (pa.sort_order + feedback_points.ordinal) % 3, pa.sort_order
     LIMIT 1)
  WHERE ask_id IS NULL AND (rowid % 5) < 3
`)
db.exec(`
  UPDATE project_asks SET answer_count = (
    SELECT COUNT(*) FROM feedback_points fp WHERE fp.ask_id = project_asks.id)
`)
db.exec('COMMIT')

/* ---------------------------------------------------------- the community */

/**
 * Threads and posts, at the size six channels and five thousand people would
 * actually produce. The seeded threads stay exactly as written; this is the
 * traffic around them.
 *
 * Every counter a channel or thread prints is computed from the posts that
 * exist, including the accepted answer and the thread's own score, so nothing
 * on the page is a number somebody typed.
 */

const channels = db.prepare(
  'SELECT id, slug FROM discussion_channels WHERE is_archived = 0 AND is_private = 0 ORDER BY sort_order',
).all()

/** Not every channel is equally busy. Craft and Playtesting carry the place. */
const CHANNEL_WEIGHT = {
  playtesting: 0.22,
  craft: 0.22,
  'giving-feedback': 0.18,
  'show-your-work': 0.16,
  pricing: 0.13,
  'whetstone-meta': 0.09,
}
const WANT_THREADS = 720

const insThread = db.prepare(
  `INSERT INTO discussion_threads (id, channel_id, project_id, author_id, title, body_md, thread_kind,
                                   status, is_pinned, post_count, view_count, score, hot_score,
                                   last_post_at, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
)
const markAccepted = db.prepare('UPDATE discussion_posts SET is_accepted = 1 WHERE id = ?')
const updThread = db.prepare(
  `UPDATE discussion_threads
      SET status = ?, accepted_post_id = ?, post_count = ?, view_count = ?,
          last_post_at = ?, updated_at = ?
    WHERE id = ?`,
)
const insPost = db.prepare(
  `INSERT INTO discussion_posts (id, thread_id, parent_post_id, author_id, body_md, depth, score, is_accepted, created_at)
   VALUES (?,?,?,?,?,?,?,?,?)`,
)

const titlesSeen = new Set(db.prepare('SELECT title FROM discussion_threads').all().map((r) => r.title))
/** Projects in the order they were posted, so a showcase can only show something that existed. */
const byPublished = projects.slice().sort((a, b) => a.published - b.published)
const postedBy = (t) => {
  let lo = 0
  let hi = byPublished.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (byPublished[mid].published <= t) lo = mid + 1
    else hi = mid
  }
  return lo
}

db.exec('BEGIN IMMEDIATE')
let madeThreads = 0
let madePosts = 0
/** Posts, collected so their scores can be counted from real votes. */
const postSeeds = []
/** Accepted answers, which pick up extra agreement in the vote pass. */
const acceptedPosts = []
let madeAnswers = 0

for (const ch of channels) {
  const want = Math.round(WANT_THREADS * (CHANNEL_WEIGHT[ch.slug] ?? 0.1))

  for (let i = 0; i < want; i++) {
    const kind = ch.slug === 'show-your-work'
      ? (chance(0.7) ? 'showcase' : 'question')
      : chance(0.52) ? 'question' : 'discussion'
    const startedAt = clock.grown('work')
    // A showcase is its creator posting their own project, after they posted
    // it here: the body says "I" and means the person who made it. Anything
    // else is started by whoever was around.
    const posted = postedBy(startedAt - HOUR)
    const shown = kind === 'showcase' && posted > 0 ? byPublished[Math.floor(rnd() * posted)] : null
    if (kind === 'showcase' && shown === null) continue
    const author = shown !== null ? personById.get(shown.ownerId) : roster.activeAt(startedAt)
    if (author === null || author === undefined) continue
    // Which vocabulary the thread draws on: a showcase talks about its
    // project by name; a question in the same channel is about the work in
    // general.
    const voiceKey = ch.slug === 'show-your-work' && shown === null ? 'show-your-work-plain' : ch.slug
    const threadCtx = writer.threadCtx(ch.slug, shown?.wp ?? null)

    // A title nobody else has used.
    const title = writer.threadTitle(voiceKey, threadCtx, titlesSeen)
    if (title === null) continue
    titlesSeen.add(title)

    const id = idFor('thread', `${ch.slug}:${title}`)
    const body = writer.threadBody(shown === null && ch.slug === 'show-your-work' ? 'default' : ch.slug, personaOf(author.id), threadCtx)
    const postVoice = shown === null && ch.slug === 'show-your-work' ? 'craft' : ch.slug

    // Foreign keys are on, so the thread has to exist before anything can be
    // posted into it. It goes in empty and the counters are set below from the
    // posts that actually landed.
    insThread.run(
      id, ch.id, shown?.id ?? null, author.id, title, body, kind,
      'open', 0, 0, 0, 0, 0, null, startedAt, startedAt,
    )
    madeThreads++

    const replies = power(0, 26, 2.4)
    const seenInThread = new Set()
    const postIds = []
    let lastAt = startedAt

    for (let k = 0; k < replies; k++) {
      // A reply follows the last one. The conversation stops where the
      // present is, however many replies it might have gone on to get.
      const at = clock.after(lastAt, 'post')
      if (at > NOW) break
      const poster = roster.activeAt(at)
      if (poster === null || (poster.id === author.id && chance(0.8))) continue

      const text = writer.post(postVoice, personaOf(poster.id), threadCtx, seenInThread)

      // Most posts answer the thread. A few answer each other.
      const parent = postIds.length > 0 && chance(0.28)
        ? postIds[Math.floor(rnd() * postIds.length)]
        : null
      const pid = idFor('post', `${id}:${String(k)}`)
      // score starts at zero and is counted from post_votes below.
      insPost.run(pid, id, parent?.id ?? null, poster.id, text, parent === null ? 0 : 1, 0, 0, at)
      postIds.push({ id: pid, at })
      postSeeds.push({ id: pid, at, author: poster.id })
      lastAt = at
      madePosts++
    }

    // Only a question can be answered, and only by a post that exists.
    let accepted = null
    if (kind === 'question' && postIds.length > 0 && chance(0.44)) {
      accepted = postIds[Math.floor(rnd() * postIds.length)]
      markAccepted.run(accepted.id)
      // The answer a thread settled on is rarely the one nobody agreed with,
      // so it collects extra agreement rather than a score the vote pass would
      // then overwrite.
      acceptedPosts.push(accepted)
      madeAnswers++
    }

    updThread.run(
      accepted === null ? 'open' : 'answered',
      accepted?.id ?? null,
      postIds.length,
      postIds.length * between(24, 52) + between(3, 60),
      postIds.length > 0 ? lastAt : null,
      lastAt,
      id,
    )
  }
}
db.exec('COMMIT')
console.log(`  threads     ${madeThreads} with ${madePosts} posts, ${madeAnswers} answered`)

// A post score with no post_votes rows behind it collapses the moment somebody
// votes on it, the same way an invented helpful count does.
const insPostVote = db.prepare(
  'INSERT OR IGNORE INTO post_votes (post_id, voter_id, vote_value, created_at) VALUES (?,?,?,?)',
)
db.exec('BEGIN IMMEDIATE')
let madePostVotes = 0
const acceptedIds = new Set(acceptedPosts.map((a) => a.id))
for (const seed of postSeeds) {
  const isAccepted = acceptedIds.has(seed.id)
  if (!isAccepted && !chance(0.5)) continue
  const voters = isAccepted ? power(4, 26, 1.6) : power(1, 16, 2.2)
  let up = 0
  for (let k = 0; k < voters; k++) {
    const at = clock.after(seed.at, 'vote')
    if (at > NOW) continue
    const voter = roster.activeAt(at)
    if (voter === null || voter.id === seed.author) continue
    // Discussion posts carry a downvote as well, so the column is a net score.
    // An accepted answer always has at least one person agreeing with it.
    const value = isAccepted || chance(0.88) ? 1 : -1
    insPostVote.run(seed.id, voter.id, value, at)
    if (value === 1) up++
    madePostVotes++
  }
  // An accepted answer from this morning may not have drawn its votes yet,
  // but whoever accepted it agreed with it, so it has at least one.
  for (let k = 0; isAccepted && up === 0 && k < 20; k++) {
    const at = clock.settle(seed.at, clock.after(seed.at, 'vote'))
    const voter = roster.activeAt(at)
    if (voter === null || voter.id === seed.author) continue
    insPostVote.run(seed.id, voter.id, 1, at)
    up++
    madePostVotes++
  }
}
db.exec('COMMIT')
console.log(`  post votes  ${madePostVotes}`)

db.exec('BEGIN IMMEDIATE')
db.exec(`
  UPDATE discussion_posts SET score = (
    SELECT COALESCE(SUM(vote_value), 0) FROM post_votes v WHERE v.post_id = discussion_posts.id)
  WHERE EXISTS (SELECT 1 FROM post_votes v WHERE v.post_id = discussion_posts.id)
`)
// A thread's score is the sum of its posts' scores, which is how votePost()
// rewrites it on every vote. Storing any other number meant the first vote on
// a thread jumped its score and reordered Top.
db.exec(`
  UPDATE discussion_threads SET score = COALESCE((
    SELECT SUM(dp.score) FROM discussion_posts dp
     WHERE dp.thread_id = discussion_threads.id AND dp.deleted_at IS NULL), 0)
`)
// The channel register prints this, so it has to match the rows underneath.
db.exec(`
  UPDATE discussion_channels SET thread_count = (
    SELECT COUNT(*) FROM discussion_threads t
     WHERE t.channel_id = discussion_channels.id AND t.deleted_at IS NULL AND t.status <> 'removed')
`)
// The same formula recomputeThreadHotScores() uses, so the ordering the feed
// shows is the ordering the app would produce on its own.
db.exec(`
  UPDATE discussion_threads
     SET hot_score = (1.0 + score + 0.5 * post_count)
                   / POW(((${NOW} - COALESCE(last_post_at, created_at)) / 3600000.0) + 2.0, 1.5)
   WHERE deleted_at IS NULL
`)
db.exec('COMMIT')

/* ------------------------------------------------ builds and the roadmap */

/**
 * Build history and the suggestion board.
 *
 * Every project past a concept has the build it was posted with, so a note
 * can say which build it was written against. Projects whose creators kept
 * working post more, each one some weeks after the last, until the present.
 *
 * A suggestion is not invented out of nothing: each one is linked to the real
 * feedback points it came from, and vote counts are counted from real votes.
 */

const insVersion = db.prepare(
  `INSERT OR IGNORE INTO project_versions (id, project_id, version_label, changelog_md, is_current, released_at, created_at)
   VALUES (?,?,?,?,?,?,?)`,
)
const insSuggestion = db.prepare(
  `INSERT INTO suggestions (id, project_id, category_id, created_by, title, body_md, status, status_note,
                            priority, effort, shipped_in_version_id, vote_count, source_count,
                            status_changed_at, shipped_at, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
)
const insSource = db.prepare(
  'INSERT OR IGNORE INTO suggestion_sources (suggestion_id, point_id, linked_by, created_at) VALUES (?,?,?,?)',
)
const insSuggestionVote = db.prepare(
  'INSERT OR IGNORE INTO suggestion_votes (suggestion_id, voter_id, created_at) VALUES (?,?,?)',
)
const setCurrent = db.prepare('UPDATE project_versions SET is_current = 1 WHERE id = ?')

/** Points on a project, so a suggestion can say which notes raised it. */
const pointsByProject = new Map()
for (const seed of pointSeeds) {
  const list = pointsByProject.get(seed.project) ?? []
  list.push(seed)
  pointsByProject.set(seed.project, list)
}

const STATUSES = [
  'open', 'open', 'open', 'open',
  'under_review', 'planned', 'planned', 'in_progress',
  'shipped', 'shipped', 'declined', 'wont_fix',
]

db.exec('BEGIN IMMEDIATE')
let madeVersions = 0
let madeSuggestions = 0
let madeSources = 0
let madeSuggestionVotes = 0
/** Each project's builds in release order, for the market to name the one a bounty was posted against. */
const versionsByProject = new Map()

for (const p of projects) {
  const notes = pointsByProject.get(p.id) ?? []
  const shape = V.VERSION_SHAPE[p.typeSlug] ?? V.VERSION_SHAPE.web_app
  const versions = []
  const release = (at, changelog) => {
    const label = shape(versions.length + 1, p.stage)
    const id = idFor('version', `${p.id}:${label}`)
    insVersion.run(id, p.id, label, changelog, 0, at, at)
    versions.push({ id, at })
    madeVersions++
  }
  // The build it was posted with. Nothing had changed yet, so there is no
  // changelog to write.
  if (p.opening !== null) release(p.opening, null)
  // Creators who kept going, once reviews came in.
  if (notes.length > 0 && chance(0.45)) {
    const more = power(1, 5, 1.8)
    let last = versions[versions.length - 1]?.at ?? p.published
    for (let v = 0; v < more; v++) {
      const at = clock.after(Math.max(last, p.published), 'build')
      if (at > NOW) break
      release(at, writer.changelog(p.wp))
      last = at
    }
  }
  const current = versions[versions.length - 1]
  if (current) setCurrent.run(current.id)
  versionsByProject.set(p.id, versions)

  // The roadmap. Only projects with notes behind them have one.
  if (notes.length < 3 || !chance(0.3)) continue
  const wanted = power(1, 6, 1.9)
  const titlesHere = new Set()
  for (let k = 0; k < wanted; k++) {
    const title = writer.suggestionTitle(p.wp)
    if (titlesHere.has(title)) continue
    titlesHere.add(title)

    const from = notes[Math.floor(rnd() * notes.length)]
    const openedAt = clock.after(from.at, 'suggestion')
    if (openedAt > NOW) continue

    // A suggestion ships in the first build after it was opened, and says so;
    // with no such build it is still being worked on. Anything else moves on
    // some weeks later, or has not moved yet.
    let status = pick(STATUSES)
    let changedAt = null
    let inVersion = null
    if (status === 'shipped') {
      const shippedIn = versions.find((v) => v.at > openedAt) ?? null
      if (shippedIn === null) status = 'in_progress'
      else {
        changedAt = shippedIn.at
        inVersion = shippedIn.id
      }
    }
    if (status !== 'open' && changedAt === null) {
      const moved = clock.after(openedAt, 'triage')
      if (moved > NOW) status = 'open'
      else changedAt = moved
    }
    const id = idFor('suggestion', `${p.id}:${title}`)
    const note = status === 'declined' || status === 'wont_fix' ? writer.declineNote(p.wp) : null

    insSuggestion.run(
      id, p.id, null, p.ownerId, title, null, status, note,
      pick(['normal', 'normal', 'normal', 'low', 'high']),
      pick(['xs', 's', 's', 'm', 'm', 'l']),
      inVersion, 0, 0, changedAt, status === 'shipped' ? changedAt : null, openedAt, changedAt ?? openedAt,
    )
    madeSuggestions++

    // Where it came from: one to three real points on this project, each
    // written before the suggestion was opened.
    const linked = new Set([from.id])
    insSource.run(id, from.id, p.ownerId, openedAt)
    madeSources++
    const sources = between(1, 3)
    for (let q = 1; q < sources; q++) {
      const point = notes[Math.floor(rnd() * notes.length)]
      if (linked.has(point.id) || point.at > openedAt) continue
      linked.add(point.id)
      insSource.run(id, point.id, p.ownerId, openedAt)
      madeSources++
    }

    // And who else wants it.
    if (chance(0.62)) {
      const backers = power(1, 26, 2.2)
      for (let q = 0; q < backers; q++) {
        const at = clock.after(openedAt, 'backing')
        if (at > NOW) continue
        const voter = roster.activeAt(at)
        if (voter === null || voter.id === p.ownerId) continue
        insSuggestionVote.run(id, voter.id, at)
        madeSuggestionVotes++
      }
    }
  }
}
db.exec('COMMIT')

db.exec('BEGIN IMMEDIATE')
// A note is written against whatever build was current when it was written.
// Leaving version_id null everywhere made every build on every project report
// "0 notes, 0 reviewers, 0 blockers", which says the builds changed nothing.
// A quarter stay unattributed, because plenty of reviews genuinely are.
db.exec(`
  UPDATE feedback SET version_id = (
    SELECT v.id FROM project_versions v
     WHERE v.project_id = feedback.project_id AND v.released_at <= feedback.submitted_at
     ORDER BY v.released_at DESC LIMIT 1)
  WHERE version_id IS NULL AND (rowid % 4) < 3
`)
// Both counters printed on the roadmap card, both counted rather than chosen.
db.exec(`
  UPDATE suggestions SET
    vote_count   = (SELECT COUNT(*) FROM suggestion_votes v WHERE v.suggestion_id = suggestions.id),
    source_count = (SELECT COUNT(*) FROM suggestion_sources s WHERE s.suggestion_id = suggestions.id)
`)
db.exec('COMMIT')
console.log(`  builds      ${madeVersions}`)
console.log(`  roadmap     ${madeSuggestions} suggestions, ${madeSources} sourced, ${madeSuggestionVotes} backers`)

/* --------------------------------------------------------------- the market */

/**
 * The paid-review market, grown the way the rest of the community is: out of
 * what people already did here.
 *
 * Experts are the busiest reviewers with a record in one kind of work, and
 * they are verified in the areas that kind of work is about. Every verified
 * area has its own approved request and its own credential, so the badge on
 * the list and the evidence on the profile always come from the same rows.
 *
 * A bounty is a timeline, not a status picked from a list: posted and funded,
 * applied to, awarded, delivered as a real review, accepted and paid. Where it
 * stands today is simply how far along that timeline the present has got, so
 * old bounties are closed, this week's are open, and the money moves exactly
 * as the application moves it: authorised and held when posted, released to
 * the reviewer less the platform fee on acceptance, refunded on cancellation.
 */

const areaIdBySlug = new Map(db.prepare('SELECT id, slug FROM expertise_areas').all().map((r) => [r.slug, r.id]))
const typeSlugById = new Map(types.map((t) => [t.id, t.slug]))
/** The same arithmetic as feeFor() in src/server/repos/bounties.ts. */
const PLATFORM_FEE_BPS = 1000
const feeFor = (amount) => Math.min(amount - 1, Math.round((amount * PLATFORM_FEE_BPS) / 10_000))
/**
 * The reference a bounty's escrow is filed under, shaped the way
 * escrowRefFor() in src/server/queries/bounty-ops.ts opens one: 'esc_' and ten
 * hex characters, reused by every row of that bounty's ledger.
 */
const escrowRef = (key) => `esc_${createHash('sha1').update(`escrow:${key}`).digest('hex').slice(0, 10)}`
/** money() in src/components/marketplace/format.ts: whole dollars when the amount is whole. */
const money = (cents) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
  minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
}).format(cents / 100)
/** The ledger notes the bounty actions write, word for word, so old rows and new ones read alike. */
const RELEASE_NOTE = 'Released to the reviewer after acceptance.'
const REFUND_NOTE = 'Returned to the creator after cancellation.'
const feeNote = (fee, amount) => `${String(Math.round((fee * 100) / amount))} per cent of the ${money(amount)} bounty.`

const insExpert = db.prepare(
  `INSERT INTO expert_profiles (user_id, headline, pitch_md, hourly_rate_cents, min_bounty_cents, currency, turnaround_hours,
                                capacity_per_week, years_experience, is_listed, is_verified, created_at, updated_at)
   VALUES (?,?,?,?,?,'USD',?,?,?,?,1,?,?)`,
)
const insExpertise = db.prepare('INSERT INTO expert_expertise (user_id, expertise_id, level, is_verified) VALUES (?,?,?,?)')
const insRequest = db.prepare(
  `INSERT INTO verification_requests (id, user_id, expertise_id, claim_md, evidence, status, reviewer_id, decision_note, decided_at, created_at, updated_at)
   VALUES (?,?,?,?,NULL,'approved',NULL,?,?,?,?)`,
)
const insCredential = db.prepare(
  `INSERT INTO verification_credentials (id, user_id, request_id, expertise_id, credential, issued_by, issued_at, expires_at, revoked_at, revoke_reason)
   VALUES (?,?,?,?,?,NULL,?,?,NULL,NULL)`,
)
const insBadge = db.prepare(
  `INSERT OR IGNORE INTO user_badges (user_id, badge_id, awarded_at, revoked_at, reason) VALUES (?,?,?,NULL,?)`,
)
const insBounty = db.prepare(
  `INSERT INTO bounties (id, project_id, version_id, created_by, title, brief_md, expertise_id, amount_cents, currency,
                         platform_fee_bps, seats, seats_awarded, turnaround_hours, visibility, invited_user_id, status,
                         escrow_state, escrow_ref, closes_at, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,'USD',?,1,?,?,?,?,?,?,?,?,?,?)`,
)
const insApplication = db.prepare(
  `INSERT INTO bounty_applications (id, bounty_id, applicant_id, pitch_md, quoted_cents, eta_hours, status, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?)`,
)
const insAward = db.prepare(
  `INSERT INTO bounty_awards (id, bounty_id, application_id, expert_id, feedback_id, payout_method_id, amount_cents, fee_cents,
                              currency, status, payout_state, creator_rating, creator_review, due_at, delivered_at, accepted_at,
                              paid_at, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,'USD',?,?,?,?,?,?,?,?,?,?)`,
)
const insEscrow = db.prepare(
  `INSERT INTO bounty_escrow_events (id, bounty_id, award_id, event_kind, from_state, to_state, amount_cents, currency,
                                     provider_ref, actor_id, idempotency_key, note, created_at)
   VALUES (?,?,?,?,?,?,?,'USD',?,?,?,?,?)`,
)
const insPayout = db.prepare(
  `INSERT INTO payout_methods (id, user_id, provider, external_ref, display_name, currency, is_default, verified_at, created_at)
   VALUES (?,?,?,?,?,?,1,?,?)`,
)
const payoutOf = db.prepare('SELECT id FROM payout_methods WHERE user_id = ? AND deleted_at IS NULL ORDER BY is_default DESC LIMIT 1')
const badgeId = db.prepare(`SELECT id FROM badges WHERE slug = 'verified-expert'`).get()?.id ?? null

/** Who has a record worth verifying: reviews written, and the kind of work they were on. */
const record = new Map()
for (const r of db.prepare(
  `SELECT f.reviewer_id AS uid, p.project_type_id AS type_id, COUNT(*) AS n,
          SUM(f.creator_marked_helpful) AS helpful
     FROM feedback f JOIN projects p ON p.id = f.project_id
    WHERE f.status = 'submitted'
    GROUP BY f.reviewer_id, p.project_type_id`,
).all()) {
  const entry = record.get(r.uid) ?? { uid: r.uid, total: 0, helpful: 0, byType: [] }
  entry.total += r.n
  entry.helpful += r.helpful
  entry.byType.push({ type: typeSlugById.get(r.type_id), n: r.n })
  record.set(r.uid, entry)
}
const reviewTimes = new Map()
for (const r of db.prepare(`SELECT reviewer_id AS uid, submitted_at AS at FROM feedback WHERE status = 'submitted' ORDER BY submitted_at`).all()) {
  const list = reviewTimes.get(r.uid) ?? []
  list.push(r.at)
  reviewTimes.set(r.uid, list)
}

/**
 * Everyone who can take paid work, by area. Each entry says since when, since
 * nobody takes a bounty in an area before they were verified in it.
 */
const expertsByArea = new Map()
const offerWork = (expert, slug, since) => {
  const list = expertsByArea.get(slug) ?? []
  list.push({ expert, since })
  expertsByArea.set(slug, list)
}

// The hand-written experts take paid work too, in the areas they are verified in.
{
  const rows = db.prepare(
    `SELECT ee.user_id AS uid, ea.slug, ep.min_bounty_cents AS min, vc.issued_at AS since
       FROM expert_expertise ee
       JOIN expertise_areas ea ON ea.id = ee.expertise_id
       JOIN expert_profiles ep ON ep.user_id = ee.user_id AND ep.is_listed = 1
       JOIN verification_credentials vc ON vc.user_id = ee.user_id AND vc.expertise_id = ee.expertise_id
                                       AND vc.revoked_at IS NULL
      WHERE ee.is_verified = 1`,
  ).all()
  const byUser = new Map()
  for (const r of rows) {
    const expert = byUser.get(r.uid) ?? { uid: r.uid, min: r.min }
    byUser.set(r.uid, expert)
    offerWork(expert, r.slug, r.since)
  }
}

/**
 * How many generated reviewers are verified in each area: more in the area
 * each kind of work is mostly about, fewer in the specialist ones, so every
 * area has people a bounty in it can go to.
 */
const CENTRAL = new Set(Object.values(AREAS_BY_TYPE).map((pool) => pool[0]))
const wantInArea = (slug) => (CENTRAL.has(slug) ? 7 : 4)
/** The kinds of work an area is about, for reading a reviewer's record against it. */
const typesOf = (slug) => Object.entries(AREAS_BY_TYPE).filter(([, pool]) => pool.includes(slug)).map(([type]) => type)
writer.reserveHeadlines(db.prepare('SELECT headline FROM expert_profiles').all().map((r) => r.headline))
const markExpert = db.prepare('UPDATE users SET is_expert = 1 WHERE id = ?')
const badgeTheirNotes = db.prepare('UPDATE feedback SET reviewer_is_expert = 1 WHERE reviewer_id = ? AND submitted_at >= ?')
db.exec('BEGIN IMMEDIATE')
let madeExperts = 0
{
  // The busiest generated reviewers, the ones creators marked helpful first.
  const pool = [...record.values()]
    .filter((r) => generatedIds.has(r.uid) && r.total >= 6)
    .map((r) => ({ ...r, byType: r.byType.sort((a, b) => b.n - a.n) }))
    .sort((a, b) => b.total + b.helpful * 2 - (a.total + a.helpful * 2))
  const taken = new Set()
  // Areas take turns choosing, so each fills up evenly rather than the first
  // few taking everybody.
  const queue = []
  for (let round = 0; round < 7; round++) {
    for (const slug of someOf([...areaIdBySlug.keys()], areaIdBySlug.size)) if (round < wantInArea(slug)) queue.push(slug)
  }
  for (const primary of queue) {
    // The best remaining reviewer with a real record in this area's kind of work.
    const kinds = typesOf(primary)
    const cand = pool.find((r) => !taken.has(r.uid) && r.byType.some((t) => kinds.includes(t.type) && t.n >= 3))
    if (cand === undefined) continue
    taken.add(cand.uid)
    const person = personById.get(cand.uid)
    const times = reviewTimes.get(cand.uid) ?? []
    // Verification comes after a track record: some weeks after their fifth review.
    const verifiedAt = clock.after(times[Math.min(4, times.length - 1)], 'triage')
    if (verifiedAt > NOW - DAY) continue

    const areas = [{ slug: primary, level: 'specialist', verified: true, at: verifiedAt }]
    // A second area from what they review most, or a neighbour of the first.
    if (chance(0.55)) {
      const secondPool = (AREAS_BY_TYPE[cand.byType[0].type] ?? []).concat(AREAS_BY_TYPE[kinds[0]] ?? []).filter((slug) => slug !== primary)
      if (secondPool.length > 0) {
        const verified = chance(0.45)
        const at = verified ? clock.settle(verifiedAt, clock.after(verifiedAt, 'triage')) : verifiedAt
        areas.push({ slug: pick(secondPool), level: verified ? 'specialist' : 'practitioner', verified, at })
      }
    }
    // And sometimes something they know a little about and have not asked to have checked.
    if (chance(0.3)) {
      const known = new Set(areas.map((x) => x.slug))
      areas.push({ slug: pick([...areaIdBySlug.keys()].filter((slug) => !known.has(slug))), level: chance(0.5) ? 'familiar' : 'practitioner', verified: false, at: verifiedAt })
    }

    const persona = personaOf(cand.uid)
    const years = between(4, 24)
    const profile = writer.expertProfile(primary, persona)
    // Minimums spread across the market's price bands, most in the middle.
    const band = pick([0, 1, 1, 1, 2, 2, 2, 3])
    const min = [between(8, 15), between(16, 25), between(26, 40), between(42, 90)][band] * 1000
    const hourly = Math.round((min * (0.5 + rnd() * 0.45)) / 500) * 500
    insExpert.run(
      cand.uid, profile.headline, profile.pitch, hourly, min, pick([24, 48, 48, 72, 72, 72, 96, 120, 168]),
      between(1, 5), years, chance(0.92) ? 1 : 0, verifiedAt, verifiedAt,
    )
    const expert = { uid: cand.uid, min }
    for (const x of areas) {
      insExpertise.run(cand.uid, areaIdBySlug.get(x.slug), x.level, x.verified ? 1 : 0)
      if (!x.verified) continue
      const requestId = idFor('verify', `${cand.uid}:${x.slug}`)
      const opened = Math.max(person.joined + HOUR, x.at - between(4, 20) * DAY)
      insRequest.run(
        requestId, cand.uid, areaIdBySlug.get(x.slug), writer.claim(x.slug, persona, years),
        'Two existing experts read five of their reviews, chosen at random, and confirmed the claim in writing.',
        x.at, opened, x.at,
      )
      insCredential.run(
        idFor('credential', `${cand.uid}:${x.slug}`), cand.uid, requestId, areaIdBySlug.get(x.slug),
        pick(['domain_expert', 'shipped_titles', 'employer']), x.at, x.at + 730 * DAY,
      )
      offerWork(expert, x.slug, x.at)
    }
    markExpert.run(cand.uid)
    if (badgeId !== null) insBadge.run(cand.uid, badgeId, verifiedAt, 'Credentials confirmed by two existing experts.')
    // A note is badged "expert" when its reviewer was one at the time.
    badgeTheirNotes.run(cand.uid, verifiedAt)
    madeExperts++
  }
}
db.exec('COMMIT')
console.log(`  experts     ${madeExperts} verified`)

const tally = { open: 0, in_progress: 0, delivered: 0, closed: 0, cancelled: 0 }
let madeApplications = 0
let madePaidNotes = 0
const WANT_BOUNTIES = 240
/**
 * The market opened five months ago and has been picking up since: the rate
 * of new bounties rises with the square of the time it has been open, so a
 * week's worth now is several times a week's worth in its first month.
 */
const MARKET_OPENED = NOW - 150 * DAY
const postedAt = () => Math.floor(MARKET_OPENED + (NOW - MARKET_OPENED) * Math.cbrt(rnd()))
/** The area a bounty on this project is in: usually the central one for its type. */
const areaFor = (p) => {
  const pool = AREAS_BY_TYPE[p.typeSlug].filter((slug) => AREA_FITS[slug]?.(p.wp.world) ?? true)
  return chance(0.55) ? pool[0] : pick(pool)
}
const setVersion = db.prepare('UPDATE feedback SET version_id = ? WHERE id = ?')

db.exec('BEGIN IMMEDIATE')
for (let b = 0, tries = 0; b < WANT_BOUNTIES && tries < WANT_BOUNTIES * 6; tries++) {
  const posted = postedAt()
  const live = postedBy(posted - DAY)
  if (live === 0) continue
  const p = byPublished[Math.floor(rnd() * live)]
  const areaSlug = areaFor(p)
  // Only reviewers verified in the area before the bounty was posted can take
  // it, and never the creator themselves.
  const able = (expertsByArea.get(areaSlug) ?? []).filter((x) => x.since < posted && x.expert.uid !== p.ownerId).map((x) => x.expert)
  if (able.length === 0) continue
  b++

  const bid = idFor('bounty', `${p.id}:${String(b)}`)
  const words = writer.bounty(p.wp, areaSlug)
  const awardee = pick(able)
  const turnaround = pick([48, 72, 72, 96, 120, 168])
  const amount = Math.max(awardee.min, Math.round((awardee.min * (1 + rnd() * 0.8)) / 1000) * 1000)
  const fee = feeFor(amount)
  const inviteOnly = chance(0.08)
  const version = [...(versionsByProject.get(p.id) ?? [])].reverse().find((v) => v.at <= posted) ?? null
  const ref = escrowRef(bid)
  const closesAt = posted + between(17, 24) * DAY

  // The timeline, in the order it happens. Most bounties are taken within a
  // week; a few wait for the right person.
  const roll = rnd()
  const awardAt = posted + (roll < 0.35 ? 6 * HOUR + rnd() * 42 * HOUR : roll < 0.8 ? 2 * DAY + rnd() * 7 * DAY : 9 * DAY + rnd() * 7 * DAY)
  const cancelAt = chance(0.06) && awardAt - posted > 2 * DAY ? posted + DAY + rnd() * (Math.min(awardAt - posted, 10 * DAY) - DAY) : null
  const dueAt = awardAt + turnaround * HOUR
  const deliveredAt = awardAt + turnaround * HOUR * (0.3 + rnd() * 0.8)
  // Creators take a while to read what they paid for: some the same day, most within a few.
  const reading = rnd()
  const acceptedAt = deliveredAt + (reading < 0.3 ? 2 * HOUR + rnd() * 10 * HOUR : reading < 0.8 ? DAY + rnd() * 3 * DAY : 4 * DAY + rnd() * 5 * DAY)
  const paidAt = acceptedAt + MINUTE + Math.floor(rnd() * 4 * MINUTE)

  // Where the present finds it.
  const status = cancelAt !== null ? (cancelAt <= NOW ? 'cancelled' : 'open')
    : awardAt > NOW ? 'open' : deliveredAt > NOW ? 'in_progress' : acceptedAt > NOW ? 'delivered' : 'closed'
  tally[status]++
  const awarded = status === 'in_progress' || status === 'delivered' || status === 'closed'
  const escrowState = status === 'cancelled' ? 'refunded' : status === 'closed' ? 'released' : 'held'
  const updatedAt = Math.floor(
    status === 'cancelled' ? cancelAt : status === 'closed' ? paidAt : status === 'delivered' ? deliveredAt
      : status === 'in_progress' ? awardAt : posted,
  )

  insBounty.run(
    bid, p.id, version?.id ?? null, p.ownerId, words.title, words.brief, areaIdBySlug.get(areaSlug), amount, PLATFORM_FEE_BPS,
    awarded ? 1 : 0, turnaround, inviteOnly ? 'invite_only' : 'public', inviteOnly ? awardee.uid : null, status, escrowState, ref,
    closesAt, Math.floor(posted), updatedAt,
  )

  // The money, as the application records it: authorised and held at posting.
  let escrowFrom = null
  const escrow = (kind, to, cents, at, key, awardId = null, note = null) => {
    insEscrow.run(idFor('escrow', `${bid}:${key}`), bid, awardId, kind, escrowFrom, to, cents, ref, p.ownerId,
      `${bid}:${key}`, note, Math.floor(at))
    escrowFrom = to
  }
  escrow('authorize', 'authorized', amount, posted, 'authorize')
  escrow('hold', 'held', amount, posted + MINUTE, 'hold')

  // Applications, each before the award and before the present. An invited
  // reviewer is the only one who can apply.
  const applicants = inviteOnly ? [awardee] : [awardee, ...someOf(able.filter((e) => e !== awardee), between(0, 5))]
  const lastApply = Math.min(cancelAt ?? awardAt, awardAt) - 30 * MINUTE
  let awardeeApplication = null
  for (const e of applicants) {
    const window = e === awardee ? Math.min(lastApply - posted, 3 * DAY) : lastApply - posted
    const at = Math.floor(posted + 20 * MINUTE + rnd() * Math.max(10 * MINUTE, window - 20 * MINUTE))
    if (at > NOW) continue
    const aid = idFor('application', `${bid}:${e.uid}`)
    const appStatus = awarded ? (e === awardee ? 'accepted' : 'declined')
      : status === 'cancelled' ? 'declined'
      : chance(0.3) ? 'shortlisted' : 'pending'
    const quoted = chance(0.7) ? amount : Math.round((amount * (0.85 + rnd() * 0.3)) / 1000) * 1000
    insApplication.run(aid, bid, e.uid, writer.application(p.wp, areaSlug, personaOf(e.uid)), quoted,
      Math.min(turnaround, pick([24, 36, 48, 72, 96, 120])), appStatus, at, at)
    if (e === awardee) awardeeApplication = aid
    madeApplications++
  }

  if (status === 'cancelled') {
    escrow('refund', 'refunded', amount, cancelAt, 'refund', null, REFUND_NOTE)
    continue
  }
  if (!awarded) continue

  // The award, and the review it paid for once that is delivered.
  const awardId = idFor('award', bid)
  let feedbackId = null
  if (status === 'delivered' || status === 'closed') {
    feedbackId = idFor('feedback', `bounty:${bid}`)
    const submitted = Math.max(Math.floor(awardAt) + HOUR, Math.floor(deliveredAt - 5 * MINUTE - rnd() * 2 * HOUR))
    writeNote(p, personById.get(awardee.uid), submitted, { id: feedbackId, origin: 'bounty', bountyId: bid, expert: 1, paid: true })
    setVersion.run(version?.id ?? null, feedbackId)
    madePaidNotes++
  }
  let payout = null
  const rating = status === 'closed' && chance(0.78) ? pick([5, 5, 5, 5, 5, 4, 4, 4, 3]) : null
  if (status === 'closed') {
    payout = payoutOf.get(awardee.uid)?.id ?? null
    if (payout === null) {
      const [provider, display] = pick(PAYOUT)
      const cur = pick(['USD', 'EUR', 'GBP', 'EUR', 'USD', 'SEK', 'CAD'])
      payout = idFor('payout', awardee.uid)
      insPayout.run(payout, awardee.uid, provider, `acct_${idFor('acct', awardee.uid).slice(0, 12)}`, display.replace('{cur}', cur),
        cur, Math.floor(awardAt), Math.floor(awardAt))
    }
  }
  insAward.run(
    awardId, bid, awardeeApplication, awardee.uid, feedbackId, payout, amount, fee,
    status === 'in_progress' ? 'assigned' : status === 'delivered' ? 'delivered' : 'accepted',
    status === 'closed' ? 'paid' : 'pending',
    rating, rating !== null && chance(0.7) ? writer.creatorReview(p.wp, rating) : null,
    Math.floor(dueAt),
    status === 'in_progress' ? null : Math.floor(deliveredAt),
    status === 'closed' ? Math.floor(acceptedAt) : null,
    status === 'closed' ? Math.floor(paidAt) : null,
    Math.floor(awardAt), updatedAt,
  )
  if (status === 'closed') {
    // Released to the reviewer less the fee, and the fee, at acceptance, in
    // the order acceptDelivery() writes them: the fee never precedes the
    // release it was taken from.
    escrow('release', 'released', amount - fee, acceptedAt, 'release', awardId, RELEASE_NOTE)
    escrow('fee', 'released', fee, acceptedAt + 1000, 'fee', awardId, feeNote(fee, amount))
  }
}
db.exec('COMMIT')
console.log(`  bounties    ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(', ')}; ${madeApplications} applications, ${madePaidNotes} paid reviews`)

// Every expert's record, counted from their awards the way acceptDelivery()
// counts it, for the hand-written experts as much as the generated ones.
db.exec('BEGIN IMMEDIATE')
db.exec(`
  UPDATE expert_profiles SET
    completed_count = (SELECT COUNT(*) FROM bounty_awards a WHERE a.expert_id = expert_profiles.user_id AND a.status = 'accepted'),
    avg_rating = COALESCE((SELECT ROUND(AVG(CAST(a.creator_rating AS REAL)), 2) FROM bounty_awards a
                            WHERE a.expert_id = expert_profiles.user_id AND a.creator_rating IS NOT NULL), 0.0),
    on_time_rate = COALESCE((SELECT ROUND(AVG(CASE WHEN a.delivered_at <= a.due_at THEN 1.0 ELSE 0.0 END), 2)
                               FROM bounty_awards a
                              WHERE a.expert_id = expert_profiles.user_id AND a.status = 'accepted'), 0.0)
`)
db.exec('COMMIT')

/* ------------------------------------------------------------- reputation */

// Reputation, counted rather than chosen.
//
// These rows used to be invented before any of the work existed: a reviewer
// score drawn from a distribution beside a review count drawn from another one,
// over an empty ledger. The profile prints "41 projects, 12 shipped, 380 pieces
// of feedback received" from these columns and the leaderboard sorts on them,
// so every one of those sentences was fiction. Each column below is a count of
// rows that exist.
// Every column is an aggregate over the whole table, so it is computed once
// into a temp table and joined, rather than as four correlated subqueries run
// per user across five thousand rows.
db.exec('BEGIN IMMEDIATE')
db.exec(`
  CREATE TEMP TABLE rep_tally AS
  SELECT u.id AS user_id,
         COALESCE(rev.n, 0)        AS reviews_written,
         COALESCE(rev.helpful, 0)  AS marked_helpful,
         COALESCE(app.n, 0)        AS notes_shipped,
         COALESCE(got.n, 0)        AS reviews_received,
         COALESCE(got.answered, 0) AS reviews_answered,
         COALESCE(com.n, 0)        AS posts_written,
         COALESCE(com.accepted, 0) AS answers_accepted,
         COALESCE(paid.n, 0)       AS paid_accepted
    FROM users u
    LEFT JOIN (SELECT reviewer_id AS uid, COUNT(*) AS n,
                      SUM(CASE WHEN creator_marked_helpful = 1 THEN 1 ELSE 0 END) AS helpful
                 FROM feedback WHERE status = 'submitted' GROUP BY reviewer_id) rev ON rev.uid = u.id
    LEFT JOIN (SELECT f.reviewer_id AS uid, COUNT(DISTINCT s.id) AS n
                 FROM suggestions s
                 JOIN suggestion_sources src ON src.suggestion_id = s.id
                 JOIN feedback_points fp ON fp.id = src.point_id
                 JOIN feedback f ON f.id = fp.feedback_id
                WHERE s.status = 'shipped' GROUP BY f.reviewer_id) app ON app.uid = u.id
    LEFT JOIN (SELECT p.owner_id AS uid, COUNT(*) AS n,
                      SUM(CASE WHEN f.first_reply_at IS NOT NULL THEN 1 ELSE 0 END) AS answered
                 FROM feedback f JOIN projects p ON p.id = f.project_id
                WHERE f.status = 'submitted' GROUP BY p.owner_id) got ON got.uid = u.id
    LEFT JOIN (SELECT author_id AS uid, COUNT(*) AS n,
                      SUM(CASE WHEN is_accepted = 1 THEN 1 ELSE 0 END) AS accepted
                 FROM discussion_posts WHERE deleted_at IS NULL GROUP BY author_id) com ON com.uid = u.id
    LEFT JOIN (SELECT expert_id AS uid, COUNT(*) AS n
                 FROM bounty_awards WHERE status = 'accepted' GROUP BY expert_id) paid ON paid.uid = u.id
`)
db.exec('CREATE INDEX temp.ix_rep_tally ON rep_tally (user_id)')
db.exec(`
  UPDATE reputation_scores SET
    feedback_count = (SELECT reviews_written FROM rep_tally t WHERE t.user_id = reputation_scores.user_id),
    helpful_count  = (SELECT marked_helpful  FROM rep_tally t WHERE t.user_id = reputation_scores.user_id),
    applied_count  = (SELECT notes_shipped   FROM rep_tally t WHERE t.user_id = reputation_scores.user_id),
    computed_at    = ${NOW}
  WHERE EXISTS (SELECT 1 FROM rep_tally t WHERE t.user_id = reputation_scores.user_id)
`)
db.exec(`
  UPDATE reputation_scores SET
    helpful_rate = CASE WHEN feedback_count > 0
                        THEN ROUND(CAST(helpful_count AS REAL) / feedback_count, 3) ELSE 0.0 END,
    response_rate = COALESCE((
      SELECT CASE WHEN t.reviews_received > 0
                  THEN ROUND(CAST(t.reviews_answered AS REAL) / t.reviews_received, 3) ELSE 0.0 END
        FROM rep_tally t WHERE t.user_id = reputation_scores.user_id), 0.0)
`)
// A score is a weighted count of the same rows: reviews written, the share the
// creator marked helpful, the notes that reached a shipped build, and, for a
// creator, the reviews their own work drew and how many they answered. The
// expert facet is the paid work accepted, at the forty points acceptDelivery()
// records for each.
db.exec(`
  UPDATE reputation_scores SET
    reviewer_score = feedback_count * 6 + helpful_count * 14 + applied_count * 40,
    creator_score = COALESCE((
      SELECT t.reviews_received * 3 + t.reviews_answered * 9
        FROM rep_tally t WHERE t.user_id = reputation_scores.user_id), 0),
    community_score = COALESCE((
      SELECT t.posts_written * 4 + t.answers_accepted * 12
        FROM rep_tally t WHERE t.user_id = reputation_scores.user_id), 0),
    expert_score = COALESCE((
      SELECT t.paid_accepted * 40 FROM rep_tally t WHERE t.user_id = reputation_scores.user_id), 0)
`)
db.exec(`
  UPDATE reputation_scores SET
    total_score = reviewer_score + creator_score + community_score + expert_score,
    level = CASE
      WHEN reviewer_score + creator_score + community_score >= 1200 THEN 5
      WHEN reviewer_score + creator_score + community_score >= 600  THEN 4
      WHEN reviewer_score + creator_score + community_score >= 250  THEN 3
      WHEN reviewer_score + creator_score + community_score >= 80   THEN 2
      ELSE 1 END
`)
db.exec('DROP TABLE rep_tally')
db.exec('COMMIT')

/* --------------------------------------------------------------- the stats */

db.exec('BEGIN IMMEDIATE')
db.exec(`
  INSERT INTO project_stats (project_id, computed_at)
  SELECT p.id, ${NOW} FROM projects p
   WHERE p.id NOT IN (SELECT project_id FROM project_stats)
`)
// Every derived column is computed the way the application computes it when
// the underlying rows change (feedback.ts, ratings.ts, suggestions.ts), for
// every project, so the first real event on a project moves its numbers by
// exactly that event and nothing else. Only the view count is not derived:
// the hand-written projects keep theirs and the generated ones get one below.
db.exec(`
  UPDATE project_stats SET
    feedback_count = (SELECT COUNT(*) FROM feedback f
                       WHERE f.project_id = project_stats.project_id AND f.status = 'submitted' AND f.deleted_at IS NULL),
    reviewer_count = (SELECT COUNT(DISTINCT f.reviewer_id) FROM feedback f
                       WHERE f.project_id = project_stats.project_id AND f.status = 'submitted' AND f.deleted_at IS NULL),
    expert_feedback_count = (SELECT COUNT(*) FROM feedback f
                       WHERE f.project_id = project_stats.project_id AND f.status = 'submitted'
                         AND f.deleted_at IS NULL AND f.reviewer_is_expert = 1),
    last_feedback_at = (SELECT MAX(f.submitted_at) FROM feedback f
                         WHERE f.project_id = project_stats.project_id AND f.status = 'submitted' AND f.deleted_at IS NULL),
    reply_rate = COALESCE((SELECT CAST(SUM(CASE WHEN f.first_reply_at IS NOT NULL THEN 1 ELSE 0 END) AS REAL) / NULLIF(COUNT(*), 0)
                             FROM feedback f
                            WHERE f.project_id = project_stats.project_id AND f.status = 'submitted' AND f.deleted_at IS NULL), 0.0),
    open_suggestions = (SELECT COUNT(*) FROM suggestions s WHERE s.project_id = project_stats.project_id
                          AND s.status IN ('open', 'under_review', 'planned', 'in_progress')),
    shipped_suggestions = (SELECT COUNT(*) FROM suggestions s WHERE s.project_id = project_stats.project_id AND s.status = 'shipped'),
    rating_count = (SELECT COUNT(*) FROM feedback_ratings fr JOIN feedback f ON f.id = fr.feedback_id
                     WHERE f.project_id = project_stats.project_id AND f.status = 'submitted' AND f.deleted_at IS NULL),
    rating_avg = COALESCE((SELECT ROUND(SUM(fr.rating_value * ra.weight * (5.0 / ra.scale_max)) / SUM(ra.weight), 2)
                             FROM feedback_ratings fr
                             JOIN feedback f ON f.id = fr.feedback_id
                             JOIN rating_axes ra ON ra.id = fr.axis_id
                            WHERE f.project_id = project_stats.project_id AND f.status = 'submitted' AND f.deleted_at IS NULL), 0.0),
    follower_count = (SELECT COUNT(*) FROM project_follows pf WHERE pf.project_id = project_stats.project_id),
    bookmark_count = (SELECT COUNT(*) FROM project_bookmarks pb WHERE pb.project_id = project_stats.project_id),
    computed_at = ${NOW}
`)
// The last thing that happened on a project: posted, reviewed, answered, built or moved on the roadmap.
db.exec(`
  UPDATE project_stats SET last_activity_at = (
    SELECT MAX(t) FROM (
      SELECT p.published_at AS t FROM projects p WHERE p.id = project_stats.project_id
      UNION ALL SELECT MAX(f.submitted_at) FROM feedback f WHERE f.project_id = project_stats.project_id AND f.status = 'submitted'
      UNION ALL SELECT MAX(r.created_at) FROM feedback_replies r JOIN feedback f ON f.id = r.feedback_id
                 WHERE f.project_id = project_stats.project_id
      UNION ALL SELECT MAX(v.released_at) FROM project_versions v WHERE v.project_id = project_stats.project_id
      UNION ALL SELECT MAX(COALESCE(s.status_changed_at, s.created_at)) FROM suggestions s WHERE s.project_id = project_stats.project_id))
`)
db.exec('COMMIT')

// Views: most visitors do not review, and how many look without writing
// anything varies a great deal from one project to the next.
db.exec('BEGIN IMMEDIATE')
{
  const setViews = db.prepare('UPDATE project_stats SET view_count = ? WHERE project_id = ?')
  for (const r of db.prepare(
    `SELECT s.project_id AS id, s.feedback_count AS n, p.published_at AS at FROM project_stats s
       JOIN projects p ON p.id = s.project_id WHERE s.project_id IN (SELECT id FROM generated_project)`,
  ).all()) {
    const days = Math.max(1, (NOW - r.at) / DAY)
    setViews.run(Math.round(r.n * (14 + rnd() * 50) + Math.sqrt(days) * (3 + rnd() * 9) + between(2, 40)), r.id)
  }
}
db.exec('COMMIT')

// Tag counts are the number of public, published projects carrying each tag
// right now, which is what the tag pages say they are.
db.exec('BEGIN IMMEDIATE')
db.exec(`
  UPDATE tags SET usage_count = (
    SELECT COUNT(*) FROM project_tags pt JOIN projects p ON p.id = pt.project_id
     WHERE pt.tag_id = tags.id AND p.status = 'published' AND p.visibility = 'public' AND p.deleted_at IS NULL)
`)
db.exec('COMMIT')

// Somebody was last seen around the last thing they did, and never later
// than now. The hand-written members keep the dates their authors gave them.
db.exec('BEGIN IMMEDIATE')
{
  const lastDone = new Map()
  const note = (uid, at) => {
    if (at > (lastDone.get(uid) ?? 0)) lastDone.set(uid, at)
  }
  for (const r of db.prepare(`
      SELECT reviewer_id AS uid, MAX(submitted_at) AS at FROM feedback GROUP BY reviewer_id
      UNION ALL SELECT author_id, MAX(created_at) FROM feedback_replies GROUP BY author_id
      UNION ALL SELECT author_id, MAX(created_at) FROM discussion_posts GROUP BY author_id
      UNION ALL SELECT author_id, MAX(created_at) FROM discussion_threads GROUP BY author_id
      UNION ALL SELECT voter_id, MAX(created_at) FROM feedback_votes GROUP BY voter_id
      UNION ALL SELECT voter_id, MAX(created_at) FROM feedback_point_votes GROUP BY voter_id
      UNION ALL SELECT voter_id, MAX(created_at) FROM post_votes GROUP BY voter_id
      UNION ALL SELECT owner_id, MAX(published_at) FROM projects GROUP BY owner_id`).all()) note(r.uid, r.at)
  const setSeen = db.prepare('UPDATE users SET last_seen_at = ?, updated_at = ? WHERE id = ?')
  for (const person of people) {
    const last = Math.max(person.joined, lastDone.get(person.id) ?? 0)
    const seen = clock.settle(last, last + Math.floor(rnd() * 2 * DAY))
    setSeen.run(seen, seen, person.id)
  }
}
db.exec('ANALYZE')
db.exec('COMMIT')

const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n
console.log('\n  ------------------------------')
for (const t of ['users', 'profiles', 'projects', 'project_asks', 'project_needs', 'project_tags', 'feedback',
                 'feedback_points', 'feedback_ratings', 'feedback_replies', 'project_versions', 'suggestions',
                 'discussion_threads', 'discussion_posts', 'expert_profiles', 'bounties', 'bounty_awards']) {
  console.log(`  ${t.padEnd(18)} ${String(count(t)).padStart(7)}`)
}
console.log('  ------------------------------')

// What the text actually costs in repetition, printed so a regression here is
// visible rather than something you notice in a screenshot three days later.
const spread = (label, table, column) => {
  const r = db.prepare(`SELECT COUNT(DISTINCT ${column}) AS d, COUNT(*) AS t FROM ${table}`).get()
  const worst = db.prepare(
    `SELECT COUNT(*) AS n FROM ${table} GROUP BY ${column} ORDER BY n DESC LIMIT 1`,
  ).get().n
  console.log(`  ${label.padEnd(22)} ${String(r.d).padStart(7)} distinct of ${String(r.t).padStart(7)}, worst repeats ${worst}`)
}
spread('ask prompts', 'project_asks', 'prompt')
spread('note headlines', 'feedback', 'headline')
spread('note summaries', 'feedback', 'summary_md')
spread('point bodies', 'feedback_points', 'body_md')
spread('thread titles', 'discussion_threads', 'title')
spread('discussion posts', 'discussion_posts', 'body_md')
spread('expert headlines', 'expert_profiles', 'headline')
spread('bounty titles', 'bounties', 'title')
console.log(`  point agreements       ${db.prepare('SELECT COUNT(*) AS n FROM feedback_point_votes').get().n}`)
// How often the writer ran out of fresh ways to say something and kept a
// repeat. A number that grows here means a word stock has grown thin.
for (const b of writer.ledger.report()) {
  if (b.forced > 0) console.log(`  ${b.name.padEnd(22)} ${String(b.forced).padStart(7)} of ${b.written} written after the redraws ran out`)
  for (const [why, n] of b.blockers) console.log(`      ${String(n).padStart(6)}  ${why.slice(0, 110)}`)
}
if (writer.forcedTitles > 0) console.log(`  ${writer.forcedTitles} project titles needed a number to stay unique`)

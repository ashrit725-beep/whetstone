/**
 * Whetstone database seed.
 *
 *   npm run db:seed                          reseed as of the current minute
 *   npm run db:seed -- --now 2026-09-18T09:00Z reseed as of a fixed instant
 *   npm run db:seed -- --db ./data/scratch.db
 *
 * Wipes the database file, re-applies schema.sql, and inserts the content in
 * src/server/db/seed-data.ts. Every id is derived from a name and every
 * timestamp from one base instant, which is the present unless `--now` says
 * otherwise: a community whose latest activity is days old reads as abandoned,
 * so the default is a database that is current the moment it is built. Pass
 * the instant a build printed as `--now` and you get that build again, row for
 * row. The instant is recorded in schema_meta as `seeded_at`, which is where
 * the population step reads it from.
 *
 * Content is data. Everything derived from it (counters, reputation, votes,
 * notifications, badges, ranking) is computed here from the rows that actually
 * exist, so no number in the product is invented.
 */

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { registerHooks } from 'node:module'
import * as SEED from '../src/server/db/seed-data.ts'

/* -------------------------------------------------------------------------- */
/* Module resolution                                                          */
/* -------------------------------------------------------------------------- */

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'src')

/**
 * The app is compiled by Next, which understands the `@/*` path alias and the
 * `next/headers` server module. A bare `node` run understands neither, so map
 * the alias onto the real files and stub the one Next module that `@/lib/auth`
 * imports but never calls outside a request.
 *
 * The stub carries every name `next/headers` publishes, not only the ones
 * `@/lib/auth` happens to reach for today. An ES module import is checked name
 * by name at link time, so a missing name is not a dormant risk: it is an
 * immediate `SyntaxError` before a single row is written, and the seed dies on
 * a request helper it was never going to call. Each one throws if it is ever
 * called, which is the part that has to stay honest.
 */
const NEXT_HEADERS_STUB =
  'data:text/javascript,' +
  encodeURIComponent(
    ['cookies', 'headers', 'draftMode']
      .map(
        (name) =>
          `export function ${name}(){throw new Error("next/headers ${name}() is not available in the seed script")}`,
      )
      .join('\n'),
  )

/** `./thing` and `@/lib/thing` both mean `thing.ts` in a Next codebase. */
function withExtension(file: string): string {
  if (path.extname(file) !== '') return file
  for (const candidate of [`${file}.ts`, `${file}.tsx`, path.join(file, 'index.ts')]) {
    if (fs.existsSync(candidate)) return candidate
  }
  return file
}

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'next/headers') return { url: NEXT_HEADERS_STUB, shortCircuit: true }
    if (specifier.startsWith('@/')) {
      return next(pathToFileURL(withExtension(path.join(SRC, specifier.slice(2)))).href, context)
    }
    // Application modules import each other without a file extension, which
    // Node's ESM resolver will not do on its own.
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
      const parent = path.dirname(fileURLToPath(context.parentURL))
      const resolved = withExtension(path.resolve(parent, specifier))
      if (resolved !== path.resolve(parent, specifier)) {
        return next(pathToFileURL(resolved).href, context)
      }
    }
    return next(specifier, context)
  },
})

/* -------------------------------------------------------------------------- */
/* Arguments                                                                  */
/* -------------------------------------------------------------------------- */

type Args = { now: number; dbPath: string | undefined; quiet: boolean }

/** The current minute. Whole minutes keep two builds a few seconds apart identical. */
function currentMinute(): number {
  return Math.floor(Date.now() / 60_000) * 60_000
}

function parseArgs(argv: readonly string[]): Args {
  let now = currentMinute()
  let dbPath: string | undefined
  let quiet = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--now') {
      const raw = argv[++i]
      if (!raw) throw new Error('--now needs a value: an ISO date or a millisecond epoch')
      if (/^\d+$/.test(raw)) now = Number(raw)
      else {
        const parsed = Date.parse(raw)
        if (Number.isNaN(parsed)) throw new Error(`--now could not read the date ${raw}`)
        now = parsed
      }
    } else if (arg === '--db') {
      const raw = argv[++i]
      if (!raw) throw new Error('--db needs a path')
      dbPath = raw
    } else if (arg === '--quiet') {
      quiet = true
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(
        'Usage: node --experimental-strip-types scripts/seed.ts [--now <iso|epoch>] [--db <path>] [--quiet]\n',
      )
      process.exit(0)
    } else {
      throw new Error(`Unknown argument ${arg}. Try --help.`)
    }
  }
  return { now, dbPath, quiet }
}

/* -------------------------------------------------------------------------- */
/* Determinism helpers                                                        */
/* -------------------------------------------------------------------------- */

const NAMESPACE = 'whetstone.seed.v1'
const DAY = 86_400_000

/** Stable UUID (version 5 shape) from a name, so ids survive a reseed. */
function id(name: string): string {
  const h = createHash('sha1').update(`${NAMESPACE}:${name}`).digest()
  const b = Buffer.from(h.subarray(0, 16))
  b[6] = ((b[6] as number) & 0x0f) | 0x50
  b[8] = ((b[8] as number) & 0x3f) | 0x80
  const x = b.toString('hex')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`
}

/** Deterministic 32-bit hash, used for jitter and for picking voters. */
function hash32(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** A seeded generator, so the same run always picks the same voters. */
function rng(seed: string): () => number {
  let a = hash32(seed) || 1
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(items: readonly T[], count: number, seed: string): T[] {
  const pool = [...items]
  const next = rng(seed)
  const out: T[] = []
  const n = Math.min(count, pool.length)
  for (let i = 0; i < n; i++) {
    const j = Math.floor(next() * pool.length)
    const [taken] = pool.splice(j, 1)
    if (taken !== undefined) out.push(taken)
  }
  return out
}

function clampInt(n: number): number {
  return Math.round(n)
}

/* -------------------------------------------------------------------------- */
/* Content checks, run before anything is written                             */
/* -------------------------------------------------------------------------- */

/**
 * The content file is hand written, so the things a type cannot catch are
 * checked here: dangling references, a review filed against a build that did
 * not exist yet, a terminal suggestion state with no explanation. A failure
 * here stops the run before the database is touched.
 */
function validate(tax: Taxonomy): string[] {
  const problems: string[] = []
  const handles = new Set(SEED.USERS.map((u) => u.handle))
  const projects = new Map(SEED.PROJECTS.map((p) => [p.slug, p]))
  const themes = new Map(SEED.THEMES.map((t) => [t.key, t]))
  const needKeys = new Set<string>(tax.NEED_KINDS.map((n) => n.key))
  const areaSlugs = new Set<string>(tax.EXPERTISE_AREAS.map((a) => a.slug))
  const stageKeys = new Set<string>(tax.GRIT_STAGE_KEYS)
  const suggestionKeys = new Set(SEED.SUGGESTIONS.map((s) => s.key))
  const feedbackKeys = new Set(SEED.FEEDBACK.map((f) => f.key))
  const usedThemes = new Set<string>()

  if (new Set(SEED.USERS.map((u) => u.email)).size !== SEED.USERS.length) problems.push('duplicate email addresses')
  if (new Set(feedbackKeys).size !== SEED.FEEDBACK.length) problems.push('duplicate feedback keys')

  for (const user of SEED.USERS) {
    for (const area of user.expert?.expertise ?? []) {
      if (!areaSlugs.has(area.area)) problems.push(`${user.handle}: unknown expertise area ${area.area}`)
    }
    if (user.expert && !areaSlugs.has(user.expert.credential.area)) {
      problems.push(`${user.handle}: unknown credential area ${user.expert.credential.area}`)
    }
  }

  for (const project of SEED.PROJECTS) {
    if (!tax.isProjectTypeSlug(project.type)) problems.push(`${project.slug}: unknown project type ${project.type}`)
    if (!stageKeys.has(project.stage)) problems.push(`${project.slug}: unknown grit stage ${project.stage}`)
    for (const need of project.needs) if (!needKeys.has(need)) problems.push(`${project.slug}: unknown need ${need}`)
    if (!handles.has(project.ownerHandle)) problems.push(`${project.slug}: unknown owner ${project.ownerHandle}`)
    if (project.versions.filter((v) => v.current).length !== 1) problems.push(`${project.slug}: needs exactly one current version`)
    if (project.publishedDaysAgo > project.createdDaysAgo) problems.push(`${project.slug}: published before it was created`)
  }

  for (const fb of SEED.FEEDBACK) {
    const project = projects.get(fb.project)
    if (!project) {
      problems.push(`${fb.key}: unknown project ${fb.project}`)
      continue
    }
    if (!handles.has(fb.reviewer)) problems.push(`${fb.key}: unknown reviewer ${fb.reviewer}`)
    if (fb.reviewer === project.ownerHandle) problems.push(`${fb.key}: the owner cannot review their own project`)
    if (fb.daysAgo > project.publishedDaysAgo) problems.push(`${fb.key}: submitted before the project was published`)

    const version = fb.versionLabel ? project.versions.find((v) => v.label === fb.versionLabel) : undefined
    if (fb.versionLabel && !version) problems.push(`${fb.key}: unknown build ${fb.versionLabel}`)
    if (version && fb.daysAgo > version.daysAgo) problems.push(`${fb.key}: filed against ${version.label}, which had not shipped yet`)
    // What the reviewer says they ran, and what they write about, cannot be a
    // build that shipped after the review. The creator's replies are exempt:
    // "the fix goes out in v0.7.2" is a promise, not a report.
    if (fb.environment?.build !== undefined && fb.environment.build !== fb.versionLabel) {
      problems.push(`${fb.key}: ran ${fb.environment.build} but is filed against ${fb.versionLabel ?? 'no build'}`)
    }
    const written = [fb.headline, fb.summary ?? '', ...fb.points.map((p) => p.body), ...Object.values(fb.environment ?? {})]
    for (const later of project.versions.filter((v) => v.daysAgo < fb.daysAgo)) {
      const named = new RegExp(`(^|[^\\w.])${later.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w.]*\\d)`)
      if (written.some((text) => named.test(text))) problems.push(`${fb.key}: mentions ${later.label}, which shipped after it`)
    }

    const typeAxes = tax.axesFor(project.type)
    const axes = new Set(typeAxes.map((a) => a.key))
    for (const key of Object.keys(fb.ratings)) if (!axes.has(key)) problems.push(`${fb.key}: ${key} is not an axis on a ${project.type}`)
    if (Object.keys(fb.ratings).length !== typeAxes.length) problems.push(`${fb.key}: expected ${typeAxes.length} axis ratings`)

    const categories = new Set(tax.categoriesFor(project.type).map((c) => c.key))
    fb.points.forEach((point, i) => {
      if (!categories.has(point.category)) problems.push(`${fb.key}[${i}]: ${point.category} is not a category on a ${project.type}`)
      if (point.actionability === 'repro' && !point.repro) problems.push(`${fb.key}[${i}]: filed as a reproduction with no steps`)
      if (point.anchorKind && !point.anchorValue) problems.push(`${fb.key}[${i}]: an anchor with no value`)
      if (point.askIndex !== undefined && !project.asks[point.askIndex]) problems.push(`${fb.key}[${i}]: answers an ask that does not exist`)
      if (point.theme) {
        const theme = themes.get(point.theme)
        if (!theme) problems.push(`${fb.key}[${i}]: unknown theme ${point.theme}`)
        else if (theme.project !== fb.project) problems.push(`${fb.key}[${i}]: theme belongs to another project`)
        else usedThemes.add(point.theme)
      }
    })

    ;(fb.replies ?? []).forEach((reply, i) => {
      if (!handles.has(reply.author)) problems.push(`${fb.key} reply ${i}: unknown author`)
      if (reply.pointIndex !== undefined && !fb.points[reply.pointIndex]) problems.push(`${fb.key} reply ${i}: replies to a point that does not exist`)
      if (reply.parent !== undefined && reply.parent >= i) problems.push(`${fb.key} reply ${i}: replies to a later reply`)
    })
  }

  for (const theme of SEED.THEMES) {
    if (!projects.has(theme.project)) problems.push(`theme ${theme.key}: unknown project`)
    if (!usedThemes.has(theme.key)) problems.push(`theme ${theme.key}: no feedback point belongs to it`)
  }

  for (const suggestion of SEED.SUGGESTIONS) {
    const project = projects.get(suggestion.project)
    if (!project) {
      problems.push(`suggestion ${suggestion.key}: unknown project`)
      continue
    }
    if (suggestion.status === 'shipped' && !suggestion.shippedVersionLabel) problems.push(`suggestion ${suggestion.key}: shipped with no build`)
    if (suggestion.shippedVersionLabel && !project.versions.some((v) => v.label === suggestion.shippedVersionLabel)) {
      problems.push(`suggestion ${suggestion.key}: unknown build ${suggestion.shippedVersionLabel}`)
    }
    if ((suggestion.status === 'declined' || suggestion.status === 'wont_fix') && !suggestion.statusNote) {
      problems.push(`suggestion ${suggestion.key}: a terminal state owes a reason`)
    }
    if (suggestion.status === 'duplicate' && !(suggestion.duplicateOf && suggestionKeys.has(suggestion.duplicateOf))) {
      problems.push(`suggestion ${suggestion.key}: marked duplicate with no original`)
    }
    if (suggestion.events[0]?.to !== 'open') problems.push(`suggestion ${suggestion.key}: history does not start at open`)
    if (suggestion.events[suggestion.events.length - 1]?.to !== suggestion.status) {
      problems.push(`suggestion ${suggestion.key}: history does not end at its current status`)
    }
  }

  for (const bounty of SEED.BOUNTIES) {
    if (!projects.has(bounty.project)) problems.push(`bounty ${bounty.key}: unknown project`)
    if (!areaSlugs.has(bounty.expertise)) problems.push(`bounty ${bounty.key}: unknown expertise area ${bounty.expertise}`)
    if ((bounty.status === 'open' || bounty.status === 'in_progress') && !['authorized', 'held'].includes(bounty.escrowState)) {
      problems.push(`bounty ${bounty.key}: advertised without money held`)
    }
    if (bounty.award?.feedbackKey && !feedbackKeys.has(bounty.award.feedbackKey)) {
      problems.push(`bounty ${bounty.key}: delivered feedback does not exist`)
    }
    // An invite-only bounty names the one reviewer who may take it, and a
    // public one names nobody.
    if (bounty.visibility === 'invite_only' && !(bounty.invitee && handles.has(bounty.invitee))) {
      problems.push(`bounty ${bounty.key}: invite-only with no known invitee`)
    }
    if (bounty.visibility === 'public' && bounty.invitee) problems.push(`bounty ${bounty.key}: public, yet names an invitee`)
    // Posting authorises and holds the money in one action, so a bounty that is
    // advertised has both rows, the way a bounty posted today does.
    if ((bounty.status === 'open' || bounty.status === 'in_progress') && !bounty.escrow.some((e) => e.kind === 'hold')) {
      problems.push(`bounty ${bounty.key}: advertised with the money authorised but never held`)
    }
  }

  for (const thread of SEED.THREADS) {
    const depths: number[] = []
    thread.posts.forEach((post, i) => {
      const depth = post.parent === undefined ? 0 : (depths[post.parent] ?? 0) + 1
      depths.push(depth)
      if (depth > 2) problems.push(`thread ${thread.key} post ${i}: nested deeper than three levels`)
      if (post.parent !== undefined && post.parent >= i) problems.push(`thread ${thread.key} post ${i}: replies to a later post`)
    })
    if (thread.status === 'answered' && thread.posts.filter((p) => p.accepted).length !== 1) {
      problems.push(`thread ${thread.key}: answered with no accepted answer`)
    }
  }

  return problems
}

/* -------------------------------------------------------------------------- */
/* Seeding                                                                    */
/* -------------------------------------------------------------------------- */

type Runner = (sql: string, params?: readonly unknown[]) => void
type Counter = (table: string, rows: number) => void
type Counts = Map<string, number>
type Taxonomy = typeof import('../src/lib/taxonomy.ts')
type FeedbackRepo = typeof import('../src/server/repos/feedback.ts')
type ReputationRepo = typeof import('../src/server/repos/reputation.ts')
type MarketFormat = typeof import('../src/components/marketplace/format.ts')

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const now = args.now

  if (args.dbPath) process.env.DATABASE_PATH = args.dbPath

  // Wipe before the client opens the file, so schema.sql runs against an empty
  // database and the seed is a true reset rather than a merge.
  const envMod = (await import('@/lib/env')) as typeof import('../src/lib/env.ts')
  const file = path.resolve(ROOT, envMod.env.databasePath)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(`${file}${suffix}`, { force: true })
  }

  const db = (await import('@/server/db/client')) as typeof import('../src/server/db/client.ts')
  const auth = (await import('@/lib/auth')) as typeof import('../src/lib/auth.ts')
  const tax = (await import('@/lib/taxonomy')) as Taxonomy
  // The specificity score is the app's own, imported rather than reimplemented,
  // so a seeded review is worth exactly what the composer would have given it.
  const feedbackRepo = (await import('@/server/repos/feedback')) as FeedbackRepo
  const reputationRepo = (await import('@/server/repos/reputation')) as ReputationRepo
  // The ledger notes are worded by the same formatter the bounty actions use.
  const format = (await import('@/components/marketplace/format')) as MarketFormat

  const problems = validate(tax)
  if (problems.length > 0) {
    throw new Error(`The seed content is inconsistent. Fix these first:\n  - ${problems.join('\n  - ')}`)
  }

  const password = SEED.seedPassword()
  const passwordHash = password ? await auth.hashPassword(password) : null

  const counts: Counts = new Map()
  const countRow: Counter = (table, rows) => counts.set(table, (counts.get(table) ?? 0) + rows)
  const run: Runner = (sql, params = []) => {
    db.run(sql, params as unknown[])
    const table = /INSERT\s+INTO\s+([a-z_]+)/i.exec(sql)?.[1]
    if (table) counts.set(table, (counts.get(table) ?? 0) + 1)
  }

  db.tx(() => {
    seedEverything(run, now, passwordHash, tax, feedbackRepo, reputationRepo, format, countRow)
    assertNothingAhead(db, now)
  })

  db.run('PRAGMA optimize')

  if (!args.quiet) report(counts, now)
}

/** One transaction. If any statement throws, nothing lands. */
function seedEverything(
  run: Runner,
  now: number,
  passwordHash: string | null,
  tax: Taxonomy,
  feedbackRepo: FeedbackRepo,
  reputationRepo: ReputationRepo,
  format: MarketFormat,
  countRow: Counter,
): void {
  /* ---------------------------------------------------------------------- */
  /* Time                                                                   */
  /* ---------------------------------------------------------------------- */

  /** A timestamp `days` before the base instant, nudged into the working day. */
  const at = (days: number, key: string): number =>
    clampInt(now - days * DAY + (hash32(key) % (6 * 3600_000)))

  const after = (base: number, ms: number): number => clampInt(base + ms)

  /**
   * A moment that has already happened. The content is written as offsets
   * from the base instant, and a few of them, nudged forward by `at()` or
   * placed some days after something recent, land after it: a vote three
   * days after yesterday's review, a user last seen "today" plus the nudge.
   * Such a moment is redrawn inside the time there actually was, between
   * `floor` and the present, from a hash of its key, rather than pinned to
   * the present where every late row would meet.
   */
  const past = (want: number, floor: number, key: string): number => {
    if (want <= now) return want
    const room = now - 60_000 - floor
    return room <= 0 ? now - 60_000 : clampInt(floor + (hash32(`past:${key}`) % room))
  }

  /* ---------------------------------------------------------------------- */
  /* 1. Taxonomy                                                            */
  /* ---------------------------------------------------------------------- */

  // Ids follow the convention src/lib/taxonomy.ts documents and every
  // repository relies on: a project type is its own slug, an axis and a
  // category are `<typeSlug>:<key>`.
  const typeId = (slug: string) => slug
  const stageId = (slug: string, key: string) => `${slug}:${key}`
  const catId = (slug: string, key: string) => tax.categoryId(slug as SEED.TypeSlug, key)
  const axisIdFor = (slug: string, key: string) => tax.axisId(slug as SEED.TypeSlug, key)
  const tagId = (slug: string) => `tag_${slug}`
  const areaId = (slug: string) => `exp_${slug}`
  const badgeId = (slug: string) => `badge_${slug}`
  const channelId = (slug: string) => `chan_${slug}`

  const taxonomyAt = at(400, 'taxonomy')

  for (const type of tax.allProjectTypes()) {
    run(
      `INSERT INTO project_types (id, slug, label, description, icon, embed_kind, sort_order, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        typeId(type.slug),
        type.slug,
        type.label,
        type.description,
        type.icon,
        type.embedKind,
        type.sortOrder,
        taxonomyAt,
      ],
    )

    tax.GRIT_STAGES.forEach((stage, i) => {
      run(
        `INSERT INTO project_stages (id, project_type_id, stage_key, label, description, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          stageId(type.slug, stage.key),
          typeId(type.slug),
          stage.key,
          type.stageLabels[stage.key],
          stage.definition,
          (i + 1) * 10,
        ],
      )
    })

    // `categoriesFor` merges the type's own vocabulary with the universal one
    // and removes the overlap, so a type that names its own performance
    // category does not get a second copy of it.
    tax.categoriesFor(type.slug).forEach((category, i) => {
      run(
        `INSERT INTO feedback_categories
           (id, project_type_id, category_key, label, description, prompt, icon, sort_order, is_required, is_active)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, 0, 1)`,
        [catId(type.slug, category.key), typeId(type.slug), category.key, category.label, category.description, i * 10],
      )
    })

    tax.axesFor(type.slug).forEach((axis, i) => {
      run(
        `INSERT INTO rating_axes
           (id, project_type_id, axis_key, label, description, low_label, high_label, scale_max, weight, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1.0, ?, 1)`,
        [
          axisIdFor(type.slug, axis.key),
          typeId(type.slug),
          axis.key,
          axis.label,
          axis.definition,
          axis.lowLabel,
          axis.highLabel,
          tax.RATING_SCALE_MAX,
          i * 10,
        ],
      )
    })
  }

  tax.NEED_KINDS.forEach((need) => {
    run(
      `INSERT INTO need_kinds (need_key, label, description, icon, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [need.key, need.label, need.description, need.icon, need.sortOrder],
    )
  })

  tax.EXPERTISE_AREAS.forEach((area) => {
    run(
      `INSERT INTO expertise_areas (id, slug, label, description, parent_id, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [areaId(area.slug), area.slug, area.label, area.description, area.parent ? areaId(area.parent) : null],
    )
  })

  SEED.BADGES.forEach((badge) => {
    run(
      `INSERT INTO badges (id, slug, label, description, icon, tier, facet, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [badgeId(badge.slug), badge.slug, badge.label, badge.description, badge.icon, badge.tier, badge.facet, taxonomyAt],
    )
  })

  SEED.TAGS.forEach((tag) => {
    run(
      `INSERT INTO tags (id, slug, label, kind, usage_count, is_blocked, created_at) VALUES (?, ?, ?, ?, 0, 0, ?)`,
      [tagId(tag.slug), tag.slug, tag.label, tag.kind, taxonomyAt],
    )
  })

  SEED.DISCUSSION_CHANNELS.forEach((channel, i) => {
    run(
      `INSERT INTO discussion_channels (id, slug, label, description, icon, is_private, is_archived, sort_order, thread_count, created_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?, 0, ?)`,
      [channelId(channel.slug), channel.slug, channel.label, channel.description, channel.icon, i, taxonomyAt],
    )
  })

  /* ---------------------------------------------------------------------- */
  /* 2. People                                                              */
  /* ---------------------------------------------------------------------- */

  const userId = (handle: string) => id(`user:${handle}`)
  const usersByHandle = new Map(SEED.USERS.map((u) => [u.handle, u]))
  const isExpert = (handle: string) => Boolean(usersByHandle.get(handle)?.expert)

  for (const user of SEED.USERS) {
    const uid = userId(user.handle)
    const joined = at(user.joinedDaysAgo, `joined:${user.handle}`)
    const seen = past(at(user.lastSeenDaysAgo, `seen:${user.handle}`), Math.max(joined, now - DAY / 4), `seen:${user.handle}`)

    run(
      `INSERT INTO users
         (id, email, email_normalized, email_verified_at, password_hash, handle, handle_normalized,
          role, status, is_expert, last_seen_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
      [
        uid,
        user.email,
        user.email.toLowerCase(),
        after(joined, 3600_000),
        user.handle === SEED.SIGN_IN_HANDLE ? passwordHash : null,
        user.handle,
        user.handle.toLowerCase(),
        user.role ?? 'member',
        user.expert ? 1 : 0,
        seen,
        joined,
        seen,
      ],
    )

    run(
      `INSERT INTO profiles
         (user_id, display_name, avatar_url, banner_url, bio, location, pronouns, timezone,
          primary_role, availability, is_searchable, created_at, updated_at)
       VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        uid,
        user.name,
        user.bio,
        user.location,
        user.pronouns ?? null,
        user.timezone,
        user.primaryRole,
        user.availability,
        joined,
        seen,
      ],
    )

    run(
      `INSERT INTO user_settings (user_id, theme, locale, reduced_motion, email_digest, show_nsfw, dm_policy, updated_at)
       VALUES (?, ?, 'en', 0, ?, 0, ?, ?)`,
      [uid, user.theme, user.expert ? 'daily' : 'weekly', user.expert ? 'everyone' : 'followers', seen],
    )

    user.links.forEach((link, i) => {
      run(
        `INSERT INTO profile_links (id, user_id, label, url, platform, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id(`link:${user.handle}:${i}`), uid, link.label, link.url, link.platform, i, joined],
      )
    })

    if (user.expert) {
      const expert = user.expert
      const verified = at(expert.verifiedDaysAgo, `verified:${user.handle}`)

      run(
        `INSERT INTO expert_profiles
           (user_id, headline, pitch_md, hourly_rate_cents, min_bounty_cents, currency, turnaround_hours,
            capacity_per_week, years_experience, is_listed, is_verified, completed_count, avg_rating, on_time_rate,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, 1, 0, 0.0, 0.0, ?, ?)`,
        [
          uid,
          expert.headline,
          expert.pitch,
          expert.hourlyRateCents,
          expert.minBountyCents,
          expert.turnaroundHours,
          expert.capacityPerWeek,
          expert.yearsExperience,
          expert.listed ? 1 : 0,
          verified,
          verified,
        ],
      )

      for (const area of expert.expertise) {
        run(
          `INSERT INTO expert_expertise (user_id, expertise_id, level, is_verified) VALUES (?, ?, ?, ?)`,
          // Verified means there is a credential for it, so only the area the
          // credential names is verified. The list badge and the profile's
          // evidence both read these rows and have to agree.
          [uid, areaId(area.area), area.level, area.area === expert.credential.area ? 1 : 0],
        )
      }

      const requestId = id(`verify:${user.handle}`)
      run(
        `INSERT INTO verification_requests
           (id, user_id, expertise_id, claim_md, evidence, status, reviewer_id, decision_note, decided_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'approved', NULL, ?, ?, ?, ?)`,
        [
          requestId,
          uid,
          areaId(expert.credential.area),
          expert.credential.claim,
          JSON.stringify([{ kind: 'portfolio', url: user.links[0]?.url ?? null, note: 'Submitted with the application.' }]),
          'Two existing experts read five of their reviews, chosen at random, and confirmed the claim in writing.',
          verified,
          at(expert.verifiedDaysAgo + 9, `verify-open:${user.handle}`),
          verified,
        ],
      )

      run(
        `INSERT INTO verification_credentials
           (id, user_id, request_id, expertise_id, credential, issued_by, issued_at, expires_at, revoked_at, revoke_reason)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL)`,
        [
          id(`credential:${user.handle}`),
          uid,
          requestId,
          areaId(expert.credential.area),
          expert.credential.kind,
          verified,
          clampInt(verified + 365 * DAY),
        ],
      )

      if (expert.payout) {
        run(
          `INSERT INTO payout_methods (id, user_id, provider, external_ref, display_name, currency, is_default, verified_at, created_at)
           VALUES (?, ?, ?, ?, ?, 'USD', 1, ?, ?)`,
          [
            id(`payout:${user.handle}`),
            uid,
            expert.payout.provider,
            `acct_${hash32(`payout:${user.handle}`).toString(36)}`,
            expert.payout.display,
            verified,
            verified,
          ],
        )
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 3. Projects                                                            */
  /* ---------------------------------------------------------------------- */

  const projectId = (slug: string) => id(`project:${slug}`)
  const versionId = (slug: string, label: string) => id(`version:${slug}:${label}`)
  /**
   * When each build went out, so a review filed against one cannot predate it.
   * `at()` nudges every timestamp forward by up to six hours from a hash of its
   * key, which is what keeps two events on the same day from sharing a
   * millisecond. It also means two same-day events land in hash order rather
   * than in the order they happened, and a review filed the same day as the
   * build it names could come out five hours before it.
   */
  const releasedAt = new Map<string, number>()
  const askId = (slug: string, i: number) => id(`ask:${slug}:${i}`)
  const projectBySlug = new Map(SEED.PROJECTS.map((p) => [p.slug, p]))
  const publishedAt = new Map<string, number>()
  const tagUsage = new Map<string, number>()

  for (const project of SEED.PROJECTS) {
    const pid = projectId(project.slug)
    const created = at(project.createdDaysAgo, `project:${project.slug}`)
    const published = after(created, 3 * 3600_000)
    publishedAt.set(project.slug, published)

    const coverId = id(`media:${project.slug}:cover`)

    run(
      `INSERT INTO projects
         (id, owner_id, project_type_id, slug, title, tagline, summary_md, stage_key, visibility, status,
          feedback_state, feedback_closes_at, is_nsfw, content_warnings, primary_media_id, hot_score,
          published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'public', 'published', ?, NULL, 0, NULL, ?, 0.0, ?, ?, ?)`,
      [
        pid,
        userId(project.ownerHandle),
        typeId(project.type),
        project.slug,
        project.title,
        project.tagline,
        project.summary,
        project.stage,
        project.feedbackState,
        coverId,
        published,
        created,
        published,
      ],
    )

    // Cover art is generated from a seed string. The `cover:` scheme tells the
    // renderer to draw a grit hatch composition rather than fetch anything.
    run(
      `INSERT INTO project_media
         (id, project_id, version_id, media_kind, url, thumb_url, alt_text, caption, width, height,
          duration_ms, byte_size, mime_type, sort_order, created_at)
       VALUES (?, ?, NULL, 'image', ?, ?, ?, NULL, 1200, 630, NULL, NULL, 'image/svg+xml', 0, ?)`,
      [coverId, pid, `cover:${project.coverSeed}`, `cover:${project.coverSeed}`, project.coverAlt, created],
    )

    project.versions.forEach((version, i) => {
      run(
        `INSERT INTO project_versions
           (id, project_id, version_label, changelog_md, build_url, embed_url, platforms, is_current, released_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          versionId(project.slug, version.label),
          pid,
          version.label,
          version.changelog,
          version.buildUrl ?? null,
          version.embedUrl ?? null,
          JSON.stringify(version.platforms),
          version.current ? 1 : 0,
          at(version.daysAgo, `version:${project.slug}:${i}`),
          at(version.daysAgo, `version:${project.slug}:${i}`),
        ],
      )
      releasedAt.set(`${project.slug}:${version.label}`, at(version.daysAgo, `version:${project.slug}:${i}`))
    })

    project.links.forEach((link, i) => {
      run(
        `INSERT INTO project_links (id, project_id, link_kind, label, url, sort_order, click_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id(`plink:${project.slug}:${i}`),
          pid,
          link.kind,
          link.label,
          link.url,
          i,
          hash32(`clicks:${project.slug}:${i}`) % 240,
        ],
      )
    })

    project.asks.forEach((ask, i) => {
      run(
        `INSERT INTO project_asks (id, project_id, category_id, prompt, detail_md, is_required, sort_order, answer_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          askId(project.slug, i),
          pid,
          ask.category ? catId(project.type, ask.category) : null,
          ask.prompt,
          ask.detail ?? null,
          ask.required ? 1 : 0,
          i,
          created,
        ],
      )
    })

    for (const need of project.needs) {
      run(`INSERT INTO project_needs (project_id, need_key, detail, created_at) VALUES (?, ?, NULL, ?)`, [
        pid,
        need,
        created,
      ])
    }

    for (const tag of project.tags) {
      run(`INSERT INTO project_tags (project_id, tag_id, created_at) VALUES (?, ?, ?)`, [pid, tagId(tag), created])
      tagUsage.set(tag, (tagUsage.get(tag) ?? 0) + 1)
    }

    run(
      `INSERT INTO project_collaborators (project_id, user_id, member_role, invited_by, accepted_at, created_at)
       VALUES (?, ?, 'owner', NULL, ?, ?)`,
      [pid, userId(project.ownerHandle), created, created],
    )

    ;(project.updates ?? []).forEach((update, i) => {
      const ts = at(update.daysAgo, `update:${project.slug}:${i}`)
      run(
        `INSERT INTO project_updates
           (id, project_id, version_id, author_id, title, body_md, published_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id(`update:${project.slug}:${i}`),
          pid,
          update.versionLabel ? versionId(project.slug, update.versionLabel) : null,
          userId(project.ownerHandle),
          update.title,
          update.body,
          ts,
          ts,
          ts,
        ],
      )
    })
  }

  for (const [slug, count] of tagUsage) {
    run(`UPDATE tags SET usage_count = ? WHERE id = ?`, [count, tagId(slug)])
  }

  /* ---------------------------------------------------------------------- */
  /* 4. Test rounds                                                         */
  /* ---------------------------------------------------------------------- */

  for (const round of SEED.ROUNDS) {
    const project = projectBySlug.get(round.project)
    if (!project) continue
    const rid = id(`round:${round.key}`)
    const starts = at(round.startsDaysAgo, `round:${round.key}`)
    const ends = clampInt(starts + (round.startsDaysAgo + round.endsInDays) * DAY)
    const taken = round.invitations.filter((i) => ['accepted', 'started', 'completed'].includes(i.status)).length

    run(
      `INSERT INTO test_rounds
         (id, project_id, version_id, created_by, title, brief_md, status, seats, seats_taken, is_nda,
          reward_kind, starts_at, ends_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rid,
        projectId(round.project),
        versionId(round.project, round.versionLabel),
        userId(project.ownerHandle),
        round.title,
        round.brief,
        round.status,
        round.seats,
        taken,
        round.isNda ? 1 : 0,
        round.reward,
        starts,
        ends,
        starts,
        starts,
      ],
    )

    round.tasks.forEach((task, i) => {
      run(
        `INSERT INTO test_round_tasks (id, round_id, category_id, title, instructions, success_hint, is_required, sort_order)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
        [id(`task:${round.key}:${i}`), rid, task.title, task.instructions, task.successHint, task.required ? 1 : 0, i],
      )
    })

    for (const invite of round.invitations) {
      const invitationId = id(`invite:${round.key}:${invite.user}`)
      const invited = at(invite.daysAgo, `invite:${round.key}:${invite.user}`)
      const startedAt =
        invite.startedDaysAgo === undefined
          ? null
          : Math.max(at(invite.startedDaysAgo, `start:${round.key}:${invite.user}`), after(invited, 3600_000))
      const completedAt =
        invite.completedDaysAgo === undefined
          ? null
          : Math.max(
              at(invite.completedDaysAgo, `done:${round.key}:${invite.user}`),
              after(startedAt ?? invited, 3600_000),
            )
      run(
        `INSERT INTO test_invitations
           (id, round_id, user_id, email, invited_by, source, status, nda_signed_at, invite_token,
            responded_at, started_at, completed_at, expires_at, created_at)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
        [
          invitationId,
          rid,
          userId(invite.user),
          userId(project.ownerHandle),
          invite.source,
          invite.status,
          round.isNda && invite.status !== 'pending' ? after(invited, 3600_000) : null,
          invite.status === 'pending' ? null : after(invited, 7200_000),
          startedAt,
          completedAt,
          clampInt(invited + 21 * DAY),
          invited,
        ],
      )

      for (const result of invite.results ?? []) {
        run(
          `INSERT INTO test_task_results
             (id, invitation_id, task_id, point_id, outcome, duration_ms, difficulty, note, created_at)
           VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
          [
            id(`result:${round.key}:${invite.user}:${result.task}`),
            invitationId,
            id(`task:${round.key}:${result.task}`),
            result.outcome,
            result.durationMs ?? null,
            result.difficulty ?? null,
            result.note ?? null,
            completedAt ?? startedAt ?? invited,
          ],
        )
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 5. Bounties                                                            */
  /* ---------------------------------------------------------------------- */

  const bountyId = (key: string) => id(`bounty:${key}`)
  const awardIdFor = (key: string) => id(`award:${key}`)
  /**
   * The reference a bounty's escrow is filed under, shaped the way the
   * application opens one (escrowRefFor() in src/server/queries/bounty-ops.ts):
   * 'esc_' and ten hex characters, reused by every row of its ledger.
   */
  const escrowRef = (key: string) =>
    `esc_${createHash('sha1').update(`escrow:${key}`).digest('hex').slice(0, 10)}`
  const bountyByFeedback = new Map<string, string>()
  const applicationIdsByBounty = new Map<string, Map<string, string>>()

  for (const bounty of SEED.BOUNTIES) {
    if (bounty.award?.feedbackKey) bountyByFeedback.set(bounty.award.feedbackKey, bounty.key)
  }

  // Bounties are inserted before feedback, because a bounty-origin review
  // points back at the bounty that paid for it.
  for (const bounty of SEED.BOUNTIES) {
    const project = projectBySlug.get(bounty.project)
    if (!project) continue
    const bid = bountyId(bounty.key)
    const created = at(bounty.createdDaysAgo, `bounty:${bounty.key}`)

    run(
      `INSERT INTO bounties
         (id, project_id, version_id, created_by, title, brief_md, expertise_id, amount_cents, currency,
          platform_fee_bps, seats, seats_awarded, turnaround_hours, visibility, invited_user_id, status,
          escrow_state, escrow_ref, closes_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USD', 1000, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bid,
        projectId(bounty.project),
        versionId(bounty.project, project.versions.find((v) => v.current)?.label ?? project.versions[0]!.label),
        userId(bounty.createdBy),
        bounty.title,
        bounty.brief,
        areaId(bounty.expertise),
        bounty.amountCents,
        bounty.seats,
        bounty.award ? 1 : 0,
        bounty.turnaroundHours,
        bounty.visibility,
        bounty.invitee ? userId(bounty.invitee) : null,
        bounty.status,
        bounty.escrowState,
        bounty.escrowState === 'unfunded' ? null : escrowRef(bounty.key),
        bounty.closesInDays === undefined ? null : clampInt(now + bounty.closesInDays * DAY),
        created,
        created,
      ],
    )

    const applicationIds = new Map<string, string>()
    for (const application of bounty.applications) {
      const aid = id(`application:${bounty.key}:${application.applicant}`)
      applicationIds.set(application.applicant, aid)
      const ts = at(application.daysAgo, `application:${bounty.key}:${application.applicant}`)
      run(
        `INSERT INTO bounty_applications
           (id, bounty_id, applicant_id, pitch_md, quoted_cents, eta_hours, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          aid,
          bid,
          userId(application.applicant),
          application.pitch,
          application.quotedCents ?? null,
          application.etaHours ?? null,
          application.status,
          ts,
          ts,
        ],
      )
    }
    applicationIdsByBounty.set(bounty.key, applicationIds)
  }

  /* ---------------------------------------------------------------------- */
  /* 6. Feedback                                                            */
  /* ---------------------------------------------------------------------- */

  const feedbackId = (key: string) => id(`feedback:${key}`)
  const pointId = (key: string, i: number) => id(`point:${key}:${i}`)
  const themeId = (key: string) => id(`theme:${key}`)

  const submittedAt = new Map<string, number>()
  const firstCreatorReplyAt = new Map<string, number>()
  const replyTimesByFeedback = new Map<string, readonly number[]>()
  const pointsByTheme = new Map<string, { pointId: string; reviewer: string; sentiment: number; severity: string; ts: number }[]>()
  const upvotesByUser = new Map<string, number>()
  const helpfulByUser = new Map<string, number>()
  const feedbackByUser = new Map<string, number>()
  const reproByUser = new Map<string, number>()
  const actionedBlockersByUser = new Map<string, number>()
  const qualityByFeedback = new Map<string, number>()
  const voteTotals = new Map<string, { up: number; down: number }>()

  const FREQUENCY_LABEL = new Map(tax.REPRO_FREQUENCIES.map((f) => [f.key, f.label]))

  /** The bug triple, written the way a reviewer would type it. */
  const reproText = (repro: SEED.SeedRepro): string =>
    [
      'What I tried',
      repro.steps,
      '',
      'What happened',
      repro.result,
      '',
      'What I expected',
      repro.expected,
      '',
      `How often: ${FREQUENCY_LABEL.get(repro.frequency) ?? repro.frequency}`,
    ].join('\n')

  /**
   * Specificity, scored by the product's own implementation so a seeded review
   * is worth exactly what the composer would have scored it at. The dwell floor
   * applies here too: the reviewer’s own reported minutes are the dwell. The
   * project's own vocabulary goes in as it does in createFeedback(), since it
   * offsets generic wording; the project's asks, tags and builds are all in
   * the database by now.
   */
  const specificity = (fb: SEED.SeedFeedback, projectRowId: string): number =>
    Math.round(
      feedbackRepo.computeSpecificity({
        dwellSeconds: fb.timeSpentMinutes * 60,
        openedArtifact: true,
        points: fb.points.map((point) => ({
          categoryKey: point.category,
          bodyMd: point.body,
          severity: point.severity,
          actionability: point.actionability,
          sentiment: point.sentiment,
          askId: point.askIndex === undefined ? null : 'ask',
          anchorKind: point.anchorKind ?? null,
          anchorValue: point.anchorValue ?? null,
          timecodeMs: point.timecodeMs ?? null,
          reproSteps: point.repro ? reproText(point.repro) : null,
        })),
      }, feedbackRepo.projectVocabulary(projectRowId)).score * 1000,
    ) / 1000

  const otherUsers = (exclude: readonly string[]) =>
    SEED.USERS.map((u) => u.handle).filter((h) => !exclude.includes(h))

  for (const fb of SEED.FEEDBACK) {
    const project = projectBySlug.get(fb.project)
    if (!project) continue

    const fid = feedbackId(fb.key)
    const pid = projectId(fb.project)
    const pubAt = publishedAt.get(fb.project) ?? at(project.publishedDaysAgo, `project:${fb.project}`)
    const builtAt = fb.versionLabel ? releasedAt.get(`${fb.project}:${fb.versionLabel}`) : undefined
    const floor = Math.max(after(pubAt, 3600_000), builtAt === undefined ? 0 : after(builtAt, 3600_000))
    const submitted = past(
      Math.max(
        at(fb.daysAgo, `feedback:${fb.key}`),
        after(pubAt, 3600_000),
        // A review of a build cannot be older than the build.
        builtAt === undefined ? 0 : after(builtAt, 3600_000),
      ),
      floor,
      `feedback:${fb.key}`,
    )
    submittedAt.set(fb.key, submitted)

    const blockerCount = fb.points.filter((p) => p.severity === 'blocker').length
    const sentimentScore =
      Math.round((fb.points.reduce((acc, p) => acc + p.sentiment, 0) / fb.points.length) * 100) / 100
    const sentimentLabel =
      sentimentScore >= 0.34
        ? 'positive'
        : sentimentScore <= -0.34
          ? 'negative'
          : fb.points.some((p) => p.sentiment > 0) && fb.points.some((p) => p.sentiment < 0)
            ? 'mixed'
            : 'neutral'

    const quality = specificity(fb, pid)
    qualityByFeedback.set(fb.key, quality)

    // Community votes, drawn deterministically from everybody who is not the
    // reviewer or the creator. Low-signal reviews also attract a downvote.
    const voters = pick(otherUsers([fb.reviewer, project.ownerHandle]), fb.votes ?? 0, `votes:${fb.key}`)
    const downvoters =
      quality < 0.3 && (fb.votes ?? 0) < 3
        ? pick(otherUsers([fb.reviewer, project.ownerHandle, ...voters]), 2, `down:${fb.key}`)
        : []
    voteTotals.set(fb.key, { up: voters.length, down: downvoters.length })

    // When each reply was written: after the note, after the reply it answers,
    // and before now. The note's first_reply_at is the creator's first answer,
    // which is what the application records when a creator replies.
    const replyTimes: number[] = []
    ;(fb.replies ?? []).forEach((reply, i) => {
      const parentTs = reply.parent === undefined ? submitted : (replyTimes[reply.parent] ?? submitted)
      const want = Math.max(after(submitted, Math.max(reply.daysAfter, 0) * DAY + i * 3600_000), after(parentTs, 3600_000))
      replyTimes[i] = past(want, parentTs, `reply:${fb.key}:${i}`)
    })
    replyTimesByFeedback.set(fb.key, replyTimes)
    const creatorReplyTimes = (fb.replies ?? []).flatMap((reply, i) =>
      reply.author === project.ownerHandle && replyTimes[i] !== undefined ? [replyTimes[i]] : [],
    )
    const firstReply = creatorReplyTimes.length > 0 ? Math.min(...creatorReplyTimes) : null
    if (firstReply !== null) firstCreatorReplyAt.set(fb.key, firstReply)

    const bountyKey = bountyByFeedback.get(fb.key)
    const origin = bountyKey ? 'bounty' : (fb.origin ?? 'organic')

    run(
      `INSERT INTO feedback
         (id, project_id, project_type_id, version_id, reviewer_id, round_id, bounty_id, origin, status, visibility,
          headline, summary_md, time_spent_minutes, environment, point_count, blocker_count, sentiment_score,
          sentiment_label, quality_score, helpful_count, unhelpful_count, reply_count, inbox_state,
          creator_marked_helpful, reviewer_is_expert, first_reply_at, submitted_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 'submitted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fid,
        pid,
        typeId(project.type),
        fb.versionLabel ? versionId(fb.project, fb.versionLabel) : null,
        userId(fb.reviewer),
        bountyKey ? bountyId(bountyKey) : null,
        origin,
        fb.visibility ?? 'public',
        fb.headline,
        fb.summary ?? null,
        fb.timeSpentMinutes,
        fb.environment ? JSON.stringify(fb.environment) : null,
        fb.points.length,
        blockerCount,
        sentimentScore,
        sentimentLabel,
        quality,
        voters.length,
        downvoters.length,
        (fb.replies ?? []).length,
        fb.inboxState,
        fb.creatorMarkedHelpful ? 1 : 0,
        isExpert(fb.reviewer) ? 1 : 0,
        firstReply,
        submitted,
        after(submitted, -1800_000),
        firstReply ?? submitted,
      ],
    )

    feedbackByUser.set(fb.reviewer, (feedbackByUser.get(fb.reviewer) ?? 0) + 1)
    if (fb.creatorMarkedHelpful) helpfulByUser.set(fb.reviewer, (helpfulByUser.get(fb.reviewer) ?? 0) + 1)

    for (const voter of voters) {
      run(`INSERT INTO feedback_votes (feedback_id, voter_id, vote_value, created_at) VALUES (?, ?, 1, ?)`, [
        fid,
        userId(voter),
        past(after(submitted, (1 + (hash32(`v:${fb.key}:${voter}`) % 72)) * 3600_000), submitted, `v:${fb.key}:${voter}`),
      ])
    }
    for (const voter of downvoters) {
      run(`INSERT INTO feedback_votes (feedback_id, voter_id, vote_value, created_at) VALUES (?, ?, -1, ?)`, [
        fid,
        userId(voter),
        past(after(submitted, (2 + (hash32(`d:${fb.key}:${voter}`) % 96)) * 3600_000), submitted, `d:${fb.key}:${voter}`),
      ])
    }
    upvotesByUser.set(fb.reviewer, (upvotesByUser.get(fb.reviewer) ?? 0) + voters.length)

    fb.points.forEach((point, i) => {
      const ptId = pointId(fb.key, i)
      const resolved = point.resolved ?? fb.inboxState === 'actioned'
      run(
        `INSERT INTO feedback_points
           (id, feedback_id, project_type_id, category_id, ask_id, ordinal, body_md, severity, actionability,
            sentiment, anchor_kind, anchor_value, timecode_ms, repro_steps, upvote_count, is_resolved, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ptId,
          fid,
          typeId(project.type),
          catId(project.type, point.category),
          point.askIndex === undefined ? null : askId(fb.project, point.askIndex),
          i,
          point.body,
          point.severity,
          point.actionability,
          point.sentiment,
          point.anchorKind ?? null,
          point.anchorValue ?? null,
          point.timecodeMs ?? null,
          point.repro ? reproText(point.repro) : null,
          point.upvotes ?? 0,
          resolved ? 1 : 0,
          submitted,
          submitted,
        ],
      )

      if (point.repro) reproByUser.set(fb.reviewer, (reproByUser.get(fb.reviewer) ?? 0) + 1)
      if (point.severity === 'blocker' && fb.inboxState === 'actioned') {
        actionedBlockersByUser.set(fb.reviewer, (actionedBlockersByUser.get(fb.reviewer) ?? 0) + 1)
      }

      const pointVoters = pick(
        otherUsers([fb.reviewer, project.ownerHandle]),
        point.upvotes ?? 0,
        `pv:${fb.key}:${i}`,
      )
      for (const voter of pointVoters) {
        run(`INSERT INTO feedback_point_votes (point_id, voter_id, created_at) VALUES (?, ?, ?)`, [
          ptId,
          userId(voter),
          past(after(submitted, (1 + (hash32(`pv:${fb.key}:${i}:${voter}`) % 96)) * 3600_000), submitted, `pv:${fb.key}:${i}:${voter}`),
        ])
      }

      if (point.theme) {
        const bucket = pointsByTheme.get(point.theme) ?? []
        bucket.push({
          pointId: ptId,
          reviewer: fb.reviewer,
          sentiment: point.sentiment,
          severity: point.severity,
          ts: submitted,
        })
        pointsByTheme.set(point.theme, bucket)
      }
    })

    Object.entries(fb.ratings).forEach(([axisKey, value]) => {
      run(
        `INSERT INTO feedback_ratings (id, feedback_id, project_type_id, axis_id, rating_value, comment, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?)`,
        [id(`rating:${fb.key}:${axisKey}`), fid, typeId(project.type), axisIdFor(project.type, axisKey), value, submitted],
      )
    })

    const replyIds: string[] = []
    ;(fb.replies ?? []).forEach((reply, i) => {
      const rid = id(`reply:${fb.key}:${i}`)
      replyIds.push(rid)
      const ts = replyTimes[i] ?? submitted
      run(
        `INSERT INTO feedback_replies
           (id, feedback_id, point_id, parent_reply_id, author_id, body_md, is_creator, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rid,
          fid,
          reply.pointIndex === undefined ? null : pointId(fb.key, reply.pointIndex),
          reply.parent === undefined ? null : (replyIds[reply.parent] ?? null),
          userId(reply.author),
          reply.body,
          reply.author === project.ownerHandle ? 1 : 0,
          ts,
          ts,
        ],
      )
    })
  }

  /* ---------------------------------------------------------------------- */
  /* 7. Themes                                                              */
  /* ---------------------------------------------------------------------- */

  const SEVERITY_WEIGHT: Record<string, number> = { praise: 0, nit: 1, minor: 2, major: 3, blocker: 4 }

  for (const theme of SEED.THEMES) {
    const project = projectBySlug.get(theme.project)
    if (!project) continue
    const members = pointsByTheme.get(theme.key) ?? []
    if (members.length === 0) continue

    const reviewers = new Set(members.map((m) => m.reviewer))
    const sentiment =
      Math.round((members.reduce((acc, m) => acc + m.sentiment, 0) / members.length) * 100) / 100
    const severity =
      Math.round(
        (members.reduce((acc, m) => acc + (SEVERITY_WEIGHT[m.severity] ?? 2), 0) / members.length) *
          Math.log1p(reviewers.size) *
          100,
      ) / 100
    const first = Math.min(...members.map((m) => m.ts))
    const last = Math.max(...members.map((m) => m.ts))

    run(
      `INSERT INTO feedback_themes
         (id, project_id, category_id, label, summary_md, source, point_count, reviewer_count, sentiment_score,
          severity_score, is_archived, first_seen_at, last_seen_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        themeId(theme.key),
        projectId(theme.project),
        catId(project.type, theme.category),
        theme.label,
        theme.summary,
        theme.source,
        members.length,
        reviewers.size,
        sentiment,
        severity,
        first,
        last,
        first,
        last,
      ],
    )

    for (const member of members) {
      run(
        `INSERT INTO feedback_point_themes (theme_id, point_id, confidence, assigned_by, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          themeId(theme.key),
          member.pointId,
          theme.source === 'confirmed' ? 1.0 : 0.82,
          theme.source === 'manual' ? userId(project.ownerHandle) : null,
          member.ts,
        ],
      )
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 8. Suggestions                                                         */
  /* ---------------------------------------------------------------------- */

  const suggestionId = (key: string) => id(`suggestion:${key}`)
  const shippedCredits = new Map<string, Set<string>>()
  const shippedByCreator = new Map<string, number>()

  for (const suggestion of SEED.SUGGESTIONS) {
    const project = projectBySlug.get(suggestion.project)
    if (!project) continue
    const sid = suggestionId(suggestion.key)
    const created = at(suggestion.createdDaysAgo, `suggestion:${suggestion.key}`)
    const events = [...suggestion.events].sort((a, b) => b.daysAgo - a.daysAgo)
    const lastEvent = events[events.length - 1]
    const eventAt = (event: { readonly daysAgo: number; readonly to: string }) =>
      past(at(event.daysAgo, `sgev:${suggestion.key}:${event.to}`), created, `sgev:${suggestion.key}:${event.to}`)
    const statusChanged = lastEvent ? eventAt(lastEvent) : created
    const shippedAt = suggestion.status === 'shipped' ? statusChanged : null
    const members = suggestion.theme ? (pointsByTheme.get(suggestion.theme) ?? []) : []

    run(
      `INSERT INTO suggestions
         (id, project_id, theme_id, category_id, created_by, title, body_md, status, status_note, priority, effort,
          duplicate_of, shipped_in_version_id, vote_count, source_count, status_changed_at, shipped_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sid,
        projectId(suggestion.project),
        suggestion.theme ? themeId(suggestion.theme) : null,
        suggestion.theme
          ? catId(project.type, SEED.THEMES.find((t) => t.key === suggestion.theme)?.category ?? 'bug')
          : null,
        userId(suggestion.createdBy),
        suggestion.title,
        suggestion.body,
        suggestion.status,
        suggestion.statusNote ?? null,
        suggestion.priority,
        suggestion.effort,
        suggestion.duplicateOf ? suggestionId(suggestion.duplicateOf) : null,
        suggestion.shippedVersionLabel ? versionId(suggestion.project, suggestion.shippedVersionLabel) : null,
        suggestion.voters.length,
        members.length,
        statusChanged,
        shippedAt,
        created,
        statusChanged,
      ],
    )

    for (const member of members) {
      run(
        `INSERT INTO suggestion_sources (suggestion_id, point_id, linked_by, created_at) VALUES (?, ?, ?, ?)`,
        // A note written after the suggestion was opened is linked when it arrives.
        [sid, member.pointId, userId(project.ownerHandle), Math.max(created, member.ts)],
      )
      if (suggestion.status === 'shipped') {
        const set = shippedCredits.get(member.reviewer) ?? new Set<string>()
        set.add(suggestion.key)
        shippedCredits.set(member.reviewer, set)
      }
    }

    if (suggestion.status === 'shipped') {
      shippedByCreator.set(project.ownerHandle, (shippedByCreator.get(project.ownerHandle) ?? 0) + 1)
      const authorSet = shippedCredits.get(suggestion.createdBy) ?? new Set<string>()
      authorSet.add(suggestion.key)
      shippedCredits.set(suggestion.createdBy, authorSet)
    }

    let previous: string | null = null
    events.forEach((event, i) => {
      const ts = eventAt(event)
      run(
        `INSERT INTO suggestion_events (id, suggestion_id, actor_id, from_status, to_status, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id(`sgev:${suggestion.key}:${i}`), sid, userId(event.actor), previous, event.to, event.note ?? null, ts],
      )
      previous = event.to
    })

    for (const voter of suggestion.voters) {
      run(`INSERT INTO suggestion_votes (suggestion_id, voter_id, created_at) VALUES (?, ?, ?)`, [
        sid,
        userId(voter),
        past(after(created, (2 + (hash32(`sv:${suggestion.key}:${voter}`) % 120)) * 3600_000), created, `sv:${suggestion.key}:${voter}`),
      ])
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 9. Bounty rows                                                         */
  /* ---------------------------------------------------------------------- */

  const completedByExpert = new Map<string, { total: number; onTime: number; ratings: number[] }>()

  // The ledger rows the bounty actions annotate carry the words those actions
  // write: what was released, what the fee was a share of, why money went
  // back. Authorising and holding explain themselves and carry nothing.
  const ledgerNote = (kind: SEED.SeedEscrowEvent['kind'], cents: number, bountyCents: number): string | null =>
    kind === 'release'
      ? 'Released to the reviewer after acceptance.'
      : kind === 'fee'
        ? `${String(Math.round((cents * 100) / bountyCents))} per cent of the ${format.money(bountyCents)} bounty.`
        : kind === 'refund'
          ? 'Returned to the creator after cancellation.'
          : null

  for (const bounty of SEED.BOUNTIES) {
    const bid = bountyId(bounty.key)
    const created = at(bounty.createdDaysAgo, `bounty:${bounty.key}`)
    const applicationIds = applicationIdsByBounty.get(bounty.key) ?? new Map<string, string>()

    if (bounty.award) {
      const award = bounty.award
      const fee = Math.round((bounty.amountCents * 1000) / 10000)
      const due = clampInt(now - award.dueDaysAgo * DAY)
      // Delivery cannot predate the review it delivered, and the acceptance and
      // the payout follow it in that order whatever the jitter does.
      const deliveredFloor = award.feedbackKey ? (submittedAt.get(award.feedbackKey) ?? created) : created
      const delivered =
        award.deliveredDaysAgo === undefined
          ? null
          : Math.max(at(award.deliveredDaysAgo, `deliver:${bounty.key}`), after(deliveredFloor, 3600_000))
      const accepted =
        award.acceptedDaysAgo === undefined
          ? null
          : Math.max(at(award.acceptedDaysAgo, `accept:${bounty.key}`), after(delivered ?? created, 2 * 3600_000))
      const paid =
        award.paidDaysAgo === undefined
          ? null
          : Math.max(at(award.paidDaysAgo, `paid:${bounty.key}`), after(accepted ?? created, 2 * 3600_000))

      run(
        `INSERT INTO bounty_awards
           (id, bounty_id, application_id, expert_id, feedback_id, payout_method_id, amount_cents, fee_cents, currency,
            status, payout_state, creator_rating, creator_review, due_at, delivered_at, accepted_at, paid_at,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          awardIdFor(bounty.key),
          bid,
          applicationIds.get(award.expert) ?? null,
          userId(award.expert),
          award.feedbackKey ? feedbackId(award.feedbackKey) : null,
          usersByHandle.get(award.expert)?.expert?.payout ? id(`payout:${award.expert}`) : null,
          bounty.amountCents,
          fee,
          award.status,
          award.payoutState,
          award.creatorRating ?? null,
          award.creatorReview ?? null,
          due,
          delivered,
          accepted,
          paid,
          created,
          paid ?? accepted ?? delivered ?? created,
        ],
      )

      if (award.status === 'accepted' || award.status === 'delivered') {
        const record = completedByExpert.get(award.expert) ?? { total: 0, onTime: 0, ratings: [] }
        record.total += 1
        if (delivered !== null && delivered <= due) record.onTime += 1
        if (award.creatorRating) record.ratings.push(award.creatorRating)
        completedByExpert.set(award.expert, record)
      }
    }

    let previousState: string | null = null
    let previousKind: string | null = null
    let previousAt = created - 60_000
    bounty.escrow.forEach((event, i) => {
      // Money moves when the bounty is posted at the earliest, and each movement
      // after the one before it, whatever the jitter on the dates does. The
      // pairs one action writes together stay together: posting authorises and
      // holds, acceptance releases and then takes the fee.
      const ts =
        event.kind === 'hold' && previousKind === 'authorize'
          ? previousAt + 60_000
          : event.kind === 'fee' && previousKind === 'release'
            ? previousAt + 1000
            : Math.max(at(event.daysAgo, `escrow:${bounty.key}:${i}`), previousAt + 60_000)
      previousAt = ts
      previousKind = event.kind
      run(
        `INSERT INTO bounty_escrow_events
           (id, bounty_id, award_id, event_kind, from_state, to_state, amount_cents, currency, provider_ref,
            actor_id, idempotency_key, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?)`,
        [
          id(`escrow:${bounty.key}:${i}`),
          bid,
          bounty.award ? awardIdFor(bounty.key) : null,
          event.kind,
          previousState,
          event.to,
          event.amountCents,
          escrowRef(bounty.key),
          userId(bounty.createdBy),
          `${bounty.key}:${event.kind}:${i}`,
          event.note ?? ledgerNote(event.kind, event.amountCents, bounty.amountCents),
          ts,
        ],
      )
      previousState = event.to
    })
  }

  for (const [handle, record] of completedByExpert) {
    const avg =
      record.ratings.length > 0
        ? Math.round((record.ratings.reduce((a, b) => a + b, 0) / record.ratings.length) * 100) / 100
        : 0
    run(
      `UPDATE expert_profiles SET completed_count = ?, avg_rating = ?, on_time_rate = ? WHERE user_id = ?`,
      [record.total, avg, record.total === 0 ? 0 : Math.round((record.onTime / record.total) * 100) / 100, userId(handle)],
    )
  }

  /* ---------------------------------------------------------------------- */
  /* 10. Discussions                                                        */
  /* ---------------------------------------------------------------------- */

  const threadsPerChannel = new Map<string, number>()
  const postTimesByThread = new Map<string, readonly number[]>()

  for (const thread of SEED.THREADS) {
    const tid = id(`thread:${thread.key}`)
    const created = past(at(thread.createdDaysAgo, `thread:${thread.key}`), now - DAY / 4, `thread:${thread.key}`)
    const postIds: string[] = []
    const postTimes: number[] = []
    let acceptedPostId: string | null = null

    thread.posts.forEach((post, i) => {
      const pid = id(`post:${thread.key}:${i}`)
      postIds.push(pid)
      const parentTs = post.parent === undefined ? created : (postTimes[post.parent] ?? created)
      const ts = past(Math.max(at(post.daysAgo, `post:${thread.key}:${i}`), after(parentTs, 5400_000)), parentTs, `post:${thread.key}:${i}`)
      postTimes.push(ts)
      if (post.accepted) acceptedPostId = pid
    })

    postTimesByThread.set(thread.key, postTimes)
    const lastPostAt = postTimes.length > 0 ? Math.max(...postTimes) : created
    // A post's score is the votes it actually has, and a thread's is the sum
    // of its posts', which is how votePost() keeps it on every vote. The hot
    // score is recomputeThreadHotScores()'s formula at the base instant.
    const postVoters = thread.posts.map((post, i) =>
      pick(otherUsers([post.author]), Math.min(post.score, SEED.USERS.length - 2), `post-votes:${thread.key}:${i}`),
    )
    const threadScore = postVoters.reduce((acc, voters) => acc + voters.length, 0)
    const hot = (1 + threadScore + 0.5 * thread.posts.length) / Math.pow((now - lastPostAt) / 3600_000 + 2, 1.5)

    run(
      `INSERT INTO discussion_threads
         (id, channel_id, project_id, author_id, title, body_md, thread_kind, status, accepted_post_id, is_pinned,
          post_count, view_count, score, hot_score, last_post_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tid,
        channelId(thread.channel),
        thread.project ? projectId(thread.project) : null,
        userId(thread.author),
        thread.title,
        thread.body,
        thread.kind,
        thread.status,
        acceptedPostId,
        thread.pinned ? 1 : 0,
        thread.posts.length,
        thread.views,
        threadScore,
        hot,
        lastPostAt,
        created,
        lastPostAt,
      ],
    )
    threadsPerChannel.set(thread.channel, (threadsPerChannel.get(thread.channel) ?? 0) + 1)

    const depths: number[] = []
    thread.posts.forEach((post, i) => {
      const depth = post.parent === undefined ? 0 : (depths[post.parent] ?? 0) + 1
      depths.push(depth)
      run(
        `INSERT INTO discussion_posts
           (id, thread_id, parent_post_id, author_id, body_md, depth, score, is_accepted, edited_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [
          postIds[i]!,
          tid,
          post.parent === undefined ? null : (postIds[post.parent] ?? null),
          userId(post.author),
          post.body,
          depth,
          postVoters[i]?.length ?? 0,
          post.accepted ? 1 : 0,
          postTimes[i]!,
        ],
      )

      for (const voter of postVoters[i] ?? []) {
        run(`INSERT INTO post_votes (post_id, voter_id, vote_value, created_at) VALUES (?, ?, 1, ?)`, [
          postIds[i]!,
          userId(voter),
          past(after(postTimes[i]!, (1 + (hash32(`pvote:${thread.key}:${i}:${voter}`) % 120)) * 3600_000), postTimes[i]!, `pvote:${thread.key}:${i}:${voter}`),
        ])
      }
    })

    const subscribers = new Set<string>([thread.author, ...thread.posts.map((p) => p.author)])
    for (const subscriber of subscribers) {
      run(
        `INSERT INTO thread_subscriptions (thread_id, user_id, state, last_read_at, created_at) VALUES (?, ?, 'subscribed', ?, ?)`,
        [tid, userId(subscriber), lastPostAt, created],
      )
    }
  }

  for (const [slug, count] of threadsPerChannel) {
    run(`UPDATE discussion_channels SET thread_count = ? WHERE id = ?`, [count, channelId(slug)])
  }

  /* ---------------------------------------------------------------------- */
  /* 11. Social graph                                                       */
  /* ---------------------------------------------------------------------- */

  const followerCount = new Map<string, number>()

  for (const [follower, followees] of Object.entries(SEED.USER_FOLLOWS)) {
    for (const followee of followees) {
      run(`INSERT INTO user_follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)`, [
        userId(follower),
        userId(followee),
        at(20 + (hash32(`follow:${follower}:${followee}`) % 200), `follow:${follower}:${followee}`),
      ])
    }
  }

  // Reviewing a project subscribes you to it, plus the explicit followers.
  const projectFollowers = new Map<string, Set<string>>()
  for (const fb of SEED.FEEDBACK) {
    const set = projectFollowers.get(fb.project) ?? new Set<string>()
    set.add(fb.reviewer)
    projectFollowers.set(fb.project, set)
  }
  for (const [slug, handles] of Object.entries(SEED.PROJECT_FOLLOWS)) {
    const set = projectFollowers.get(slug) ?? new Set<string>()
    for (const handle of handles) set.add(handle)
    projectFollowers.set(slug, set)
  }
  /** Who follows what, and since when, so a build can tell the right people. */
  const followsByProject = new Map<string, { handle: string; since: number }[]>()
  for (const [slug, followers] of projectFollowers) {
    const project = projectBySlug.get(slug)
    if (!project) continue
    for (const follower of followers) {
      if (follower === project.ownerHandle) continue
      const since = at(5 + (hash32(`pfollow:${slug}:${follower}`) % 60), `pfollow:${slug}:${follower}`)
      run(`INSERT INTO project_follows (user_id, project_id, notify, created_at) VALUES (?, ?, ?, ?)`, [
        userId(follower),
        projectId(slug),
        hash32(`notify:${slug}:${follower}`) % 3 === 0 ? 'versions' : 'all',
        since,
      ])
      const list = followsByProject.get(slug) ?? []
      list.push({ handle: follower, since })
      followsByProject.set(slug, list)
      followerCount.set(slug, (followerCount.get(slug) ?? 0) + 1)
    }
  }

  for (const [handle, tags] of Object.entries(SEED.TAG_FOLLOWS)) {
    for (const tag of tags) {
      run(`INSERT INTO tag_follows (user_id, tag_id, created_at) VALUES (?, ?, ?)`, [
        userId(handle),
        tagId(tag),
        at(30 + (hash32(`tfollow:${handle}:${tag}`) % 120), `tfollow:${handle}:${tag}`),
      ])
    }
  }

  const bookmarkCount = new Map<string, number>()
  for (const bookmark of SEED.BOOKMARKS) {
    run(`INSERT INTO project_bookmarks (user_id, project_id, note, created_at) VALUES (?, ?, ?, ?)`, [
      userId(bookmark.user),
      projectId(bookmark.project),
      bookmark.note ?? null,
      at(3 + (hash32(`bookmark:${bookmark.user}:${bookmark.project}`) % 40), `bookmark:${bookmark.user}`),
    ])
    bookmarkCount.set(bookmark.project, (bookmarkCount.get(bookmark.project) ?? 0) + 1)
  }

  /* ---------------------------------------------------------------------- */
  /* 12. Project stats                                                      */
  /* ---------------------------------------------------------------------- */

  for (const project of SEED.PROJECTS) {
    const feedback = SEED.FEEDBACK.filter((f) => f.project === project.slug)
    const suggestions = SEED.SUGGESTIONS.filter((s) => s.project === project.slug)
    const reviewers = new Set(feedback.map((f) => f.reviewer))
    const expertFeedback = feedback.filter((f) => isExpert(f.reviewer)).length
    const replied = feedback.filter((f) => firstCreatorReplyAt.has(f.key)).length

    // Counted the way recomputeProjectRating() counts: every rating row, and
    // their mean on the five-step scale.
    const ratings = feedback.flatMap((f) => Object.values(f.ratings))
    const ratingAvg =
      ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : 0

    const lastFeedbackAt =
      feedback.length > 0 ? Math.max(...feedback.map((f) => submittedAt.get(f.key) ?? 0)) : null
    const lastActivityAt = Math.max(
      lastFeedbackAt ?? 0,
      ...[...firstCreatorReplyAt.entries()]
        .filter(([key]) => feedback.some((f) => f.key === key))
        .map(([, ts]) => ts),
      publishedAt.get(project.slug) ?? 0,
    )

    run(
      `INSERT INTO project_stats
         (project_id, view_count, feedback_count, reviewer_count, expert_feedback_count, follower_count,
          bookmark_count, open_suggestions, shipped_suggestions, rating_count, rating_avg, reply_rate,
          last_feedback_at, last_activity_at, computed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId(project.slug),
        project.views,
        feedback.length,
        reviewers.size,
        expertFeedback,
        followerCount.get(project.slug) ?? 0,
        bookmarkCount.get(project.slug) ?? 0,
        suggestions.filter((s) => ['open', 'under_review', 'planned', 'in_progress'].includes(s.status)).length,
        suggestions.filter((s) => s.status === 'shipped').length,
        ratings.length,
        ratingAvg,
        feedback.length === 0 ? 0 : replied / feedback.length,
        lastFeedbackAt,
        lastActivityAt,
        now,
      ],
    )

    // hot_score stays at the 0 the insert gave it. The feed ranks on one
    // formula, the application's own recomputeHotScore(), run over every
    // project once the population is in; a second formula here put the
    // hand-written projects on a scale the feed could never compare.

    project.asks.forEach((_, i) => {
      const answers = feedback.reduce(
        (acc, f) => acc + f.points.filter((p) => p.askIndex === i).length,
        0,
      )
      run(`UPDATE project_asks SET answer_count = ? WHERE id = ?`, [answers, askId(project.slug, i)])
    })
  }

  /* ---------------------------------------------------------------------- */
  /* 13. Moderation: one low-effort report, upheld                          */
  /* ---------------------------------------------------------------------- */

  const reportedKey = 'pc-emmett-1'
  const reportedFeedback = SEED.FEEDBACK.find((f) => f.key === reportedKey)
  if (reportedFeedback) {
    const reportId = id(`report:${reportedKey}`)
    const filed = at(9, `report:${reportedKey}`)
    const resolved = after(filed, 2 * DAY)
    run(
      `INSERT INTO content_reports
         (id, reporter_id, target_type, target_id, target_owner_id, reason, detail, status, resolver_id,
          resolution_note, resolved_at, created_at)
       VALUES (?, ?, 'feedback', ?, ?, 'low_effort', ?, 'upheld', ?, ?, ?, ?)`,
      [
        reportId,
        userId('gretalind'),
        feedbackId(reportedKey),
        userId(reportedFeedback.reviewer),
        'Three minutes with a paper prototype and no answer to the ask. Not abusive, just empty, and it is sitting above reviews people spent an hour on.',
        userId('gretalind'),
        'Upheld as low effort. A note has gone to the reviewer with the three questions that would have made it useful. No restriction applied.',
        resolved,
        filed,
      ],
    )
    run(
      `INSERT INTO moderation_actions
         (id, moderator_id, report_id, target_type, target_id, subject_user_id, action, reason, public_note, expires_at, reverted_at, created_at)
       VALUES (?, ?, ?, 'feedback', ?, ?, 'warn', ?, ?, NULL, NULL, ?)`,
      [
        id(`modaction:${reportedKey}`),
        userId('gretalind'),
        reportId,
        feedbackId(reportedKey),
        userId(reportedFeedback.reviewer),
        'Review earns no reputation under the specificity floor. Sent the reviewer the three questions that would raise it.',
        'This review stays up. It earns nothing, and the reviewer has been shown how to make the next one count.',
        resolved,
      ],
    )
  }

  /* ---------------------------------------------------------------------- */
  /* 14. Reputation ledger and rollup                                       */
  /* ---------------------------------------------------------------------- */

  type Facet = 'reviewer' | 'creator' | 'community' | 'expert'

  const repEvent = (
    handle: string,
    facet: Facet,
    kind: string,
    delta: number,
    subjectType: string | null,
    subjectId: string | null,
    ts: number,
    note: string | null,
    weight = 1,
  ) => {
    run(
      `INSERT INTO reputation_events
         (id, user_id, facet, kind, delta, weight, subject_type, subject_id, actor_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [
        id(`rep:${handle}:${kind}:${subjectId ?? kind}`),
        userId(handle),
        facet,
        kind,
        delta,
        weight,
        subjectType,
        subjectId,
        note,
        ts,
      ],
    )
  }

  for (const project of SEED.PROJECTS) {
    repEvent(
      project.ownerHandle,
      'creator',
      'project_published',
      20,
      'project',
      projectId(project.slug),
      publishedAt.get(project.slug) ?? now,
      `Published ${project.title}.`,
    )
  }

  for (const fb of SEED.FEEDBACK) {
    const ts = submittedAt.get(fb.key) ?? now
    const quality = qualityByFeedback.get(fb.key) ?? 0
    const project = projectBySlug.get(fb.project)
    if (!project) continue

    // Volume alone is worth almost nothing: the submission award is scaled by
    // the specificity score computed above.
    const submissionPoints = Math.max(1, Math.round(4 + 12 * quality))
    repEvent(
      fb.reviewer,
      'reviewer',
      'feedback_submitted',
      submissionPoints,
      'feedback',
      feedbackId(fb.key),
      ts,
      `Specificity ${quality.toFixed(2)} on ${project.title}.`,
      Math.round(quality * 100) / 100,
    )

    if (fb.creatorMarkedHelpful) {
      repEvent(
        fb.reviewer,
        'reviewer',
        'feedback_marked_helpful',
        25,
        'feedback',
        feedbackId(fb.key),
        past(after(ts, 2 * DAY), ts, `rep-helpful:${fb.key}`),
        `${project.title}: the creator marked this helpful.`,
      )
    }

    const votes = voteTotals.get(fb.key)
    if (votes && votes.up > 0) {
      repEvent(
        fb.reviewer,
        'reviewer',
        'feedback_upvoted',
        votes.up * 3,
        'feedback',
        feedbackId(fb.key),
        past(after(ts, 3 * DAY), ts, `rep-upvoted:${fb.key}`),
        `${votes.up} reviewers found this useful.`,
      )
    }

    if (firstCreatorReplyAt.has(fb.key)) {
      repEvent(
        project.ownerHandle,
        'creator',
        'creator_replied',
        5,
        'feedback',
        feedbackId(fb.key),
        firstCreatorReplyAt.get(fb.key)!,
        `Replied on ${project.title}.`,
      )
    }
  }

  for (const [handle, suggestionKeys] of shippedCredits) {
    for (const key of suggestionKeys) {
      const suggestion = SEED.SUGGESTIONS.find((s) => s.key === key)
      if (!suggestion) continue
      repEvent(
        handle,
        'reviewer',
        'feedback_applied',
        40,
        'suggestion',
        suggestionId(key),
        at(suggestion.events[suggestion.events.length - 1]?.daysAgo ?? 5, `ship:${key}`),
        `Shipped in ${suggestion.shippedVersionLabel ?? 'a release'}: ${suggestion.title}`,
      )
    }
  }

  for (const [handle, count] of shippedByCreator) {
    repEvent(
      handle,
      'creator',
      'suggestion_shipped',
      15 * count,
      null,
      null,
      at(6, `shipcredit:${handle}`),
      `${count} tracked suggestions reached a release.`,
    )
  }

  /** Something that happened to a post: never before the post, never after now. */
  const postRepAt = (threadKey: string, i: number, daysAgo: number, key: string): number => {
    const posted = postTimesByThread.get(threadKey)?.[i] ?? now
    return past(Math.max(at(daysAgo, key), posted), posted, key)
  }

  for (const thread of SEED.THREADS) {
    thread.posts.forEach((post, i) => {
      if (post.score > 0) {
        repEvent(
          post.author,
          'community',
          'discussion_upvoted',
          post.score,
          'discussion_post',
          id(`post:${thread.key}:${i}`),
          postRepAt(thread.key, i, thread.createdDaysAgo - 1, `postrep:${thread.key}:${i}`),
          `Upvoted in ${thread.title}.`,
        )
      }
      if (post.accepted) {
        repEvent(
          post.author,
          'community',
          'accepted_answer',
          25,
          'discussion_post',
          id(`post:${thread.key}:${i}`),
          postRepAt(thread.key, i, thread.createdDaysAgo - 1, `accept:${thread.key}:${i}`),
          `Accepted answer in ${thread.title}.`,
        )
      }
    })
  }

  for (const round of SEED.ROUNDS) {
    for (const invite of round.invitations) {
      if (invite.status !== 'completed') continue
      repEvent(
        invite.user,
        'reviewer',
        'test_round_completed',
        15,
        'test_round',
        id(`round:${round.key}`),
        at(invite.completedDaysAgo ?? 5, `roundrep:${round.key}:${invite.user}`),
        `Completed ${round.title}.`,
      )
    }
  }

  for (const bounty of SEED.BOUNTIES) {
    if (!bounty.award || bounty.award.status !== 'accepted') continue
    repEvent(
      bounty.award.expert,
      'expert',
      'bounty_completed',
      60,
      'bounty',
      bountyId(bounty.key),
      at(bounty.award.acceptedDaysAgo ?? 3, `bountyrep:${bounty.key}`),
      `Paid review accepted: ${bounty.title}`,
    )
  }

  if (reportedFeedback) {
    repEvent(
      reportedFeedback.reviewer,
      'reviewer',
      'moderation_penalty',
      -20,
      'feedback',
      feedbackId(reportedKey),
      at(7, `penalty:${reportedKey}`),
      'A review was upheld as low effort. No restriction, no reputation.',
    )
  }

  // The rollup is the product's own computation, not a second opinion: it reads
  // the rows just inserted and writes the same numbers the app would write on a
  // recompute. Two passes, because the first gives voters a credibility score
  // and the second lets their votes carry the weight that score implies.
  for (let pass = 0; pass < 2; pass++) {
    for (const user of SEED.USERS) {
      reputationRepo.persistReputation(userId(user.handle), now)
    }
  }
  // Those writes go through the repository rather than the counting wrapper, so
  // the summary table would otherwise under-report them.
  countRow('reputation_scores', SEED.USERS.length)

  /* ---------------------------------------------------------------------- */
  /* 15. Badges, awarded from the rows above                                */
  /* ---------------------------------------------------------------------- */

  const award = (handle: string, slug: string, ts: number, reason: string) => {
    run(
      `INSERT INTO user_badges (user_id, badge_id, awarded_at, revoked_at, reason) VALUES (?, ?, ?, NULL, ?)`,
      [userId(handle), badgeId(slug), ts, reason],
    )
  }

  for (const user of SEED.USERS) {
    const reviewed = feedbackByUser.get(user.handle) ?? 0
    if (reviewed >= 1) {
      const firstReview = SEED.FEEDBACK.filter((f) => f.reviewer === user.handle).sort(
        (a, b) => (submittedAt.get(a.key) ?? 0) - (submittedAt.get(b.key) ?? 0),
      )[0]
      award(user.handle, 'first-pass', submittedAt.get(firstReview?.key ?? '') ?? now, 'First structured review submitted.')
    }
    if ((reproByUser.get(user.handle) ?? 0) >= 3) {
      award(user.handle, 'repro-writer', at(12, `badge:repro:${user.handle}`), 'Three complete reproductions filed.')
    }
    if ((actionedBlockersByUser.get(user.handle) ?? 0) >= 2) {
      award(user.handle, 'blocker-finder', at(8, `badge:blocker:${user.handle}`), 'Blockers confirmed and acted on by creators.')
    }
    if ((shippedCredits.get(user.handle)?.size ?? 0) >= 1) {
      award(user.handle, 'shipped-it', at(7, `badge:shipped:${user.handle}`), 'A note reached a released version.')
    }
    if ((shippedByCreator.get(user.handle) ?? 0) >= 2) {
      award(user.handle, 'closed-the-loop', at(6, `badge:loop:${user.handle}`), 'Two tracked suggestions shipped and credited.')
    }
    const owned = SEED.PROJECTS.filter((p) => p.ownerHandle === user.handle)
    if (owned.length >= 2) {
      award(user.handle, 'open-bench', at(15, `badge:bench:${user.handle}`), 'Two projects published with a written ask.')
    }
    const ownedFeedback = SEED.FEEDBACK.filter((f) => owned.some((p) => p.slug === f.project))
    if (
      ownedFeedback.length >= 5 &&
      ownedFeedback.every((f) => firstCreatorReplyAt.has(f.key) || f.inboxState === 'archived')
    ) {
      award(user.handle, 'answers-everyone', at(4, `badge:answers:${user.handle}`), 'Replied to every review on a project.')
    }
    if (SEED.THREADS.some((t) => t.author === user.handle && t.posts.some((p) => p.accepted))) {
      award(user.handle, 'good-question', at(11, `badge:question:${user.handle}`), 'Asked a thread that earned an accepted answer.')
    }
    if (user.expert) {
      award(
        user.handle,
        'verified-expert',
        at(user.expert.verifiedDaysAgo, `badge:verified:${user.handle}`),
        'Credentials confirmed by two existing experts.',
      )
    }
    const completed = completedByExpert.get(user.handle)
    if (completed && completed.total >= 2 && completed.onTime === completed.total) {
      award(user.handle, 'on-time', at(5, `badge:ontime:${user.handle}`), 'Paid reviews delivered before the deadline.')
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 16. Notifications                                                      */
  /* ---------------------------------------------------------------------- */

  const notify = (args: {
    user: string
    actor?: string
    kind: string
    subjectType: string | null
    subjectId: string | null
    title: string
    body: string | null
    url: string
    ts: number
    read: boolean
    key: string
    groupKey?: string
  }) => {
    run(
      `INSERT INTO notifications
         (id, user_id, actor_id, kind, subject_type, subject_id, group_key, title, body, url, payload, read_at, emailed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      [
        id(`notification:${args.key}`),
        userId(args.user),
        args.actor ? userId(args.actor) : null,
        args.kind,
        args.subjectType,
        args.subjectId,
        args.groupKey ?? null,
        args.title,
        args.body,
        args.url,
        // Read and emailed some hours later, unless those hours are still to come.
        args.read && after(args.ts, 6 * 3600_000) <= now ? after(args.ts, 6 * 3600_000) : null,
        after(args.ts, 3600_000) <= now ? after(args.ts, 3600_000) : null,
        args.ts,
      ],
    )
  }

  for (const fb of SEED.FEEDBACK) {
    const project = projectBySlug.get(fb.project)
    if (!project) continue
    const ts = submittedAt.get(fb.key) ?? now
    const reviewer = usersByHandle.get(fb.reviewer)
    if (!reviewer) continue

    notify({
      user: project.ownerHandle,
      actor: fb.reviewer,
      kind: 'feedback_received',
      subjectType: 'feedback',
      subjectId: feedbackId(fb.key),
      title: `${reviewer.name} reviewed ${project.title}`,
      body: fb.headline,
      url: `/dashboard/inbox?note=${feedbackId(fb.key)}`,
      ts,
      read: fb.inboxState !== 'new',
      key: `fb-received:${fb.key}`,
    })

    if (fb.creatorMarkedHelpful) {
      notify({
        user: fb.reviewer,
        actor: project.ownerHandle,
        kind: 'feedback_helpful',
        subjectType: 'feedback',
        subjectId: feedbackId(fb.key),
        title: `${usersByHandle.get(project.ownerHandle)?.name ?? project.ownerHandle} marked your review helpful`,
        body: project.title,
        url: `/p/${project.slug}#note-${feedbackId(fb.key)}`,
        ts: past(after(ts, 2 * DAY), ts, `rep-helpful:${fb.key}`),
        read: fb.daysAgo > 10,
        key: `fb-helpful:${fb.key}`,
      })
    }

    ;(fb.replies ?? []).forEach((reply, i) => {
      const recipient = reply.author === fb.reviewer ? project.ownerHandle : fb.reviewer
      if (recipient === reply.author) return
      notify({
        user: recipient,
        actor: reply.author,
        kind: 'feedback_reply',
        subjectType: 'feedback',
        subjectId: feedbackId(fb.key),
        title: `${usersByHandle.get(reply.author)?.name ?? reply.author} replied on ${project.title}`,
        body: reply.body.slice(0, 140),
        url: `/p/${project.slug}#note-${feedbackId(fb.key)}`,
        ts: replyTimesByFeedback.get(fb.key)?.[i] ?? ts,
        read: fb.daysAgo > 8,
        key: `fb-reply:${fb.key}:${i}`,
      })
    })
  }

  for (const suggestion of SEED.SUGGESTIONS) {
    if (suggestion.status !== 'shipped') continue
    const project = projectBySlug.get(suggestion.project)
    if (!project) continue
    const members = suggestion.theme ? (pointsByTheme.get(suggestion.theme) ?? []) : []
    const recipients = new Set<string>([suggestion.createdBy, ...members.map((m) => m.reviewer)])
    recipients.delete(project.ownerHandle)
    for (const recipient of recipients) {
      notify({
        user: recipient,
        actor: project.ownerHandle,
        kind: 'suggestion_shipped',
        subjectType: 'suggestion',
        subjectId: suggestionId(suggestion.key),
        title: `Shipped in ${suggestion.shippedVersionLabel}: ${suggestion.title}`,
        body: `${project.title} released the change your note fed into.`,
        url: `/p/${project.slug}/versions`,
        ts: at(suggestion.events[suggestion.events.length - 1]?.daysAgo ?? 5, `ship-note:${suggestion.key}:${recipient}`),
        read: false,
        key: `shipped:${suggestion.key}:${recipient}`,
      })
    }
  }

  for (const suggestion of SEED.SUGGESTIONS) {
    if (suggestion.status !== 'declined' && suggestion.status !== 'wont_fix') continue
    const project = projectBySlug.get(suggestion.project)
    if (!project || suggestion.createdBy === project.ownerHandle) continue
    notify({
      user: suggestion.createdBy,
      actor: project.ownerHandle,
      kind: 'suggestion_status',
      subjectType: 'suggestion',
      subjectId: suggestionId(suggestion.key),
      title: `${project.title}: ${suggestion.title} was declined`,
      body: suggestion.statusNote ?? null,
      url: `/p/${project.slug}`,
      ts: at(suggestion.events[suggestion.events.length - 1]?.daysAgo ?? 5, `decline-note:${suggestion.key}`),
      read: true,
      key: `declined:${suggestion.key}`,
    })
  }

  for (const bounty of SEED.BOUNTIES) {
    const project = projectBySlug.get(bounty.project)
    if (!project) continue
    for (const application of bounty.applications) {
      notify({
        user: bounty.createdBy,
        actor: application.applicant,
        kind: 'bounty_application',
        subjectType: 'bounty',
        subjectId: bountyId(bounty.key),
        title: `${usersByHandle.get(application.applicant)?.name ?? application.applicant} applied to ${bounty.title}`,
        body: application.pitch.slice(0, 140),
        url: `/bounties/${bountyId(bounty.key)}`,
        ts: at(application.daysAgo, `bapp-note:${bounty.key}:${application.applicant}`),
        read: bounty.status !== 'open',
        key: `bapp:${bounty.key}:${application.applicant}`,
      })
    }
    if (bounty.award) {
      notify({
        user: bounty.award.expert,
        actor: bounty.createdBy,
        kind: 'bounty_awarded',
        subjectType: 'bounty_award',
        subjectId: awardIdFor(bounty.key),
        title: `You were awarded ${bounty.title}`,
        body: `${project.title}, due in ${bounty.turnaroundHours} hours.`,
        url: `/bounties/${bountyId(bounty.key)}`,
        ts: at(bounty.createdDaysAgo - 1, `bawarded:${bounty.key}`),
        read: true,
        key: `bawarded:${bounty.key}`,
      })
      if (bounty.award.paidDaysAgo !== undefined) {
        notify({
          user: bounty.award.expert,
          kind: 'bounty_paid',
          subjectType: 'bounty_award',
          subjectId: awardIdFor(bounty.key),
          title: `Payment released for ${bounty.title}`,
          body: `${(bounty.amountCents * 0.9) / 100} USD after the platform fee.`,
          url: `/bounties/${bountyId(bounty.key)}`,
          ts: at(bounty.award.paidDaysAgo, `bpaid:${bounty.key}`),
          read: bounty.award.paidDaysAgo > 5,
          key: `bpaid:${bounty.key}`,
        })
      }
    }
  }

  for (const [follower, followees] of Object.entries(SEED.USER_FOLLOWS)) {
    for (const followee of followees) {
      const ts = at(20 + (hash32(`follow:${follower}:${followee}`) % 200), `follownote:${follower}:${followee}`)
      if (now - ts > 45 * DAY) continue
      notify({
        user: followee,
        actor: follower,
        kind: 'new_follower',
        subjectType: 'user',
        subjectId: userId(follower),
        title: `${usersByHandle.get(follower)?.name ?? follower} followed you`,
        body: null,
        url: `/u/${follower}`,
        ts,
        read: true,
        key: `follow:${follower}:${followee}`,
      })
    }
  }

  for (const thread of SEED.THREADS) {
    thread.posts.forEach((post, i) => {
      if (post.author === thread.author) return
      notify({
        user: thread.author,
        actor: post.author,
        kind: 'thread_reply',
        subjectType: 'discussion_thread',
        subjectId: id(`thread:${thread.key}`),
        title: `${usersByHandle.get(post.author)?.name ?? post.author} replied to ${thread.title}`,
        body: post.body.slice(0, 140),
        url: `/c/${thread.channel}/${id(`thread:${thread.key}`)}`,
        ts: postTimesByThread.get(thread.key)?.[i] ?? now,
        read: thread.createdDaysAgo > 10,
        key: `threadreply:${thread.key}:${i}`,
      })
      if (post.accepted) {
        notify({
          user: post.author,
          actor: thread.author,
          kind: 'answer_accepted',
          subjectType: 'discussion_post',
          subjectId: id(`post:${thread.key}:${i}`),
          title: `Your answer was accepted in ${thread.title}`,
          body: null,
          url: `/c/${thread.channel}/${id(`thread:${thread.key}`)}`,
          ts: postRepAt(thread.key, i, post.daysAgo - 1, `acceptnote:${thread.key}:${i}`),
          read: true,
          key: `accepted:${thread.key}:${i}`,
        })
      }
    })
  }

  // A follow is the promise to hear about the next build, and posting one fans a
  // `new_version` row out to everyone already following when it landed. These
  // builds were written straight into the table rather than posted through the
  // form, so the same fan-out has to be written here; without it a world full of
  // builds landed in nobody's inbox. Ordered the way it happened — the build's
  // own release time, not today — and skipping anyone who started following
  // afterwards, since there was nothing to tell them yet.
  for (const project of SEED.PROJECTS) {
    const followers = followsByProject.get(project.slug) ?? []
    for (const version of project.versions) {
      const released = releasedAt.get(`${project.slug}:${version.label}`)
      if (released === undefined) continue
      for (const follower of followers) {
        if (follower.since > released) continue
        notify({
          user: follower.handle,
          actor: project.ownerHandle,
          kind: 'new_version',
          subjectType: 'project_version',
          subjectId: versionId(project.slug, version.label),
          title: `${project.title} has a new build: ${version.label}`,
          body: null,
          url: `/p/${project.slug}/versions`,
          ts: released,
          // Most get opened; a build from months ago that never was stays unread.
          read: hash32(`versionread:${project.slug}:${version.label}:${follower.handle}`) % 5 !== 0,
          key: `newversion:${project.slug}:${version.label}:${follower.handle}`,
        })
      }
    }
  }

  for (const user of SEED.USERS) {
    if (!user.expert) continue
    run(
      `INSERT INTO notification_preferences (user_id, kind, in_app, email, push, updated_at) VALUES (?, 'new_follower', 1, 0, 0, ?)`,
      [userId(user.handle), at(30, `pref:${user.handle}`)],
    )
  }

  /* ---------------------------------------------------------------------- */
  /* 17. Audit log                                                          */
  /* ---------------------------------------------------------------------- */

  for (const project of SEED.PROJECTS) {
    run(
      `INSERT INTO audit_log (id, actor_id, actor_role, action, entity_type, entity_id, before_json, after_json, ip_hash, user_agent, created_at)
       VALUES (?, ?, 'member', 'project.publish', 'project', ?, ?, ?, NULL, NULL, ?)`,
      [
        id(`audit:publish:${project.slug}`),
        userId(project.ownerHandle),
        projectId(project.slug),
        JSON.stringify({ status: 'draft', visibility: 'private' }),
        JSON.stringify({ status: 'published', visibility: 'public' }),
        publishedAt.get(project.slug) ?? now,
      ],
    )
  }

  for (const bounty of SEED.BOUNTIES) {
    if (!bounty.award || bounty.award.paidDaysAgo === undefined) continue
    run(
      `INSERT INTO audit_log (id, actor_id, actor_role, action, entity_type, entity_id, before_json, after_json, ip_hash, user_agent, created_at)
       VALUES (?, ?, 'member', 'bounty.release', 'bounty', ?, ?, ?, NULL, NULL, ?)`,
      [
        id(`audit:release:${bounty.key}`),
        userId(bounty.createdBy),
        bountyId(bounty.key),
        JSON.stringify({ escrow_state: 'held' }),
        JSON.stringify({ escrow_state: 'released', amount_cents: bounty.amountCents }),
        at(bounty.award.paidDaysAgo, `audit-release:${bounty.key}`),
      ],
    )
  }

  for (const suggestion of SEED.SUGGESTIONS) {
    if (suggestion.status !== 'shipped') continue
    const project = projectBySlug.get(suggestion.project)
    if (!project) continue
    run(
      `INSERT INTO audit_log (id, actor_id, actor_role, action, entity_type, entity_id, before_json, after_json, ip_hash, user_agent, created_at)
       VALUES (?, ?, 'member', 'suggestion.status', 'suggestion', ?, ?, ?, NULL, NULL, ?)`,
      [
        id(`audit:suggestion:${suggestion.key}`),
        userId(project.ownerHandle),
        suggestionId(suggestion.key),
        JSON.stringify({ status: 'in_progress' }),
        JSON.stringify({ status: 'shipped', version: suggestion.shippedVersionLabel }),
        at(suggestion.events[suggestion.events.length - 1]?.daysAgo ?? 3, `audit-sg:${suggestion.key}`),
      ],
    )
  }

  run(`INSERT INTO schema_meta (meta_key, meta_value, updated_at) VALUES ('seeded_at', ?, ?)
       ON CONFLICT (meta_key) DO UPDATE SET meta_value = excluded.meta_value, updated_at = excluded.updated_at`, [
    String(now),
    now,
  ])
  // schema.sql stamps its own row with the wall clock. Pin it to the base
  // instant so two runs of the seed produce byte-identical databases.
  run(`UPDATE schema_meta SET updated_at = ? WHERE meta_key = 'schema_version'`, [now])
}

/**
 * Deadlines and expiry dates are meant to be ahead of the base instant.
 * Everything else is a record of something that happened, and a record dated
 * in the future is exactly the content bug `past()` exists to prevent, so the
 * seed refuses to finish with one in it rather than leave the audit to find it.
 */
function assertNothingAhead(db: typeof import('../src/server/db/client.ts'), now: number): void {
  const AHEAD = new Set(['expires_at', 'ends_at', 'closes_at', 'due_at', 'feedback_closes_at'])
  const late: string[] = []
  const tables = db.all<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
  for (const { name } of tables) {
    for (const column of db.all<{ name: string }>(`PRAGMA table_info(${name})`)) {
      if (!column.name.endsWith('_at') || AHEAD.has(column.name)) continue
      const n = db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${name} WHERE ${column.name} > ?`, [now])?.n ?? 0
      if (n > 0) late.push(`${name}.${column.name}: ${n}`)
    }
  }
  if (late.length > 0) throw new Error(`Rows dated after the base instant:\n  - ${late.join('\n  - ')}`)
}

/* -------------------------------------------------------------------------- */
/* Summary                                                                    */
/* -------------------------------------------------------------------------- */

function report(counts: Counts, now: number): void {
  const rows = [...counts.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
  const width = Math.max(12, ...rows.map(([table]) => table.length))
  const total = rows.reduce((acc, [, n]) => acc + n, 0)

  const line = (left: string, right: string) => `  ${left.padEnd(width)}  ${right.padStart(7)}`
  const rule = `  ${'-'.repeat(width)}  ${'-'.repeat(7)}`

  const out: string[] = []
  out.push('')
  out.push('  Whetstone seed complete.')
  out.push('')
  out.push(line('table', 'rows'))
  out.push(rule)
  for (const [table, n] of rows) out.push(line(table, String(n)))
  out.push(rule)
  out.push(line('total', String(total)))
  out.push('')
  out.push(`  Base instant  ${new Date(now).toISOString()}`)
  const login = SEED.USERS.find((u) => u.handle === SEED.SIGN_IN_HANDLE)?.email ?? ''
  out.push(
    SEED.seedPassword()
      ? `  Sign-in       ${login} (password from SEED_PASSWORD, or the local default)`
      : `  Sign-in       ${login} has no password. Set SEED_PASSWORD and rebuild, or use a reset link.`,
  )
  out.push('  Every other account has no password and cannot sign in.')
  out.push('')
  process.stdout.write(`${out.join('\n')}\n`)
}

/* -------------------------------------------------------------------------- */

try {
  await main()
} catch (error) {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  process.stderr.write(`\n  Seed failed. Nothing was written.\n\n${message}\n\n`)
  process.exit(1)
}

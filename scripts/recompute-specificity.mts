/**
 * Recompute every submitted review's stored specificity with the application's
 * own scorer.
 *
 * `feedback.quality_score` is the review's S, written once when the review is
 * posted, and everything downstream reads it: the qualified bar on the thread,
 * the Need term in the ranked feed, the stats, reputation. The seed writes it
 * with `computeSpecificity`, but the population script draws it at random, so
 * a generated note's number says nothing about its words. And when the scorer
 * changes, every stored S is the old scorer's opinion. Run this after
 * rebuilding the database and before recompute-hot.mts and
 * recompute-reputation.mts, which both read it.
 *
 *   node --experimental-strip-types scripts/recompute-specificity.mts [--db path] [--dry-run]
 *
 * Each review is scored from what is stored with it: every point's body,
 * category, severity, actionability, ask, anchor, repro steps and attachment
 * count, against the project's own vocabulary, with the dwell floor applied
 * to its recorded minutes. Whether the build was opened is not stored, so
 * only the time half of the floor applies, as it does in the seed. A review
 * with no recorded time cannot have its floor reproduced and is left as it is.
 *
 * It opens `--db` if given, otherwise DATABASE_PATH like the app does, and
 * writes nothing but `quality_score`. `--dry-run` prints what would change.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { registerHooks } from 'node:module'
import type { NewFeedbackPointInput } from '../src/lib/types.ts'

// The application imports its own modules without a file extension and through
// the `@/` alias, both of which Next understands and a bare `node` run does
// not. Same hook the seed script installs, for the same reason.
const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'src')
const withExtension = (file: string): string => {
  if (path.extname(file) !== '') return file
  for (const candidate of [`${file}.ts`, `${file}.tsx`, path.join(file, 'index.ts')]) {
    if (fs.existsSync(candidate)) return candidate
  }
  return file
}
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) {
      return next(pathToFileURL(withExtension(path.join(SRC, specifier.slice(2)))).href, context)
    }
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
      const parent = path.dirname(fileURLToPath(context.parentURL))
      const resolved = withExtension(path.resolve(parent, specifier))
      if (resolved !== path.resolve(parent, specifier)) return next(pathToFileURL(resolved).href, context)
    }
    return next(specifier, context)
  },
})

// The client resolves DATABASE_PATH and schema.sql against the working
// directory, as the app does from the project root.
const dbFlag = process.argv.indexOf('--db')
const dbArg = dbFlag === -1 ? undefined : process.argv[dbFlag + 1]
if (dbArg) process.env.DATABASE_PATH = path.resolve(dbArg)
const dryRun = process.argv.includes('--dry-run')
process.chdir(ROOT)

const { computeSpecificity, projectVocabulary } = await import('../src/server/repos/feedback.ts')
const { all, run, tx } = await import('../src/server/db/client.ts')
const { QUALIFIED_SPECIFICITY } = await import('../src/lib/taxonomy.ts')

type ReviewRow = { id: string; project_id: string; minutes: number | null; stored: number | null }
type PointRow = {
  feedback_id: string
  category_key: string
  body_md: string
  severity: NewFeedbackPointInput['severity']
  actionability: NewFeedbackPointInput['actionability']
  ask_id: string | null
  anchor_kind: NewFeedbackPointInput['anchorKind']
  anchor_value: string | null
  timecode_ms: number | null
  repro_steps: string | null
  attachments: number
}

const started = performance.now()

const reviews = all<ReviewRow>(
  `SELECT id, project_id, time_spent_minutes AS minutes, quality_score AS stored
     FROM feedback
    WHERE status = 'submitted' AND deleted_at IS NULL`,
)

// Every point in one read, attachment counts folded in, rather than a query
// per review: there are tens of thousands of them.
const pointsByReview = new Map<string, NewFeedbackPointInput[]>()
for (const p of all<PointRow>(
  `SELECT fp.feedback_id, fc.category_key, fp.body_md, fp.severity, fp.actionability, fp.ask_id,
          fp.anchor_kind, fp.anchor_value, fp.timecode_ms, fp.repro_steps,
          (SELECT COUNT(*) FROM feedback_attachments fa WHERE fa.point_id = fp.id) AS attachments
     FROM feedback_points fp
     JOIN feedback_categories fc ON fc.id = fp.category_id AND fc.project_type_id = fp.project_type_id
    ORDER BY fp.feedback_id, fp.ordinal`,
)) {
  const list = pointsByReview.get(p.feedback_id) ?? []
  list.push({
    categoryKey: p.category_key,
    bodyMd: p.body_md,
    severity: p.severity,
    actionability: p.actionability,
    askId: p.ask_id,
    anchorKind: p.anchor_kind,
    anchorValue: p.anchor_value,
    timecodeMs: p.timecode_ms,
    reproSteps: p.repro_steps,
    // Only the count is scored, so the attachment rows themselves stay put.
    attachments: Array.from({ length: p.attachments }, () => ({ mediaKind: 'file' as const, url: '' })),
  })
  pointsByReview.set(p.feedback_id, list)
}

const vocabularies = new Map<string, ReturnType<typeof projectVocabulary>>()
const vocabularyOf = (projectId: string): ReturnType<typeof projectVocabulary> => {
  const hit = vocabularies.get(projectId)
  if (hit) return hit
  const made = projectVocabulary(projectId)
  vocabularies.set(projectId, made)
  return made
}

const before: number[] = []
const after: number[] = []
const updates: { id: string; score: number }[] = []
let untimed = 0

for (const review of reviews) {
  const points = pointsByReview.get(review.id) ?? []
  if (review.minutes === null) {
    untimed++
    continue
  }
  // Stored unrounded, as createFeedback stores it: rounding here would lift a
  // 0.4996 over the qualified bar that the live path would have kept it under.
  const score = computeSpecificity({ points, dwellSeconds: review.minutes * 60 }, vocabularyOf(review.project_id)).score
  before.push(review.stored ?? 0)
  after.push(score)
  if (review.stored === null || Math.abs(score - review.stored) > 1e-9) updates.push({ id: review.id, score })
}

if (!dryRun) {
  // One transaction: thirty thousand separate commits is most of the runtime.
  tx(() => {
    for (const u of updates) run(`UPDATE feedback SET quality_score = ? WHERE id = ?`, [u.score, u.id])
  })
}
const elapsed = performance.now() - started

const summary = (xs: readonly number[]): string => {
  const sorted = [...xs].sort((a, b) => a - b)
  const at = (f: number): string => (sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))] ?? 0).toFixed(3)
  const qualified = xs.filter((x) => x >= QUALIFIED_SPECIFICITY).length
  const share = xs.length > 0 ? ((100 * qualified) / xs.length).toFixed(1) : '0.0'
  return `${String(qualified)} qualified (${share}%), median ${at(0.5)}, p10 ${at(0.1)}, p90 ${at(0.9)}`
}

console.log(
  `  ${dryRun ? 'would recompute' : 'recomputed'} specificity for ${String(after.length)} reviews in ${(elapsed / 1000).toFixed(1)}s; ${String(updates.length)} ${dryRun ? 'would change' : 'changed'}`,
)
console.log(`  before  ${summary(before)}`)
console.log(`  after   ${summary(after)}`)
if (untimed > 0) console.log(`  left as stored: ${String(untimed)} reviews with no recorded time`)

/**
 * Recompute every member's stored reputation with the application's own
 * formula, against one clock.
 *
 * `reputation_scores` is a cache of what `persistReputation` computes from the
 * reputation events, reviews and creator record. The running app refreshes a
 * member's row whenever something about them changes. The population script
 * wrote its own tallies instead, so a generated member's card, profile and
 * reputation tab could each show a different number. Run this after rebuilding
 * the database, after recompute-hot.mts, and every surface reads one figure.
 *
 *   node --experimental-strip-types scripts/recompute-reputation.mts [--db path]
 *
 * It opens `--db` if given, otherwise DATABASE_PATH like the app does, and
 * writes nothing but `reputation_scores`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { registerHooks } from 'node:module'

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
process.chdir(ROOT)

const { persistReputation } = await import('../src/server/repos/reputation.ts')
const { all, get, tx } = await import('../src/server/db/client.ts')

const started = performance.now()
const at = Date.now()
const users = all<{ id: string }>(`SELECT id FROM users WHERE status = 'active' ORDER BY id`)
// One transaction: five thousand separate commits is most of the runtime.
tx(() => {
  for (const { id } of users) persistReputation(id, at)
})
const elapsed = performance.now() - started

const row = get<{ n: number; hi: number | null; odd: number }>(
  `SELECT COUNT(*) AS n, MAX(total_score) AS hi,
          SUM(CASE WHEN total_score <> reviewer_score THEN 1 ELSE 0 END) AS odd
     FROM reputation_scores`,
)
console.log(`  recomputed reputation for ${String(users.length)} members in ${(elapsed / 1000).toFixed(1)}s`)
console.log(`  highest ${String(row?.hi ?? 0)}; rows whose headline differs from reviewer credibility: ${String(row?.odd ?? 0)}`)

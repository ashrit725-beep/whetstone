/**
 * Recompute every listed project's `hot_score` with the application's own
 * formula, against one clock.
 *
 * `hot_score` is the window the ranked Discover feed draws from. The running
 * app keeps it current by itself (every change recomputes its project, and the
 * first feed a process serves recomputes all of them, then every fifteen
 * minutes), so this is for the moment between a data load and the first page
 * view: run it after rebuilding the database and the ranked feed is right on
 * its very first render.
 *
 *   node --experimental-strip-types scripts/recompute-hot.mts [--db path]
 *
 * It opens `--db` if given, otherwise DATABASE_PATH like the app does (the
 * same default, data/whetstone.db), and writes nothing but `hot_score`.
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

const { recomputeHotScore } = await import('../src/server/repos/projects.ts')
const { get } = await import('../src/server/db/client.ts')

const started = performance.now()
recomputeHotScore()
const elapsed = performance.now() - started

const row = get<{ n: number; lo: number | null; hi: number | null }>(
  `SELECT COUNT(*) AS n, MIN(hot_score) AS lo, MAX(hot_score) AS hi
     FROM projects
    WHERE deleted_at IS NULL AND visibility = 'public' AND status = 'published'`,
)
const n = row?.n ?? 0
console.log(`  recomputed hot_score for ${String(n)} listed projects in ${elapsed.toFixed(0)}ms`)
if (n > 0) console.log(`  range ${(row?.lo ?? 0).toFixed(4)} to ${(row?.hi ?? 0).toFixed(4)}`)

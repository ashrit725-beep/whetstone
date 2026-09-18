/**
 * Bring a built database forward to the present.
 *
 * A database is current the moment `npm run db:rebuild` finishes, and it ages
 * from then on: a week later the newest review is a week old, the last seven
 * bars of the landing chart are empty and every "2 hours ago" reads "7 days
 * ago", which is a community that has gone quiet. Rebuilding fixes that but
 * takes minutes and produces different rows. This instead moves every
 * timestamp in every table forward by one amount, the time since the build,
 * so the newest activity sits exactly as far behind the present as it did
 * when the database was built, and every relationship between rows (a reply
 * after its review, a vote after its point, a deadline three days out) is
 * unchanged.
 *
 *   node scripts/scale/catch-up.mjs [--db data/whetstone.db]
 *
 * Run it with the application stopped, then run scripts/recompute-hot.mts:
 * the feed's hot scores decay against the clock and were computed against
 * the old one.
 */

import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'

const MINUTE = 60_000

const flag = process.argv.indexOf('--db')
const file = path.resolve(process.cwd(), flag === -1 ? 'data/whetstone.db' : process.argv[flag + 1])
const db = new DatabaseSync(file)
db.exec('PRAGMA busy_timeout = 5000')

const built = db.prepare(`SELECT meta_value AS v FROM schema_meta WHERE meta_key = 'seeded_at'`).get()?.v
if (built === undefined) {
  console.error(`${file} has no seeded_at in schema_meta, so there is no build instant to move forward from.`)
  process.exit(1)
}
// Whole minutes, like the seed's own instant.
const shift = Math.floor((Date.now() - Number(built)) / MINUTE) * MINUTE
if (shift <= 0) {
  console.log(`  Already current: built ${new Date(Number(built)).toISOString()}.`)
  process.exit(0)
}

// Every timestamp in this schema is an INTEGER column whose name ends in
// `_at`, deadlines and expiry dates included, and they all move together.
const columns = []
for (const { name } of db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).all()) {
  const at = db.prepare(`PRAGMA table_info(${name})`).all()
    .filter((c) => c.name.endsWith('_at') && /INT/i.test(c.type))
    .map((c) => c.name)
  if (at.length > 0) columns.push([name, at])
}

db.exec('BEGIN IMMEDIATE')
try {
  let rows = 0
  for (const [table, at] of columns) {
    const set = at.map((c) => `${c} = ${c} + ${shift}`).join(', ')
    const where = at.map((c) => `${c} IS NOT NULL`).join(' OR ')
    rows += Number(db.prepare(`UPDATE ${table} SET ${set} WHERE ${where}`).run().changes)
  }
  db.prepare(`UPDATE schema_meta SET meta_value = ? WHERE meta_key = 'seeded_at'`).run(String(Number(built) + shift))
  db.exec('COMMIT')
  const by = shift >= 2 * 86_400_000 ? `${(shift / 86_400_000).toFixed(1)} days` : `${(shift / 3_600_000).toFixed(1)} hours`
  console.log(`  Moved ${String(rows)} rows across ${String(columns.length)} tables forward by ${by}.`)
  console.log(`  Built ${new Date(Number(built)).toISOString()}, now reads as ${new Date(Number(built) + shift).toISOString()}.`)
  console.log('  Next: node --experimental-strip-types scripts/recompute-hot.mts')
} catch (error) {
  db.exec('ROLLBACK')
  throw error
}

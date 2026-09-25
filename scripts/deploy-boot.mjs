/**
 * What has to be true before the server starts on a hosted machine.
 *
 * The community this product shows is generated, and the file it lives in is
 * 157 MB: too big for version control, so it is built during the image build
 * (`npm run db:bake`) and baked into the image at ./data/whetstone.db. A
 * container's own filesystem is thrown away on every deploy, so the copy that
 * people write to has to sit on a mounted volume instead.
 *
 * This runs at boot, before `next start`:
 *   1. If DATABASE_PATH already exists, leave it alone. That is the live
 *      database, with whatever members have written since the last deploy.
 *   2. Otherwise, copy the baked one into place, so a brand-new volume comes
 *      up with the full community rather than an empty shell.
 *   3. If there is no baked copy either (someone changed the build), build one
 *      in place. It takes minutes rather than seconds, and says so.
 *
 * It also refuses to start a production server whose session secret is missing
 * or is the development value, because a signed cookie is only as good as it.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const target = path.resolve(root, process.env.DATABASE_PATH ?? './data/whetstone.db')
const baked = path.join(root, 'data', 'whetstone.db')

const problem = (() => {
  const secret = process.env.AUTH_SECRET?.trim()
  if (process.env.NODE_ENV !== 'production') return null
  if (!secret) return 'AUTH_SECRET is not set. Generate one with: openssl rand -base64 48'
  if (secret.length < 32) return `AUTH_SECRET is ${String(secret.length)} characters; use at least 32.`
  return null
})()
if (problem) {
  console.error(`whetstone: ${problem}`)
  process.exit(1)
}

fs.mkdirSync(path.dirname(target), { recursive: true })

if (fs.existsSync(target) && fs.statSync(target).size > 0) {
  const mb = (fs.statSync(target).size / 1e6).toFixed(0)
  console.log(`whetstone: database ready at ${target} (${mb} MB)`)
} else if (baked !== target && fs.existsSync(baked)) {
  const started = Date.now()
  fs.copyFileSync(baked, target)
  const mb = (fs.statSync(target).size / 1e6).toFixed(0)
  console.log(`whetstone: seeded ${target} from the baked database (${mb} MB in ${String(Date.now() - started)} ms)`)
} else {
  console.log('whetstone: no database found and none baked into the image; building one now (several minutes)')
  execFileSync('npm', ['run', 'db:bake'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_PATH: target },
  })
  console.log(`whetstone: database built at ${target}`)
}

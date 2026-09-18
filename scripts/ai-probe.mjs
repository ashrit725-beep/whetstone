/**
 * Drive the AI endpoints the way a signed-in browser does.
 *
 * The API routes are guarded by a double-submit CSRF token and a session
 * cookie, neither of which a bare curl can mint, so this signs in through the
 * real form and then calls the routes from inside the page. What comes back is
 * what a reviewer would actually get, including the deterministic answer a
 * feature falls back to when a provider refuses.
 *
 *   node scripts/ai-probe.mjs
 */
import puppeteer from 'puppeteer-core'
import { DatabaseSync } from 'node:sqlite'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE ?? 'http://localhost:4311'

const db = new DatabaseSync('data/whetstone.db')
const me = db.prepare("SELECT id FROM users WHERE email_normalized = 'mira@brinehollow.dev'").get().id
const project = db.prepare(
  `SELECT p.id, p.slug FROM projects p
    WHERE p.owner_id <> ? AND p.status = 'published' AND p.visibility = 'public'
    ORDER BY p.hot_score DESC LIMIT 1`,
).get(me)

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
const page = await browser.newPage()
await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle2' })
await page.type('input[type="email"], input[name="email"]', 'mira@brinehollow.dev')
await page.type('input[type="password"], input[name="password"]', 'whetstone')
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
  page.click('button[type="submit"]'),
])
console.log(page.url().includes('/sign-in') ? '  SIGN IN FAILED' : '  signed in')

const call = (path, body) =>
  page.evaluate(async (path, body) => {
    const csrf = document.cookie.split('; ').find((c) => c.startsWith('ws_csrf='))?.slice(8) ?? ''
    const started = performance.now()
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ws-csrf': csrf },
      body: JSON.stringify(body),
    })
    return { status: res.status, ms: Math.round(performance.now() - started), json: await res.json() }
  }, path, body)

const mine = db.prepare(
  `SELECT id, slug FROM projects WHERE owner_id = ? AND status = 'published' ORDER BY hot_score DESC LIMIT 1`,
).get(me)

const cases = [
  // Under the minimum draft length, so it never reaches a model. The linter's
  // own verdict is the answer, which is the cheap path working as designed.
  ['coach, a draft too thin to be worth a model call', '/api/ai/coach',
    { draftId: 'probe-thin', projectId: project.id, draft: 'its good i liked it' }],
  ['coach, a long draft the linter is unhappy with', '/api/ai/coach',
    { draftId: 'probe-vague', projectId: project.id,
      draft: 'Honestly this is pretty nice overall and I think it works well. The design feels good and I liked using it. There are a few things that could maybe be better but nothing major stands out to me right now. Good job on this, it seems solid and I would probably use it again sometime.' }],
  ['coach, a draft that already does the job', '/api/ai/coach',
    { draftId: 'probe-good', projectId: project.id,
      draft: 'I installed it on a clean machine and ran the first command with a timer going. It took 94 seconds before anything useful happened, and most of that was waiting on a step that printed nothing to the terminal. When I passed a bad path it told me the path was bad but not which flag it came from, so I had to read the source to work out which of the three it meant.' }],
  ['intake, turning a description into a project', '/api/ai/intake',
    { description: 'A command line tool that migrates database schemas and can be run twice without doing damage. It is for small teams with no dedicated operations person. I am unsure whether the dry run output is readable enough.',
      askAnswers: { stage: 'beta', decision: 'Idempotent by default, even when it costs speed.' } }],
  ['cluster, themes across my own project', '/api/ai/cluster', { projectId: mine.id }],
]

for (const [label, path, body] of cases) {
  try {
    const r = await call(path, body)
    const j = r.json
    const shape = j.ok === false
      ? `error ${j.error?.code}: ${String(j.error?.message).slice(0, 80)}`
      : JSON.stringify(j.data ?? j).slice(0, 320)
    const prov = j.ok === false ? '' : `  [source ${JSON.stringify(j.data?.source ?? j.data?.suggestion?.source ?? j.data?.report?.source ?? '?')}, degraded ${JSON.stringify(j.data?.degraded ?? j.data?.suggestion?.degraded ?? j.data?.report?.degraded ?? null)}, model ${JSON.stringify(j.data?.model ?? j.data?.suggestion?.model ?? j.data?.report?.model ?? null)}]`
    console.log(`  ${String(r.status).padEnd(4)} ${String(r.ms + 'ms').padStart(8)}  ${label}${prov}\n         ${shape}\n`)
  } catch (e) {
    console.log(`  ERR        ${label}: ${String(e).slice(0, 140)}\n`)
  }
  // Every AI route carries a per-caller floor between requests.
  await new Promise((r) => setTimeout(r, 6000))
}

await browser.close()

/**
 * Every internal link the signed-in app renders, followed.
 *
 * Three whole classes of dead link shipped here without anyone noticing: the
 * notification bell pointed at `/projects/…` and `/community/…` where the routes
 * are `/p/…` and `/c/…`, the dashboard prefetched `/p/:slug/tracker` and
 * `/dashboard/inbox/:id` which are not routes, and an empty state built an href
 * from an optional slug and produced `/p/`. None of them fail a build, a type
 * check or a page render. They only fail a reader.
 *
 * This crawls a set of pages as a signed-in reader, collects every same-origin
 * href, and fetches each one with the session cookie. Anything that is not 2xx
 * or a sign-in redirect is reported with the page that linked to it.
 *
 *   BASE=http://localhost:4311 node scripts/check-links.mjs
 */
import puppeteer from 'puppeteer-core'
import { DatabaseSync } from 'node:sqlite'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE ?? 'http://localhost:4311'
const db = new DatabaseSync(process.env.DB ?? 'data/whetstone.db')

const one = (sql) => db.prepare(sql).get()
const busiest = one(
  `SELECT p.slug FROM projects p JOIN project_stats s ON s.project_id = p.id
    ORDER BY s.feedback_count DESC LIMIT 1`,
).slug
const thread = one(
  `SELECT c.slug AS channel, t.id FROM discussion_threads t
     JOIN discussion_channels c ON c.id = t.channel_id
    ORDER BY t.post_count DESC LIMIT 1`,
)

const PAGES = [
  '/', '/how-it-works', '/for-reviewers', '/legal/terms', '/legal/privacy',
  '/discover', '/search?q=tutorial', '/experts', '/bounties', '/c', '/c/craft',
  `/c/${thread.channel}/${thread.id}`,
  `/p/${busiest}`, `/p/${busiest}?notes=all`, `/p/${busiest}/versions`, `/p/${busiest}/playtest`,
  '/dashboard', '/dashboard/inbox', '/dashboard/insights', '/dashboard/suggestions',
  '/u/mira', '/u/mira/projects', '/u/mira/reviews', '/u/mira/reputation',
  '/settings/profile', '/settings/account', '/settings/notifications', '/new',
]

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', protocolTimeout: 120_000 })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000 })
await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle2' })
await page.type('input[name="email"], input[type="email"]', 'mira@brinehollow.dev')
await page.type('input[name="password"], input[type="password"]', 'whetstone')
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
  page.click('button[type="submit"]'),
])
const cookies = await browser.cookies()
const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

/** page -> the links it rendered */
const found = new Map()
for (const url of PAGES) {
  try {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle2', timeout: 60_000 })
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')]
        .map((a) => a.getAttribute('href') ?? '')
        .filter((h) => h.startsWith('/')))
    found.set(url, [...new Set(hrefs)])
  } catch (e) {
    found.set(url, [])
    console.log(`  could not load ${url}: ${String(e.message ?? e).slice(0, 80)}`)
  }
}
await browser.close()

// Also follow every link the notification bell would send somebody to, which is
// data rather than markup and so never appears in an href on a crawled page.
const notificationTargets = db
  .prepare('SELECT DISTINCT url FROM notifications WHERE url IS NOT NULL')
  .all()
  .map((r) => String(r.url))
found.set('(notifications table)', [...new Set(notificationTargets)])

const targets = new Map()
for (const [from, links] of found) {
  for (const href of links) {
    const clean = href.split('#')[0]
    if (clean.length === 0) continue
    if (!targets.has(clean)) targets.set(clean, from)
  }
}

console.log(`  ${targets.size} distinct internal links from ${String(found.size)} sources\n`)
const dead = []
for (const [href, from] of targets) {
  const res = await fetch(`${BASE}${href}`, {
    headers: { cookie: cookieHeader },
    redirect: 'manual',
  })
  const location = res.headers.get('location') ?? ''
  const ok = res.status < 400 || (res.status >= 300 && res.status < 400 && location.includes('/sign-in'))
  if (!ok) dead.push(`${String(res.status)}  ${href}   linked from ${from}`)
}

if (dead.length === 0) console.log('  every link resolves')
else {
  console.log(`  ${dead.length} dead links:`)
  for (const d of dead) console.log('   ' + d)
}
process.exit(dead.length === 0 ? 0 : 1)

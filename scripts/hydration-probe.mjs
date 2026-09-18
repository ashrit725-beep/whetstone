/**
 * Does any page hydrate with a mismatch?
 *
 * Point it at the production server, which is the build people actually get:
 *
 *   BASE=http://localhost:4311 PAGES=/discover,/c node scripts/hydration-probe.mjs
 *
 * React only names the offending node in development, so the production run
 * reports the minified code (#418, #423, #425) rather than the element. That is
 * enough to answer the question. If you need the element, run `next dev` on
 * another port and point BASE at it, then **run `npm run build` again before
 * doing anything else**: dev and start share the `.next` directory, so a dev run
 * replaces the production build and every chunk the running server serves goes
 * 404 with a text/html body. That mistake produced several hundred phantom
 * console errors in a verification sweep before anyone noticed.
 */
import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', protocolTimeout: 120000,
})
const p = await b.newPage()
const seen = []
p.on('console', (m) => { if (m.type() === 'error') seen.push(m.text()) })
p.on('pageerror', (e) => seen.push('pageerror: ' + String(e)))
await p.setViewport({ width: 1440, height: 900 })
const BASE = process.env.BASE ?? 'http://localhost:4312'
await p.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle2', timeout: 120000 })
await p.type('input[name="email"], input[type="email"]', 'mira@brinehollow.dev')
await p.type('input[name="password"], input[type="password"]', 'whetstone')
await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 }).catch(() => {}), p.click('button[type="submit"]')])
for (const url of (process.env.PAGES ?? '/discover').split(',')) {
  seen.length = 0
  await p.goto(`${BASE}${url}`, { waitUntil: 'networkidle2', timeout: 120000 })
  await new Promise((r) => setTimeout(r, 1500))
  const hyd = seen.filter((s) => /hydrat|did not match|#418|#423|#425/i.test(s))
  console.log(`\n=== ${url} ===`)
  if (hyd.length === 0) console.log('  no hydration mismatch')
  else for (const h of hyd) console.log('  ' + h.slice(0, 1400))
}
await b.close()

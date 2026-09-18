/**
 * Every page, at every width, checked but not photographed.
 *
 * shoot.mjs writes 216 full-page PNGs at 1.5x and takes hours; the checks it
 * runs on the way past are the part that actually finds things. This keeps
 * those — console errors, failed requests, and any element sticking out past
 * the viewport — and drops the file writing.
 *
 * It also uses a fresh browser per page. One long-lived Chrome wedged on
 * `Emulation.setDeviceMetricsOverride` partway through the landing page, which
 * killed the whole run; a page that hangs now costs one page.
 *
 *   THEME=dark node scripts/verify-pages.mjs
 */
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE ?? 'http://localhost:4311'
const THEME = process.env.THEME ?? 'dark'
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null

const WIDTHS = [
  { w: 1440, h: 900, tag: '1440' },
  { w: 1024, h: 800, tag: '1024' },
  { w: 768, h: 900, tag: '0768' },
  { w: 390, h: 844, tag: '0390' },
]

const PAGES = [
  { name: 'landing', url: '/' },
  { name: 'how-it-works', url: '/how-it-works' },
  { name: 'for-reviewers', url: '/for-reviewers' },
  { name: 'sign-in', url: '/sign-in', anon: true },
  { name: 'sign-up', url: '/sign-up', anon: true },
  { name: 'legal-terms', url: '/legal/terms' },
  { name: 'legal-privacy', url: '/legal/privacy' },
  { name: 'discover', url: '/discover' },
  { name: 'discover-filtered', url: '/discover?type=game&grit=1000' },
  { name: 'discover-needs', url: '/discover?need=playtesters' },
  { name: 'search', url: '/search?q=tutorial' },
  { name: 'project', url: 'FIRST_PROJECT' },
  { name: 'project-feedback', url: 'FIRST_PROJECT/feedback' },
  { name: 'project-versions', url: 'FIRST_PROJECT/versions' },
  { name: 'project-playtest', url: 'FIRST_PROJECT/playtest' },
  { name: 'dashboard', url: '/dashboard' },
  { name: 'dashboard-inbox', url: '/dashboard/inbox' },
  { name: 'dashboard-insights', url: '/dashboard/insights' },
  { name: 'dashboard-suggestions', url: '/dashboard/suggestions' },
  { name: 'profile', url: '/u/mirasolvang' },
  { name: 'experts', url: '/experts' },
  { name: 'bounties', url: '/bounties' },
  { name: 'discussions', url: '/c' },
  { name: 'channel', url: '/c/craft' },
  { name: 'channel-unanswered', url: '/c/playtesting?sort=unanswered' },
  { name: 'thread', url: 'FIRST_THREAD' },
  { name: 'thread-new', url: '/c/playtesting/new' },
  { name: 'new-project', url: '/new' },
  { name: 'settings', url: '/settings/profile' },
]

const OVERFLOW_PROBE = () => {
  // documentElement.scrollWidth counts the scrollbar track even when it is
  // hidden, which reads as a phantom 11px overflow at narrow widths. What
  // matters is whether any element sticks out past the viewport, measured
  // directly, ignoring anything a clipping or scrolling ancestor contains.
  const de = document.documentElement
  const vw = de.clientWidth
  let worst = 0
  let culprit = ''
  const contained = (el) => {
    for (let a = el.parentElement; a; a = a.parentElement) {
      const cs = getComputedStyle(a)
      const ar = a.getBoundingClientRect()
      const clips = (v) => v === 'hidden' || v === 'clip' || v === 'auto' || v === 'scroll'
      if (clips(cs.overflowX) || clips(cs.overflow)) {
        if (ar.right <= vw + 1 && ar.left >= -1) return true
      }
      if (cs.clipPath !== 'none' && ar.width <= 2) return true
    }
    return false
  }
  // Order matters for speed. getBoundingClientRect is one forced layout and
  // getComputedStyle on every ancestor is many, so the cheap geometry test
  // comes first and only the handful of elements that actually stick out pay
  // for the visibility and clipping checks. Doing it the other way round took
  // about ninety seconds a page.
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0) continue
    const over = Math.max(r.right - vw, -r.left)
    if (over <= 1 || over <= worst) continue
    if (!el.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true })) continue
    if (contained(el)) continue
    worst = over
    culprit = el.tagName.toLowerCase() +
      (typeof el.className === 'string' && el.className ? '.' + el.className.slice(0, 60) : '')
  }
  return { over: Math.round(Math.max(0, worst)), vw, culprit }
}

const launch = () =>
  puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    protocolTimeout: 180_000,
    args: ['--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb', '--font-render-hinting=none'],
  })

const problems = []
let checked = 0

// Sign in once and carry the cookies, so a fresh browser per page costs a
// launch rather than a round trip through the form.
let cookies = []
let firstProject = '/discover'
let firstThread = '/c/craft'
{
  const browser = await launch()
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle2', timeout: 60_000 })
  await page.type('input[type="email"], input[name="email"]', 'mira@brinehollow.dev')
  await page.type('input[type="password"], input[name="password"]', 'whetstone')
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60_000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ])
  if (page.url().includes('/sign-in')) problems.push('SIGN IN FAILED')
  cookies = await browser.cookies()
  await page.goto(`${BASE}/discover`, { waitUntil: 'networkidle2', timeout: 60_000 })
  const href = await page.evaluate(() => document.querySelector('a[href^="/p/"]')?.getAttribute('href') ?? null)
  if (href) firstProject = href
  // Ask the app which thread exists rather than pinning a uuid that a reseed
  // can invalidate without anyone noticing the page stopped being checked.
  await page.goto(`${BASE}/c/craft`, { waitUntil: 'networkidle2', timeout: 60_000 })
  const threadHref = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="/c/"]')]
      .map((x) => x.getAttribute('href') ?? '')
      .find((h) => h.split('/').filter(Boolean).length === 3) ?? null)
  if (threadHref) firstThread = threadHref
  await browser.close()
  console.log(`  signed in, first project ${firstProject}, first thread ${firstThread}`)
}

for (const p of PAGES) {
  if (ONLY && !ONLY.includes(p.name)) continue
  const url = p.url === 'FIRST_PROJECT' ? firstProject
    : p.url === 'FIRST_THREAD' ? firstThread
    : p.url.startsWith('FIRST_PROJECT') ? firstProject + p.url.slice('FIRST_PROJECT'.length)
    : p.url

  let browser
  try {
    browser = await launch()
    const page = await browser.newPage()
    if (!p.anon) await browser.setCookie(...cookies)
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: THEME }])
    await page.setCookie({ name: 'ws_theme', value: THEME, url: BASE, path: '/' })

    // Chrome's console line for a failed subresource names neither the URL nor
    // the element that asked for it, so the response listener does the naming
    // and the console listener drops the line it would otherwise duplicate.
    page.on('response', (r) => {
      if (r.status() < 400) return
      problems.push(`http ${p.name}: ${String(r.status())} ${r.request().resourceType()} ${r.url().slice(0, 120)}`)
    })
    page.on('console', (m) => {
      if (m.type() !== 'error') return
      const text = m.text()
      if (/Failed to load resource/.test(text)) return
      problems.push(`console ${p.name}: ${text.slice(0, 160)}`)
    })
    page.on('pageerror', (e) => problems.push(`pageerror ${p.name}: ${String(e).slice(0, 160)}`))
    page.on('requestfailed', (r) => {
      const u = r.url()
      if (u.startsWith('data:')) return
      // Next cancels a link prefetch when the page navigates away. That is the
      // normal end of a prefetch, not a failure.
      if (r.failure()?.errorText === 'net::ERR_ABORTED' && u.includes('_rsc=')) return
      problems.push(`net ${p.name}: ${r.failure()?.errorText} ${u.slice(0, 100)}`)
    })

    for (const v of WIDTHS) {
      await page.setViewport({ width: v.w, height: v.h })
      await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      // Walk the page so anything revealed on intersection has actually run.
      await page.evaluate(async () => {
        const step = window.innerHeight * 0.9
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 40))
        }
        window.scrollTo(0, 0)
        await new Promise((r) => setTimeout(r, 200))
      }).catch(() => {})
      await page.evaluate(() => document.fonts?.ready).catch(() => {})
      const o = await page.evaluate(OVERFLOW_PROBE)
      if (o.over > 1) problems.push(`OVERFLOW ${p.name} @${v.tag}: ${o.over}px past ${o.vw} via ${o.culprit}`)
      checked++
    }
    console.log(`  ok ${p.name}`)
  } catch (e) {
    problems.push(`FAILED ${p.name}: ${String(e.message ?? e).slice(0, 120)}`)
    console.log(`  FAILED ${p.name}`)
  } finally {
    await browser?.close().catch(() => {})
  }
}

fs.writeFileSync(`/tmp/verify-${THEME}.json`, JSON.stringify({ checked, problems }, null, 2))
console.log(`\n  ${checked} page renders checked in ${THEME}`)
if (problems.length === 0) console.log('  no console errors, no failed requests, no horizontal overflow')
else {
  console.log(`  ${problems.length} problems:`)
  for (const x of [...new Set(problems)].slice(0, 40)) console.log('   -', x)
}

import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE ?? 'http://localhost:4311'
const OUT = process.env.OUT ?? 'shots'
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null
const THEME = process.env.THEME ?? 'dark'   // 'dark' | 'light'

/** The four widths the design contract requires every page to survive. */
const ONLY_W = process.env.WIDTHS ? process.env.WIDTHS.split(',') : null
const ALL_WIDTHS = [
  { w: 1440, h: 900, tag: '1440' },
  { w: 1024, h: 800, tag: '1024' },
  { w: 768, h: 900, tag: '0768' },
  { w: 390, h: 844, tag: '0390' },
]
const WIDTHS = ONLY_W ? ALL_WIDTHS.filter((w) => ONLY_W.includes(String(w.w))) : ALL_WIDTHS

const PAGES = [
  { name: 'landing', url: '/', auth: false },
  { name: 'how-it-works', url: '/how-it-works', auth: false },
  { name: 'for-reviewers', url: '/for-reviewers', auth: false },
  { name: 'sign-in', url: '/sign-in', auth: false },
  { name: 'sign-up', url: '/sign-up', auth: false },
  { name: 'discover', url: '/discover', auth: true },
  { name: 'discover-filtered', url: '/discover?type=game&grit=1000', auth: true },
  { name: 'search', url: '/search?q=tutorial', auth: true },
  { name: 'project', url: 'FIRST_PROJECT', auth: true },
  { name: 'project-feedback', url: 'FIRST_PROJECT/feedback', auth: true },
  { name: 'project-versions', url: 'FIRST_PROJECT/versions', auth: true },
  { name: 'project-playtest', url: 'FIRST_PROJECT/playtest', auth: true },
  { name: 'dashboard', url: '/dashboard', auth: true },
  { name: 'dashboard-inbox', url: '/dashboard/inbox', auth: true },
  { name: 'dashboard-insights', url: '/dashboard/insights', auth: true },
  { name: 'dashboard-suggestions', url: '/dashboard/suggestions', auth: true },
  { name: 'profile', url: '/u/mirasolvang', auth: true },
  { name: 'experts', url: '/experts', auth: true },
  { name: 'bounties', url: '/bounties', auth: true },
  { name: 'discussions', url: '/c', auth: true },
  { name: 'channel', url: '/c/playtesting', auth: true },
  { name: 'channel-unanswered', url: '/c/craft?sort=unanswered', auth: true },
  { name: 'thread', url: 'FIRST_THREAD', auth: true },
  { name: 'thread-new', url: '/c/playtesting/new', auth: true },
  { name: 'new-project', url: '/new', auth: true },
  { name: 'settings', url: '/settings/profile', auth: true },
]

const log = (...a) => console.log(...a)

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none'],
  })

  const page = await browser.newPage()
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: THEME }])
  const problems = []

  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 200)}`)
  })
  page.on('pageerror', (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`))
  page.on('requestfailed', (r) => {
    const u = r.url()
    if (u.startsWith('data:')) return
    // Next prefetches every link in the viewport and cancels the request when
    // the page navigates away, which is the normal end of a prefetch rather
    // than a failure. Counting them buried the real ones.
    const aborted = r.failure()?.errorText === 'net::ERR_ABORTED'
    if (aborted && u.includes('_rsc=')) return
    problems.push(`net: ${r.failure()?.errorText} ${u.slice(0, 120)}`)
  })

  // --- sign in once, reuse the cookie -------------------------------------
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 })
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.setCookie({ name: 'ws_theme', value: THEME, url: BASE, path: '/' })
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle2', timeout: 120000 })
  await page.type('input[type="email"], input[name="email"]', 'mira@brinehollow.dev')
  await page.type('input[type="password"], input[name="password"]', 'whetstone')
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ])
  const signedIn = !page.url().includes('/sign-in')
  log(signedIn ? '  auth ok ->' : '  AUTH FAILED, still at', page.url())

  // --- resolve a real project slug ----------------------------------------
  let firstProject = '/discover'
  await page.goto(`${BASE}/discover`, { waitUntil: 'networkidle2', timeout: 120000 })
  const href = await page.evaluate(() => document.querySelector('a[href^="/p/"]')?.getAttribute('href') ?? null)
  if (href) firstProject = href
  log('  first project ->', firstProject)

  // The thread used to be a literal uuid, which survives a reseed only as long
  // as nobody renames the seeded thread it came from. Ask the running app which
  // thread exists instead.
  let firstThread = '/c'
  await page.goto(`${BASE}/c/craft`, { waitUntil: 'networkidle2', timeout: 120000 })
  const threadHref = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a[href^="/c/"]')]
      .map((x) => x.getAttribute('href') ?? '')
      .find((h) => h.split('/').filter(Boolean).length === 3)
    return a ?? null
  })
  if (threadHref) firstThread = threadHref
  log('  first thread  ->', firstThread)

  const manifest = []
  for (const p of PAGES) {
    if (ONLY && !ONLY.includes(p.name)) continue
    const url = p.url === 'FIRST_PROJECT' ? firstProject
      : p.url === 'FIRST_THREAD' ? firstThread
      : p.url.startsWith('FIRST_PROJECT') ? firstProject + p.url.slice('FIRST_PROJECT'.length)
      : p.url

    for (const v of WIDTHS) {
      const before = problems.length
      await page.setViewport({ width: v.w, height: v.h, deviceScaleFactor: 1.5 })
      try {
        await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle2', timeout: 120000 })
      } catch (e) {
        problems.push(`goto ${url} @${v.tag}: ${String(e).slice(0, 120)}`)
        continue
      }
      // Walk the page so anything revealed on intersection has actually been
      // seen. A fullPage screenshot never moves the viewport, so without this
      // every on-view element is captured in its hidden state.
      try {
        await page.evaluate(async () => {
          const step = window.innerHeight * 0.8
          for (let y = 0; y < document.body.scrollHeight; y += step) {
            window.scrollTo(0, y)
            await new Promise((r) => setTimeout(r, 90))
          }
          window.scrollTo(0, 0)
          await new Promise((r) => setTimeout(r, 300))
        })
      } catch { /* navigated away */ }

      // A signed-in visit to /sign-in redirects, which tears down the context
      // mid-evaluate. Settle, then retry once against the page we landed on.
      const settle = async () => {
        await page.evaluate(() => document.fonts?.ready)
        await new Promise((r) => setTimeout(r, 350))
        return page.evaluate(() => {
          // documentElement.scrollWidth includes the scrollbar track even when
          // --hide-scrollbars is on, which reads as a phantom 11px overflow at
          // narrow widths. What actually matters is whether any element sticks
          // out past the viewport, so measure that directly.
          const de = document.documentElement
          const vw = de.clientWidth
          let worst = 0
          let culprit = ''
          const clipped = (el) => {
            for (let a = el.parentElement; a; a = a.parentElement) {
              const cs = getComputedStyle(a)
              // A visually-hidden wrapper (the sr-only pattern) clips its child
              // to a 1px box. The child still reports its full layout width, so
              // an accessible data table beside a chart looks like a 600px
              // overflow when nothing is actually visible off-screen.
              const ar = a.getBoundingClientRect()
              // Anything inside a clipping ancestor cannot push the page wide:
              // the sr-only 1px box, and equally a deliberately-wide strip
              // inside an overflow-hidden frame. Only count the overhang that
              // escapes past the clip.
              // auto and scroll are scroll containers, so a wide child scrolls
              // inside them rather than widening the page. hidden and clip cut
              // it off. In all four cases the descendant is not page overflow.
              const contains = (v) => v === 'hidden' || v === 'clip' || v === 'auto' || v === 'scroll'
              if (contains(cs.overflowX) || contains(cs.overflow)) {
                if (ar.right <= vw + 1 && ar.left >= -1) return true
              }
              if (cs.clipPath !== 'none' && ar.width <= 2) return true
            }
            return false
          }
          for (const el of document.querySelectorAll('body *')) {
            const r = el.getBoundingClientRect()
            if (r.width === 0) continue
            if (!el.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true })) continue
            if (clipped(el)) continue
            const over = Math.max(r.right - vw, -r.left)
            if (over > worst) {
              worst = over
              culprit = el.tagName.toLowerCase() +
                (typeof el.className === 'string' && el.className ? '.' + el.className.slice(0, 60) : '')
            }
          }
          return { scrollW: Math.round(vw + Math.max(0, worst)), clientW: vw, culprit }
        })
      }
      let overflow
      try {
        overflow = await settle()
      } catch {
        await new Promise((r) => setTimeout(r, 600))
        try { overflow = await settle() } catch { overflow = null }
      }
      if (overflow && overflow.scrollW > overflow.clientW + 1) {
        problems.push(`OVERFLOW ${p.name} @${v.tag}: ${overflow.scrollW} > ${overflow.clientW} via ${overflow.culprit}`)
      }

      const file = path.join(OUT, `${p.name}-${v.tag}-${THEME}.png`)
      await page.screenshot({ path: file, fullPage: true })
      manifest.push({ page: p.name, width: v.w, file, newProblems: problems.length - before })
    }
    log(`  shot ${p.name}`)
  }

  fs.writeFileSync(path.join(OUT, `manifest-${THEME}.json`), JSON.stringify({ manifest, problems }, null, 2))
  await browser.close()

  log(`\n${manifest.length} screenshots -> ${OUT}/`)
  if (problems.length) {
    log(`\n${problems.length} PROBLEMS:`)
    for (const x of [...new Set(problems)].slice(0, 40)) log('  -', x)
  } else log('\nno console errors, no failed requests, no horizontal overflow')
}

main().catch((e) => { console.error(e); process.exit(1) })

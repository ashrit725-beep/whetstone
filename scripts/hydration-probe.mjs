/**
 * Does any page hydrate with a mismatch, and is the gate what keeps it from one?
 *
 *   BASE=http://localhost:4311 RUNS=20 node scripts/hydration-probe.mjs
 *
 * Two phases, because either one alone can pass for the wrong reason.
 *
 * Phase 1 — loads. Every run is a fresh browser context that signs in and then
 * loads each page in PAGES with a full navigation, watching for React's
 * hydration errors (#418 and its neighbours). The sign-in matters: `startSession`
 * calls `revalidatePath('/', 'layout')`, so the front page is rendered cold on
 * the next request and therefore *streamed* — the shell with its `loading.tsx`
 * skeleton in one flush, the page itself in another. That is the only condition
 * under which #418 was ever reproduced here, so the phase also counts the
 * documents that actually arrived in more than one flush and says so: a quiet
 * loop over pages that streamed nothing has proved nothing, and this reports
 * that rather than a pass. The default RUNS=20 over two pages is 40 loads.
 *
 * Phase 2 — reveal. Phase 1 is a race, and a race can be won by luck. React's
 * `$RC` marks a completed boundary's comment `$~`, pushes it onto `$RB`, and
 * parks the actual reveal (`$RV`) on `requestAnimationFrame` — and #418 needs
 * exactly one thing: hydration walking into a boundary while it is still `$~`.
 * So this phase kills `requestAnimationFrame` before the document's own scripts
 * run, which takes the browser's frame timing out of it and leaves
 * `HydrationGate` as the only thing that can ever apply the reveal. Then it
 * reads the boundary comments back. With the gate in place every boundary is
 * `$` with nothing left parked; with the gate replaced by a pass-through in
 * flight (see GATE=off below) every one of them stays `$~` with the page's
 * content still sitting in its `<div hidden>`. That is the gate doing the work,
 * rather than a frame that happened to land early. A page that throws in this
 * phase answers nothing — React rebuilds it from scratch and the comments go
 * with it — so it is reported as a mismatch and not counted as a reveal.
 *
 * Exit status is 1 if any load reported a hydration error, if any page in
 * phase 2 was left with an unrevealed boundary, or if nothing streamed, so this
 * can gate a change to the shell.
 *
 * GATE=off rewrites the layout chunk in the response to a pass-through, so the
 * same production build runs without the gate and phase 2 fails. Nothing on
 * disk is touched. It needs CHUNK to point at the built layout chunk, which
 * carries a content hash, so read the name out of `.next/static/chunks/app`
 * first; that is a diagnostic, not part of a normal run.
 *
 * React only names the offending node in development, so a production run
 * reports the minified code (#418, #423, #425) rather than the element. That is
 * enough to answer the question. If you need the element, point BASE at a dev
 * server started with its own NEXT_DIST_DIR — never at `.next`, because a dev
 * run there replaces the production build and every chunk the running server
 * serves then 404s with a text/html body.
 */
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = process.env.BASE ?? 'http://localhost:4311'
const RUNS = Number(process.env.RUNS ?? 20)
const PAGES = (process.env.PAGES ?? '/,/discover').split(',')
const EMAIL = process.env.EMAIL ?? 'mira@brinehollow.dev'
const PASSWORD = process.env.PASSWORD ?? 'whetstone'
const CHROME =
  process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const HYDRATION = /hydrat|did not match|#418|#421|#423|#425/i
const TIMEOUT = 300000

/* GATE=off only. The gate compiles to one function in the layout chunk; this is
   that function, rewritten to return its children and nothing else. */
const GATE_IN_CHUNK = /function \w\(e\)\{let\{children:n\}=e;if\("undefined"!=typeof document\).*?return n\}/s

function passthroughChunk() {
  const dir = path.join(process.cwd(), '.next/static/chunks/app')
  const name =
    process.env.CHUNK ?? fs.readdirSync(dir).find((file) => /^layout-[0-9a-f]+\.js$/.test(file))
  if (!name) throw new Error(`no built layout chunk under ${dir}`)
  const source = fs.readFileSync(path.join(dir, name), 'utf8')
  if (!GATE_IN_CHUNK.test(source)) {
    throw new Error(`HydrationGate not found in ${name}; the build predates it, or it changed shape`)
  }
  return source.replace(GATE_IN_CHUNK, 'function r(e){let{children:n}=e;return n}')
}

const gateOff = process.env.GATE === 'off'
const patched = gateOff ? passthroughChunk() : null

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  protocolTimeout: TIMEOUT,
})

/** A signed-in page in a context of its own, collecting errors into `seen`. */
async function signedInPage(seen) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  if (gateOff) {
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      if (request.url().includes('/_next/static/chunks/app/layout-')) {
        request.respond({
          status: 200,
          contentType: 'application/javascript; charset=utf-8',
          body: patched,
        })
        return
      }
      request.continue()
    })
  }
  page.on('console', (message) => {
    if (message.type() === 'error') seen.push('console: ' + message.text())
  })
  page.on('pageerror', (error) => seen.push('pageerror: ' + String(error)))

  await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle2', timeout: TIMEOUT })
  await page.type('input[type="email"]', EMAIL)
  await page.type('input[type="password"]', PASSWORD)
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: TIMEOUT }).catch(() => {}),
    page.click('button[type="submit"]'),
  ])
  return { context, page }
}

/** The state of every streaming boundary in the document, after the reveal. */
function boundaryState() {
  const marks = []
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT)
  for (let node = walk.nextNode(); node !== null; node = walk.nextNode()) {
    if (/^\$[~?!]?$/.test(node.data)) marks.push(node.data)
  }
  return { marks, parked: document.querySelectorAll('div[hidden][id^="S:"]').length }
}

const failures = []
let loads = 0
let streamed = 0

/* ------------------------------------------------------------- phase 1 --- */

for (let run = 0; run < RUNS; run++) {
  const seen = []
  const { context, page } = await signedInPage(seen)

  for (const route of PAGES) {
    seen.length = 0
    const response = await page.goto(`${BASE}${route}`, {
      waitUntil: 'networkidle2',
      timeout: TIMEOUT,
    })
    // The reveal React parks for a later frame lands within 300ms of the first
    // paint, so a load is only clean once it has been given that long.
    await new Promise((resolve) => setTimeout(resolve, 1200))
    loads += 1
    const html = (await response?.text()) ?? ''
    const flushes = (html.match(/\$RC\(/g) ?? []).length
    if (flushes > 0) streamed += 1
    const hydration = seen.filter((line) => HYDRATION.test(line))
    // A long run says where it is, so a stall is visible while it happens.
    process.stderr.write(
      `loads  run ${run} ${route} ${response?.headers()['x-nextjs-cache'] ?? '-'} ` +
        `flushed=${flushes + 1} ${hydration.length > 0 ? 'MISMATCH' : 'clean'}\n`,
    )
    if (hydration.length > 0) {
      failures.push({
        phase: 'loads',
        route,
        run,
        cache: response?.headers()['x-nextjs-cache'] ?? null,
        lines: hydration.map((line) => line.slice(0, 300)),
      })
    }
  }
  await context.close()
}

/* ------------------------------------------------------------- phase 2 --- */

const unrevealed = []
let revealChecked = 0

{
  const seen = []
  const { context, page } = await signedInPage(seen)
  // Sign-in is done; from here no frame ever arrives, so the parked reveal has
  // no way home except the gate.
  await page.evaluateOnNewDocument(() => {
    window.requestAnimationFrame = () => 0
  })

  for (const route of PAGES) {
    seen.length = 0
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: TIMEOUT })
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const state = await page.evaluate(boundaryState)
    const stuck = state.marks.filter((mark) => mark !== '$')
    const hydration = seen.filter((line) => HYDRATION.test(line))
    // A page that throws #418 is rebuilt from scratch on the client, which
    // takes the boundary comments with it: no marks at all is a thrown-away
    // document, not a revealed one, and it is the mismatch that is the news.
    const verdict =
      hydration.length > 0 ? 'MISMATCH' : stuck.length > 0 || state.parked > 0 ? 'UNREVEALED' : 'clean'
    process.stderr.write(
      `reveal run 0 ${route} boundaries=${state.marks.join(',') || 'none'} parked=${state.parked} ` +
        `${verdict}\n`,
    )
    if (verdict === 'UNREVEALED') {
      unrevealed.push({ route, marks: state.marks, parked: state.parked })
    }
    if (verdict === 'clean') revealChecked += 1
    if (hydration.length > 0) {
      failures.push({
        phase: 'reveal',
        route,
        run: 0,
        cache: null,
        lines: hydration.map((line) => line.slice(0, 300)),
      })
    }
  }
  await context.close()
}

await browser.close()

/* -------------------------------------------------------------- report --- */

console.log(
  `${loads} signed-in loads of ${PAGES.join(', ')} against ${BASE}` +
    (gateOff ? ' with HydrationGate patched out' : ''),
)
console.log(`${streamed} of them arrived in more than one flush`)

if (streamed === 0) {
  console.log(
    'nothing streamed, so this run tested nothing: the pages must be rendered cold ' +
      '(sign in first, or clear the route cache) for a boundary to be parked at all',
  )
  process.exitCode = 1
}

if (failures.length === 0) {
  console.log('no hydration mismatch')
} else {
  console.log(`${failures.length} load(s) reported one:`)
  for (const failure of failures) {
    console.log(`  ${failure.phase} ${failure.route} (run ${failure.run}, cache ${failure.cache ?? 'n/a'})`)
    for (const line of failure.lines) console.log('    ' + line)
  }
  process.exitCode = 1
}

if (unrevealed.length === 0 && revealChecked === PAGES.length) {
  console.log('every streamed boundary was revealed before hydration reached it')
} else if (unrevealed.length === 0) {
  console.log(
    `the reveal check answered for ${revealChecked} of ${PAGES.length} page(s); ` +
      'the rest threw before their boundaries could be read',
  )
} else {
  console.log(`${unrevealed.length} page(s) hydrated with a boundary still parked:`)
  for (const page of unrevealed) {
    console.log(`  ${page.route} boundaries=${page.marks.join(',')} parked=${page.parked}`)
  }
  process.exitCode = 1
}

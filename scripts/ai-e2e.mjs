/**
 * Every AI feature the product ships, run fresh through the running app.
 *
 * `ai-probe.mjs` shows what a caller gets back, which may be a cached answer.
 * This one busts every cache (a new draft id, a new description, `refresh` on
 * the rollup) and then reads `ai_run`, so the question it answers is the one an
 * operator asks after changing a key: did a model actually answer, which one,
 * and how long did it take.
 *
 *   cp data/whetstone.db /tmp/ui.db
 *   DATABASE_PATH=/tmp/ui.db npx next start -p 4311 &
 *   DB=/tmp/ui.db BASE=http://localhost:4311 node scripts/ai-e2e.mjs
 */
import puppeteer from 'puppeteer-core'
import { DatabaseSync } from 'node:sqlite'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE ?? 'http://localhost:4311'
const db = new DatabaseSync(process.env.DB ?? '/tmp/ui.db')
const started = Date.now()
const nonce = started.toString(36)

const me = db.prepare("SELECT id FROM users WHERE email_normalized = 'mira@brinehollow.dev'").get().id
const other = db.prepare(
  `SELECT id FROM projects WHERE owner_id <> ? AND status = 'published' AND visibility = 'public'
    ORDER BY hot_score DESC LIMIT 1`,
).get(me)
// The creator's project with the most notes, so the rollup has something to cluster.
const mine = db.prepare(
  `SELECT p.id, p.slug, COUNT(f.id) AS n FROM projects p JOIN feedback f ON f.project_id = p.id
    WHERE p.owner_id = ? AND p.status = 'published' AND f.status = 'submitted'
    GROUP BY p.id ORDER BY n DESC LIMIT 1`,
).get(me)

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', protocolTimeout: 180_000 })
const page = await browser.newPage()
page.setDefaultTimeout(120_000)
await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle2' })
await page.type('input[name="email"]', 'mira@brinehollow.dev')
await page.type('input[name="password"]', process.env.SEED_PASSWORD ?? 'whetstone')
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), page.click('button[type="submit"]')])
if (page.url().includes('/sign-in')) throw new Error('sign-in failed')

const call = (path, body) =>
  page.evaluate(async (path, body) => {
    const csrf = document.cookie.split('; ').find((c) => c.startsWith('ws_csrf='))?.slice(8) ?? ''
    const t = performance.now()
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-ws-csrf': csrf }, body: JSON.stringify(body) })
    return { status: res.status, ms: Math.round(performance.now() - t), json: await res.json() }
  }, path, body)

const results = []
const run = async (label, fn) => {
  try {
    const r = await fn()
    results.push({ label, ...r })
    console.log(`  ${r.ok ? 'pass' : 'FAIL'}  ${label}  ${r.detail}`)
  } catch (e) {
    results.push({ label, ok: false })
    console.log(`  FAIL  ${label}  ${String(e.message ?? e).slice(0, 200)}`)
  }
}
const sourceOf = (d) => d?.source ?? d?.suggestion?.source ?? d?.report?.source

await run('themes on page load: fast now, model board in the background', async () => {
  // This runs on a copy, so the project's stored boards can go: the page then
  // has nothing to reuse and must take the background path.
  //
  // The four ai_* tables belong to the AI layer and are created on its first
  // use (src/server/ai/store.ts), not by the product schema, so a fresh copy of
  // data/whetstone.db has none of them and this statement used to throw before
  // the first test had measured anything. Skip the clear when there is nothing
  // to clear.
  const hasArtifacts = db
    .prepare("SELECT 1 AS hit FROM sqlite_master WHERE type = 'table' AND name = 'ai_artifact'")
    .get()
  if (hasArtifacts) {
    db.prepare("DELETE FROM ai_artifact WHERE feature = 'themes' AND subject_id = ?").run(mine.id)
  }
  const second = mine
  const t = Date.now()
  // Timed to DOMContentLoaded: the page prefetches its sidebar links, and
  // waiting for the network to go quiet measures those, not this render.
  const res = await page.goto(`${BASE}/dashboard/insights?project=${second.id}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const firstMs = Date.now() - t
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 30_000 }).catch(() => {})
  const firstText = await page.evaluate(() => document.body.innerText)
  // Wait for the background run to leave an artifact.
  let artifact
  for (let i = 0; i < 60 && !artifact; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    artifact = db.prepare(
      "SELECT model, generated_at FROM ai_artifact WHERE feature = 'themes' AND subject_id = ? AND generated_at >= ?",
    ).get(second.id, t)
  }
  await page.goto(`${BASE}/dashboard/insights?project=${second.id}`, { waitUntil: 'networkidle2', timeout: 60_000 })
  const secondText = await page.evaluate(() => document.body.innerText)
  const named = /clustered by a model/i.test(secondText)
  return {
    ok: res?.status() === 200 && firstMs < 8000 && Boolean(artifact) && named && !/something went wrong/i.test(firstText + secondText),
    detail: `first load ${firstMs} ms (${/being grouped|replaces this one/i.test(firstText) ? 'says a model run is under way' : 'no pending note'}), background run ${artifact ? `${artifact.model} after ${Math.round((artifact.generated_at - t) / 1000)} s` : 'never finished'}, next load ${named ? 'shows the model board' : 'still local'}`,
  }
})

await run('coach', async () => {
  const r = await call('/api/ai/coach', {
    draftId: `e2e-${nonce}`, projectId: other.id,
    draft: 'Honestly this is pretty nice overall and I think it works well. The design feels good and I liked using it. There are a few things that could maybe be better but nothing major stands out to me right now. Good job on this, it seems solid.',
  })
  const d = r.json.data
  return { ok: r.status === 200 && d?.source === 'ai' && (d?.coaching?.suggestions?.length ?? 0) > 0,
    detail: `HTTP ${r.status}, ${r.ms} ms, source ${d?.source}, ${d?.coaching?.suggestions?.length ?? 0} suggestions` }
})

await run('intake', async () => {
  const r = await call('/api/ai/intake', {
    description: `A browser game about keeping a lighthouse lit through one winter night (${nonce}). You ration oil, trim the wick and log passing ships; the storm gets worse each hour. I am unsure whether the second hour drags.`,
    askAnswers: { stage: 'prototype', decision: 'Whether the oil ration is too generous.' },
  })
  const d = r.json.data
  const source = d?.source ?? d?.suggestion?.source
  const type = d?.suggestion?.projectType?.value ?? d?.suggestion?.data?.projectType?.value
  return { ok: r.status === 200 && source === 'ai' && Boolean(type),
    detail: `HTTP ${r.status}, ${r.ms} ms, source ${source}, type ${type}` }
})

await run('themes (the feedback rollup)', async () => {
  const r = await call('/api/ai/cluster', { projectId: mine.id, refresh: true })
  const d = r.json.data
  const themes = d?.report?.themes?.length ?? 0
  return { ok: r.status === 200 && d?.source === 'ai' && themes > 0,
    detail: `HTTP ${r.status}, ${r.ms} ms, source ${d?.source}, ${themes} themes over ${d?.itemsConsidered} notes${r.json.error ? ', ' + r.json.error.message : ''}` }
})

await run('digest: fast page, written brief drafted in the background', async () => {
  const t = Date.now()
  const res = await page.goto(`${BASE}/dashboard/insights?project=${mine.id}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const firstMs = Date.now() - t
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 30_000 }).catch(() => {})
  let row
  for (let i = 0; i < 45 && !row; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    row = db.prepare(
      "SELECT provider, model, status, latency_ms FROM ai_run WHERE feature = 'digest' AND created_at >= ? AND status = 'ok' ORDER BY created_at DESC LIMIT 1",
    ).get(t)
  }
  await page.goto(`${BASE}/dashboard/insights?project=${mine.id}`, { waitUntil: 'networkidle2', timeout: 60_000 })
  const text = await page.evaluate(() => document.body.innerText)
  const drafted = /drafted by a model/i.test(text)
  return {
    ok: res?.status() === 200 && firstMs < 8000 && row?.status === 'ok' && drafted && !/something went wrong/i.test(text),
    detail: `first load ${firstMs} ms, background ${row ? `${row.provider} ${row.model} in ${row.latency_ms} ms` : 'never ran'}, next load ${drafted ? 'shows the written brief' : 'still computed'}`,
  }
})

await browser.close()

console.log('\n  What answered (ai_run, this run only):')
for (const r of db.prepare(
  `SELECT feature, provider, model, status, latency_ms, error_code, cost_micros
     FROM ai_run WHERE created_at >= ? ORDER BY created_at`,
).all(started)) {
  console.log(`    ${r.feature.padEnd(8)} ${r.provider.padEnd(9)} ${r.model.padEnd(18)} ${r.status.padEnd(6)} ${String(r.latency_ms).padStart(6)} ms  $${(r.cost_micros / 1e6).toFixed(4)}${r.error_code ? '  ' + r.error_code : ''}`)
}
const failed = results.filter((r) => !r.ok).length
console.log(`\n  ${results.length - failed} of ${results.length} AI features answered from a model`)
process.exit(failed ? 1 : 0)

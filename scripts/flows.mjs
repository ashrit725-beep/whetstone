/**
 * The things a person actually does here, driven through the real interface.
 *
 * Route checks and screenshots say a page renders. They do not say a form
 * submits, an authorisation rule holds, or a counter moves. This signs in and
 * works through the product: write a review, reply to one, post to a channel,
 * create a project, vote, follow, bookmark. Each step asserts the effect in the
 * database rather than trusting the redirect.
 *
 * It writes rows, so point it at a copy of the database. The password reset
 * journey follows the link out of the message the server wrote, the way a
 * person would, so the server has to keep its mail in an outbox this script can
 * read, and SITE_URL has to be the address this script browses, because every
 * emailed link is built from it. Against a production build, exactly:
 *
 *   cp data/whetstone.db /tmp/flows.db && rm -rf /tmp/flows-outbox
 *   DATABASE_PATH=/tmp/flows.db MAIL_TRANSPORT=outbox MAIL_OUTBOX_DIR=/tmp/flows-outbox \
 *     SITE_URL=http://localhost:4313 npx next start -p 4313 &
 *   DB=/tmp/flows.db OUTBOX=/tmp/flows-outbox BASE=http://localhost:4313 node scripts/flows.mjs
 *
 * AUTH_SECRET comes from .env.local as it does for any `next start`. A provider
 * key in .env.local does not matter: MAIL_TRANSPORT=outbox wins over it.
 *
 *   BASE    the server's origin, and the server's SITE_URL (default http://localhost:4313)
 *   DB      the database file that server has open (default /tmp/flows.db)
 *   OUTBOX  that server's MAIL_OUTBOX_DIR (default /tmp/flows-outbox)
 */
import puppeteer from 'puppeteer-core'
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE ?? 'http://localhost:4313'
const OUTBOX = process.env.OUTBOX ?? '/tmp/flows-outbox'
const db = new DatabaseSync(process.env.DB ?? '/tmp/flows.db')
const count = (sql, ...p) => db.prepare(sql).get(...p).n
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Polls `read` until it returns something other than `from`, or the time is
 * up, and returns the last value. Next runs a page's Server Actions one at a
 * time, so a click made while an earlier action is still in flight waits its
 * turn: a fixed sleep counts too early on a slow server, and moving on
 * navigates away and cancels the queued request.
 */
const changed = async (read, from, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = read()
    if (value !== from || Date.now() > deadline) return value
    await pause(250)
  }
}

const results = []
const step = async (name, fn) => {
  try {
    const detail = await fn()
    results.push({ name, ok: true, detail })
    console.log(`  pass  ${name}${detail ? '  ' + detail : ''}`)
  } catch (e) {
    results.push({ name, ok: false, detail: String(e.message ?? e).slice(0, 160) })
    console.log(`  FAIL  ${name}  ${String(e.message ?? e).slice(0, 160)}`)
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg) }

/**
 * The first matching field inside the page's own form, not the first on the
 * page. The nav carries a search input on every screen, so an unscoped
 * `page.$('input')` types the thread title into the site search.
 */
const inForm = async (page, selector) => {
  const handle = await page.evaluateHandle((sel) => {
    for (const form of document.querySelectorAll('form')) {
      // Skip the chrome: the search form sits in the header.
      if (form.closest('header, nav')) continue
      const el = form.querySelector(sel)
      if (el) return el
    }
    return document.querySelector(sel)
  }, selector)
  return handle.asElement()
}

/** Click the submit button belonging to the same form as `el`. */
const submitFor = async (page, el) =>
  page.evaluate((node) => {
    const form = node.closest('form')
    const button = form?.querySelector('button[type="submit"], input[type="submit"]')
      ?? [...document.querySelectorAll('button[type="submit"]')].at(-1)
    button?.click()
  }, el)

/** The messages the server has written to its outbox, oldest first. */
const outbox = () => {
  let names = []
  try {
    // Only finished messages: the server writes under a dot-name and renames.
    names = readdirSync(OUTBOX).filter((n) => n.endsWith('.eml') && !n.startsWith('.')).sort()
  } catch {
    return []
  }
  return names.map((name) => ({ name, raw: readFileSync(join(OUTBOX, name), 'utf8') }))
}
const addressedTo = (message, email) =>
  message.raw.split(/\r?\n/).some((line) => line.toLowerCase() === `to: ${email.toLowerCase()}`)

/**
 * Messages to `email` that were not in `seen`. Mail leaves after the response
 * has gone (`after()`), so it is waited for rather than expected at once.
 */
const mailFor = async (email, seen, timeoutMs = 15_000) => {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const found = outbox().filter((m) => !seen.has(m.name) && addressedTo(m, email))
    if (found.length > 0 || Date.now() > deadline) return found
    await pause(250)
  }
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', protocolTimeout: 120_000 })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000 })
page.setDefaultTimeout(45_000)

const me = db.prepare("SELECT id, handle FROM users WHERE email_normalized = 'mira@brinehollow.dev'").get()

await step('sign in', async () => {
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle2' })
  await page.type('input[name="email"], input[type="email"]', 'mira@brinehollow.dev')
  await page.type('input[name="password"], input[type="password"]', 'whetstone')
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), page.click('button[type="submit"]')])
  expect(!page.url().includes('/sign-in'), `still on sign-in: ${page.url()}`)
  return `landed on ${new URL(page.url()).pathname}`
})

await step('the signed-in shell knows who I am', async () => {
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' })
  const text = await page.evaluate(() => document.body.innerText)
  expect(!/sign in/i.test(text.slice(0, 400)), 'the header still offers a sign-in')
  return 'dashboard reachable'
})

// --- writing a review ------------------------------------------------------
const target = db.prepare(
  `SELECT p.id, p.slug FROM projects p
    WHERE p.owner_id <> ? AND p.status = 'published' AND p.feedback_state = 'open'
      AND NOT EXISTS (SELECT 1 FROM feedback f WHERE f.project_id = p.id AND f.reviewer_id = ?)
    ORDER BY p.hot_score DESC LIMIT 1`,
).get(me.id, me.id)

await step('the feedback composer opens', async () => {
  await page.goto(`${BASE}/p/${target.slug}/feedback`, { waitUntil: 'networkidle2' })
  const fields = await page.$$('textarea, input[type="text"]')
  expect(fields.length > 0, 'no writable field on the composer')
  return `${String(fields.length)} fields on /p/${target.slug}/feedback`
})

await step('follow a project', async () => {
  const before = count('SELECT COUNT(*) n FROM project_follows WHERE user_id = ?', me.id)
  await page.goto(`${BASE}/p/${target.slug}`, { waitUntil: 'networkidle2' })
  const btn = await page.evaluateHandle(() => {
    const all = [...document.querySelectorAll('button')]
    return all.find((b) => /^follow\b/i.test(b.innerText.trim())) ?? null
  })
  const el = btn.asElement()
  expect(el, 'no Follow control on the project page')
  await el.click()
  const after = await changed(() => count('SELECT COUNT(*) n FROM project_follows WHERE user_id = ?', me.id), before)
  expect(after === before + 1, `follows went ${before} to ${after}`)
  return `project_follows ${before} to ${after}`
})

await step('bookmark a project', async () => {
  const before = count('SELECT COUNT(*) n FROM project_bookmarks WHERE user_id = ?', me.id)
  const btn = await page.evaluateHandle(() => {
    const all = [...document.querySelectorAll('button')]
    return all.find((b) => /^(save|bookmark)\b/i.test(b.innerText.trim())) ?? null
  })
  const el = btn.asElement()
  expect(el, 'no Save control on the project page')
  await el.click()
  const after = await changed(() => count('SELECT COUNT(*) n FROM project_bookmarks WHERE user_id = ?', me.id), before)
  expect(after === before + 1, `bookmarks went ${before} to ${after}`)
  return `project_bookmarks ${before} to ${after}`
})

// --- the core action: actually write a review ------------------------------
await step('write a first impression, blind', async () => {
  const before = count("SELECT COUNT(*) n FROM feedback WHERE reviewer_id = ? AND project_id = ?", me.id, target.id)
  await page.goto(`${BASE}/p/${target.slug}/feedback`, { waitUntil: 'networkidle2' })
  const box = await inForm(page, 'textarea')
  expect(box, 'no field on the blind first step')
  await box.type(
    'Installed it on a clean machine and ran the first command with a timer going. ' +
    'It was ninety four seconds before anything printed, and most of that was one step ' +
    'that said nothing at all. When I passed a bad path it told me the path was bad but ' +
    'not which of the three flags it came from.',
  )
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    submitFor(page, box),
  ])
  await new Promise((r) => setTimeout(r, 1500))
  const after = count("SELECT COUNT(*) n FROM feedback WHERE reviewer_id = ? AND project_id = ?", me.id, target.id)
  expect(after === before + 1, `no row written: ${before} to ${after}`)
  // Step one's impression becomes the note's headline; the points and the
  // summary come later, in step two.
  const row = db.prepare(
    'SELECT status, headline FROM feedback WHERE reviewer_id = ? AND project_id = ?',
  ).get(me.id, target.id)
  expect(/ninety four seconds/.test(row.headline ?? ''), `the text I typed is not in the row: ${String(row.headline).slice(0, 80)}`)
  return `feedback row written, status ${row.status}`
})

await step('the second step opens, carrying the impression forward', async () => {
  await page.goto(`${BASE}/p/${target.slug}/feedback`, { waitUntil: 'networkidle2' })
  const text = await page.evaluate(() => document.body.innerText)
  // Step two is the area-by-area pass: the step indicator moves, each area gets
  // its 1 to 5 rating, and the impression written blind is shown back rather
  // than thrown away.
  expect(/area by area/i.test(text), 'the step indicator did not move to the second step')
  expect(await page.$('input[type="radio"][name^="rating-"]'), 'the rating scale is not on the page')
  expect(/ninety four seconds/.test(text), 'the first impression was not carried forward')
  expect(/file it under/i.test(text), 'no category selector on the page')
  return 'step two carries the impression, the ratings and the categories'
})

// --- the community ---------------------------------------------------------
await step('start a discussion thread', async () => {
  const before = count("SELECT COUNT(*) n FROM discussion_threads WHERE author_id = ?", me.id)
  await page.goto(`${BASE}/c/craft/new`, { waitUntil: 'networkidle2' })
  const title = await inForm(page, 'input[name="title"], input[type="text"]')
  expect(title, 'no title field on the new-thread form')
  await title.type('Does the width axis still read at sixteen pixels?')
  // Posted as a question, so the accept-answer check below has one to work on.
  await page.evaluate(() => {
    document.querySelector('input[name="kind"][value="question"]')?.click()
  })
  const body = await inForm(page, 'textarea')
  expect(body, 'no body field on the new-thread form')
  await body.type('Asking because I have done this twice now and got a different answer each time. The constraint is time rather than money, if that changes the answer. What do you do?')
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    submitFor(page, body),
  ])
  await new Promise((r) => setTimeout(r, 1500))
  const after = count("SELECT COUNT(*) n FROM discussion_threads WHERE author_id = ?", me.id)
  expect(after === before + 1, `threads by me went ${before} to ${after}`)
  const kind = db.prepare('SELECT thread_kind AS k FROM discussion_threads WHERE author_id = ? ORDER BY created_at DESC LIMIT 1').get(me.id).k
  expect(kind === 'question', `the thread was filed as a ${kind}`)
  return `discussion_threads ${before} to ${after}, filed as a question`
})

await step('reply in a thread', async () => {
  const before = count('SELECT COUNT(*) n FROM discussion_posts WHERE author_id = ?', me.id)
  const thread = db.prepare(
    `SELECT t.id, c.slug FROM discussion_threads t JOIN discussion_channels c ON c.id = t.channel_id
      WHERE t.author_id <> ? ORDER BY t.hot_score DESC LIMIT 1`,
  ).get(me.id)
  await page.goto(`${BASE}/c/${thread.slug}/${thread.id}`, { waitUntil: 'networkidle2' })
  const box = await inForm(page, 'textarea')
  expect(box, 'no reply box on the thread')
  await box.type('Two things. I would do the opposite of what you are describing, and I could be wrong.')
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    submitFor(page, box),
  ])
  await new Promise((r) => setTimeout(r, 1500))
  const after = count('SELECT COUNT(*) n FROM discussion_posts WHERE author_id = ?', me.id)
  expect(after === before + 1, `posts by me went ${before} to ${after}`)
  return `discussion_posts ${before} to ${after}`
})

await step('a submit the schema refuses does not spend the posting allowance', async () => {
  // The thread limit is ten an hour with twenty seconds between two posts. Both
  // used to be charged on the way into the action, before anything was parsed,
  // so a title one character short cost a post and armed the cooldown: the
  // corrected submit came back "that is more than one account can post in a
  // short stretch". The charge now happens where the thread is written.
  //
  // The twenty seconds are real for an accepted post, so the clock is read from
  // the last thread this run wrote rather than assumed to have run out.
  const lastAt = db.prepare('SELECT MAX(created_at) AS t FROM discussion_threads WHERE author_id = ?').get(me.id).t ?? 0
  const wait = 21_000 - (Date.now() - lastAt)
  if (wait > 0) await pause(wait)

  const threads = () => count('SELECT COUNT(*) n FROM discussion_threads WHERE author_id = ?', me.id)
  const before = threads()

  const compose = async (title) => {
    await page.goto(`${BASE}/c/craft/new`, { waitUntil: 'networkidle2' })
    const field = await inForm(page, 'input[name="title"], input[type="text"]')
    expect(field, 'no title field on the new-thread form')
    await field.type(title)
    const body = await inForm(page, 'textarea')
    expect(body, 'no body field on the new-thread form')
    await body.type(
      'Reporting this the way it happened: the first submit came back with a field error, and the second one, ' +
      'with the title corrected and nothing else changed, has to be accepted rather than rate limited.',
    )
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
      submitFor(page, body),
    ])
    await pause(1500)
    return page.evaluate(() => document.body.innerText)
  }

  // Ten characters: under the twelve the schema asks for, and long enough that
  // nothing else about the form is at fault.
  const refused = await compose('Two lines')
  expect(/at least 12 characters/i.test(refused), `no field error for a short title: ${refused.replace(/\s+/g, ' ').slice(0, 160)}`)
  expect(threads() === before, 'the refused submit wrote a thread anyway')

  const accepted = await compose('Does the grit scale read the same way at 390 pixels?')
  expect(
    !/more than one account can post|faster than the site accepts/i.test(accepted),
    `the corrected submit was rate limited: ${accepted.replace(/\s+/g, ' ').slice(0, 200)}`,
  )
  const after = threads()
  expect(after === before + 1, `the corrected thread did not post: ${before} to ${after}`)
  return 'a field error costs no allowance and arms no cooldown; the corrected submit posts'
})

// --- authorisation, not just authentication --------------------------------
await step('I cannot overwrite somebody else\'s project', async () => {
  // The wizard's first step takes a draft id in a hidden field. It used to
  // resolve that id with no owner check and hand it to an UPDATE keyed on id
  // alone, so any signed-in account could rewrite the title and summary of any
  // project in the database. Project ids are public.
  const victim = db.prepare(
    `SELECT id, slug, title, summary_md FROM projects
      WHERE owner_id <> ? AND status = 'published' ORDER BY hot_score DESC LIMIT 1`,
  ).get(me.id)

  // The first wizard step is a type picker with no form; Basics is the step
  // that carries the hidden draft field, which is the one being attacked.
  await page.goto(`${BASE}/new?step=basics&type=game`, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 800))
  const injected = await page.evaluate((victimId) => {
    const forms = [...document.querySelectorAll('form')].filter((f) => !f.closest('header, nav'))
    const form = forms.find((f) => f.querySelector('input[name="title"], textarea'))
    if (!form) {
      return `no wizard form: ${String(forms.length)} forms, controls ${forms
        .map((f) => [...f.querySelectorAll('input,textarea')].map((e) => e.getAttribute('name')).join('|'))
        .join(' / ')}`
    }
    const hidden = document.createElement('input')
    hidden.type = 'hidden'
    hidden.name = 'draft'
    hidden.value = victimId
    form.appendChild(hidden)
    const set = (sel, value) => {
      const el = form.querySelector(sel)
      if (!el) return false
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement
      Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }
    // The grit scale writes through a hidden input held in React state. Without
    // a value the form fails validation and the request never reaches the
    // ownership check this test is about.
    set('input[name="grit"]', '1000')
    set('input[name="title"]', 'Defaced by a stranger')
    set('input[name="tagline"]', 'This should never be written.')
    set('textarea[name="summary"]',
      'A stranger who is not the owner of this project submitted the first wizard step with the hidden draft field pointing at it, which is the whole attack and it must be refused by the server rather than by the form.')
    return 'ok'
  }, victim.id)
  expect(injected === 'ok', injected)

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    page.evaluate(() => {
      const forms = [...document.querySelectorAll('form')].filter((f) => !f.closest('header, nav'))
      const form = forms.find((f) => f.querySelector('input[name="draft"]'))
      form?.querySelector('button[type="submit"]')?.click()
    }),
  ])
  await new Promise((r) => setTimeout(r, 2000))

  const after = db.prepare('SELECT title, summary_md FROM projects WHERE id = ?').get(victim.id)
  expect(after.title === victim.title, `the title was overwritten: "${after.title}"`)
  expect(after.summary_md === victim.summary_md, 'the summary was overwritten')

  // The row being untouched is not enough on its own: a form that never
  // submitted would leave it untouched too. The server has to have said no.
  const text = await page.evaluate(() => document.body.innerText)
  expect(
    /belongs to someone else/i.test(text),
    `the row survived but the server said nothing: ${text.slice(0, 200)}`,
  )
  return `${victim.slug} untouched, and the server refused in words`
})

await step('a stranger cannot open the dashboard', async () => {
  const anon = await browser.createBrowserContext()
  const p2 = await anon.newPage()
  const res = await p2.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' })
  const landed = new URL(p2.url()).pathname
  await anon.close()
  expect(landed.startsWith('/sign-in'), `signed-out visitor landed on ${landed} with ${String(res?.status())}`)
  return 'redirected to /sign-in'
})

await step('every protected page redirects before it renders a byte', async () => {
  // A page that answers 200 and then redirects from inside its own payload has
  // already flushed the shell and a skeleton, and with JavaScript off the
  // redirect arrives as a one-second meta refresh, which is a timed redirect
  // (WCAG 2.2.1). /bounties/new was the only one left: it has a loading.tsx, so
  // the response began before the page's own redirect() ran, and only the
  // middleware can answer earlier than that.
  const paths = ['/bounties/new', '/new', '/projects/new', '/dashboard', '/dashboard/inbox', '/notifications', '/settings/profile']
  const seen = []
  for (const path of paths) {
    const res = await fetch(`${BASE}${path}`, { redirect: 'manual' })
    const location = res.headers.get('location') ?? ''
    expect(res.status === 307, `${path} answered ${String(res.status)} rather than a 307`)
    expect(
      location.includes(`next=${encodeURIComponent(path)}`),
      `${path} redirected to ${location || '(nowhere)'} without a way back`,
    )
    seen.push(`${path} 307`)
  }
  return seen.join(', ')
})

await step('I cannot review my own project', async () => {
  const mine = db.prepare("SELECT slug FROM projects WHERE owner_id = ? AND status = 'published' LIMIT 1").get(me.id)
  await page.goto(`${BASE}/p/${mine.slug}/feedback`, { waitUntil: 'networkidle2' })
  const text = await page.evaluate(() => document.body.innerText)
  // The page's own words: "This is your project ... Whetstone does not let a
  // creator review their own build". Match the refusal, not a phrasing guess.
  const blocked = /this is your project|review their own|cannot review your own/i.test(text)
  const hasComposer = /write your first|submit|post (the )?feedback/i.test(text) && !blocked
  expect(blocked && !hasComposer, `the composer opened on my own project: ${text.slice(0, 180)}`)
  return 'refused, with a reason'
})


/**
 * Runs `act` with every Server Action POST from `p` passed through `rewrite`,
 * which gets the request body and returns the body to send instead, undefined
 * to send it unchanged, or null to refuse to send it at all. A tampering check
 * must never let the untampered request through by accident: that would be a
 * real write, which the check would then blame on the server.
 */
const withActionRewrite = async (p, rewrite, act) => {
  const seen = { sent: 0, blocked: 0 }
  const settle = (promise) => promise.catch(() => {}) // the page may have moved on
  const onRequest = async (request) => {
    if (request.method() !== 'POST' || !request.headers()['next-action']) {
      await settle(request.continue())
      return
    }
    const body = request.postData() ?? (request.hasPostData() ? await request.fetchPostData() : undefined) ?? ''
    const next = rewrite(body)
    if (next === null) {
      seen.blocked += 1
      await settle(request.abort())
      return
    }
    seen.sent += 1
    await settle(next === undefined ? request.continue() : request.continue({ postData: next }))
  }
  await p.setRequestInterception(true)
  p.on('request', onRequest)
  try {
    await act()
  } finally {
    p.off('request', onRequest)
    await p.setRequestInterception(false)
  }
  return seen
}

/**
 * Waits until React has attached its handlers to the first element matching
 * `selector` (and `text`, when given). `networkidle2` can fire before hydration
 * finishes, and a click on a control React has not reached yet does nothing.
 */
const whenHydrated = (p, selector, text) =>
  p.waitForFunction(
    (sel, source) => {
      const pattern = source ? new RegExp(source, 'i') : null
      const el = [...document.querySelectorAll(sel)].find((node) => !pattern || pattern.test(node.textContent ?? ''))
      return Boolean(el && Object.keys(el).some((key) => key.startsWith('__reactProps')))
    },
    { timeout: 30_000 },
    selector,
    text?.source ?? null,
  )

await step('marking a reply from another thread as the answer is refused', async () => {
  // The mark sends (threadId, postId) from the page. The post id used to be
  // looked up on its own, so any post on the site could be "accepted": the
  // question flipped to answered with nothing in it marked, and the stranger
  // who wrote the post was paid +15 reputation for it.
  //
  // The check needs one of my questions with somebody else's reply on it. The
  // question comes from the thread step above; the reply is written straight
  // into this throwaway copy, because what is under test is who may mark it.
  const mine = db.prepare(
    `SELECT id FROM discussion_threads WHERE author_id = ? AND thread_kind = 'question' AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 1`,
  ).get(me.id)
  if (mine && !db.prepare('SELECT 1 FROM discussion_posts WHERE thread_id = ? AND author_id <> ?').get(mine.id, me.id)) {
    const other = db.prepare("SELECT id FROM users WHERE id <> ? AND status = 'active' ORDER BY created_at LIMIT 1").get(me.id)
    db.prepare('INSERT INTO discussion_posts (id, thread_id, author_id, body_md, depth, created_at) VALUES (?, ?, ?, ?, 0, ?)').run(
      `flow-answer-${Date.now().toString(36)}`, mine.id, other.id,
      'At sixteen pixels it still reads if the stroke stays at 1.5px or heavier. Below that it merges with the label.',
      Date.now(),
    )
  }
  const question = db.prepare(
    `SELECT t.id, c.slug FROM discussion_threads t
       JOIN discussion_channels c ON c.id = t.channel_id
      WHERE t.author_id = ? AND t.thread_kind = 'question' AND t.deleted_at IS NULL
        AND t.status IN ('open', 'answered') AND c.is_private = 0 AND c.is_archived = 0
        AND EXISTS (SELECT 1 FROM discussion_posts p
                     WHERE p.thread_id = t.id AND p.deleted_at IS NULL AND p.is_accepted = 0)
      ORDER BY t.status = 'open' DESC, t.last_post_at DESC LIMIT 1`,
  ).get(me.id)
  expect(question, 'none of my questions has a reply that could be marked')
  const foreign = db.prepare(
    `SELECT id FROM discussion_posts
      WHERE thread_id <> ? AND author_id <> ? AND deleted_at IS NULL AND is_accepted = 0
      ORDER BY created_at DESC LIMIT 1`,
  ).get(question.id, me.id)
  const state = () => JSON.stringify({
    thread: db.prepare('SELECT status, accepted_post_id FROM discussion_threads WHERE id = ?').get(question.id),
    marked: db.prepare('SELECT id FROM discussion_posts WHERE thread_id = ? AND is_accepted = 1').all(question.id).map((r) => r.id),
    foreign: db.prepare('SELECT is_accepted FROM discussion_posts WHERE id = ?').get(foreign.id).is_accepted,
    paid: count("SELECT COUNT(*) AS n FROM reputation_events WHERE kind = 'accepted_answer' AND subject_id = ?", foreign.id),
  })
  const before = state()

  await page.goto(`${BASE}/c/${question.slug}/${question.id}`, { waitUntil: 'networkidle2' })
  const markLabel = /^\s*mark (as the answer|this one instead)/
  await whenHydrated(page, 'main button', markLabel).catch(() => {})
  const traffic = await withActionRewrite(
    page,
    (body) => {
      let args = null
      try { args = JSON.parse(body) } catch { return null }
      if (!Array.isArray(args) || args[0] !== question.id || typeof args[1] !== 'string') return null
      return JSON.stringify([question.id, foreign.id])
    },
    async () => {
      const clicked = await page.evaluate(() => {
        const button = [...document.querySelectorAll('main button')]
          .find((b) => /^mark (as the answer|this one instead)/i.test(b.innerText.trim()))
        button?.click()
        return Boolean(button)
      })
      expect(clicked, 'no "Mark as the answer" control on my own question')
      await page.waitForFunction(() => /could not be marked/i.test(document.body.innerText), { timeout: 15_000 }).catch(() => {})
    },
  )
  expect(traffic.sent === 1 && traffic.blocked === 0, `expected one rewritten mark, saw ${traffic.sent} sent and ${traffic.blocked} refused`)
  const after = state()
  expect(after === before, `the database moved: ${before} to ${after}`)
  const text = await page.evaluate(() => document.body.innerText)
  expect(/that reply could not be marked/i.test(text), 'the page did not say the mark was refused')
  return 'refused in words; status, the mark and reputation unchanged'
})

await step('a reply cannot be filed under a post in another thread', async () => {
  // The inline composer names the post being answered in a hidden field. That
  // id used to be trusted, so a reply could be hung under any post on the site.
  const thread = db.prepare(
    `SELECT t.id, c.slug FROM discussion_threads t
       JOIN discussion_channels c ON c.id = t.channel_id
      WHERE t.author_id <> ? AND t.deleted_at IS NULL AND t.status IN ('open', 'answered')
        AND c.is_private = 0 AND c.is_archived = 0
        AND EXISTS (SELECT 1 FROM discussion_posts p WHERE p.thread_id = t.id AND p.deleted_at IS NULL)
      ORDER BY t.hot_score DESC LIMIT 1 OFFSET 1`,
  ).get(me.id)
  const foreign = db.prepare(
    `SELECT id FROM discussion_posts WHERE thread_id <> ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
  ).get(thread.id)
  const mine = () => count('SELECT COUNT(*) AS n FROM discussion_posts WHERE author_id = ?', me.id)
  const before = mine()

  await page.goto(`${BASE}/c/${thread.slug}/${thread.id}`, { waitUntil: 'networkidle2' })
  await whenHydrated(page, 'main button[id^="reply-toggle-"]').catch(() => {})
  const opened = await page.evaluate(() => {
    const toggle = document.querySelector('main button[id^="reply-toggle-"]')
    toggle?.click()
    return Boolean(toggle)
  })
  expect(opened, 'no Reply control on any post in the thread')
  const box = await page.waitForSelector('main textarea[id^="reply-body-"]', { visible: true })
  await box.type('Nesting this under the right post matters more than it looks.')

  const traffic = await withActionRewrite(
    page,
    // The reply goes up as multipart form data, unchanged once the field has
    // been set. Anything not carrying the foreign id is not sent at all.
    (body) => (body.includes(foreign.id) ? undefined : null),
    async () => {
      // Set the field and submit in one task, so React has no render in
      // between in which to put the real parent back.
      await page.evaluate((foreignId) => {
        const form = document.querySelector('main textarea[id^="reply-body-"]').closest('form')
        form.querySelector('input[name="parentPostId"]').value = foreignId
        form.requestSubmit(form.querySelector('button[type="submit"]'))
      }, foreign.id)
      await page.waitForFunction(() => /was not posted/i.test(document.body.innerText), { timeout: 15_000 }).catch(() => {})
    },
  )
  expect(traffic.sent === 1, `expected the tampered reply to go out once, saw ${traffic.sent} sent and ${traffic.blocked} refused`)
  const text = await page.evaluate(() => document.body.innerText)
  expect(mine() === before, `a reply was written: my posts went ${before} to ${mine()}`)
  expect(count('SELECT COUNT(*) AS n FROM discussion_posts WHERE parent_post_id = ? AND author_id = ?', foreign.id, me.id) === 0, 'a reply hangs under the other thread\'s post')
  expect(/was not posted/i.test(text), 'the page did not say the reply was refused')
  return 'refused in words, nothing written'
})

await step('a shipped note cannot be credited to another project', async () => {
  // "Mark as shipped" sends the note and the build it went out in as hidden
  // fields, and the server checks both against the project. Without that, a
  // creator could credit a fix to somebody else's build, or resolve a note on
  // somebody else's project and notify its reviewer.
  const mine = db.prepare(
    `SELECT p.id, p.slug FROM projects p
      WHERE p.owner_id = ? AND p.status = 'published'
        AND EXISTS (SELECT 1 FROM project_versions v WHERE v.project_id = p.id)
      ORDER BY (SELECT COUNT(*) FROM feedback f WHERE f.project_id = p.id) DESC LIMIT 1`,
  ).get(me.id)
  expect(mine, 'none of my projects has a build to credit')
  const theirBuild = db.prepare(
    'SELECT id FROM project_versions WHERE project_id <> ? ORDER BY created_at DESC LIMIT 1',
  ).get(mine.id)
  const theirNote = db.prepare(
    `SELECT fp.id FROM feedback_points fp JOIN feedback f ON f.id = fp.feedback_id
      WHERE f.project_id <> ? AND fp.is_resolved = 0 ORDER BY fp.created_at DESC LIMIT 1`,
  ).get(mine.id)

  await page.goto(`${BASE}/p/${mine.slug}`, { waitUntil: 'networkidle2' })
  await whenHydrated(page, 'main details form textarea[name="note"]').catch(() => {})
  const pointId = await page.evaluate(() => {
    const summary = [...document.querySelectorAll('main details > summary')]
      .find((node) => /mark as shipped/i.test(node.textContent ?? ''))
    if (!summary) return null
    summary.parentElement.open = true
    return summary.parentElement.querySelector('input[name="pointId"]')?.value ?? null
  })
  expect(pointId, 'no "Mark as shipped" control on my own project')
  const state = () => JSON.stringify({
    suggestions: count('SELECT COUNT(*) AS n FROM suggestions WHERE project_id = ?', mine.id),
    creditedToTheirs: count('SELECT COUNT(*) AS n FROM suggestions WHERE shipped_in_version_id = ?', theirBuild.id),
    resolved: [pointId, theirNote.id].map((id) => db.prepare('SELECT is_resolved AS r FROM feedback_points WHERE id = ?').get(id).r),
    sourced: count('SELECT COUNT(*) AS n FROM suggestion_sources WHERE point_id IN (?, ?)', pointId, theirNote.id),
  })
  const before = state()

  const note = await page.$(`#ship-${pointId}`)
  await note.type('Cut the first-run pause to under ten seconds and named the flag in the path error.')
  const attempt = async (field, value, refusal) => {
    const traffic = await withActionRewrite(
      page,
      (body) => (body.includes(value) ? undefined : null),
      async () => {
        await page.evaluate(({ pointId, field, value }) => {
          const form = document.getElementById(`ship-${pointId}`).closest('form')
          form.querySelector(`input[name="${field}"]`).value = value
          form.requestSubmit(form.querySelector('button[type="submit"]'))
        }, { pointId, field, value })
        await page.waitForFunction((re) => new RegExp(re, 'i').test(document.body.innerText), { timeout: 15_000 }, refusal.source).catch(() => {})
      },
    )
    const text = await page.evaluate(() => document.body.innerText)
    expect(traffic.sent === 1, `the ${field} attempt went out ${traffic.sent} times, ${traffic.blocked} refused`)
    expect(refusal.test(text), `no refusal on the page after sending another project's ${field}`)
  }
  await attempt('versionId', theirBuild.id, /not one of this project/)
  await pause(2_500) // one shipped mark per two seconds
  await attempt('pointId', theirNote.id, /not on this project/)

  const after = state()
  expect(after === before, `the database moved: ${before} to ${after}`)
  return 'another build and another project\'s note both refused in words, nothing written'
})

await step('an invite-only build refuses a reviewer it did not invite', async () => {
  // "Invited reviewers only" used to post exactly like open feedback, so the
  // label promised a closed door that anyone with the link walked through. The
  // page has to say no, and so does the action behind it when the slug in the
  // first step's hidden field is swapped for the invite-only one.
  const closed = db.prepare(
    `SELECT p.id, p.slug FROM projects p
      WHERE p.feedback_state = 'invite_only' AND p.status = 'published' AND p.visibility = 'public'
        AND p.owner_id <> ?
        AND NOT EXISTS (SELECT 1 FROM project_collaborators c WHERE c.project_id = p.id AND c.user_id = ?)
        AND NOT EXISTS (SELECT 1 FROM feedback f WHERE f.project_id = p.id AND f.reviewer_id = ?)
        AND NOT EXISTS (SELECT 1 FROM bounty_awards ba JOIN bounties b ON b.id = ba.bounty_id
                         WHERE b.project_id = p.id AND ba.expert_id = ?)
        AND NOT EXISTS (SELECT 1 FROM test_invitations ti JOIN test_rounds tr ON tr.id = ti.round_id
                         WHERE tr.project_id = p.id AND ti.user_id = ?)
      ORDER BY p.hot_score DESC LIMIT 1`,
  ).get(me.id, me.id, me.id, me.id, me.id)
  expect(closed, 'no invite-only project to try')
  const open = db.prepare(
    `SELECT p.id, p.slug FROM projects p
      WHERE p.owner_id <> ? AND p.status = 'published' AND p.visibility = 'public'
        AND p.feedback_state = 'open' AND p.id <> ?
        AND NOT EXISTS (SELECT 1 FROM project_collaborators c WHERE c.project_id = p.id AND c.user_id = ?)
        AND NOT EXISTS (SELECT 1 FROM feedback f WHERE f.project_id = p.id AND f.reviewer_id = ?)
      ORDER BY p.hot_score DESC LIMIT 1`,
  ).get(me.id, target.id, me.id, me.id)
  const mine = () => count(
    'SELECT COUNT(*) AS n FROM feedback WHERE reviewer_id = ? AND project_id IN (?, ?)',
    me.id, closed.id, open.id,
  )
  const before = mine()

  await page.goto(`${BASE}/p/${closed.slug}/feedback`, { waitUntil: 'networkidle2' })
  const page1 = await page.evaluate(() => ({
    text: document.querySelector('main')?.innerText ?? '',
    fields: document.querySelectorAll('main textarea').length,
  }))
  expect(/reviewed by invitation/i.test(page1.text), `the composer page did not refuse: ${page1.text.slice(0, 160)}`)
  expect(page1.fields === 0, `the refusal still offers ${page1.fields} writable fields`)

  await page.goto(`${BASE}/p/${open.slug}/feedback`, { waitUntil: 'networkidle2' })
  await whenHydrated(page, 'main form textarea[name="impression"]').catch(() => {})
  const box = await page.$('main form textarea[name="impression"]')
  expect(box, `no first-impression field on /p/${open.slug}/feedback`)
  await box.type('Opened it from the link in the channel and read the whole first screen before touching anything.')
  const traffic = await withActionRewrite(
    page,
    // Multipart, sent unchanged once the field is set. Anything still naming
    // the open project is not sent at all, so nothing is written there either.
    (body) => (body.includes(`\r\n\r\n${closed.slug}\r\n`) ? undefined : null),
    async () => {
      // One task, so the timer's next render cannot put the real slug back.
      await page.evaluate((slug) => {
        const form = document.querySelector('main form textarea[name="impression"]').closest('form')
        form.querySelector('input[name="slug"]').value = slug
        form.requestSubmit(form.querySelector('button[type="submit"]'))
      }, closed.slug)
      await page.waitForFunction(() => /invited reviewers only/i.test(document.body.innerText), { timeout: 15_000 }).catch(() => {})
    },
  )
  expect(traffic.sent === 1, `the swapped slug went out ${traffic.sent} times, ${traffic.blocked} refused`)
  const text = await page.evaluate(() => document.body.innerText)
  expect(/invited reviewers only/i.test(text), 'the page did not say the step was refused')
  expect(mine() === before, `a review was started: ${before} to ${mine()}`)
  return `/p/${closed.slug}/feedback refuses, and its slug in another composer is refused in words`
})

await step('a write that cannot show where it came from is refused', async () => {
  // Every browser sends Origin or Sec-Fetch-Site with a POST. A request with
  // neither and no ws_csrf cookie used to be waved through to the handler.
  // Node's fetch sends neither, which makes it the forged request.
  const url = `${BASE}/api/projects/${target.id}/follow`
  const init = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ following: true }) }
  const bare = await fetch(url, init)
  const bareCode = (await bare.json().catch(() => null))?.error?.code
  expect(bare.status === 403 && bareCode === 'CSRF_FAILED', `a request with no origin got ${bare.status} ${String(bareCode)}`)

  // The same request naming this site gets past that check and stops at the
  // next one, because nobody is signed in. So the refusal above was the origin.
  const same = await fetch(url, { ...init, headers: { ...init.headers, origin: new URL(BASE).origin } })
  const sameCode = (await same.json().catch(() => null))?.error?.code
  expect(same.status === 401 && sameCode === 'UNAUTHENTICATED', `a same-origin request got ${same.status} ${String(sameCode)}`)

  const out = await fetch(`${BASE}/api/auth/sign-out`, { method: 'POST', redirect: 'manual' })
  expect(out.status === 403, `sign-out with no origin answered ${out.status}`)
  return 'no origin 403, same origin 401 for want of a session, sign-out 403'
})

await step('the caller cannot decide whether the cookies are marked Secure', async () => {
  // Both cookies used to take that decision from `x-forwarded-proto`, a header
  // whoever sends the request writes. An HTTPS deployment with no SITE_URL,
  // behind a terminator that forwards the scheme under another name, issued the
  // session and CSRF cookies without Secure and the browser then sent the
  // session in cleartext. The answer now comes from the deployment's own
  // configuration: this server's SITE_URL is http, so the attribute is off, and
  // nothing a caller writes may turn it on.
  const secureOf = async (headers) => {
    const res = await fetch(`${BASE}/discover`, { headers, redirect: 'manual' })
    const csrf = res.headers.getSetCookie().filter((c) => c.startsWith('ws_csrf='))
    expect(csrf.length === 1, `expected one ws_csrf cookie, saw ${csrf.length}`)
    return /;\s*secure/i.test(csrf[0])
  }
  const plain = await secureOf({})
  const spoofed = await secureOf({ 'x-forwarded-proto': 'https' })
  const listed = await secureOf({ 'x-forwarded-proto': 'https, http' })
  const rewritten = await secureOf({ 'x-forwarded-host': 'whetstone.example' })
  expect(
    plain === spoofed && plain === listed && plain === rewritten,
    `a header moved the Secure flag: plain ${plain}, forwarded ${spoofed}, list ${listed}, host ${rewritten}`,
  )
  expect(plain === false, 'this server is reached over http, so Secure should be off')
  return 'Secure stays off over http, whatever the caller forwards'
})

await step('a stranger cannot follow or bookmark a private project', async () => {
  // Both controls carry the project's slug in a hidden field, and the actions
  // behind them resolved that slug with no visibility check: a signed-in
  // stranger could follow somebody's unpublished draft, and the follow then
  // delivered notifications naming a page they get a 404 on.
  //
  // Nothing in the seeded population is private, so the draft is written
  // straight into this throwaway copy. What is under test is who may act on it.
  const host = db.prepare(
    "SELECT owner_id, project_type_id, stage_key FROM projects WHERE owner_id <> ? LIMIT 1",
  ).get(me.id)
  const mark = Date.now().toString(36)
  const draft = { id: `flow-draft-${mark}`, slug: `flow-private-${mark}` }
  db.prepare(
    `INSERT INTO projects (id, owner_id, project_type_id, slug, title, tagline, summary_md,
                           stage_key, visibility, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'private', 'draft', ?, ?)`,
  ).run(
    draft.id, host.owner_id, host.project_type_id, draft.slug,
    'A draft nobody else may touch', 'Private until its owner publishes it.',
    'Written by scripts/flows.mjs so there is a private project to aim at. Its owner has not published it.',
    host.stage_key, Date.now(), Date.now(),
  )
  const rows = () =>
    count('SELECT COUNT(*) n FROM project_follows WHERE project_id = ?', draft.id) +
    count('SELECT COUNT(*) n FROM project_bookmarks WHERE project_id = ?', draft.id)
  expect(rows() === 0, 'the fixture draft already carries follows or bookmarks')

  // Reading it is refused, which is the part that was already right.
  const res = await page.goto(`${BASE}/p/${draft.slug}`, { waitUntil: 'networkidle2' })
  expect(res?.status() === 404, `a stranger opened the draft with ${String(res?.status())}`)

  // Writing it, from the controls on a project I can see, retargeted at the one
  // I cannot. The request is rewritten in flight rather than in the page, so a
  // control React re-rendered cannot quietly send the honest slug instead.
  await page.goto(`${BASE}/p/${target.slug}`, { waitUntil: 'networkidle2' })
  await whenHydrated(page, 'main form button[type="submit"]').catch(() => {})
  const press = (pattern) =>
    page.evaluate((source) => {
      const re = new RegExp(source, 'i')
      const button = [...document.querySelectorAll('main form button[type="submit"]')]
        .find((b) => re.test(b.innerText.trim()))
      button?.click()
      return Boolean(button)
    }, pattern.source)

  const traffic = await withActionRewrite(
    page,
    (body) => {
      if (!body.includes(target.slug)) return null
      // The state each form asks for rides in the body too, so both are set to
      // the state that would write a row rather than remove one.
      return body
        .split(target.slug).join(draft.slug)
        .replace(/name="saved"\r\n\r\nfalse/, 'name="saved"\r\n\r\ntrue')
        .replace(/name="following"\r\n\r\nfalse/, 'name="following"\r\n\r\ntrue')
    },
    async () => {
      expect(await press(/^(save|saved)$/), 'no Save control on a project I can see')
      await pause(2000)
      expect(await press(/^(follow|following)$/), 'no Follow control on a project I can see')
      await pause(2000)
    },
  )
  expect(
    traffic.sent === 2 && traffic.blocked === 0,
    `expected two retargeted writes, saw ${traffic.sent} sent and ${traffic.blocked} refused`,
  )
  const after = rows()
  expect(after === 0, `${after} follow or bookmark rows were written against a private draft`)
  return 'the draft 404s for a stranger, and both retargeted writes leave no row'
})

// --- accounts: the journeys a new person takes -----------------------------
// All of these run in their own browser contexts, so the signed-in page above
// is untouched. They write one account, which is why this runs on a copy.
const stamp = Date.now().toString(36)
const fresh = {
  name: 'Tove Aalders',
  handle: `tove${stamp}`,
  email: `tove.${stamp}@fieldmail.net`,
  password: 'harbour-lantern-47',
}

const signInAs = async (ctx, email, password, stay) => {
  const p = await ctx.newPage()
  await p.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle2' })
  await (await inForm(p, 'input[name="email"]')).type(email)
  await (await inForm(p, 'input[name="password"]')).type(password)
  if (stay) await p.click('#stay')
  await Promise.all([
    p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    submitFor(p, await inForm(p, 'input[name="password"]')),
  ])
  await new Promise((r) => setTimeout(r, 600))
  return p
}
const sessionCookie = async (p) => (await p.cookies()).find((c) => c.name === 'ws_session')

await step('the old password hash is upgraded on sign-in', async () => {
  const h = db.prepare('SELECT password_hash AS h FROM users WHERE id = ?').get(me.id).h
  expect(h.startsWith('scrypt$32768$8$3$'), `still stored as ${h.split('$').slice(0, 2).join('$')}…`)
  return 'scrypt N=2^15 r=8 p=3, parameters stored with the hash'
})

await step('sign up creates an account and signs it in', async () => {
  const ctx = await browser.createBrowserContext()
  const p = await ctx.newPage()
  await p.goto(`${BASE}/sign-up`, { waitUntil: 'networkidle2' })
  await (await inForm(p, 'input[name="displayName"]')).type(fresh.name)
  await (await inForm(p, 'input[name="handle"]')).type(fresh.handle)
  await (await inForm(p, 'input[name="email"]')).type(fresh.email)
  await (await inForm(p, 'input[name="password"]')).type(fresh.password)
  await new Promise((r) => setTimeout(r, 900)) // the handle check answers
  await Promise.all([
    p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    submitFor(p, await inForm(p, 'input[name="password"]')),
  ])
  await new Promise((r) => setTimeout(r, 600))
  const path = new URL(p.url()).pathname
  const user = db.prepare('SELECT id, password_hash AS h FROM users WHERE email_normalized = ?').get(fresh.email)
  const cookie = await sessionCookie(p)
  await ctx.close()
  expect(user, `no account row; the page is ${path}`)
  expect(!path.startsWith('/sign-up'), `still on ${path}`)
  expect(user.h.startsWith('scrypt$32768$'), 'the new hash does not carry current parameters')
  expect(cookie && !cookie.session, 'the new account was not given a lasting session')
  fresh.id = user.id
  return `@${fresh.handle} created, landed on ${path}`
})

await step('sign-up refuses a handle that is already taken', async () => {
  const ctx = await browser.createBrowserContext()
  const p = await ctx.newPage()
  await p.goto(`${BASE}/sign-up`, { waitUntil: 'networkidle2' })
  // The check runs from an effect, so a handle typed before hydration is never
  // checked at all. It then waits 400ms for typing to stop before it asks.
  await whenHydrated(p, 'input[name="handle"]').catch(() => {})
  await (await inForm(p, 'input[name="handle"]')).type(me.handle)
  await (await inForm(p, 'input[name="displayName"]')).click()
  await p.waitForFunction(() => /is taken/i.test(document.body.innerText), { timeout: 15_000 }).catch(() => {})
  const text = await p.evaluate(() => document.body.innerText)
  await ctx.close()
  expect(/taken/i.test(text), 'no "taken" message for an existing handle')
  return `@${me.handle} reported taken`
})

await step('a wrong password gets the generic refusal', async () => {
  const ctx = await browser.createBrowserContext()
  const p = await signInAs(ctx, fresh.email, 'not-the-password-1', false)
  const text = await p.evaluate(() => document.body.innerText)
  const path = new URL(p.url()).pathname
  await ctx.close()
  expect(path.startsWith('/sign-in'), `a wrong password signed in and went to ${path}`)
  expect(/email or password is incorrect/i.test(text), 'the refusal is missing or names which half was wrong')
  return 'refused without saying which field'
})

await step('without "stay signed in" the cookie ends with the browser', async () => {
  const ctx = await browser.createBrowserContext()
  const p = await signInAs(ctx, fresh.email, fresh.password, false)
  const cookie = await sessionCookie(p)
  await ctx.close()
  expect(cookie, 'no session cookie after signing in')
  expect(cookie.session, `the cookie outlives the browser (expires ${String(cookie.expires)})`)
  return 'browser-session cookie, 24-hour token'
})

await step('with "stay signed in" the cookie lasts thirty days', async () => {
  const ctx = await browser.createBrowserContext()
  const p = await signInAs(ctx, fresh.email, fresh.password, true)
  const cookie = await sessionCookie(p)
  await ctx.close()
  expect(cookie && !cookie.session, 'no lasting cookie')
  const days = (cookie.expires * 1000 - Date.now()) / 86_400_000
  expect(days > 29 && days < 31, `the cookie lasts ${days.toFixed(1)} days`)
  return `${days.toFixed(1)} days`
})

await step('signing out ends the session on the server, not just the cookie', async () => {
  const ctx = await browser.createBrowserContext()
  const p = await signInAs(ctx, fresh.email, fresh.password, false)
  const stolen = await sessionCookie(p)
  expect(stolen, 'did not sign in')
  await p.goto(`${BASE}/discover`, { waitUntil: 'networkidle2' })
  await p.click('[aria-label^="Account menu for"]')
  await p.waitForSelector('[role="menuitem"]')
  await p.evaluate(() => {
    const item = [...document.querySelectorAll('[role="menuitem"]')].find((n) => /sign out/i.test(n.textContent ?? ''))
    item?.click()
  })
  await new Promise((r) => setTimeout(r, 1500))
  const after = await sessionCookie(p)
  await ctx.close()
  expect(!after || after.value === '', 'the cookie is still set after signing out')

  // Replay the copied cookie in a clean browser.
  const thief = await browser.createBrowserContext()
  const t = await thief.newPage()
  await t.setCookie({ name: 'ws_session', value: stolen.value, url: BASE })
  await t.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' })
  const landed = new URL(t.url()).pathname
  await thief.close()
  expect(landed.startsWith('/sign-in'), `a copy of the signed-out cookie still opens ${landed}`)
  return 'a copied cookie is refused after sign-out'
})

let resetMessage = null

await step('forgot-password says the same thing for known and unknown addresses', async () => {
  const seen = new Set(outbox().map((m) => m.name))
  const nobody = `nobody.${stamp}@fieldmail.net`
  const ask = async (email) => {
    const ctx = await browser.createBrowserContext()
    const p = await ctx.newPage()
    await p.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle2' })
    const field = await inForm(p, 'input[name="email"]')
    if (!field) {
      const text = await p.evaluate(() => (document.querySelector('main') ?? document.body).innerText)
      await ctx.close()
      // The page offers no form when the server cannot deliver a link.
      throw new Error(
        /cannot be sent/i.test(text)
          ? 'the server has no mail transport; start it with MAIL_TRANSPORT=outbox as the top of this file says'
          : `no email field on /forgot-password: ${text.replace(/\s+/g, ' ').slice(0, 120)}`,
      )
    }
    await field.type(email)
    await submitFor(p, field)
    // The answer, or the refusal summary. Not "reset link": the submit button
    // says that too, so it would match before the request had even gone.
    await p.waitForFunction(() => /if an account exists|no link was sent/i.test(document.body.innerText), { timeout: 15_000 }).catch(() => {})
    const text = await p.evaluate(() => (document.querySelector('main') ?? document.body).innerText)
    await ctx.close()
    return text.replace(/\s+/g, ' ').trim()
  }
  const known = await ask(fresh.email)
  const unknown = await ask(nobody)
  expect(/if an account exists/i.test(known), `unexpected answer: ${known.slice(0, 140)}`)
  expect(known === unknown, 'the page reads differently for a registered address')
  const tokens = count("SELECT COUNT(*) AS n FROM auth_tokens WHERE user_id = ? AND purpose = 'password_reset'", fresh.id)
  expect(tokens === 1, `${tokens} reset tokens were created for the real account`)

  const mail = await mailFor(fresh.email, seen)
  expect(mail.length === 1, `${mail.length} messages reached ${OUTBOX} for the real account`)
  const stray = outbox().filter((m) => !seen.has(m.name) && addressedTo(m, nobody))
  expect(stray.length === 0, 'a message was written for an address with no account')
  resetMessage = mail[0]
  return `identical answers, one token issued, one message in the outbox (${mail[0].name})`
})

await step('the link in the reset message sets a new password once, and signs in', async () => {
  expect(resetMessage, 'there is no reset message to follow, so the step above failed first')
  // Read the link the way a person would, out of the message itself. Nothing
  // here looks at auth_tokens: the database only ever holds the link's digest.
  const link = /https?:\/\/[^\s"<>]+\/reset-password\?token=[A-Za-z0-9_-]+/.exec(resetMessage.raw)?.[0]
  expect(link, `the message carries no reset link: ${resetMessage.raw.slice(0, 200)}`)
  const origin = new URL(link).origin
  expect(
    origin === new URL(BASE).origin,
    `the link points at ${origin}, not ${new URL(BASE).origin}; the server's SITE_URL must be the address this script browses`,
  )
  const before = db.prepare('SELECT password_hash AS h FROM users WHERE id = ?').get(fresh.id).h

  const ctx = await browser.createBrowserContext()
  const p = await ctx.newPage()
  await p.goto(link, { waitUntil: 'networkidle2' })
  const next = 'quiet-meridian-2291'
  await (await inForm(p, 'input[name="password"]')).type(next)
  await Promise.all([
    p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    submitFor(p, await inForm(p, 'input[name="password"]')),
  ])
  await pause(600)
  const path = new URL(p.url()).pathname

  // The same link a second time is dead.
  await p.goto(link, { waitUntil: 'networkidle2' })
  const second = await p.evaluate(() => document.body.innerText)
  await ctx.close()

  const after = db.prepare('SELECT password_hash AS h FROM users WHERE id = ?').get(fresh.id).h
  expect(after !== before, 'the password did not change')
  expect(!path.startsWith('/reset-password'), `still on ${path} after resetting`)
  expect(/already been used|expired|request a new|no longer works/i.test(second), 'the link worked a second time')

  const ctx2 = await browser.createBrowserContext()
  const p2 = await signInAs(ctx2, fresh.email, next, false)
  const signedIn = !new URL(p2.url()).pathname.startsWith('/sign-in')
  await ctx2.close()
  expect(signedIn, 'the new password does not sign in')
  fresh.password = next
  return `followed the emailed link, landed on ${path}, link dead on reuse, new password works`
})

await step('a reset started from a page comes back to that page', async () => {
  // Signing in from /sign-in?next=… has always honoured the destination.
  // Resetting instead dropped it twice over: the "Reset your password" link was
  // a bare /forgot-password, and the action ended on an unconditional
  // /discover. Somebody sent to sign in from a project's composer, who reset
  // their password rather than remembering it, lost the page they came for.
  const wanted = `/p/${target.slug}`
  const seen = new Set(outbox().map((m) => m.name))
  const ctx = await browser.createBrowserContext()
  const p = await ctx.newPage()

  await p.goto(`${BASE}/sign-in?next=${encodeURIComponent(wanted)}`, { waitUntil: 'networkidle2' })
  const href = await p.evaluate(() => {
    const link = [...document.querySelectorAll('main a')].find((a) => /reset your password/i.test(a.textContent ?? ''))
    return link?.getAttribute('href') ?? null
  })
  expect(
    href !== null && href.includes(`next=${encodeURIComponent(wanted)}`),
    `the reset link drops the destination: ${String(href)}`,
  )

  await p.goto(`${BASE}${href}`, { waitUntil: 'networkidle2' })
  const field = await inForm(p, 'input[name="email"]')
  expect(field, 'no email field on /forgot-password')
  await field.type(fresh.email)
  await submitFor(p, field)
  await p.waitForFunction(() => /if an account exists|no link was sent/i.test(document.body.innerText), { timeout: 15_000 }).catch(() => {})

  const mail = await mailFor(fresh.email, seen)
  expect(mail.length === 1, `${mail.length} messages arrived for a second reset request`)
  const link = /https?:\/\/[^\s"<>]+\/reset-password\?[^\s"<>]+/.exec(mail[0].raw)?.[0]
  expect(link, `the second message carries no reset link: ${mail[0].raw.slice(0, 200)}`)
  expect(
    link.includes(`next=${encodeURIComponent(wanted)}`),
    `the emailed link lost the destination: ${link}`,
  )

  await p.goto(link, { waitUntil: 'networkidle2' })
  const password = 'tideline-archive-58'
  await (await inForm(p, 'input[name="password"]')).type(password)
  await Promise.all([
    p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    submitFor(p, await inForm(p, 'input[name="password"]')),
  ])
  await pause(800)
  const landed = new URL(p.url()).pathname
  await ctx.close()
  expect(landed === wanted, `the reset landed on ${landed} rather than ${wanted}`)
  fresh.password = password
  return `the destination survived the link, and the reset landed on ${wanted}`
})

await step('an off-origin destination is dropped rather than followed', async () => {
  // `?next=` now rides the sign-in URL, the sign-up link, the forgot form and
  // the emailed reset link, so each of those is a way to hand somebody a
  // Whetstone address that ends up somewhere else. `safeNextPath` is the single
  // gate: only a relative, same-origin path survives it, wherever it is read.
  const evil = 'https://evil.example/phish'
  const ctx = await browser.createBrowserContext()
  const p = await ctx.newPage()

  await p.goto(`${BASE}/forgot-password?next=${encodeURIComponent(evil)}`, { waitUntil: 'networkidle2' })
  const carried = await p.evaluate(() => [
    ...[...document.querySelectorAll('main a[href]')].map((a) => a.getAttribute('href') ?? ''),
    ...[...document.querySelectorAll('input[name="next"]')].map((i) => i.value),
  ])
  expect(
    !carried.some((value) => value.includes('evil.example')),
    `the reset form carries the off-origin value: ${JSON.stringify(carried.filter((v) => v.includes('evil')))}`,
  )

  await p.goto(`${BASE}/sign-in?next=${encodeURIComponent(evil)}`, { waitUntil: 'networkidle2' })
  await (await inForm(p, 'input[name="email"]')).type(fresh.email)
  await (await inForm(p, 'input[name="password"]')).type(fresh.password)
  await Promise.all([
    p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    submitFor(p, await inForm(p, 'input[name="password"]')),
  ])
  await pause(800)
  const landed = new URL(p.url())
  await ctx.close()
  expect(landed.origin === new URL(BASE).origin, `signing in left this site for ${landed.origin}`)
  expect(landed.pathname === '/discover', `an off-origin next sent the reader to ${landed.pathname}`)
  return 'the form drops it, and signing in with it lands on /discover'
})

await step('a generated member cannot be signed into with the old shared password', async () => {
  const other = db.prepare(
    "SELECT email FROM users WHERE password_hash IS NULL AND status = 'active' ORDER BY created_at LIMIT 1",
  ).get()
  expect(other, 'every account still has a password')
  const ctx = await browser.createBrowserContext()
  const p = await signInAs(ctx, other.email, 'whetstone', false)
  const path = new URL(p.url()).pathname
  await ctx.close()
  expect(path.startsWith('/sign-in'), `signed in as ${other.email}`)
  const withPassword = count('SELECT COUNT(*) AS n FROM users WHERE password_hash IS NOT NULL')
  return `refused; ${withPassword} accounts in this copy have a password`
})

await step('a closed account is told it is closed, not that its password is wrong', async () => {
  // Last, because it closes the account the steps above created. A closed
  // account used to hear "email or password is incorrect", which sent the
  // person to reset a password that was right — and the reset quietly issues no
  // link, because only an active account gets one. Saying this after the
  // password has verified tells somebody holding it nothing they did not know.
  db.prepare("UPDATE users SET status = 'deactivated', updated_at = ? WHERE id = ?").run(Date.now(), fresh.id)
  const ctx = await browser.createBrowserContext()
  const p = await signInAs(ctx, fresh.email, fresh.password, false)
  const path = new URL(p.url()).pathname
  const text = await p.evaluate(() => (document.querySelector('main') ?? document.body).innerText)
  await ctx.close()
  expect(path.startsWith('/sign-in'), `a closed account signed in and landed on ${path}`)
  expect(/account was closed/i.test(text), `the refusal does not say the account is closed: ${text.replace(/\s+/g, ' ').slice(0, 200)}`)
  expect(!/password is incorrect/i.test(text), 'the refusal still blames the password')
  // The summary is the sentence the action returned, not the form's standing
  // "Reset your password" link, which is correct to leave on the page.
  expect(/no undo/i.test(text), 'the refusal does not say what closing an account did')
  return 'refused with the reason the account cannot sign in'
})

await browser.close()
const failed = results.filter((r) => !r.ok).length
console.log(`\n  ${results.length - failed} of ${results.length} flows pass`)
process.exit(failed === 0 ? 0 : 1)

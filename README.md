# Whetstone

Creators post what they are building while it is still in progress. Reviewers
leave structured, category-scoped critique instead of "looks good". Creators see
where reviewers disagree, ship the fix, and the person whose feedback caused it
gets told.

Tagline: **Ship sharper.**

---

## Run it

```bash
npm install
cp .env.example .env.local     # then set AUTH_SECRET
npm run db:rebuild      # the hand-written content, the community around it, then the audit
npm run dev             # http://localhost:4300 (npm start serves a build on 4311)
```

Only `mira@brinehollow.dev` can sign in, with the password `whetstone` locally or
`SEED_PASSWORD` when set; the verification scripts sign in as that account. Every
other member is an author, not a login. See `design/SEED.md`.

A rebuild is current as of the minute it ran. `node --experimental-strip-types
scripts/recompute-hot.mts` ranks the feed afterwards, and `node
scripts/scale/catch-up.mjs` brings an older database forward to the present
(then recompute again). Both are described under "The population" below.

### Environment

| Variable | Required | Notes |
|---|---|---|
| `AUTH_SECRET` | Production only | `openssl rand -base64 48`. A development fallback is used when unset outside production. |
| `DATABASE_PATH` | No | Defaults to `./data/whetstone.db`. |
| `TRUST_PROXY_HEADERS` | No | Set to `1` behind a proxy that appends to `x-forwarded-for` (nginx's `$proxy_add_x_forwarded_for`), so rate limits key on the address the proxy saw. Every auth limit also has a cap that ignores the address, so a forged header cannot get around it. |
| `SEED_PASSWORD` | When building a production database | Password for the one seeded account that can sign in. Without it a production build gives that account no password. Every other seeded or generated member has no password and cannot sign in. |
| `SITE_URL` | Production, for mail | The public origin, e.g. `https://whetstone.example`. Emailed links are built from it and never from the request's Host header, so production sends no reset link without it. |
| `MAIL_FROM` | Production, for mail | The sender, on a domain the provider has verified: `Whetstone <no-reply@whetstone.example>`. |
| `RESEND_API_KEY` or `POSTMARK_SERVER_TOKEN` | Production, for mail | One provider key. With `SITE_URL` and `MAIL_FROM` it makes password reset work. Missing any of the three, a production server logs event `mail.unconfigured` at boot and `/forgot-password` says no link can be sent. Outside production, messages are written to the server's output instead. |
| `MAIL_TRANSPORT` | No | Set to `outbox` to write each message as an `.eml` file instead of emailing it, for a self-hosted instance with no provider and for the end-to-end flows. Never chosen on its own. A production server using it still needs `SITE_URL`, and logs event `mail.outbox` at boot, as a warning if a provider key is also set, since that key is then not used. |
| `MAIL_OUTBOX_DIR` | No | Where the outbox writes, default `./data/outbox`. One file per message, named oldest first, readable only by the server's user. Each holds a live reset link, so keep the directory private. |
| `ANTHROPIC_API_KEY` | No | First provider tried. |
| `OPENAI_API_KEY` | No | Second. The gpt-5 models are reasoning models, so each tier also sends a `reasoning_effort`. |
| `KIMI_API_KEY` | No | Moonshot, third, OpenAI-compatible. |

The three are tried in that order and the first one that answers wins, so a dead
key costs one refused request rather than a broken feature.

**The app is fully functional with zero AI keys configured.** Every AI feature has
a real deterministic implementation, not a disabled state: theme clustering falls
back to stemmed keyword clustering, duplicate detection to trigram similarity,
the quality coach to measurable specificity signals, sentiment to a lexicon. The
interface says which path produced a result rather than hiding it.

---

## Stack

- **Next.js 15** App Router, **React 19**, **TypeScript** strict with `noUncheckedIndexedAccess`
- **Tailwind CSS v4**, tokens only, no `tailwind.config.js`
- **SQLite** via Node's built-in `node:sqlite`, WAL mode, no native build step
- **Auth**, scrypt password hashing, HS256 session in an httpOnly cookie via `jose`, revocable server-side sessions
- No component library. All 48 primitives are hand-built on the platform.
- Motion is CSS first, `@starting-style`, `transition-behavior: allow-discrete`,
  one shared `IntersectionObserver` for every on-view reveal. `motion` is used
  only inside `src/components/motion/`, for the six pieces that genuinely need
  a timeline. Every one of them short-circuits under `prefers-reduced-motion`.

## Layout

```
design/          The design contract, specs, research, and playbook. Start with CONTRACT.md.
src/app/         Routes. (marketing) (auth) (app) route groups.
src/components/  ui/ = the 48 primitives. Everything else is surface-specific.
src/lib/         Framework-free helpers: auth, env, taxonomy, utils.
src/server/      db/ repos/ ai/ actions/ api/, server-only.
scripts/seed.ts  Idempotent seed: the hand-written content.
scripts/scale/   The population generator: 5,000 people and what they wrote.
scripts/audit.mjs        99 checks that every printed number matches its rows.
scripts/verify-pages.mjs Every page at 1440/1024/768/390, both themes.
scripts/flows.mjs        The things a person does, driven through the interface.
scripts/check-links.mjs  Every internal link the app renders, followed.
scripts/check-ai-schemas.mts  The tool schemas against OpenAI strict mode.
scripts/check-urls.mts   The href allowlist against javascript:, data: and friends.
scripts/check-css.mjs    Every custom property read is one that exists.
scripts/hydration-probe.mjs   Does any page hydrate with a mismatch.
scripts/ai-probe.mjs     Every AI feature, end to end, against the live keys.
scripts/shoot.mjs        The same page sweep, with screenshots, when you want to look.
```

## Checking it

```bash
npm run verify          # typecheck, build, data audit, AI schemas, href allowlist, css tokens
npm run verify:pages    # every page at four widths in both themes
npm run check:links     # every internal link, including the notification targets
BASE=http://localhost:4311 node scripts/hydration-probe.mjs

# The flows write rows, so give them a copy of the database. The password
# reset flow follows the link out of the message, so the server writes mail to
# an outbox, and SITE_URL has to be the address the flows browse.
cp data/whetstone.db /tmp/flows.db && rm -rf /tmp/flows-outbox
DATABASE_PATH=/tmp/flows.db MAIL_TRANSPORT=outbox MAIL_OUTBOX_DIR=/tmp/flows-outbox \
  SITE_URL=http://localhost:4313 npx next start -p 4313 &
DB=/tmp/flows.db OUTBOX=/tmp/flows-outbox BASE=http://localhost:4313 node scripts/flows.mjs
```

One hazard worth knowing: `next dev` and `next start` would share the `.next`
directory, and a dev server writing there replaces the production build
underneath a running `npm start`. Every chunk then 404s with an HTML body and the
browser console fills with MIME-type errors that look like a real fault. `npm run
dev` writes to `.next-dev` (`NEXT_DIST_DIR`) for that reason; a bare `npx next
dev` does not, so rebuild after one before verifying.

`audit.mjs` is the one to run after touching the seed or the generator. Every
denormalised counter in this schema can drift from the rows beneath it, and each
check counts the rows and compares. It caught six projects published before
their author had an account, and a reply counter on ten thousand notes with no
replies behind it.

## Design

The direction is called **Paper & Ink** and it is written down, not improvised.
`design/CONTRACT.md` is the source of truth: every hex, rem, millisecond, easing
curve and radius is literal, with measured WCAG contrast ratios for every
text-on-surface pair in both themes. `design/direction.md` records every
deviation from it and why.

The organising idea is a real data structure rather than an ornament: the **grit
index** (120 concept, 400 prototype, 1000 beta, 3000 release candidate, 8000
shipped) is rendered as an SVG hatch whose stroke narrows and whose spacing
halves at each step. It is the filter in Discover, the rail on a project page,
the selector in the composer, the axis in the dashboard rollup, and the history
strip on a profile. The feed sorts by it, so the number is data.

Type carries the division of labour and it is visible at a glance: **Bricolage
Grotesque** (variable, with the width axis worked as the headline device) for
machine chrome, **Newsreader** for anything a human wrote. A serif paragraph in
a row means there is a person in there.

## Accessibility

WCAG 2.2 AA is a build requirement, not a later pass. Every interactive element
ships eight states including a never-removed focus ring, 44×44px hit areas, real
semantics, a non-dragging path for every dragging action (2.5.7), paste allowed
on every auth field (3.3.8), and a `prefers-reduced-motion` path for every
animation. `design/CONTRACT.md` §9 is the pre-ship gate.

## Security notes

- Sessions are revocable server-side; the cookie alone is not authority.
- Every mutating route is rate limited and authorisation-checked against the
  actor and the resource, not merely "is signed in".
- Sign-in and password reset never reveal whether an email exists.
- User-authored markdown is sanitised server-side against an allowlist.
- `.env.local` is gitignored. If you cloned this with keys in it, rotate them.


## The population

The product only makes sense at community scale, so `scripts/scale/` generates
one: 5,028 people, 3,524 projects, 30,429 reviews carrying 76,062 separate
points and 130,291 axis ratings, 14,769 replies, 153,884 votes, 4,202 builds,
1,717 roadmap items, 730 discussion threads with 4,171 posts, 107 verified
reviewers and 249 paid-review bounties. Everything comes from seeded PRNGs, so
the same command against the same instant produces the same rows.

**Time.** The seed resolves every hand-written date against the current minute
(or `--now`) and records that instant in `schema_meta` as `seeded_at`; the
population grows up to it and no further (`scripts/scale/clock.mjs`). The
community grew along a curve that picked up about four months ago, afternoons
are busier than the small hours and weekdays busier than weekends, and anything
whose time has not come yet, such as a reply due next week, simply does not
exist. So the present is alive: a few hundred reviews every day for the last
four weeks, activity within the last hour, and no two reviews of one project at
the same millisecond. A built database ages; `node scripts/scale/catch-up.mjs`
moves every timestamp forward by the time since the build, which keeps every
relationship between rows. The generator leaves `hot_score` at 0, so the feed is
ranked by the application's own formula: run `scripts/recompute-hot.mts` after
either step.

**Ratings, tags and the market.** Nine reviews in ten rate every axis of their
project's type, centred on the review's own verdict and moved by how good the
project is and how generous the reviewer is, so a crowd agrees on some axes and
splits on others. Tags are read off each project's world (`scripts/scale/tags.mjs`:
a roguelike made in Godot is tagged Roguelike and Godot) from the vocabulary in
`src/server/db/seed-data.ts`. The busiest reviewers become verified experts,
spread across all twenty areas, with an approved request and a credential for
every verified area. Each bounty is a timeline: posted with the money held,
applied to, awarded, delivered as a real review, accepted and released less the
platform fee, or cancelled and refunded. Where it stands is how far along that
timeline the present has got.

Two rules hold throughout, and `npm run audit` enforces both across 99 checks:

- **Nothing is a number somebody typed.** Reply counts, helpful counts, vote
  counts, answer counts, follower counts, rating counts and averages, tag
  counts, reputation scores, expert records and last-activity stamps are all
  computed from the rows underneath them, the same way the application computes
  them. A helpful count with no votes behind it collapses the first time
  somebody actually votes.
- **Nothing contradicts itself.** A point asking for a change is never filed
  under "Delight, keep this"; a note headlined as negative is not three
  compliments; nothing is older than the person who wrote it or the thing it
  answers, and nothing is dated after the present; a verified area always has a
  credential behind it; and a value the application reads on a 0-to-1 scale is
  never written on a 0-to-100 one. The audit also refuses any wording that
  suggests the content is not real.

Text is written, not picked, and it is written about the project in front of
it. Every generated project gets a world from `scripts/scale/types/`: a game has
a genre, a unit of play, named areas, mechanics and a resource; a web app has a
job, an audience, screens and features; a CLI has commands, flags and a config
file. Titles are shaped by the kind of work and never handed out twice. A point
is written after its category is chosen, from that category's own subjects and
the templates for that kind of observation (`scripts/scale/kinds.mjs`), so a note
filed under Audio is about something you hear. The note's opening paragraph names
what its worst point is about, and the replies under it answer that point.

Five thousand people do not write in one voice, so each has a persona derived
from their id: whether they contract, spell the American way, write numbers as
words, hedge, sign off or lead with the verdict. Names come from one naming
tradition at a time and no two members share a display name.

Repetition is budgeted while writing rather than measured afterwards
(`scripts/scale/compose.mjs`): no sentence may be printed more than four times
anywhere, and no five-word run may appear in more than about 0.4 per cent of any
one kind of text. A draw that would break either ceiling is redrawn, and
`populate.mjs` reports any that could not be. Words come from their own seeded
stream, separate from the one that decides who reviews what, so rewording a
sentence never moves a count or a date. `npm run db:populate` with
`DEBUG_TEXT=1` prints which phrases are pressing against the ceilings.

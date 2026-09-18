# Whetstone: direction log

Direction: **Paper & Ink**, which replaced Grit Index partway through the build.
`CONTRACT.md` is still law for spacing, component craft, motion, voice, the ban
list and the finish gate; its art direction, colour and typography sections were
superseded, and it says so at the top. `src/app/globals.css` is the authority on
every token.
This file records only the deviations from it, as the contract requires, and the
one-line justification for each.

## Deviations

| § | Contract says | What shipped | Why |
|---|---|---|---|
| 3.1 | Load faces with `next/font/local` | `@font-face` in `globals.css` + explicit `<link rel="preload">` in `layout.tsx` | The woff2 files live in `/public` so the OG image route can read the same bytes. Metric-override fallbacks are unchanged, so the CLS budget is unaffected. |
| 5.6 | Icons are Phosphor Regular | `lucide-react`, `strokeWidth={1.5}`, sizes 16/20/24, `currentColor` | No Phosphor package is installed; lucide is. The substance of the rule is unchanged: one library, one variant, one stroke width, and the same banned-glyph list. |
| 4.4 | Discover row is 4.5rem tall | 5.5rem (`--row-h-feed`) | The row carries a two-line clipped ask in Literata at 17px/1.65, which alone is 2.8rem; 4.5rem cannot hold it plus the title and metadata without clipping a descender. Register rows elsewhere keep 4.5rem. |
| 6.x | framer-motion banned | Reinstated, owner's decision | The owner lifted the ban explicitly so the Aceternity components could be used. It is confined to `src/components/motion/`; everything else stays on CSS with `@starting-style`, so the library is not on the critical path for any core surface. |
| 4.4 s9 | (auth) layout is "centered `max-w-sm` card" (ROUTES.md §5.2) | One 24rem column hung off the page's inline start, no card, no shadow | CONTRACT §4.4 surface 9 is law and says left-aligned, directly on `surface-1`, no card. ROUTES.md predates it. The wordmark, the column and the footer share one left edge so the page reads as deliberate rather than as a form that failed to centre. |
| 1 (auth) | Password reset arrives by email | It does, through Resend or Postmark over HTTPS (`src/server/mail.ts`), sent after the response so an existing address is not slower to answer. With no provider key, development writes the message to the server log and shows the link in an info banner; production logs the gap at boot and `/forgot-password` says no link can be sent instead of offering the form | A confirmation that promises an email nobody will send is worse than no form. Links are built from `SITE_URL`, never from the Host header, which production requires before mail counts as configured. |
| ROUTES §3 | `rate_limit` table lives in `schema.sql` | Created idempotently on first use from `src/server/queries/auth.ts`, together with a partial index on `auth_sessions (token_hash)` | `src/server/db/schema.sql` is owned by the data layer and never shipped a `rate_limit` table. Both objects are additive and `IF NOT EXISTS`, so re-running the real schema is unaffected. |
| ROUTES §1 | Session claims carry `sid` and `sv` | The cookie↔row binding is `auth_sessions.token_hash = sha256(jwt)` | `SessionClaims` in `src/lib/auth.ts` is `{ uid, handle }` and that module is not editable from the auth surface. Hashing the cookie gives the same property a `jti` would: one row per issued cookie, revocable on its own, with the secret never stored. |
| ROUTES §6.1 | Handle availability is `GET /api/auth/handle-available` | A Server Action, `checkHandleAction`, debounced 400ms | Only `api/auth/sign-out` is owned by this surface. The action is rate limited identically (30 per minute per device) and the handle is re-checked on submit either way, because availability is racy. |
| 1 (auth) | "Stay signed in" controls the cookie lifetime | It controls the `auth_sessions` row lifetime: 30 days on, 24 hours off | `setSessionCookie` fixes `maxAge` at 30 days and is not editable here. The authoritative check reads the row, so the shorter life is real; the checkbox says so in its own description rather than implying a browser-session cookie. |
| PLAYBOOK MOVE 4 | Field message slots reserve `1lh` | The sign-up handle's status line and the password strength note reserve `2lh` | Both run to two lines at 24rem: a 24-character handle plus its verdict, and the strength advice sentence. MOVE 4 permits reserving `2lh` where errors are known to run long, and the constant height is what keeps the answer from moving the form. |
| 2.4.6, 2.4.7 | A current item is marked by the 2px accent grind-mark on its leading edge | The channel strip on `/c/[channel]` marks the current channel with a 2px accent rule under its label, together with the label stepping from `text-2` to `text-1` and `aria-current="page"`; the top navigation already marks its current item this way, and the profile tabs with the same 2px under-rule drawn in ink | The strip is a horizontal row of short labels that wraps to two or three lines at phone width. A vertical rule on a label's leading edge reads there as a divider between two labels rather than as a mark on one. The rule is still 2px, still accent, still the only accent object in the view, and it is a transparent-to-accent border swap, so selection changes no geometry. |

## Icon relevance notes

Per §5.6 every icon ships with a one-line reason. Recorded as they are introduced.

| Icon | Where | Why this glyph |
|---|---|---|
| `Search` | Discover search field | Standard affordance; Jakob's Law applies to search above almost anything else. |
| `SlidersHorizontal` | Filter rail toggle | Reads as "adjust criteria", unlike `Filter` which reads as a funnel and implies removal. |
| `MessageSquare` | Feedback count | The count is of written responses, not reactions. |
| `CircleAlert` | Validation and severity | Carries meaning at 16px where a triangle does not. |
| `Check` | Resolved, accepted, shipped | The only glyph used for completion anywhere. |
| `ArrowUp` / `ArrowDown` | Stat deltas | Direction is an arrow **plus** text; never colour alone. |
| `Eye` / `EyeOff` | Password reveal toggle | The one pair every password field in software uses; SC 3.3.8 wants an alternative to re-typing, and a familiar glyph is the alternative people already know. |
| `Check` | Handle is free | Reuses the completion glyph already recorded above rather than introducing a second affirmative mark. |

## Where boldness is spent

One element per surface, per §1.

- Landing: the honing sweep on the word "sharper".
- Discover: the grit-scale filter rail.
- Project detail: the 3rem bevel rail in the left gutter.
- Composer: the rating strip, a ruled 1 to 5 scale per area that fills with ink where the reviewer puts it. It replaced the grit selector, which asked for a stage and stored a rating.
- Dashboard: the theme rollup bars.
- Public profile: the 5-cell grit history strip.
- Marketplace: straw as a fill, the only surface where it fills.
- Discussions: nothing. Hairlines and type only.
- Auth: nothing. Control edges are the only structure.

## Surfaces 6 and 7: public profile, reviewer marketplace, bounties

Recorded by the agent that built `/u/[handle]`, `/experts` and `/bounties`.

### Deviations

| § | Contract says | What shipped | Why |
|---|---|---|---|
| 4.4 surface 6 | Reputation reads "41 projects, 12 shipped, 380 pieces of feedback received" | The same sentence, with any clause whose count is zero dropped | Every figure is counted from a row (§7.1.6). The seeded creators have one or two projects each, so a fixed five-clause sentence would print zeroes that read as a broken page rather than as a true small number. |
| 4.4 surface 6 | The grit history strip shows how many projects reached each stage | Unchanged, and a step nobody has reached renders a hairline rather than an empty cell | `GritHistoryStrip` already does this. Noted because with real data most creators fill exactly one cell, which is the honest picture and not a rendering fault. |
| 5.7 | Every grit value is a numeral beside a hatch | The reviews list shows specificity instead of a grit chip | `FeedbackView` does not carry the reviewed project's grit, and inventing one would break §7.1.6. Specificity is on the review's own row and is the figure the reputation formula actually multiplies by. |
| 7.1.3 | Buttons are verb phrases | The follow control reads "Following" in its on state | It is a toggle whose label states the current state, which is what makes the optimistic flip legible. The off state is the verb phrase, "Follow Mira". |

### Money

Nothing in these surfaces collects a card, an account number or a billing address, and
no form is styled to look as though it does. Every ledger row comes from
`bounty_escrow_events`, every amount is summed from award rows, and every state
transition is written by the Server Action that causes it, filed under the bounty's one
escrow reference. The terms are one sentence, `settlementTerms` in
`components/marketplace/bounty-state.tsx`: committed at posting, paid out only after
acceptance, released less the platform fee, returned in full by a cancellation before an
award. The bounty list, the bounty form and every bounty's ledger print that sentence and
no other, because an earlier note saying settlement happened off-platform sat beside a
ledger, a fee and a release, and a reader could not tell which was true.

### Icon relevance notes

| Icon | Where | Why this glyph |
|---|---|---|
| `BadgeCheck` | Verified expertise areas | A tick inside a mark reads as "checked by someone", which is what a verification is; a bare `Check` is already spoken for by completion. |
| `Clock` | Turnaround | The one unambiguous glyph for elapsed time at 16px. |
| `Users` | Weekly capacity, application count | A count of people, which is literally what both numbers are. |
| `UserPlus` | Follow | Adds a person to a list, and its absence in the on state is half the toggle's signal. |
| `TriangleAlert` | Blocker-severity findings on a review | Severity, not validity: `CircleAlert` is already the validation glyph and the two must not blur. |
| `MapPin` / `CalendarDays` | Profile location and join date | Both are `sr-only`-labelled `<dt>` markers, not decoration; the words are present for assistive technology. |

---

## 13 September 2026: the population pass

The design was finished before the database was full. Filling it to the size the
product is meant to run at surfaced a class of problem the contract does not
cover: not whether a surface is well made, but whether what it is showing is
believable. Eleven things were wrong, and all of them were only visible at scale.

### Text that read as a template

| Was | Now |
|---|---|
| 603 distinct project asks across 3,535 projects, the worst printed 105 times | 5,004 asks, every one unique |
| 185 distinct note headlines across 33,000 notes, the worst printed 2,476 times | 6,749, and no two notes on one project or by one reviewer share one |
| 395 distinct point bodies across 83,000 points, drawn from the same pool as the note summaries above them | 23,388, from a separate pool, unique across a whole project page |

The fix in every case was to stop picking whole sentences and start composing.
An ask is a task and a probe drawn independently, with an optional closing line.
A headline is a claim plus an optional second clause. Both halves carry slots.
The generator also tracks what it has emitted and redraws on a collision, scoped
to the page a reader actually sees at once.

### Things that contradicted themselves

- A point asking for a change arrived under the severity label **Keep this**, and
  a complaint could be filed in the **Delight, keep this** category. Severity and
  category are now drawn from the tone of the sentence that was written, and the
  tone of the points follows the sentiment of the note they sit in.
- 9,719 notes carried a reply count with no replies behind them, and every note
  on every generated project showed as unanswered. Replies are real rows now,
  and `reply_count`, `first_reply_at` and `inbox_state` are computed from them.
- Every ask on every project read **Open**, because no point named an ask. The
  label also said "notes" while counting points, so a project with 25 notes could
  report 42 answers.
- Every build reported `0 notes, 0 reviewers, 0 blockers`, because no note named
  a version. A note is now attributed to whichever build was current when it was
  written, and a quarter stay unattributed, because plenty of reviews are.

### Surfaces that were empty

`project_needs` had 47 rows, so the feed printed **Wants: Any read** on nearly
every row and the Discover need filter returned almost nothing. Discussions had
12 threads across 6 channels. Suggestions and build history existed only on the
hand-written projects, so the landing page's fourth statistic said six things had
ever shipped, next to three five-figure numbers.

All four are generated now: 5,133 needs, 655 threads carrying 4,300 posts, 1,104
roadmap items sourced from the real points that raised them, and 2,698 builds.

### The rule that came out of it

Every counter is counted, never chosen. `scripts/audit.mjs` is the enforcement:
40 checks that each denormalised count matches the rows beneath it and that
nothing contradicts itself in time or in meaning. It found six projects published
before their author had an account. It also disagreed with the data once and was
wrong: a build legitimately predates the day its project was posted here, because
people work before they ask for feedback. The check was corrected, not the data.

## 13 September 2026: what driving the product found

Rendering a page proves it renders. It does not prove a form submits, a rule
holds, or a counter moves. `scripts/flows.mjs` signs in and works through the
product, asserting each effect in the database rather than trusting a redirect.
Eleven flows; four defects came out of writing them.

### Following was built and never wired

`project_follows`, `followProject`, `unfollowProject`, the notify preference,
the follower counter, `viewer.follows` on the project query and an API route all
existed. There was no control anywhere in the interface, so it was a row nobody
could write. `FollowButton` now sits beside `SaveButton` on all three project
surfaces, and the two labels say different things on purpose: Save puts the
project on your list, Follow asks to be told when it moves. A creator does not
see it on their own project, because the notification would be about themselves.

### A field the client capped and the server did not

The blind first impression is stored verbatim as `feedback.headline`. Its
textarea caps at 600 characters and the second step's schema caps at 600. Step
one's schema had a minimum of thirty and no maximum at all, so a request that
skipped the form wrote an unbounded string into the column the note renders as
its opening paragraph. The cap is now on the server, where it is true.

### A link validated as a URL rather than as a link

`buildUrl` was `z.string().url()`, whose error message read "starting with
https" while the check enforced no scheme at all. The URL constructor accepts
`javascript:`, `data:` and `vbscript:`, and the value reaches four `href`
attributes. React's own href filtering was the only thing in the way.

There is now one `HttpsUrl` in the shared request vocabulary, used by both build
forms and by the intake route that had its own copy. Separately, the allowlist
the markdown renderer has always used moved to `@/lib/utils` as `safeHref`, and
every render site that puts a stored URL in an href goes through it: the three
build links, and the profile links, which have no write path today and would
have become a stored-XSS surface the day somebody added one.

### Two landmarks on one page

Every route under `(app)/c/` rendered its own `<main id="main">` inside the
shell's, so the community pages carried nested `main` elements and a duplicate
id, and the skip link had two places it could land. The dashboard layout already
had the comment explaining why it does not do this; the fourteen discussion
files now follow it.

## 17 September 2026: what a ten-dimension audit found

Ten specialists read the codebase in parallel, each on one dimension, and every
finding was put to two independent skeptics before it counted. What survived
falls into three groups.

### Authorisation: eight actions that checked the actor and not the resource

The pattern each time: a Server Action authenticates the caller, reads an id out
of the form, and acts on the row without asking whether the two belong together.
The API routes have a chokepoint that forces the question; Server Actions do not.

| Action | Was | Now |
|---|---|---|
| `saveBasics` | Resolved any project by id and ran an UPDATE keyed on id alone, so any signed-in account could rewrite the title, tagline and summary of any project | Owner is compared before the update, the way every other wizard step already did |
| `markFeedbackHelpful` | Set the creator's endorsement on any review by id, from any account | Only the project's owner or a collaborator |
| `markPointShipped` | Checked ownership of the slug and never checked the point was on that project | Point and project are checked against each other |
| `replyToFeedback` | Posted into any review thread by id, creator-only ones included | Requires being able to read the thread |
| `voteOnFeedback`, `voteOnPoint` | Skipped the visibility and self-vote gates the API twins enforce | Both gates, same as the twins |
| `promoteThemeToSuggestion` | Took point ids from any project as evidence | Evidence has to be on the project |
| `getChannel` | Omitted the `is_private` guard the register and thread queries apply, so a private channel was readable and postable by slug | Guard applied in the one place the slug is resolved |

### Sessions: a revocation table nothing read

`auth_sessions` was written on every sign-in and read by three auth pages. The
other forty-odd files authenticated with `currentClaims()`, which verifies the
cookie's signature and asks nothing else, so a session revoked by a sign-out or a
password reset kept working until its token expired, up to thirty days. The
seam was deliberate and documented: the check was to go in once sign-in provably
recorded a row, which it does.

`currentClaimsLive()` is that check, same shape as `currentClaims()` so adopting
it is an import change. Every Server Action and every page under `(app)` now uses
it, the API chokepoint goes through `currentUser()`, and it also refuses an
account whose `users.status` is no longer active, which nothing on the write
paths was reading either.

### Performance: one index worth fourteen seconds

Discover asks two questions per candidate about the signed-in reader: has this
person reviewed this project, and have they reviewed anything of this type.
Every `feedback` index on `reviewer_id` is partial on `deleted_at IS NULL`, and
neither subquery mentions `deleted_at`, so SQLite could not use one and scanned
all 32,704 notes per candidate. Over 300 candidates that measured 14.1 seconds.

Signed-out readers never paid it, which is why every measurement taken from a
cold `curl` said 164ms and the page was fine. `ix_feedback_reviewer_project`
takes it to 2.2ms.

### The design tokens were real, and a correction

A cluster of findings said design tokens were read across the component layer
and defined nowhere. They were right. An undefined `var()` with no fallback
invalidates the whole declaration, so borders built on `--hairline` vanished,
filter rows built on `--tap-min` fell from 44px to the height of their text,
the reading widths built on `--container-*` ran the full page, and the z-index
scale was half-defined, which is why open menus painted under the Discover
filter bar. The numeric `--spacing-1..5` steps that control classes still read
had been deleted in the earlier spacing fix without their usages.

All of it was fixed on 14 September: the missing tokens are defined in the
blocks at `globals.css:128-144` and `218-231`, the numeric spacing usages were
moved onto the named scale, the z-scale was completed, and
`scripts/check-css.mjs` was written to catch the class for good. It found ten
more on its first run.

The session then hit a usage limit and resumed three days later without that
work in view. Reading the already-fixed stylesheet, it concluded the reviewers
had missed a compatibility block and recorded the findings here as false
positives. That was wrong: the block they supposedly missed was the fix. This
paragraph replaces that claim.

### The tests that came out of it

Three checks now exist because three whole classes of defect passed a green
build, a clean type check and a 240-render page sweep without leaving a mark.

`npm run check:links` crawls thirty signed-in pages, collects every same-origin
href, adds every `notifications.url` in the database, and follows all of them.
It found six dead links the page sweep could not: the dashboard's activity rail
builds `/dashboard/inbox/:id`, `/p/:slug/feedback/:id` and `/p/:slug/tracker` as
SQL string concatenation, and not one of those is a route. A link that 404s
renders perfectly.

`npm run check:urls` puts the href allowlist and the write-side schema against
`javascript:`, `data:`, `vbscript:`, `file:`, a protocol-relative `//host`, a
tab-embedded `java\tscript:` and a three-thousand-character URL. All refused,
and `https://`, `http://`, an internal path and `mailto:` still allowed.

`scripts/flows.mjs` drives twelve things a person actually does and asserts each
one in the database rather than trusting a redirect. One of them attacks the
build: it signs in, puts somebody else's project id in the wizard's hidden draft
field, and submits. With the ownership check removed that test reports
`the title was overwritten: "Defaced by a stranger"`, which is what a regression
test has to be able to do to be worth having.

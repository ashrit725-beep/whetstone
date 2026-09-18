# Whetstone seed data

> The demo database: 28 people, 24 projects across all ten types and all five grit stages, 171 pieces of
> feedback written in distinct voices, and every counter, score, badge and notification computed from those
> rows by the product's own code rather than invented.

Files: `src/server/db/seed-data.ts` (the content), `scripts/seed.ts` (the loader), this document.

---

## 1. Demo login

| | |
|---|---|
| **Email** | `mira@brinehollow.dev` |
| **Password** | `whetstone` |
| **Who** | Mira Solvang, `@mirasolvang`, solo game developer in Oslo |

Sign in as Mira to see the product with something in it: a creator dashboard with 24 reviews on one project,
4 unread notifications, a theme rollup where nine separate people describe the same failure in four different
vocabularies, a suggestion tracker with items in five states, and one paid bounty that has been delivered,
accepted and released.

**Every seeded account uses the same password, `whetstone`.** Sign in as anybody in the roster below to see
the product from their side. Three worth trying:

| Email | Who they are | What their view shows |
|---|---|---|
| `nkechi@obi.works` | Nkechi Obi, accessibility engineer, verified expert | The reviewer side: 13 reviews across thirteen projects, a listed marketplace profile at $180 an hour, one bounty paid and one in progress, and four blockers that creators fixed the same week |
| `emmett.quill@fastmail.com` | Emmett Quill, enthusiastic and imprecise | The low-signal case: 15 reviews, more than anybody else on the platform, the lowest specificity scores in the database, one upheld low-effort report, and the lowest reputation score on the platform |
| `priya@tallyroot.co` | Priya Ramanathan, solo founder | A second creator dashboard, where three reviewers describe the same currency mistake from three different angles, and a separate reproduction shows a rate edit being silently discarded under a success message |

Passwords are hashed with `hashPassword` from `@/lib/auth` (scrypt, per-password salt), so the salt differs on
every run while everything else in the database stays byte-identical.

---

## 2. Running it

```bash
npm run db:seed                      # wipe and reseed ./data/whetstone.db
npm run db:seed -- --now now         # same content, dated against the moment you run it
npm run db:seed -- --now 2026-12-01  # or against any date you name
npm run db:seed -- --db ./data/scratch.db
npm run db:seed -- --quiet           # no summary table
```

The script wipes the database file (plus its `-wal` and `-shm` siblings), lets `client.ts` re-apply
`schema.sql`, inserts everything inside one transaction, and prints a table of what it wrote. It is safe to
run as often as you like.

- **Idempotent.** Every id is a UUID derived from a name (`project:brinehollow`, `feedback:bh-greta-1`), so the
  same rows come back with the same ids every time. Two consecutive runs produce databases that are identical
  apart from the password salt.
- **Fails loudly.** Content is validated before the first write: dangling references, a review filed against a
  build that had not shipped yet, a declined suggestion with no reason, a bounty advertised without money held.
  Any failure prints the list and exits `1` without touching the database. The insert itself runs in one
  transaction, so a constraint violation rolls the whole thing back.
- **Reproducible time.** Nothing calls `Date.now()` while building rows. `BASE_NOW` is a fixed constant
  (13 September 2026, 12:00 UTC) and every timestamp in the content file is an offset in days from it.
  `--now` moves the whole dataset without changing a single relationship.

The script runs under plain `node --experimental-strip-types`, which knows neither the `@/*` path alias, nor
the extensionless relative imports the app uses, nor `next/headers`. It installs one module resolution hook
for all three at the top of the file, which is what lets it import the real taxonomy, the real specificity
function and the real reputation rollup rather than copies that drift.

---

## 3. What is in it

| Table | Rows | Notes |
|---|---:|---|
| `users`, `profiles` | 28 | Real-sounding handles, one-paragraph bios, each written in a different voice |
| `expert_profiles` | 7 | Verified, listed, with real hourly rates from $120 to $250 |
| `projects` | 24 | All ten project types, all five grit stages |
| `project_versions` | 49 | Every project has history, and feedback binds to the build that was current when it was written |
| `project_asks` | 35 | Specific, answerable questions. No project says “let me know what you think” |
| `feedback` | 171 | Two sentences to four paragraphs, from precise to blunt to wrong |
| `feedback_points` | 233 | Severity, actionability, sentiment, anchors |
| `feedback_ratings` | 855 | Every submission rates all five axes for its project type |
| `feedback_replies` | 49 | Creator replies, including seven nested exchanges |
| `feedback_themes` | 32 | Clusters, with duplicate reports collapsed |
| `suggestions` | 27 | Across all eight tracker states, with an immutable status history per item |
| `bounties` | 9 | Open, claimed, delivered, paid, cancelled, with an escrow ledger |
| `discussion_threads` / `discussion_posts` | 12 / 46 | Nested to three levels |
| `notifications` | 399 | 105 unread, across eleven kinds |
| `test_rounds` / `test_task_results` | 2 / 30 | A running tutorial round and a closed ten-day hardware carry |
| `reputation_events` | 564 | The human-readable ledger of what happened to whom |
| `user_badges` | 56 | Every grant is earned by a rule applied to real rows |
| **Total** | **~9,490** | 65 of the 69 tables carry rows |

Four tables are deliberately empty. `auth_sessions` and `auth_tokens` belong to a running server, not to a
seed. `feedback_attachments` would need uploaded files, and the seed fabricates no media. `user_blocks` would
mean inventing a grudge between two named people, which is not a thing to invent.

### The people

28 accounts, from a 22-year industrial designer to somebody three months into building things on purpose.
Seven are verified experts with genuine, narrow specialisms: onboarding sessions, documentary cutting,
WCAG audits, design for manufacture, product copy, developer experience, device-matrix bug hunts.

Reputation is computed by the product, never assigned by the seed, so the distribution tells a story on its
own: the highest score belongs to a reviewer with nine submissions, and the person who has written the most
reviews in the database sits at the bottom of the table. Their credential chips say who they are; the score
says what their feedback has been worth here, and the taxonomy is deliberate about keeping the two apart.

### The projects

Four games, three web apps, two mobile apps, two websites, three videos, two business ideas, two hardware
projects, two design projects, two pieces of writing, two developer tools. Four at grit 120, four at 400,
six at 1000, six at 3000, four at 8000.

Every project carries a pointed ask. A sample:

> The tutorial is 90 seconds and 40 per cent of testers quit inside it. I need to know which beat loses them.

> The hinge is rated for 20 000 cycles and I think that is the wrong number. If you have carried the unit for
> a week, tell me what you do with it when you are not typing.

> Read the homepage once, at normal speed, then close it. Tell me what you think we sell.

### The feedback

Written to read like people wrote it. Bug reports carry the full triple (what I tried, what happened, what I
expected, plus how often). Video notes carry timecodes. Copy reviews are formatted as *yours, mine, what
changed*. Several reviewers disagree with each other, one of them is confidently wrong, and a handful are
deliberately low-signal so the quality coach has something to act on:

- Emmett Quill’s “Really enjoyed this” at nine minutes of play, which earns almost nothing under the
  specificity floor and carries two downvotes.
- Hugo Bittencourt’s “Clean and easy to use” at six minutes, which a creator still answered.
- One upheld low-effort report with a moderation record attached, and a `-20` reputation event that names it.

### The themes

Clustering is real: a point carries a theme key, and `point_count` and `reviewer_count` are counted from the
rows that reference it. The flagship cluster on Brinehollow is nine distinct reviewers describing one failure
in four different vocabularies (never noticed it, read it once and stopped, mistook it for a score, cannot
see it change under a colour filter). Two smaller clusters are contested, with reviewers on both sides.

---

## 4. Cover art is generated, not fetched

Projects do not reference an image host. Each project carries a **cover seed** string, stored on its primary
`project_media` row:

```
url        = 'cover:hatch-brinehollow-tide-06'
thumb_url  = 'cover:hatch-brinehollow-tide-06'
alt_text   = 'Generated grit hatch cover in cold blue-green, dense at the waterline and open above it.'
media_kind = 'image'
mime_type  = 'image/svg+xml'
```

Anything whose `url` begins with `cover:` is a seed, not an address. The renderer hashes the part after the
colon and draws a grit hatch composition from it: the same seed always draws the same cover, offline, at any
size, in either theme. `alt_text` is written for every media row and is never null, because the schema will
not accept an image without one.

Seeds are also exported from `seed-data.ts` on each project as `coverSeed`, so a component can derive one
without a database read.

---

## 5. How the derived numbers are derived

Nothing in the seed asserts a count. `seed-data.ts` holds only content; `scripts/seed.ts` computes everything
else from the rows it just inserted, and where the app already has an implementation, the seed imports it
rather than writing a second opinion.

**Specificity** (`feedback.quality_score`, 0 to 1) is `computeSpecificity()` from
`src/server/repos/feedback.ts`, the same function the composer calls while a reviewer is still typing. So a
seeded review is worth exactly what the product would have scored it at:

```
S = 0.30·structure + 0.25·evidence + 0.25·anchor + 0.20·language
```

with the dwell floor applied on top: a review written in under 90 seconds with the artifact is capped at 0.4
whatever it says. The seeded spread runs 0.38 to 0.75, and 92 of 171 reviews clear the 0.5 qualified bar.

**Reputation** (`reputation_scores`) is written by `persistReputation()` from
`src/server/repos/reputation.ts`, run for every user after the content is in, twice: the first pass gives
voters a credibility score, the second lets their votes carry the weight that score implies. The numbers are
therefore the numbers the app produces on a recompute, shrinkage, time decay, creator discrimination and all.
With review counts in the single and low double digits, everybody lands in Contributor, which is what the
algorithm says a platform this young looks like.

`reputation_events` is the separate, human-readable ledger of what happened: a review submitted with its
specificity, a creator marking it helpful, a note reaching a released build with the version named. The
community facet of the score is computed from it; the rest of the ledger is the audit trail a profile renders
when somebody asks why their number moved.

**Everything else**: `project_stats` counters are counted, `rating_avg` is the mean of per-submission axis
means, `reply_rate` is replied-to over received, `hot_score` is engagement over age with a boost for open
projects short on reviews, theme counts are counted from the points that carry the theme key, votes are drawn
by a seeded generator from everybody who is not the author or the creator, badges are awarded by rules
applied to the rows, and every notification is generated by the event that caused it.

---

## 6. One taxonomy, not two

The ten project types, their rating axes and category vocabularies, the five grit stages, the need kinds and
the expertise areas all live in **`src/lib/taxonomy.ts`**. The seed does not restate any of them: it reads
that file and inserts rows from it, so a key that exists in the app exists in the database with the same id,
the same label and the same definition.

`seed-data.ts` therefore carries only the keys it points with, and `scripts/seed.ts` checks every one of them
against the taxonomy before the first insert. A typo in a category key stops the run.

Ids follow the convention the taxonomy documents and every repository relies on:

| Row | Id | Example |
|---|---|---|
| `project_types` | the slug | `game` |
| `rating_axes` | `<typeSlug>:<axisKey>` | `game:fun` |
| `feedback_categories` | `<typeSlug>:<categoryKey>` | `game:core_loop` |
| `project_stages` | `<typeSlug>:<stageKey>` | `video:beta` |
| `tags`, `badges`, `expertise_areas`, `discussion_channels` | prefixed slug | `tag_roguelike` |
| people, projects, feedback, everything else | UUID derived from a name | `feedback:bh-greta-1` |

The grit stage keys are `concept`, `prototype`, `beta`, `release_candidate`, `shipped`, worth 120, 400, 1000,
3000 and 8000. The key and the numeral are constant across all ten types; only the label changes, which is
why `project_stages` is a table: a video at grit 1000 is a fine cut, a game at grit 1000 is a playable beta.

Because the seed runs under plain `node` rather than through Next, `scripts/seed.ts` installs a module
resolution hook that teaches Node the `@/*` alias, the extensionless relative imports the app uses, and a
stub for `next/headers`. That is what lets the seed import the real taxonomy, the real specificity function
and the real reputation rollup instead of copies that drift.

---

## 7. Writing more of it

`seed-data.ts` is plain data. Add a person to `USERS`, a project to `PROJECTS`, a review to `FEEDBACK`, and
`npm run db:seed` picks it up. Three house rules, enforced either by the validator or by review:

1. **No invented numbers.** If a devlog says nine people reported something, nine points must carry that
   theme. The validator will not catch this one; a reader will.
2. **Punctuation.** Curly quotes, the ellipsis character, en dash for numeric ranges, a non-breaking space before units.
   No em dash, no straight quotes, no three-period ellipsis, no all-caps emphasis.
3. **Timestamps are offsets.** `daysAgo`, never a date. A review cannot predate the build it reviews, and the
   validator will stop the run if it does.

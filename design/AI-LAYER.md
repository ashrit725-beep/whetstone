# The AI layer

`src/server/ai` implements the six features in `AI-FEATURES.md`. It is server-only, provider-agnostic, and fully functional with no API keys configured.

The single architectural commitment: **degradation lives inside the feature module, never in the UI.** A caller renders `result.data` and reads `result.source` only to choose a provenance label. A deployment with zero keys executes the same code path as one whose provider is having an outage.

---

## 1. The contract

```ts
type AiSource = 'ai' | 'cached' | 'heuristic'

type DegradeReason =
  | 'no_key' | 'provider_down' | 'timeout' | 'rate_limited'
  | 'budget_exhausted' | 'schema_invalid' | 'breaker_open'
  | 'disabled_by_user' | 'gated'

type AiResult<T> = {
  data: T                 // always present, never null, never a throw
  source: AiSource
  ms: number              // wall clock spent producing this
  generatedAt: string     // ISO-8601; for a cached row, when it was first made
  model?: string          // only when a model produced it
  degraded?: DegradeReason
  stale?: { newItemsSince: number }
}
```

Every feature module exports the same pair:

```ts
function heuristic(input: I): AiResult<O>            // sync, no network, always works
async function generate(input: I): Promise<AiResult<O>>  // cache, then model, then heuristic
```

`generate` never throws and never rejects. Every failure mode inside it resolves to a populated `data` with a `degraded` reason.

Import from the barrel:

```ts
import { themes, coach, intake, triage, dedupe, digest, aiStatus } from '@/server/ai'
```

---

## 2. Server-only enforcement

The `server-only` package is not installed in this project, so `src/server/ai/guard.ts` stands in for it. Every file in the directory begins with `import './guard'`, and the guard throws the moment it is evaluated in a browser realm.

Provider keys are read through `env` in `@/lib/env` and nowhere else. There is no `process.env` access anywhere in this layer.

If `server-only` is added to `package.json` later, replace the body of `guard.ts` with `import 'server-only'` and every file keeps working unchanged.

---

## 3. Provider routing

`provider.ts` selects **Anthropic, then OpenAI, then Kimi, then the deterministic path.** Kimi speaks the OpenAI protocol, so one adapter serves both, with `baseURL` taken from `env.kimiBaseUrl`.

| Tier | Anthropic | OpenAI | Kimi |
|---|---|---|---|
| `reason` | `claude-opus-5` | `gpt-5` | `kimi-k2-0905-preview` |
| `work` | `claude-sonnet-5` | `gpt-5-mini` | `kimi-k2-0905-preview` |
| `fast` | `claude-haiku-4-5` | `gpt-5-mini` | `kimi-k2-turbo-preview` |

**Structured output** uses a strict tool definition with a forced `tool_choice` on both protocols. This is a security control as much as a formatting one: a model that can only emit a schema-shaped object has no channel through which injected free text could reach a creator. Every response is then re-validated with zod, which is what catches a compatible endpoint that implements the schema loosely.

`maxRetries` is pinned to 1 on both SDKs. The default of 2 lets a hung provider burn three timeouts of wall clock before the deterministic path runs, and reaching that path quickly matters more than one extra attempt.

### Two entry points

```ts
callStructured(request, scope?, repair?): Promise<StructuredOutcome>
callValidated<T>(request, zodSchema, scope?): Promise<ValidatedOutcome<T>>
```

`callValidated` adds zod plus **one repair retry**: a schema violation gets a corrective turn carrying the validation error, and a second failure resolves to `{ ok: false, reason: 'schema_invalid' }`. The invalid payload is recorded against the run and never rendered.

---

## 4. The six features

Each subsection lists the exported signature, what the deterministic path actually computes, and the cache key.

### 4.1 `themes`: feedback theme clustering

```ts
themes.generate(input: ThemesInput, options?: ThemesOptions): Promise<AiResult<ThemeReport>>
themes.heuristic(input: ThemesInput): AiResult<ThemeReport>
themes.themesLabel(result): string

type ThemesInput = {
  projectId: string
  projectType?: ProjectType
  ask?: string
  categories?: ReadonlyArray<{ key: string; label: string }>
  items: readonly FeedbackInput[]
}
type ThemesOptions = { refresh?: boolean; signal?: AbortSignal; userId?: string }
```

**Model path.** `reason` tier, forced tool call, system prefix cached. Verified beyond zod: every cited id must exist in the input, and every quote must be a literal substring of the item it cites after whitespace normalisation. A theme failing verification is dropped; if more than 30% drop, the whole artifact is discarded and the layer falls back. This makes a fabricated quote structurally impossible to display. The impact number the model returns is replaced by the measured one, so only its reasoning survives.

**Delta prompting.** When a valid previous artifact exists and fewer than 25% of items are new, the prompt carries the existing theme labels plus the new items and asks the model to assign or create.

**Deterministic path, in order.**
1. Partition by `(categoryKey, praise/problem bucket)`. The composer already scoped every point to a category, which is a human-authored clustering signal the model has to derive for itself.
2. TF-IDF over **unigrams only**, with IDF computed per project so project jargon stays discriminative. Bigrams are excluded from the clustering vector deliberately: in short feedback they are almost all unique, and including them roughly halves the measured similarity between two phrasings of one complaint. They are used for the label, where being distinctive is exactly what is wanted.
3. Greedy agglomerative assignment at cosine ≥ **0.24**, followed by a centroid merge pass and a singleton rescue pass. The threshold is calibrated, not assumed: two phrasings of one complaint measure around 0.45, unrelated notes in the same category measure near zero.
4. Label from the highest-weight bigram in the centroid, expanded from stems back to the most common surface form so it reads as English, then title-cased.
5. Representative quote from the member nearest the centroid, verbatim by construction.
6. Impact from the shared formula in §5.

**Middle tier.** When the chat path degrades and an OpenAI key is present, `text-embedding-3-small` vectors replace TF-IDF at a 0.62 threshold. That result is reported as `source: 'ai'` with `model: 'text-embedding-3-small'`, because it is one, and hiding that would make the badge a lie.

**Sampling.** Above 300 items the input is sampled deterministically: everything from the last 30 days, then a stratified fill across category and severity. The report carries a `notes` line saying so. Never a silent truncation.

**Cache key.** `sha256(schemaVersion + projectId + ask + sorted(categoryKeys) + sorted(id:updatedAt))`. A previous artifact is kept and served with `stale: { newItemsSince: n }` when the provider fails, rather than regressing the dashboard to keywords.

### 4.2 `coach`: feedback quality coach

```ts
coach.generateDebounced(input: CoachInput, options?): Promise<AiResult<CoachResult>>  // the live path
coach.generate(input: CoachInput, options?): Promise<AiResult<CoachResult>>
coach.heuristic(input: CoachInput): AiResult<CoachResult>
coach.noteDismissed(draftId: string): void
coach.forgetDraft(draftId: string): void
coach.setCoachEnabled(userId: string, enabled: boolean): void
coach.coachDisabledFor(userId?: string): boolean
```

**This feature cannot block a submit.** It has no verb. It returns a verdict, five booleans and at most two suggestion chips. Every anti-annoyance rule is enforced in this module rather than trusted to the caller:

- Idle debounce of 1200ms in `generateDebounced`; a superseded call aborts the in-flight request and resolves immediately with the linter’s answer, so awaiting every keystroke still costs one model round trip.
- A draft that passes four of five checks is **never sent to a model**. The linter is the gate.
- Two nudges per draft, ever. Six calls per draft as a backstop. Sixty seconds between nudges. Never twice for an unchanged draft hash.
- Two dismissals silence it for the session. A reviewer preference silences it permanently, honoured server-side through `ai_setting`.
- A reviewer whose last ten submissions averaged ≥ 0.8 quality is excluded outright.
- 40 calls per reviewer per day; beyond that the linter runs alone, silently.

When the coach is suppressed it returns the linter’s real verdict with the chips withheld, not a fabricated `ok`.

**Deterministic path** (`lint.ts`, also used by triage):

| Check | Passes when |
|---|---|
| `specific` | a unit or measurement, a timecode/route/level anchor, a quoted string, a digit in a substantial draft, or a term from the project’s own tag and axis vocabulary |
| `reproducible` | a when/how marker near eight or more words |
| `contrastive` | a strong contrast word, or a weak one alongside a specific claim |
| `scoped` | three sentences or fewer, or sentence count within one of the bullet count |
| `onAsk` | two or more content words shared with the creator’s ask; skipped when no ask is supplied |

Verdict is `thin` under 40 characters or 8 words, `vague` when the low-signal phrase ratio crosses 0.7, `off_ask` when only that check fails, `ok` at four passes. Scaffolds come from a fixed table keyed by failed check and project type.

**Cache.** Per-process LRU of 200 entries, 90s TTL, keyed by `sha256(normalisedDraft + projectId + axisKey)`. Nothing is persisted: storing coach output alongside the feedback would imply the reviewer’s text was judged and retained.

### 4.3 `intake`: project intake assistant

```ts
intake.generate(input: IntakeInput, options?): Promise<AiResult<IntakeSuggestion>>
intake.heuristic(input: IntakeInput): AiResult<IntakeSuggestion>
intake.fetchLinkMetadata(urls: readonly string[]): Promise<LinkMetadata[]>
intake.axisPicker(type: ProjectType): { defaults: readonly AxisSpec[]; optional: readonly AxisSpec[] }
```

**Explicit trigger only.** Bind `generate` to a button, never to change or blur. It returns values for the form to pre-fill unsaved; nothing is persisted until the creator submits. A form that rearranges itself under someone’s cursor is an unexpected context change.

**Links are fetched by us, not by a model.** `fetchLinkMetadata` enforces a host allowlist, a 3s deadline, `redirect: 'manual'` with a same-host check, a 4000-character body cap, three links maximum, and a 24h per-URL cache. There is no browsing tool in the prompt, so exactly what enters it is known.

**Deterministic path.** Weighted term frequency over the description and fetched link metadata against a per-type keyword table, with host rules scored above any keyword (`itch.io` → game, `npmjs.com` → devtool, and so on). Below the confidence floor, or within the ambiguity margin of the runner-up, it reports `confidence: 'low'` and returns clarifying questions instead of guessing. Stage comes from keyword tiers, defaulting to `prototype`. Axes are the curated per-type defaults, which are the source of truth on **both** paths: the model only ever swaps one or two. The ask degrades to a three-field guided template that composes into the identical `headline` / `body` / `ignoreList` structure.

**Post-processing the model does not get to skip.** Tags are re-checked against the vocabulary and flagged `fromTaxonomy: false` so they render as a chip the creator must accept, which is what stops the taxonomy filling with noise. A short axis list is topped up from the defaults.

**Cache key.** `sha256(schemaVersion + description + sortedLinks + askAnswers)`. Re-pressing the button with unchanged input costs nothing. Limit: 3 per user per hour.

### 4.4 `triage`: sentiment and severity

```ts
triage.generate(input: TriageInput, options?): Promise<AiResult<TriageBatch>>
triage.heuristic(input: TriageInput): AiResult<TriageBatch>
triage.triageHeuristicOne(item: FeedbackInput, axes?): Triage   // for the synchronous write on insert
```

**Never on the submit path.** Call `triageHeuristicOne` when the item is written so a row always exists, then enqueue `generate` to upgrade the labels. A provider outage is invisible to the creator: the labels are present, they are simply the deterministic ones.

**Deterministic path.** The composer already collected most of this:

- **Sentiment** is arithmetic from the per-axis ratings: `(mean − midpoint) / halfRange`, corrected by the lexicon by at most a third, and only when the lexicon matched three or more terms. Ratings are a number the reviewer chose deliberately; word counting does not get to overrule them.
- **Severity** is the reviewer’s own selection. The heuristic may only escalate, and only by **one rung**, and only when the text describes a higher consequence. Capping the escalation is what stops it crying wolf.
- **Type** from the composer category plus a keyword override.
- **containsRepro** from the same function the coach uses.
- **actionability** from the linter’s score.

**Model path.** `fast` tier, up to 20 items per request so the system prefix amortises. Items where the reviewer’s labels and the heuristic already agree and the body is under 150 characters are skipped entirely. Any item returned as `blocker` or `low` confidence is re-run on the `work` tier before it can fire a notification. A batch whose returned id set differs from the request id set is discarded whole: one item’s labels sitting on another item’s row has no safe partial recovery.

### 4.5 `dedupe`: duplicate detection

```ts
dedupe.generate(input: DedupeInput, options?): Promise<AiResult<DedupeReport>>
dedupe.heuristic(input: DedupeInput, threshold?): AiResult<DedupeReport>
dedupe.recordUnmerge(aId: string, bId: string, reason?): void
```

**Stage one needs no model.** Items are gated first by the human-authored category and axis, then compared on a blend:

```
similarity = 0.45 · dice(character trigrams)
           + 0.45 · cosine(TF-IDF over the candidate window)
           + 0.10 · jaccard(word trigrams)
           − 0.08 if the detected types disagree
```

Trigrams survive typos, inflection and word order. Cosine catches the pair sharing vocabulary but not spelling. Word trigrams are the near-verbatim check and stay small because two people rarely phrase a complaint the same way twice. The type disagreement is a **penalty, not a gate**: the detector is a keyword table, and one item saying `120fps` while another says `framerate` should still meet.

Thresholds are calibrated against real feedback: near-identical restatements score above 0.9, the same complaint in visibly different words in the high fifties, the same complaint from a different angle in the low thirties, unrelated notes under 0.15.

| Band | Behaviour |
|---|---|
| ≥ 0.72 | auto-link, no model, no cost |
| 0.34 – 0.72 | stage two: the model adjudicates, in batches of 10 |
| < 0.34 | discarded |

**With no provider** the band is simply not merged and the auto-link bar drops to 0.66. The creator sees "9 people reported this" instead of 12: degraded, never wrong in the dangerous direction.

**Candidate generation.** Inside a category, pairs are compared directly below 80 items. That is not a shortcut. At the 200-item candidate window a full comparison is a few thousand set intersections, and it has perfect recall where locality-sensitive hashing at these similarity levels does not. LSH (64 bands of 2 rows) switches on above that size. The textbook 16×8 split is tuned for documents that are 80% identical, and on feedback it buckets nothing.

**The verdict cache is the highest-value cache in the system.** A pair is adjudicated at most once, ever, keyed permanently by `sha256(min(aId,bId) + max(aId,bId) + schemaVersion)`. Union-Find over confirmed edges keeps clusters incremental. `recordUnmerge` writes a `distinct` verdict, so a creator correcting a bad merge is also what stops the pair being re-adjudicated into the same mistake.

Only `relation === 'duplicate'` with confidence above `low` merges. `subset` and `related` become "see also" links with both rows visible. The canonical statement is chosen from an existing member rather than synthesised, so no reviewer’s voice is ever put in another’s mouth.

### 4.6 `digest`: weekly creator digest

```ts
digest.generate(input: DigestInput, options?): Promise<AiResult<Digest>>
digest.heuristic(input: DigestInput): AiResult<Digest>
digest.shouldSend(input: DigestInput): SkipVerdict
```

`shouldSend` is evaluated before anything is generated: cadence off, or zero feedback with nothing shipped and no changelog, means no digest. An empty digest is worse than no digest, and it is the main reason people mute these.

Input is a **prepared brief** assembled by the caller: week-over-week metrics, the theme artifact from §4.1, dedupe reporter counts, shipped suggestions. The model never sees raw feedback, only quotes already selected and verified by the clusterer.

**Deterministic path.** Metrics and deltas straight from the brief. Fix-first is the top three open non-praise themes by the same impact score, ranked identically to the model path because the ranking input *is* the score. `why` is the reporter count plus the representative quote. Wins are themes whose mean rating rose ≥ 0.5, plus shipped suggestions. Regressions are a fall of ≥ 0.5 or a reporter count up ≥ 50%. Headline and next step come from templates chosen by the shape of the week.

**Grounding is per section, not all-or-nothing.** The schema is a flat object of independent parts, so after validation each section is checked against the brief: fix-first entries citing an unknown id are dropped, reporter counts and impact scores are overwritten with ours, `metrics` and `quiet` are never the model’s to restate. A section that ends up empty falls back to the computed one. The send is never delayed for an AI reason.

---

## 5. The impact formula

Both paths compute the same 0–100 integer, and the model is given the rubric in its prompt:

```
impact = 45% reach + 35% mean severity + 20% mean reviewer credibility
```

Reach saturates rather than scaling linearly (`n / (n + 4)`): the difference between two reporters and six is large, between forty and forty-four is not, and a linear term lets one popular theme flatten the board.

This is what makes configuring a key non-disruptive. A creator who turns AI on gets better grouping and better prose, not a dashboard where every number moved.

---

## 6. Caching, cost control and safety

### Persistence

Four tables, created on first use by `store.ts` and owned by this layer:

| Table | Purpose |
|---|---|
| `ai_artifact` | output keyed by input hash, with `schema_version` as the invalidation lever |
| `ai_run` | append-only ledger: provider, model, status, token counts, `cost_micros`, latency |
| `ai_job` | background work, unique on `(feature, subjectId)` while pending so a burst coalesces into one job |
| `ai_setting` | operator policy and per-user opt-outs |

Every call is wrapped. If SQLite is unavailable the layer keeps working against an in-process map; `aiStatus().persistent` reports which. A cache that cannot persist is a slower cache, not a broken feature.

### Cost control

- **Token ceilings and deadlines per feature**, in `FEATURE_POLICY`. The coach’s deadline is 700ms; past it the `AbortController` fires and the linter’s answer is shown.
- **Model tier per feature.** Cheap tier for triage and coaching, `reason` tier for clustering, intake and the digest, `work` tier for duplicate adjudication and triage escalation.
- **Budget guard**, measured from `response.usage` against a rate table, in integer micro-dollars. Monthly cap $25, per-user daily $0.25, per-project daily $1.00 by default. Sums are cached 60s per scope. Over any cap the deterministic path runs and the operator sees it; no user-facing feature hard-fails on budget.
- **Circuit breaker per provider.** Five failures in 60s opens it for five minutes, then admits a single half-open probe. While open the model path is skipped with **zero added latency**, which matters more than the quality loss.
- **Per-feature kill switches** through `setEnabledFeatures`, honoured server-side; a disabled feature reports `degraded: 'disabled_by_user'` and still returns real output.
- **Rate limits** in `RATE_LIMITS`: theme runs per project per day, coach calls per reviewer per day, intake per user per hour, batch sizes, candidate windows.
- **Prompt caching** on every system prefix above the minimum; `cacheReadRatioSince` surfaces the hit rate so a cache-miss streak is visible rather than silently expensive.

### Untrusted content

This is a feedback platform, so every body of text is written by a stranger about someone else’s work. Four defences, ordered by how much they depend on the model co-operating:

1. **Structured output.** A forced tool call with a strict schema. An injected instruction has no channel to speak through.
2. **Zod re-validation** server-side, unknown keys stripped.
3. **Verification against our own rows.** Quotes must be literal substrings; cited ids must exist and belong to the subject; a triage batch whose ids drift is discarded.
4. **Prompt framing.** `wrapUntrusted` strips contact details, credential-shaped strings and tag delimiters, then wraps the text in `<untrusted_content>`. `UNTRUSTED_CONTENT_RULE` tells the model the contents are data. This is last on the list on purpose.

Email addresses never enter a prompt. Reviewers are referenced by opaque id.

---

## 7. Honest provenance

```ts
aiStatus(): AiStatus
```

Returns which providers are configured and reachable, each breaker’s state and cooldown, the path each feature will take on its next call with the reason or the model name, spend against cap, cache-hit ratio, per-feature run counts and the job queue depth.

This exists so the interface can say **"Keyword grouping"** or **"Clustered with Claude"** truthfully, instead of hiding which one happened. A provenance label that lies is worse than no label: it teaches a creator to distrust every number on the page.

The honest name for each path is in `FEATURE_POLICY`:

| Feature | No provider | With a provider |
|---|---|---|
| themes | Keyword grouping | Clustered with Claude |
| coach | Writing tips | AI writing tips |
| intake | Suggested from your description | Suggested with Claude |
| triage | Auto-labelled | Labelled with Claude |
| dedupe | Grouped by similarity | Grouped with Claude |
| digest | Computed from your week | Written with Claude |

---

## 8. Enabling the AI path

Set any one of these in `.env.local` and restart. No other change is needed anywhere in the app.

```bash
ANTHROPIC_API_KEY=sk-ant-...     # primary for every reasoning task
OPENAI_API_KEY=sk-...            # cross-provider failover, and the only embeddings source
KIMI_API_KEY=sk-...              # OpenAI-compatible
KIMI_BASE_URL=https://api.moonshot.ai/v1   # optional, this is the default
```

Operational policy is not a secret and does not live in the environment. It is typed defaults in `config.ts` that the operator page overrides through `ai_setting`:

```ts
import { setBudgetConfig, setEnabledFeatures } from '@/server/ai'

setBudgetConfig({ monthlyMicros: 50_000_000 })     // $50
setEnabledFeatures(['themes', 'triage', 'digest']) // the rest run deterministic
```

A per-reviewer opt-out for the coach is `coach.setCoachEnabled(userId, false)`, honoured on the server.

---

## 9. Verifying the zero-key claim

The claim is that with `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and `KIMI_API_KEY` all unset, every feature still returns something genuinely useful. It was checked against a representative feedback set during development, and the deterministic paths produced:

- **themes**: two themes from seven notes. `Jump Floaty` grouping three differently-worded reports of the same input-timing problem with an impact of 55, and `Crafting` grouping two tutorial-coverage reports at 48. Unrelated notes correctly left unclustered.
- **coach**: `thin` on a twenty-character draft; `ok` with all specificity checks passing on a real one; two scaffold chips offered on a weak one and silence thereafter.
- **intake**: `game` at high confidence from a Godot description plus an `itch.io` link, stage `prototype`, tags `roguelike`/`deckbuilder`/`godot`, the five curated game axes, and a composed ask.
- **triage**: sentiment scores derived from axis ratings, a save-corruption report correctly at `blocker` and type `bug`, a compliment at `praise` with +0.96.
- **dedupe**: three near-identical reports merged into one cluster with a reporter count of three and a verbatim canonical line; two genuinely different phrasings of one complaint left in the undecided band rather than merged without an adjudicator.
- **digest**: a real headline, week summary, ranked fix list, wins, regressions and a next step, all computed.

With an unreachable provider configured, the coach fell back in 276ms and the clusterer in 82ms, both with full output. A `degraded` reason is always set so the reason is never guessed at.

For CI, run the route smoke suite twice: once with keys, once with all three empty and outbound network blocked. The assertions must be identical. The suite should fail if a feature’s absence changes a page’s **structure** rather than only its provenance label.

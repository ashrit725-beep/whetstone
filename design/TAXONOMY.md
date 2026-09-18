# taxonomy

> Full feedback taxonomy and reputation IP for Whetstone: rating axes, categories and elicitation prompts for 10 project types; a structured feedback item schema (severity × reach, 4-level actionability, bug triple, dual effort estimate); a precise reputation algorithm with specificity gating, creator-discrimination weighting, time decay, Bayesian shrinkage, expert-grant criteria and named anti-gaming defenses; and a Discover ranking formula with a need boost, cold-start slot reservation and anti-extraction penalties.

# Whetstone — Feedback Taxonomy & Reputation System

This is the product IP: the thing that makes Whetstone feedback different from a comment box. Three layers.

1. **Taxonomy** — what a reviewer is asked, per project type. Turns "looks cool!" into a located, categorized, severity-graded claim.
2. **Structure** — the shape of a single feedback item, so a creator can triage 40 of them in ten minutes.
3. **Economics** — reputation and ranking, so the good reviewers rise, the farmers don't, and unreviewed projects still get eyes.

---

## 0. The spine

Every project type draws its rating axes from four families plus one type-unique axis. This keeps 10 taxonomies feeling like one system, makes cross-type reviewer reputation meaningful, and lets the dashboard render the same charts everywhere.

| Family | Question it answers | Appears as |
|---|---|---|
| **Value** | Is this worth someone's time or money? | Fun, Job Fit, Problem Sharpness, Hook Strength… |
| **Comprehension** | Do I understand it without being told? | Onboarding & Legibility, Message Clarity, Docs Quality… |
| **Friction** | What actively hurts? | Flow Friction, Balance & Difficulty, Ergonomics… |
| **Execution** | Is the craft there? | Game Feel, Production Craft, Build & Durability… |
| **Type-unique** | The thing only this medium has | Platform Fit, Manufacturability, Willingness to Pay… |

**Rating scale.** All axes are 1–5 with *written anchors per axis* (never bare stars), plus a mandatory-available **"Not enough exposure to rate"** which is excluded from the mean — never silently counted as 3. Axis means are Bayesian-shrunk toward the project type's global mean: `μ̂ = (n·x̄ + k·μ_type) / (n + k)`, `k = 4`. Below `n = 4` the UI shows a range and the individual ratings, never a headline number.

**Universal categories** available on every type (in addition to the type-specific list): `Bug/Defect`, `Confusion`, `Friction`, `Missing`, `Delight / keep-this`, `Positioning`, `Accessibility`, `Performance`, `Copy`.

`Delight / keep-this` is not decoration. Creators cut good things by accident between builds; a tagged "keep this" item is the cheapest insurance in the product.

**Forced ranking at submit.** Every review ends with: *"If they only fix one thing, which of your items is it?"* — reviewers drag their top 3 into order. This single constraint produces more signal per keystroke than any other mechanic here, and it feeds `Need`/theme weighting downstream.

---

## 1. Taxonomy by project type

### 1.1 Game

| Axis | Definition (shown under the label) |
|---|---|
| **Fun** | Did the core loop make you want another round? |
| **Balance & Difficulty** | Was the challenge tuned fairly — no dead ends, no obviously dominant strategy? |
| **Game Feel & Controls** | Do inputs respond precisely and read the way they look? |
| **Onboarding & Legibility** | How fast did you understand the goal, the rules, and the current state without being told? |
| **Performance & Stability** | Frame pacing, load times, and crashes on your actual hardware. |

**Categories:** Core loop · Difficulty curve · Controls/input · Camera · UI/HUD · Tutorial/onboarding · Level design · Combat/mechanics · Economy/progression · Audio · Art readability · Narrative · Multiplayer/netcode · Save/progression loss · Accessibility (remapping, colorblind, subtitles)

**Prompts:**
1. At what minute did you first know what you were supposed to do? What told you?
2. Describe the last time you died or failed. Did it feel like your mistake, or the game's?
3. Was there a strategy you found that felt too strong or too safe? Name it.
4. Name one input that felt off: the action, what you pressed, what you expected to happen.
5. If you stopped playing, give the exact moment and why.

---

### 1.2 Web app

| Axis | Definition |
|---|---|
| **Job Fit** | Does it do the job you'd actually hire it for, end to end? |
| **Time to First Value** | How long until you got a real result — not a tour, a result? |
| **Flow Friction** | Dead ends, extra steps, re-entered data, states you couldn't read. |
| **Trust & Clarity** | Do you understand what it did to your data, and whether it worked? |
| **Performance & Reliability** | Speed, errors, and behavior on a slow or broken connection. |

**Categories:** Signup/onboarding · Empty state · Core task flow · Navigation/IA · Forms · Error handling · Import/export · Permissions & sharing · Pricing/paywall · Search · Responsive/mobile · Integrations · Microcopy · Performance

**Prompts:**
1. What was the first thing you tried to do, and did you finish it? Say where you stalled.
2. Name a screen where you didn't know what would happen if you clicked the primary button.
3. Where did you have to type something the app already knew?
4. What did you expect to find in the navigation that wasn't there?
5. If this replaced a tool you use today, what would still be missing on day one?

---

### 1.3 Mobile app

| Axis | Definition |
|---|---|
| **First-Session Payoff** | Did the first two minutes give you a reason to open it again tomorrow? |
| **Thumb Ergonomics** | Reach, target size, and gesture comfort with one hand. |
| **Platform Fit** | Does it behave like a native app — back, share, safe areas, haptics, system settings? |
| **Flow Friction** | Steps, interruptions, and state loss on the main path. |
| **Performance & Battery** | Launch time, scroll jank, heat, and what happens offline. |

**Categories:** Install/first run · Permission prompts · Tab/nav structure · Gestures · Notifications · Offline & sync · Keyboard/input · Layout on my device · Dark mode · Haptics/sound · Deep links · Crash · Accessibility (Dynamic Type, VoiceOver/TalkBack) · Store listing

**Prompts:**
1. Device and OS version — and anything that looked broken on your specific screen size.
2. Which action needed two hands that should have needed one?
3. When did it ask for a permission, and did you understand why *at that moment*?
4. What happened when you backgrounded it mid-task and came back?
5. Would you keep notifications on? One line on why.

---

### 1.4 Website (marketing / content, not app)

| Axis | Definition |
|---|---|
| **Message Clarity** | Can you say what this is and who it's for after five seconds? |
| **Credibility** | Does it read like something you'd trust with your money or your email address? |
| **Scan & Find** | Could you locate the specific thing you came for? |
| **Conversion Pull** | Is the next action obvious, and worth taking? |
| **Craft & Responsiveness** | Type, spacing, imagery, and behavior across viewports. |

**Categories:** Hero/headline · Value proposition · Social proof · Pricing page · Navigation · Page speed · Visual design · Copy & tone · CTA · Forms · SEO/metadata · Mobile layout · Broken link · Accessibility

**Prompts:**
1. Without scrolling back: what does this do, and for whom? Quote the words that told you.
2. What was the first thing you doubted or distrusted?
3. You came to find the price — how long did it take, and what got in the way?
4. Which CTA did you almost click, and what stopped you?
5. Paste the sentence doing the most work, and the one you'd delete.

---

### 1.5 Video

| Axis | Definition |
|---|---|
| **Hook Strength** | Do the first 15 seconds earn the next 60? |
| **Pacing & Retention** | Where does attention sag, and where does it spike? |
| **Clarity of Story** | Can you follow the through-line without rewinding? |
| **Production Craft** | Audio, framing, lighting, edit rhythm, on-screen text legibility. |
| **Payoff** | Does the ending justify the watch and land its ask? |

**Categories:** Hook/first 15s · Structure · Pacing · Script · Audio mix · Music · VO delivery · Color & lighting · Framing · Graphics & captions · B-roll · Cut timing · Thumbnail/title · End screen/CTA · Platform fit (short vs long)

**Every video item requires a timecode anchor.** The composer rejects an untimed issue on a video project.

**Prompts:**
1. Timecode where you first considered skipping — and what you'd cut there.
2. Timecode anywhere you had to rewind. What was unclear?
3. Audio: any point where levels, room tone, or music fought the voice? Timecode it.
4. If you had to cut 20% of the runtime, which timecoded chunks go?
5. Would this thumbnail and title make you click in a crowded feed? What would you change?

---

### 1.6 Business idea

| Axis | Definition |
|---|---|
| **Problem Sharpness** | Is a real, frequent, painful problem named — for a person you could point at? |
| **Differentiated Insight** | Does this know something non-obvious about the market? |
| **Willingness to Pay** | Would the stated buyer actually pay the stated price? |
| **Path to First 100** | Is there a specific, credible way to reach the first hundred customers? |
| **Risk Honesty** | Are the real killers named, or dodged? |

**Categories:** Problem definition · Target customer · Alternatives & status quo · Pricing/model · Unit economics · Go-to-market · Moat · Regulatory/legal · Founder fit · Timing · Testable assumptions · Naming/brand

**Prompts:**
1. Are you the customer? If yes — what do you do instead today, and what does it cost you?
2. Name the strongest alternative, including "do nothing," and why it loses.
3. At the stated price, would you buy? If not, at what price would you?
4. Which single assumption, if false, kills this? How would you test it in two weeks?
5. Where would you actually find the first 100 buyers — name the channel, not the category.

---

### 1.7 Hardware

| Axis | Definition |
|---|---|
| **Problem–Form Fit** | Does the physical form solve this better than software or an object you already own? |
| **Ergonomics & Handling** | Grip, weight, reach, control placement, wear comfort. |
| **Build & Durability Read** | Materials, tolerances, and what you expect to break first. |
| **Manufacturability & Cost Realism** | Can this be built at the stated price and volume? |
| **Setup & Daily Use** | Unboxing, pairing, power, and maintenance over a week. |

**Categories:** Industrial design · Ergonomics · Materials & finish · Mechanism/moving parts · Thermals · Power & battery · Connectivity/pairing · Firmware & companion app · DFM/assembly · BOM & cost · Safety & compliance · Packaging · Repairability · Documentation

**Prompts:**
1. Which part would you expect to fail first, and why? Point at it.
2. Where do your hands go — and what do they hit that they shouldn't?
3. What's the most expensive thing in this design that a user will never notice?
4. Describe the charging or power routine in daily life. Is it acceptable?
5. At 1,000 units, which production step would you expect to blow the schedule?

---

### 1.8 Design (UI, brand, graphic)

| Axis | Definition |
|---|---|
| **Concept Strength** | Is there an idea here, or only styling? |
| **Hierarchy & Legibility** | Does the eye land in the right place, and does it read easily? |
| **Craft** | Spacing, alignment, type detail, color handling, internal consistency. |
| **Tone Fit** | Does it feel like the brand and audience it claims? |
| **Systemic Durability** | Will it survive real content, long strings, edge states, other viewports? |

**Categories:** Concept · Composition · Typography · Color · Spacing & rhythm · Iconography · Imagery/illustration · Motion · Brand tone · Component consistency · States (empty/error/loading) · Localization & long strings · Contrast/accessibility · File hygiene

**Prompts:**
1. Where did your eye land first? Was that the intended first thing?
2. Name one element you'd remove entirely — and what improves once it's gone.
3. Which detail reads as unfinished? Give the exact element and the specific flaw.
4. Imagine double the real content length. What breaks?
5. Give three adjectives this evokes. Do they match the brief's adjectives?

---

### 1.9 Writing

| Axis | Definition |
|---|---|
| **Opening Pull** | Does the first paragraph earn the second? |
| **Structure** | Does it move, and can you follow the spine? |
| **Line Quality** | Sentence rhythm, precision, and absence of filler. |
| **Clarity for the Intended Reader** | Assumed knowledge, jargon, and what goes undefined. |
| **Ending Landing** | Does it conclude, or just stop? |

**Categories:** Opening · Structure · Pacing · Argument & evidence · Voice/character · Dialogue · Jargon & clarity · Line edit · Repetition/filler · Tone fit · Title & subheads · Scannability · Claim check · Ending

**Prompts:**
1. Quote the last sentence you read before you wanted to stop.
2. Say the thesis in your own words. If you can't, say where it slipped.
3. Mark the three paragraphs you'd cut with no loss.
4. Which claim needed evidence you didn't get?
5. Paste one sentence you'd steal and one you'd rewrite.

---

### 1.10 API / dev tool

| Axis | Definition |
|---|---|
| **Time to First Successful Call** | Minutes from landing page to a working response. |
| **API Ergonomics** | Naming, consistency, defaults, ceremony, and footguns. |
| **Docs Quality** | Can you do the second and third thing without reading the source? |
| **Error & Debuggability** | Do failures tell you what you did wrong and how to fix it? |
| **Production Readiness** | Auth, versioning, limits, idempotency, observability. |

**Categories:** Install/setup · Quickstart · Auth · Naming & consistency · Types/schema · Defaults · Error messages · Pagination · Rate limits · Versioning & stability · SDK ergonomics · CLI UX · Docs & examples · Observability · Performance · Security

**Prompts:**
1. How many minutes and how many browser tabs to your first 200? Paste the snippet that finally worked.
2. Paste an error verbatim. What did you think it meant, and what did it mean?
3. Name a parameter or method whose name misled you.
4. What did you have to read the source — or guess — to learn?
5. What would stop you putting this into production on Monday?

---

## 2. The structured feedback item

A **Review** = axis ratings + N **Items** + a forced top-3 ranking. The Item is the atom.

```ts
type FeedbackItem = {
  id: string
  projectId: string
  versionId: string        // items bind to a build, not a project
  reviewId: string
  authorId: string

  kind: 'praise' | 'issue' | 'bug' | 'idea' | 'question' | 'risk'
  categories: CategoryId[]  // 1–3, from the type's list
  axisRefs: AxisId[]        // which rating this item explains

  anchor?: Anchor           // timecode | route | screenName | selector
                            // | fileLine | frameId | pageNumber | componentId
  severity?: Severity       // required unless kind = praise | question
  reach?: Reach
  actionability: Actionability
  effortReviewer?: Effort   // optional, offered only to domain-credible reviewers
  effortCreator?: Effort    // set by creator during triage

  repro?: Repro             // REQUIRED when kind = 'bug'
  body: string
  attachments: Attachment[] // screenshot, clip, log, patch, redline
  confidence: 'hunch' | 'fairly-sure' | 'certain'

  creatorState: 'open' | 'acknowledged' | 'planned' | 'shipped'
              | 'declined' | 'duplicate'
  declineReason?: string    // required to decline S0–S1
  themeId?: string          // assigned by clustering
  specificity: number       // 0–1, computed, see §3.1
  createdAt: string
}
```

### 2.1 Severity

| Level | Label | Definition |
|---|---|---|
| **S0** | Blocker | Prevents the core job entirely. No workaround. |
| **S1** | Major | Core job completable, but badly damaged; the workaround costs real time. |
| **S2** | Moderate | Noticeable defect or friction on a common path; a workaround exists. |
| **S3** | Minor | Small defect or annoyance; rare path, or cosmetic with real impact. |
| **S4** | Polish | Cosmetic or taste. No functional impact. |

`kind: 'praise'` carries no severity. `kind: 'risk'` (business idea, hardware) uses the same scale, read as "how fatal."

### 2.2 Reach — the other half of priority

| Value | Meaning |
|---|---|
| `everyone` | Anyone who opens it hits this |
| `most` | Common path, common setup |
| `some` | A segment, or a specific configuration |
| `just-me` | My hardware, my locale, my weird setup |

Severity alone over-prioritizes the dramatic. **Priority hint = severity × reach, plotted against effort** in the creator dashboard as four quadrants: **Quick Wins** (S0–S2 × E0–E1), **Big Rocks** (S0–S1 × E2–E4), **Cheap Polish** (S3–S4 × E0–E1), **Backlog** (everything else).

### 2.3 Actionability

Orthogonal to severity and to specificity. **A0 is not a lesser item** — a precisely located emotional reaction is gold, and the reputation math treats it that way.

| Level | Label | Definition | Example |
|---|---|---|---|
| **A0** | Observation | A reaction, no implied change. | "At 0:40 I lost the thread and checked my phone." |
| **A1** | Directional | Names what should change, not how. | "Onboarding never teaches the dash." |
| **A2** | Specific change | Names a concrete change. | "Force a gap jump in room 2 so dash is mandatory before the boss." |
| **A3** | Prescription + asset | Concrete change plus a usable artifact: patch, diff, redline, rewritten copy, repro repo. | PR attached. |

### 2.4 The bug triple

Required when `kind: 'bug'`.

```ts
type Repro = {
  environment: string     // auto-filled from session where possible:
                          // device, OS, browser, build hash, viewport
  whatITried: string[]    // numbered steps from a named start state
  whatHappened: string    // REQUIRED — the only hard-blocking field
  whatIExpected: string   // and, ideally, where that expectation came from
  frequency: 'always' | 'often' | 'once' | 'could-not-reproduce'
}
```

Composer rules, deliberately asymmetric:
- **Blocks submit** only on `whatHappened`. Blocking more loses reports, and a lost report is worse than a thin one.
- **Warns inline** on missing steps or expectation, with the warning phrased as value to the reviewer ("creators fix 3× more bugs that include steps"), not as a scold.
- `whatIExpected` gets a hint: *"…and what gave you that expectation?"* — that clause is what separates a bug from a preference, and it's the field that most often reveals a **documentation** defect rather than a code one.
- `could-not-reproduce` is a first-class, encouraged choice. Unreproducible reports are still evidence; hiding them behind shame destroys data.

### 2.5 Effort to fix — dual estimate

| Level | Label | Scale |
|---|---|---|
| **E0** | Trivial | Under 30 minutes — copy, a constant, a toggle |
| **E1** | Small | Hours; local change |
| **E2** | Medium | Days; touches several systems |
| **E3** | Large | Weeks; structural |
| **E4** | Foundational | Changes the premise — architecture, model, or business |

Two independent values. The reviewer's guess is **optional and only offered to reviewers with domain credibility ≥ 300** (an unqualified guess is noise that anchors the creator badly). The creator sets theirs during triage, blind to the reviewer's until after they commit.

The gap feeds **effort calibration** — `1 − mean(|E_reviewer − E_creator|)/4` over the last 25 paired items — surfaced on expert profiles. It's one of the hardest signals in the system to fake, because the creator's value is set independently and after the fact.

### 2.6 Theme clustering

Items across reviewers cluster into **Themes** (embedding similarity within the same category, threshold tuned for precision over recall — a wrong merge is worse than a missed one; creators can split or merge by hand and every correction retrains the threshold).

A theme carries:
- `agreement` — count of **distinct** reviewers, never item count
- `severityDistribution` and `contested` — set when axis sentiment splits (σ above threshold). "6 reviewers agree" and "4 say yes, 3 say no" must never render the same way; a contested theme is a *design decision surfaced*, not noise to average away.
- `demographics` — does this theme come only from experts? only from first-timers? Those are opposite instructions.

### 2.7 Suggestion tracker states

`open → acknowledged → planned → shipped | declined | duplicate`

- `shipped` requires linking a version, changelog entry, or commit. This is what makes follow-through auditable rather than claimable.
- `declined` on an S0/S1 requires a one-line public reason. Cheap to write, and it keeps the thread honest in both directions.
- `planned` pays reputation provisionally at half weight (§3.2) and **decays to a quarter after 120 days** if it never ships — otherwise "planned" becomes a free currency creators mint to buy goodwill.

---

## 3. The reputation algorithm

Design goals, in priority order: (1) specificity beats volume; (2) follow-through beats applause; (3) collusion is arithmetically unprofitable; (4) honest critical feedback is never punished; (5) expertise is per-domain, never a single vanity number.

Credibility `C_d(u) ∈ [0, 1000]` is computed **per domain** `d` (the 10 project types). The headline number is a weighted mean, but the profile always shows the per-domain bars.

### 3.1 Specificity score `S ∈ [0,1]` — computed at write time

```
S = clamp01( 0.30·s_struct + 0.25·s_evidence + 0.25·s_anchor + 0.20·s_lex )
```

| Term | Computation |
|---|---|
| `s_struct` | Fraction of applicable structured fields filled non-trivially: severity, reach, category, actionability, and the bug triple where required. |
| `s_evidence` | `min(1, 0.5·n_attachments + 0.5·has_artifact)` — screenshot, clip, log, error text, patch, redline. |
| `s_anchor` | `0` none · `0.5` coarse (a screen, a section) · `1.0` precise (timecode, route, file:line, frame, component). |
| `s_lex` | `1 − generic_ratio`, where `generic_ratio` is the share of content tokens matching a generic-phrase lexicon ("looks good", "needs polish", "just my opinion"), offset by concrete nouns matched against the project's own declared vocabulary (feature names, screen names, character names from the project card). |

`s_lex` is the only model-driven term and is **deliberately capped at 20% weight**. It can nudge; it can never decide. Its ratio-based form also means padding with project nouns dilutes the numerator rather than concentrating it — keyword stuffing lowers the score it was meant to raise.

`S` **gates rewards but never blocks posting.** A low-specificity item still appears in the thread. It just earns close to nothing.

**Dwell floor:** an item on a project where the reviewer's session was under 90 seconds, or where the build/embed was never opened, is capped at `S ≤ 0.4`. This is the single most effective defense against LLM-generated review dumps, because it measures the one thing generation can't fake — time with the artifact.

### 3.2 Per-review value `v_r`

Signals:

| Symbol | Signal | Range |
|---|---|---|
| `h_r` | Creator marked the review helpful | {0, 1} |
| `a_r` | Adoption: `shipped` = 1 · `planned` = 0.5 (→ 0.25 after 120d) · else 0 | [0, 1] |
| `û_r` | Trust-weighted peer upvotes, saturated | [0, 1] |
| `d_r` | Creator marked "not applicable" | {0, 1} |
| `m_r` | Moderation strike: 0 · 0.5 low-effort/spam · 1 abuse/plagiarism | {0, .5, 1} |

```
u_r  = Σ_voters min(C(voter)/500, 1.5) − Σ_downvoters min(C(voter)/500, 1.5)
û_r  = log1p(max(u_r, 0)) / log1p(25)          // saturates ≈ 25 trust-units
```

**Creator discrimination** — the core anti-collusion term. A creator who marks everything helpful carries no information:

```
p_helpful(c) = (marked_helpful + 2) / (reviews_received + 4)   // Beta(2,2) prior
D(c)         = 1 − |2·p_helpful(c) − 1|                        // 1 at p=0.5, →0 at extremes
κ(c)         = 0.4 + 0.6·D(c)                                  // ∈ [0.4, 1.0]
```

A creator who marks 100% of reviews helpful has their signal cut to 40% of face value — and the more they inflate, the less their inflation is worth. **Reciprocity damping** handles direct rings:

```
ρ(u,c) = 1 / (1 + 2·min(x_{u→c}, x_{c→u}))
```
where `x` counts positive signals passed each direction in 180 days. One-way admiration is untouched; mutual back-scratching collapses toward zero after two or three exchanges.

**Review value:**

```
v_r = S_r · ( 1.0·κ(c)·ρ(u,c)·h_r  +  1.8·κ(c)·a_r  +  0.8·û_r )
      − 0.6·d_r  −  4.0·m_r

v_r ∈ [−4, 4]   (clamped)
```

Read the weights as the product thesis: **adoption (1.8) outweighs applause (1.0) outweighs peer approval (0.8)**, and every positive term multiplies by `S`, so unstructured praise earns approximately nothing regardless of how enthusiastically it's received.

### 3.3 Domain credibility, decay, and shrinkage

Reviews attribute to domains with weight `ω_d(r)`: `1.0` primary, `0.7`/`0.3` for cross-tagged projects.

```
λ        = ln(2) / 270            // 9-month half-life, in days
w_time   = exp(−λ · age_days)

n_d      = Σ_r w_time·ω_d(r)                    // effective review count
E_d      = Σ_r w_time·ω_d(r)·v_r                // decayed evidence
q̄_d      = E_d / (n_d + k),          k = 8      // Bayesian shrink toward 0
V_d      = n_d / (n_d + 20)                     // saturating volume term

C_d(u)   = 1000 · clamp01( 0.65·norm(q̄_d) + 0.35·V_d )
norm(q̄)  = clamp01( (q̄ + 0.5) / 2.5 )           // q̄ = −0.5 → 0 ; q̄ = 2.0 → 1
```

The `k = 8` prior means your first eight effective reviews are heavily shrunk — no one arrives at high credibility on one lucky hit. The `V_d` saturation means volume contributes at most 350 points and reaches half of that at ~20 effective reviews.

Worked outcomes:

| Reviewer profile | `q̄` | `n` | `C_d` |
|---|---|---|---|
| High-volume, mediocre quality | 0.25 | 200 | **~525** |
| Low-volume, excellent quality | 1.8 | 12 | **~465** |
| Excellent and consistent | 1.7 | 30 | **~780** |
| Ten reviews, all ignored | 0.0 | 10 | **~247** |
| Actively harmful (strikes) | −0.4 | 15 | **~87** |

Grinding cannot reach the top tier. Quality without any volume cannot either. That's intentional — Whetstone's top badge should mean *sustained* signal.

**Global score** is the effective-count-weighted mean across domains, `C = Σ n_d·C_d / Σ n_d`, so a generalist number can never hide behind one strong specialty.

**Decay with a floor.** `n_d` shrinks continuously with inactivity, so both terms fall. But expertise doesn't vanish in a sabbatical:

```
C_display = max( C_d , 0.5 · C_peak · exp(−ln2 · months_since_peak / 24) )
```

A former expert who stops for a year still shows meaningful standing, marked "peak credibility, inactive since ___" rather than silently collapsed.

### 3.4 Tiers

| `C` | Tier |
|---|---|
| 0–99 | New |
| 100–299 | Contributor |
| 300–549 | Trusted |
| 550–799 | Signal |
| 800+ | Sharpener |

### 3.5 Expert status — granted, not accumulated

Per-domain. Requires **all** of:

| Gate | Threshold | Why |
|---|---|---|
| Credibility | `C_d ≥ 650` with `n_d ≥ 30` | Sustained, not spiky |
| Adoption rate | `Σa_r / 40 ≥ 0.20` over last 40 reviews in `d` | Creators actually ship their suggestions |
| Helpful rate | `≥ 0.55` from **≥ 12 distinct creators** | Breadth, not one patron |
| Creator concentration | Herfindahl `H = Σ pᵢ² ≤ 0.15` | No single-creator farm can qualify |
| Clean record | No moderation strike in 180 days | — |
| **Human confirmation** | Two existing experts in `d` (or staff) review 5 randomly sampled reviews and confirm with written reasons | The gate no formula should own alone |

Expert status **expires after 12 months** below the numeric floors, with a 60-day warned grace period. Annual re-confirmation by panel also defeats account sale — a transferred account fails the sample review immediately.

Credential verification (GitHub, shipped titles, employer, portfolio) grants a **"Verified ___"** chip. It never moves `C`. Credentials say who you are; Whetstone's number says what your feedback has been worth here, and those must stay separate or the number becomes a résumé.

### 3.6 Anti-gaming, attack by attack

| Attack | Defense |
|---|---|
| Reciprocal helpful-marking rings | `κ(c)` discrimination + `ρ(u,c)` reciprocity damping — both directions collapse within ~3 exchanges |
| Sockpuppet upvotes | Votes weighted by voter `C` (new accounts ≈ 0), `log1p` saturation at 25 trust-units, per-project vote budget |
| Volume grinding | `k=8` shrinkage, `V_d` saturation, and a hard cap of **6 rep-bearing reviews/day** (extras post normally, earn 0) |
| LLM-generated review dumps | Dwell floor (`S ≤ 0.4` under 90s or build never opened), `s_evidence` and `s_anchor` requiring artifacts a generator can't produce, rate cap |
| Keyword stuffing to raise `s_lex` | Ratio-based scoring (padding dilutes), 20% weight cap |
| **Creator retaliation** against honest criticism | `d_r` is **public on the thread** as a neutral badge; max one per review; declining S0–S1 requires a written reason; creators whose "not applicable" rate exceeds 3σ have `d_r` weight zeroed and are flagged |
| Paid-bounty collusion | Bounty-completed reviews earn reputation **only** via `a_r` and peer votes — `h_r` from the paying creator is set to 0. Money cannot buy the helpful mark. |
| Account sale / transfer | Payment and device fingerprint checks on tier transitions; annual expert re-confirmation by sample |
| Severity inflation to look rigorous | Severity calibration stat: reviewer's severity distribution vs. creator's final triage, shown on profile; persistent inflation lowers `κ`-analogous trust in their severity, not their `C` |

Two non-negotiables encoded above: **critical feedback must never cost a reviewer**, and **a creator's approval must never be worth more than a creator's shipping**.

---

## 4. Discover feed ranking

```
Rank(p, u) = Quality(p)^0.8 · Need(p) · Freshness(p) · Urgency(p)
           · Fit(p, u) · Penalty(p)
```

### 4.1 Freshness

```
Freshness(p) = 1 / (1 + (hours_since_meaningful_update / 36)^1.4)
```

**"Meaningful update"** = first publish, a new build/version, or a changed ask. **Not** comment activity — otherwise creators bump-farm their own threads, and the feed rewards noise.

### 4.2 Need — the thing that makes a feedback marketplace work

```
Need(p) = 1 + 1.6 · exp( −R_eff(p) / 3 )
```
where `R_eff` = qualified reviews (`S ≥ 0.5`) on the **current version**.

| Qualified reviews | Multiplier |
|---|---|
| 0 | **2.60×** |
| 1 | 2.15× |
| 3 | 1.59× |
| 5 | 1.30× |
| 10 | 1.06× |

A brand-new project outranks an established one at more than 2.5× the raw quality score. The boost fades fast enough that a popular project doesn't get suppressed forever. Once a project reaches the review count its creator asked for, `Need` drops to `0.3×` and it rotates out — the creator got what they came for.

```
Urgency(p) = 1 + 0.4 · [deadline within 14 days]
```
Rate-limited to **2 urgency flags per creator per quarter**, or every project is urgent and none are.

### 4.3 Quality

```
Quality(p) = 0.5·Q_creator + 0.3·Q_brief + 0.2·Q_engagement
```

| Term | Definition |
|---|---|
| `Q_creator` | `clamp01(C_creator / 800)` — creators have reputation too: responsiveness, triage rate, ship rate |
| `Q_brief` | Completeness of the ask: a specific question, a working build or embed, declared stage, chosen axes, ≥2 target categories |
| `Q_engagement` | `clamp01( (helpful_marks + 2·threads_with_creator_reply) / (3 + reviews) )` — do reviewers who go in find it worth it? |

`Q_brief` is weighted heavily on purpose: it's the term a first-time creator fully controls, so the feed teaches good asks on the very first post rather than gating newcomers behind history they can't have yet.

### 4.4 Fit and penalties

```
Fit(p,u) = (1 + 0.5·domain_match + 0.3·tag_overlap + 0.2·[needs an axis u is expert in])
         × (already_reviewed_this_version ? 0.15 : 1)
         × (shown_and_skipped ≥ 3 ? 0.5 : 1)
```

```
Penalty(p) = (≥5 unanswered reviews older than 7d ? 0.3 : 1)   // anti-extraction
           × (creator already in top 20 ? 0.6 : 1)             // author diversity
           × (flagged/unsafe ? 0 : 1)
```

The **anti-extraction penalty** is the ethical core of the ranking. A creator who takes feedback and never responds loses feed reach fast. Reviewer attention is the scarce resource on Whetstone, and the feed should spend it on people who use it.

### 4.5 Cold start and exploration

Two guarantees that override the ranking:

1. **Reserved slots.** Every 4th position (25% of the feed) is drawn from the **"Needs eyes"** pool — zero-or-one-review projects, sorted by `Need · Fit` alone, ignoring `Quality` entirely. A newcomer with no reputation and a decent brief is *guaranteed* distribution. Without this, the feed is a rich-get-richer machine and the marketplace dies from the supply side.
2. **ε-exploration.** 10% of impressions sample from eligible-but-low-rank projects, weighted by `Need`. This keeps the ranking's own estimates honest by continually testing them.

**Impression cap:** a project is limited per 24h to `400 + 200·log1p(reviews_still_wanted)` impressions, so nothing monopolizes the feed while its creator's needs are already met.

---

## 5. What this buys each side

| | Reviewer | Creator |
|---|---|---|
| **Gets** | Per-domain credibility that's hard to fake and portable as a public profile; paid bounty access at expert tier | Triage-ready items sorted by severity × reach × effort; themes with real agreement counts |
| **Pays** | Structure at write time — anchors, severity, the bug triple | Responsiveness: triage, reasons for declines, linked ships |
| **Punished for** | Volume without specificity; collusion; drive-by generation | Extraction without response; retaliation against criticism; inflated "planned" |

The taxonomy makes feedback *locatable*. The item schema makes it *triageable*. The reputation math makes honesty *the profitable strategy*. That combination is the product — the pages are just how it's delivered.
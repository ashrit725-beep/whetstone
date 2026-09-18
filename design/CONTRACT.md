# Whetstone Design Contract v1.0
**Direction: Grit Index** · Stack: Next.js 15 App Router, React 19, Tailwind CSS v4, TypeScript · Dark-first, light supported · No component library · WCAG 2.2 AA

> ### Superseded in part: read this before following anything below
>
> The build was remodelled after this document was written. The direction that
> ships is **Paper & Ink**, not Grit Index, and three sections here describe a
> design that no longer exists:
>
> | § | Status | What ships instead |
> |---|---|---|
> | 1. Art direction | **Superseded** | Warm paper and ink, not a cold blue-green stone ground. Light is the primary theme; dark inverts it. |
> | 2. Colour | **Superseded** | `--color-paper` `#f6f0e4` (dark: `#1a1610`), `--color-ink` `#17120c` (dark: `#f4eddf`), one mark `#a32d14` (dark: `#ff7b4f`). No blue accent, no straw. `src/app/globals.css` is the authority on every token. |
> | 3. Typography | **Superseded** | **Bricolage Grotesque Variable** for chrome and **Newsreader Variable** for voice, with Instrument Serif and Barlow used once each. The merge ledger at 0.5 chose Archivo over Bricolage; the remodel reversed that, and the width-axis rule still holds on Bricolage. |
> | 4–8 | **In force** | Spacing, component craft, motion ceilings, voice and the ban list are unchanged and still govern. |
> | 9. Finish gate | **In force** | Updated in place for the shipped faces. It is the gate that was run. |
>
> `direction.md` records the remodel and every deviation since. Where this
> document and `globals.css` disagree about a colour or a face, the stylesheet
> is right and this document is history.

This document is the single source of truth. Where it conflicts with any upstream skill, lens, or template, this document wins. Every hex, ratio, duration, and ch-value below is literal. An implementer who deviates must record the deviation in `/design/direction.md` with a one-line reason, or the build fails the Finish Gate (§9).

---

## 0. MERGE LEDGER (conflicts already resolved; do not re-litigate)

| # | Conflict | Resolution | Reason |
|---|---|---|---|
| 0.1 | Warm ember/terracotta accent (2 lenses) vs. ban on 10–30° warm-clay hues (1 lens) | **Neither.** Accent is tempering blue `#66ACE2` (HSL 206°, OKLCH H 243). | `#E2703A` measures HSL 19°, inside the banned clay band and adjacent to `#D97757`. The ban is the stronger signal. |
| 0.2 | Anthropic brand palette / Poppins / Lora | **Not used.** Zero of the seven brand hexes; neither face. | Whetstone is not an Anthropic surface. |
| 0.3 | Warm near-black ground `#14110F` vs. blue-green `#141D20` | **`#141D20`.** All neutrals sit in OKLCH hue 207–242. | Warm neutrals + a cool accent produce a muddy mid-tone; a cool ground makes the one warm token (straw) unmissable. |
| 0.4 | Warm cream light paper (`#FAF7F2`, `#F4F1EA`) | **Banned.** Light paper is `#EBEFF2` (cool). | `#F4F1EA`-family cream is a named generated-design tell, and it breaks hue constancy with the dark mode. |
| 0.5 | Bricolage Grotesque (2 lenses) vs. Archivo (1 lens) | **Archivo Variable.** | The headline move is a width-axis grind. Archivo's `wdth` axis is 62–125, with room above 100. Bricolage's width axis does not reach 112 and the rule would clamp silently. |
| 0.6 | Mono for all numerals (1 lens) vs. mono banned outside code (2 lenses) | **Mono only inside `<code>`, `<pre>`, `<kbd>`.** Numbers use Archivo + `tabular-nums`. | 2:1 majority, and Archivo's tabular figures align without a family switch. |
| 0.7 | Source Serif 4 for prose vs. "Source Serif as default" ban | **Literata Variable.** | Removes the ambiguity entirely; Literata is on no ban list, is screen-tuned, and has `opsz` + `wght` axes. |
| 0.8 | Em dash required (1 lens) vs. em dash banned (1 lens) | **Em dash banned in all shipped strings.** En dash `–` for numeric ranges, ellipsis `…`, curly quotes `’ “ ”` required. | Stricter rule wins; sentences wanting an em dash get split or take a colon. |
| 0.9 | 900ms hero sequence vs. 400ms animation ceiling | **360ms hero.** | Ceiling is absolute. The width-axis travel (118 → 96) is large enough to read as a grind at 360ms. |
| 0.10 | Number-counter reveals 1.2–1.6s | **Removed.** Numbers render final on first paint. | Violates the 400ms ceiling; counters are also a named generated-dashboard tell. |
| 0.11 | 24×24px targets (WCAG 2.5.8) vs. 44×44px | **44×44px everywhere**, ≥8px gap between adjacent targets. | Passes SC 2.5.8 with margin. |
| 0.12 | 80ch cap vs. 45–75ch | **72ch hard cap**, 66ch prose, 58ch UI. | Stricter ceiling wins. |
| 0.13 | Radix / Headless UI prescribed vs. "no component library" | **Hand-built primitives + platform.** Native `<dialog>` + `showModal()`, Popover API, `inert`. Each primitive documents its keyboard contract in a header comment and ships a Testing Library test that queries by role. | The brief forbids the dependency; the platform now covers the focus trap and backdrop. |
| 0.14 | "Diversify every build" vs. nine surfaces of one product | **System locked after surface 1.** Surfaces 2–9 inherit tokens, nav, footer, and grammar from `/design/direction.md`. Only the *layout grammar* varies per surface, never the system. | Nine different macrostructures would read as nine unrelated sites. |
| 0.15 | "Variance/asymmetry per page" vs. "product UI must disappear" | **Variance applies to surfaces 1 and 6 only** (landing, public profile). Surfaces 2, 3, 4, 5, 7, 8, 9 are conventional: novelty in the composer or dashboard is a defect. | Marketing persuades; tools must be predictable. |
| 0.16 | Warn/caution needs a hue; straw already owns commerce | **One straw hue, two roles separated by form.** Commerce = straw *fill* with dark ink. Warn = straw *icon + 1px border + label*, never a fill. | Adding a sixth hue costs more than the shared hue does, and no state is ever carried by color alone anyway. |
| 0.17 | `info` semantic | **`--info` is the accent.** Info callouts are the only non-interactive use of the accent. | Five hues total is the cap. |
| 0.18 | Dark mode needs a "reason to be dark" | Recorded verbatim in `/design/direction.md`: "Dark base because every Discover card, project embed, gameplay clip and screenshot is media on a dark stage, and reviewers work long evening sessions." Light theme is real, toggled, and contrast-verified. | |

---

## 1. ART DIRECTION

**Grit Index.** Whetstone looks like a sharpening bench under a work lamp: a cold blue-green stone ground (`#141D20`, never a tinted near-black), hairline-ruled rows instead of floating cards, one warm tempering-straw accent reserved for money and focus, and one cool tempering-blue accent for every action, so the only warm object on any screen is the one you are being paid for or the thing your keyboard is pointing at. The whole product is organised by a single real data structure, the **grit index** (120 = concept, 400 = prototype, 1000 = beta, 3000 = release candidate, 8000 = shipped), rendered everywhere as an SVG hatch whose stroke steps 3px → 2px → 1.25px → 0.75px → 0.5px and whose spacing halves at each step, always paired with the literal numeral; it is the filter in Discover, the rail on Project Detail, the selector in the composer, the axis in the dashboard rollup, the history strip on profiles, and the segmentation in the marketplace. Type carries the division of labour and it is visible at a glance: **Archivo** (variable, width axis worked as a design element) for every piece of machine chrome (nav, buttons, labels, counts, headlines), **Literata** for every word a human wrote (the ask, feedback bodies, discussion posts, bios), so a serif paragraph inside a row is the signal that there is a person in there.

**Permitted metaphor vocabulary** (the only figurative words allowed in UI copy, section names, and code identifiers): grit, bevel, hone, edge, burr, slurry, rail, bench, pass. Anything outside this list is literal product language.

**Where boldness is spent** (exactly one element per surface; name it in a comment at the top of the page file):
- Landing: the hero honing sequence on the word "sharper".
- Discover: the grit-scale filter rail.
- Project detail: the 3rem bevel rail in the left gutter.
- Composer: the grit selector.
- Dashboard: the theme rollup bars.
- Public profile: the 5-cell grit history strip.
- Marketplace: straw as a fill (the only surface where it fills).
- Discussions: nothing. Hairlines and type only.
- Auth: nothing. Control edges are the only structure.

---

## 2. COLOR

### 2.1 Token set

All tokens live in `app/globals.css` inside `@theme` (Tailwind v4 has no `tailwind.config.js`). Dark is the root default. Light is applied by `:root[data-theme="light"]` **and** by `@media (prefers-color-scheme: light)` guarded with `:root:not([data-theme="dark"])`. **No hex, `oklch()`, `rgb()`, or `hsl()` literal may appear anywhere else in the repo.**

```css
@import "tailwindcss";           /* must stay first; never drop it */

@theme {
  /* ---------- DARK (default) ---------- */
  --color-surface-0:        #0E1417;  /* recessed: input interiors, code wells, zebra-low */
  --color-surface-1:        #141D20;  /* page ground */
  --color-surface-2:        #1B262A;  /* raised: app nav, sticky filter bar, table stripe */
  --color-surface-3:        #223037;  /* card, feed row, thread bubble, popover body */
  --color-surface-4:        #2A3A41;  /* modal, sheet, top of stack */
  --color-surface-wash:     #1E3240;  /* info/callout background only. Never a row-selection fill */

  --color-border-hair:      #2E4047;  /* decorative rules only; carries no information */
  --color-border-control:   #6E858D;  /* every input, checkbox, toggle, chip, card edge */
  --color-border-strong:    #93A7AE;  /* hovered control edge, active tab underline */
  --color-hatch:            #7E939A;  /* grit hatch strokes, chart gridlines, sparkline */

  --color-text-1:           #E6EDEE;  /* headings, body, primary values */
  --color-text-2:           #BCCACE;  /* secondary: row subtitles, table body, helper text */
  --color-text-3:           #93A7AE;  /* tertiary: metadata, timestamps, counts, placeholders */
  --color-text-disabled:    #6E858D;  /* paired with aria-disabled + a reason; never opacity alone */

  --color-accent:           #66ACE2;  /* primary action, links, selected tab, grind-mark */
  --color-accent-ink:       #07161E;  /* text on an accent fill */
  --color-straw:            #F0C24B;  /* money + warn + focus ring */
  --color-straw-ink:        #241A05;  /* text on a straw fill */
  --color-positive:         #6FCF8E;  /* shipped, resolved, accepted */
  --color-positive-ink:     #06170D;
  --color-critical:         #FF7A80;  /* destructive, validation error, failed */
  --color-critical-ink:     #1C0406;
  --color-warn:             var(--color-straw);
  --color-info:             var(--color-accent);
  --color-focus:            #F0C24B;

  --color-scrim:            rgba(6, 12, 14, 0.66);
}

:root[data-theme="light"],
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) {
  --color-surface-0:        #E1E6EA;
  --color-surface-1:        #EBEFF2;
  --color-surface-2:        #F3F7FA;
  --color-surface-3:        #F3F7FA;  /* see 2.4: light separates elevation with rules, not greys */
  --color-surface-4:        #F3F7FA;
  --color-surface-wash:     #E0E6EA;

  --color-border-hair:      #C8D2D8;
  --color-border-control:   #6A797F;
  --color-border-strong:    #4B5E64;
  --color-hatch:            #6A797F;

  --color-text-1:           #0E171A;
  --color-text-2:           #31464C;
  --color-text-3:           #4B5E64;
  --color-text-disabled:    #6A797F;

  --color-accent:           #1C5E8E;
  --color-accent-ink:       #F3F7FA;
  --color-straw:            #795B00;   /* text/border role */
  --color-straw-fill:       #F0C24B;   /* fill role, unchanged across modes */
  --color-straw-ink:        #241A05;
  --color-positive:         #1F6E3C;
  --color-positive-ink:     #F3F7FA;
  --color-critical:         #B12433;
  --color-critical-ink:     #F3F7FA;
  --color-focus:            #795B00;

  --color-scrim:            rgba(14, 23, 26, 0.42);
}}
```

### 2.2 Measured contrast, dark theme (WCAG 2.x, computed, not estimated)

Body text floor 4.5:1; large text (≥24px, or ≥18.66px bold), icons, control boundaries, focus rings floor 3:1.

| Foreground | on `surface-0` #0E1417 | on `surface-1` #141D20 | on `surface-2` #1B262A | on `surface-3` #223037 | on `surface-4` #2A3A41 | Verdict |
|---|---|---|---|---|---|---|
| `text-1` #E6EDEE | 15.66 | **14.44** | 13.05 | 11.46 | 9.95 | AA + AAA all |
| `text-2` #BCCACE | 11.03 | **10.17** | 9.19 | 8.07 | 7.01 | AA + AAA all |
| `text-3` #93A7AE | 7.41 | **6.83** | 6.17 | 5.42 | 4.71 | AA body on all five |
| `accent` #66ACE2 | 7.57 | **6.98** | 6.31 | 5.54 | 4.81 | AA body on all five |
| `straw` #F0C24B | 11.07 | **10.21** | 9.23 | 8.10 | 7.04 | AA + AAA all |
| `positive` #6FCF8E | 9.72 | **8.96** | 8.10 | 7.11 | 6.18 | AA + AAA all |
| `critical` #FF7A80 | 7.38 | **6.81** | 6.15 | 5.40 | 4.69 | AA body on all five |
| `hatch` #7E939A | 5.77 | **5.32** | 4.81 | 4.22 | 3.67 | ≥3:1 non-text on all five |
| `border-control` #6E858D | 4.78 | **4.41** | 3.98 | 3.49 | 3.04 | ≥3:1 non-text on all five (SC 1.4.11) |
| `border-hair` #2E4047 | 1.72 | **1.58** | 1.43 | 1.26 | 1.09 | **Decorative only.** Never the sole boundary of a control or the sole carrier of a grouping. |

Text on `surface-wash` #1E3240 (info callouts): `text-1` 11.17, `text-2` 7.87, `text-3` 5.29. All AA.

**Ink on fills (dark):** `#07161E` on accent `#66ACE2` = **7.50** · `#241A05` on straw `#F0C24B` = **10.22** · `#06170D` on positive `#6FCF8E` = **9.67** · `#1C0406` on critical `#FF7A80` = **7.81**. Accent and critical fills take **dark** ink, never white (`#FFFFFF` on `#FF7A80` is 3.37 and fails).

### 2.3 Measured contrast, light theme

| Foreground | on `surface-0` #E1E6EA | on `surface-1` #EBEFF2 | on `surface-2/3/4` #F3F7FA | Verdict |
|---|---|---|---|---|
| `text-1` #0E171A | 14.45 | **15.71** | 16.86 | AA + AAA |
| `text-2` #31464C | 7.91 | **8.60** | 9.24 | AA + AAA |
| `text-3` #4B5E64 | 5.42 | **5.89** | 6.32 | AA body |
| `accent` #1C5E8E | 5.49 | **5.97** | 6.41 | AA body |
| `straw` #795B00 | 5.05 | **5.49** | 5.89 | AA body |
| `positive` #1F6E3C | 4.98 | **5.41** | 5.81 | AA body |
| `critical` #B12433 | 5.27 | **5.74** | 6.15 | AA body |
| `border-control` / `hatch` #6A797F | 3.59 | **3.90** | 4.19 | ≥3:1 non-text (SC 1.4.11) |
| `border-hair` #C8D2D8 | 1.22 | **1.33** | 1.44 | Decorative only |

Text on `surface-wash` #E0E6EA: `text-1` 14.42, `text-3` 5.41. AA.

**Ink on fills (light):** `#F3F7FA` on accent `#1C5E8E` = **6.41** · `#241A05` on straw-fill `#F0C24B` = **10.22** · `#F3F7FA` on positive `#1F6E3C` = **5.81** · `#F3F7FA` on critical `#B12433` = **6.15**.

### 2.4 Color rules

1. **Elevation, dark:** five fills, zero shadow on anything attached to the page. A card is `surface-3` + 1px `border-hair`. Adjacent step ratios: 1.107 / 1.139 / 1.151, which is a visible step without a shadow.
2. **Elevation, light:** three fills. `surface-2/3/4` share `#F3F7FA`; they are separated from the ground by the 1px hairline and, for elevation 4 only, by `--shadow-overlay` plus the page scrim. Light UIs read elevation from rules, not from more greys.
3. **Hue constancy:** every chromatic token holds its OKLCH hue across modes within 4°. accent 243.3 → 244.9 · straw 87.3 → 86.2 · positive 152.7 → 151.6 · critical 19.1 → 21.4.
4. **No zero-chroma neutrals.** Every neutral measures OKLCH chroma 0.0042–0.0292 and hue 207–242. No neutral in either mode sits in the warm 20–110 hue band. (`surface-2` light `#F3F7FA` is the lowest at C 0.0059.)
5. **Accent footprint ≤3% of any viewport.** Measure by screenshot: if accent pixels exceed 5%, the build fails. At most one accent-filled element per viewport.
6. **Selection is never a fill.** A selected/current row is marked by (a) the 2px accent **grind-mark** on its leading edge, (b) its title stepping from `text-2` to `text-1`, and (c) `aria-current="true"`. `--surface-wash` is for info callouts only.
7. **The grind-mark is the identity motif.** A 2px solid accent rule on the leading edge of exactly one element per view (the open ask, the selected thread, the current bounty) and nowhere else. It replaces the banned 4–6px colored left stripe: 2px, leading edge only, one per view.
8. **No hue carries meaning alone.** Every sentiment segment, rating, status chip, and validation state ships hue **plus** a text label **plus** a numeral or a Phosphor glyph. The dashboard rollup must be fully readable in greyscale.
9. **Every rule that sets `background-color` sets `color` in the same rule.** No surface-flipping class relies on inheritance.
10. **Straw fills only on the Reviewer marketplace** (surfaces 7): bounty amounts, paid-request buttons, open-bounty chips. Everywhere else straw appears as a 2px focus ring or a warn border/icon.

---

## 3. TYPOGRAPHY

### 3.1 Stacks

Self-host as subset woff2 under `/public/fonts`, loaded with `next/font/local`, `display: "swap"`, variable axes preserved. Three families, three non-overlapping jobs.

```css
--font-ui:    "Archivo Variable", "Archivo", "Helvetica Neue", Arial, sans-serif;
--font-prose: "Literata Variable", "Literata", Georgia, "Times New Roman", serif;
--font-mono:  "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
```

Fallback metric overrides are mandatory (CLS budget < 0.01):

```css
@font-face { font-family:"Archivo Fallback";  src:local("Arial");    size-adjust:100.5%; ascent-override:92%; descent-override:24%; line-gap-override:0%; }
@font-face { font-family:"Literata Fallback"; src:local("Georgia");  size-adjust:97%;    ascent-override:90%; descent-override:26%; line-gap-override:0%; }
```
Verify the overrides in DevTools by toggling the real face off; if the baseline shifts, retune before shipping.

**Roles, non-negotiable:**
- `--font-ui` (Archivo): nav, buttons, labels, chips, tabs, table headers and cells, all headings, all numerals, all metadata.
- `--font-prose` (Literata): the creator's ask, project descriptions, feedback bodies, discussion posts, reviewer bios, and nothing else. Serif in a row means a human wrote it.
- `--font-mono` (JetBrains Mono): only inside `<code>`, `<pre>`, `<kbd>`, and version strings. Never for counts, scores, timestamps, prices, or labels.

### 3.2 Scale (root 16px; 1.25 ratio above body, hand-tuned below it because ratios collapse under 16px)

| Token | rem / px | line-height | letter-spacing | `font-variation-settings` | Use |
|---|---|---|---|---|---|
| `--text-2xs` | 0.75 / 12 | 1.30 | +0.01em | `'wdth' 87,'wght' 600` | Grit chip numerals, hatch labels, table column heads. Never a sentence. |
| `--text-xs` | 0.8125 / 13 | 1.45 | +0.005em | `'wdth' 94,'wght' 400` | Metadata rows, timestamps, counts, helper text. Absolute floor for any rendered text. |
| `--text-sm` | 0.875 / 14 | 1.50 | 0 | `'wdth' 100,'wght' 400` | Dense UI: nav links, buttons, chips, table body. |
| `--text-base` | 1 / 16 | 1.55 | 0 | `'wdth' 100,'wght' 400` | UI body, form labels. **Every `<input>`, `<select>`, `<textarea>` is ≥1rem** (prevents iOS zoom-on-focus). |
| `--text-prose` | 1.0625 / 17 | **1.65** | 0 | Literata `'opsz' 17,'wght' 400` | All Literata prose. |
| `--text-md` | 1.25 / 20 | 1.40 | -0.005em | `'wdth' 100,'wght' 600` | h4, card titles, lede. |
| `--text-lg` | 1.5625 / 25 | 1.30 | -0.010em | `'wdth' 104,'wght' 620` | h3. |
| `--text-xl` | 1.9531 / 31 | 1.22 | -0.015em | `'wdth' 108,'wght' 650` | h2. |
| `--text-2xl` | 2.4414 / 39 | 1.12 | -0.020em | `'wdth' 112,'wght' 700` | Page h1. |
| `--text-display` | `clamp(2.75rem, 5vw + 1rem, 5.25rem)` | 1.04 | -0.025em | `'wdth' 112,'wght' 700` | Landing hero only. Hard ceiling 5.5rem. |

**Rules:**
- A build that ships Archivo at `'wdth' 100` on h1/h2 has failed. The width axis is the headline device; there is no other headline emphasis.
- Maximum **six** scale steps on any one surface. Landing may use `--text-display` plus four.
- Body has one weight (400). Headings contrast body by ≥200 units (620–700). Weights 500 and 550 do not exist in this system.
- Headline emphasis is **never** one word in a different color, weight, or italic. Italic is banned on h1–h6, the wordmark, stat figures, and inside any heading. "Ship sharper." is set roman, one weight, one color.

### 3.3 Measure

| Content | max-width | Applies to |
|---|---|---|
| Literata prose | **66ch** | Ask, feedback bodies, discussion posts, descriptions, bios |
| Archivo UI paragraphs | **58ch** | Lede, empty-state copy, helper text, error text |
| Absolute cap | **72ch** | Any text block anywhere. Over 72ch fails the gate. |
| Prose page container | `40rem` | Long-form routes (guidelines, terms) |

### 3.4 Numerals and punctuation

- `font-variant-numeric: tabular-nums` on every rating, score, grit value, vote count, reply count, price, timestamp, and any column of numbers.
- Grit chips additionally set `font-feature-settings: 'zero' 1` so 120 and 1000 cannot be misread.
- Literata prose sets `font-variant-numeric: proportional-nums oldstyle-nums`.
- **Required in every rendered string:** curly quotes `’ “ ”`, ellipsis `…`, en dash `–` for numeric ranges (`120–8000`), `&nbsp;` before units (`4.5&nbsp;kB`, `12&nbsp;replies`).
- **Banned in every rendered string:** em dash `—`, spaced `--`, straight quotes `" '`, three-period `...`, ALL-CAPS emphasis words, exclamation marks in error and empty states.
- **No tracked-out uppercase eyebrows.** `text-transform: uppercase` combined with positive `letter-spacing` appears nowhere in the codebase. There is no eyebrow label above any heading on any of the nine surfaces.

---

## 4. SPACING & LAYOUT

### 4.1 Spacing scale (4px base, twelve steps, closed set)

```
--space-3xs 0.125rem  2px      --space-xl  2rem    32px
--space-2xs 0.25rem   4px      --space-2xl 3rem    48px
--space-xs  0.5rem    8px      --space-3xl 4rem    64px
--space-sm  0.75rem  12px      --space-4xl 6rem    96px
--space-md  1rem     16px      --space-5xl 9rem   144px
--space-lg  1.5rem   24px      --space-6xl 12rem  192px
```
Any `padding`, `margin`, `gap`, or `row-gap` value not on this scale fails the gate. `padding: 17px` and `p-[17px]` are auto-fails. Internal spacing of a container is always ≤ its external spacing.

### 4.2 Grid, containers, breakpoints

```
--grid-cols: 12
--gutter: 1.5rem (<48rem) / 2rem (≥48rem)
--pad-inline: clamp(1rem, 4vw, 2rem)
--w-prose: 40rem      --w-feed: 72rem     --w-detail: 80rem
--w-rail: 16rem       --nav-h: 3.5rem     --filterbar-h: 3rem
```

Breakpoints are min-width, rem-based, and derived from where Whetstone content breaks (not from a device list). Four states, never two:

| Token | Value | What changes, and why |
|---|---|---|
| `--bp-sm` | 40rem / 640px | Feed row metadata goes from stacked to inline; display type steps down. |
| `--bp-md` | 60rem / 960px | Filter rail leaves the drawer and becomes persistent; dashboard sidebar appears. |
| `--bp-lg` | 80rem / 1280px | Project detail splits into embed column + thread column. |
| `--bp-xl` | 90rem / 1440px | Containers stop growing; gutters absorb the rest. |

Verify by dragging the viewport across the full range, and specifically at **320 / 375 / 414 / 768 / 960 / 1280px**. Hero fold is checked at **1280×800**, not 1440×900.

### 4.3 Z-index (seven named levels; no ad-hoc values, no `z-index: 9999`)

```
--z-base 1 · --z-raised 10 · --z-dropdown 100 · --z-sticky 200 · --z-sticky-nav 300 · --z-modal 400 · --z-toast 500 · --z-tooltip 600
```
Never two elements at `position: sticky; top: 0` on one page. The app nav is `top: 0; z-index: var(--z-sticky-nav)`. The Discover filter bar is `top: var(--nav-h); z-index: var(--z-sticky)`.

### 4.4 Layout grammar per surface, and why each one is not a centered 3-card grid

| # | Surface | Grammar | Not-a-3-card-grid because |
|---|---|---|---|
| 1 | **Landing (logged out)** | Asymmetric split on the 12-col grid: hero copy left-aligned across cols 1–7, a real Discover screenshot in a `<figure>` with a hairline border across cols 8–12. Section vertical padding alternates `--space-5xl` / `--space-3xl` / `--space-4xl` / `--space-2xl`; no two adjacent sections share padding, container width, or column count. One full-bleed break: the live grit rail showing five real projects, one per stage, spanning edge to edge. "How it works" is a two-column `<dl>` with visible `<dt>` terms. | There is no card row on this page at all. The feature explanation is a definition list; the proof is one real project; the structure is a 7/5 split, never three equal columns. No `min-height: 100vh`, no centered dual-CTA, no eyebrow pill, no logo strip. |
| 2 | **Discover feed** | `<ul>` of rows. Each row is 4.5rem tall, 8px radius, separated by a 1px `border-hair`: 48px thumbnail (2px radius) · title (Archivo `--text-sm`) · the ask clipped to two lines in Literata `--text-xs` · a `<dl>` of metadata with `--space-sm` gaps · grit chip · feedback count with `tabular-nums`. Filters are URL search params read in a Server Component. The filter rail is persistent ≥60rem, a `<dialog>` drawer below. | Rows, not cards. One project per line, scanned vertically like a spec sheet. Metadata is a `<dl>`, never a `·`-joined string. Every grid track that holds an image is `minmax(0, 1fr)`, never bare `1fr`. |
| 3 | **Project detail** | Left-aligned, never centered. `3rem` bevel rail in the left gutter (full-height SVG hatch, stroke stepping 3px → 0.5px, `mask-image` fade, marking this project's grit position) + 7 columns of media and ask + 4 columns of feedback thread at ≥80rem; stacked below. The ask is Literata `--text-prose` / 66ch on `surface-2` with a 2px accent grind-mark on its leading edge. Ratings are grit bars with a visible numeral and an accessible name (`"Balance: 3000 of 8000"`). | A single asymmetric three-zone layout with a structural rail. Media sits in a bare `<figure>`: no hand-built browser chrome, no traffic-light dots, no phone frame, no perspective tilt. |
| 4 | **Feedback composer** | Single column, 40rem, inside a native `<dialog>` pinned with `position: fixed; inset: 0; margin: auto; height: fit-content; max-height: min(80vh, 40rem)`. A hand-built roving-tabindex tablist (Fun / Balance / Controls / Onboarding / Performance), each panel holding one visible `<label>`, one Literata `<textarea>` (66ch, `min-height: 6rem`, `resize: vertical`), one `aria-live="polite"` counter, and the grit selector. Sticky footer with `scroll-margin-block: 5rem` on every focusable. | One column of labelled fields. There is no card in this surface at all. Every control shares one 44px base height: a 38px select beside a 44px button is a defect. |
| 5 | **Creator dashboard** | Three panes, three different shapes: (a) inbox as a dense `<table>` with 0px cell radius, `tabular-nums`, `surface-1`/`surface-2` zebra, `<th scope="col">`; (b) theme rollup as horizontal stacked bars (`positive` / `text-3` / `critical`), each segment carrying its percentage numeral and label; (c) suggestion tracker as columns with drag **and** a per-item "Move to…" menu (SC 2.5.7). Full-bleed with a 16rem left rail. | Three structurally different panes: a table, a bar chart, and a column board. No repeated tile. Row hover changes background by exactly one surface step: no lift, no shadow, no scale. |
| 6 | **Public creator profile** | Header is a 5-cell grit history strip (how many projects reached each stage), then reputation as a plain sentence with `tabular-nums` ("41 projects, 12 shipped, 380 pieces of feedback received"), then the bio in Literata at 66ch, then a project list reusing the Discover row. | The page's organising element is a data strip, not a grid. Reputation is a sentence, never a badge wall; a bare giant number is never the dominant element. |
| 7 | **Reviewer profile / marketplace** | Two-column list: reviewer identity and depth on the left (median grit stage reviewed + categories in a `<dl>`), bounty/price block on the right with the price in Archivo `--text-lg` `tabular-nums`. Straw fills appear here and only here. | A list of people with a price column, like a rate card. No tier cards. Tier count equals the real tier count; max five listed features per tier; real prices, never "Contact for pricing". |
| 8 | **Community discussions** | Tabular row register with hairline rules. Thread bodies in Literata `--text-prose` / 66ch. Reply nesting capped at 3 levels, indicated by a 2px `border-hair` left rule **plus** indentation, so it survives 320px reflow (SC 1.4.10). Rows mixing an avatar, a title, and a count declare `align-items: center` and `line-height: 1` on the intrinsic-height items. | Rows with rules. No card grid, and never a card inside a card: maximum one containment level anywhere in Whetstone. |
| 9 | **Auth** | Single column, 24rem, left-aligned, directly on `surface-1`. No card, no shadow, no logo lockup above center. Control edges (`border-control`) are the only structure. | There is no card to grid. One column of labelled fields with `autocomplete` set and paste allowed on every field (SC 3.3.8). |

**Cross-surface:** the Help/contact affordance sits in the same footer slot on all nine surfaces (SC 3.2.6). App footer is one inline line: wordmark, 3–4 real links, copyright. There is no four-column Product/Company/Resources/Legal footer anywhere, and no `href="#"`.

---

## 5. COMPONENT CRAFT

### 5.1 Radius scale (six values, hierarchical; a single uniform radius is a defect)

```
--radius-0:    0px      /* grit hatch bars, table cells, the bevel rail, dividers */
--radius-xs:   2px      /* chips, filter toggles, tabs, grit cells, thumbnails */
--radius-sm:   4px      /* buttons, inputs, selects, textareas */
--radius-md:   8px      /* cards, feed rows, thread bubbles, callouts */
--radius-lg:  14px      /* modals, sheets, popovers, command palette */
--radius-full: 9999px   /* <img> avatars ONLY */
```
`rounded-full` on a button, chip, badge, input, or status dot fails the gate. There are no pill CTAs. There are no decorative status dots: presence and state are labelled chips.

### 5.2 Borders

- Every card, row, input, chip, and tab has a **1px border in every state**. Border *width* never changes between states; only its color does (`border-control` → `border-strong` on hover, → `focus` handled by outline, → `critical` on error).
- `border-hair` (1.58:1 dark / 1.33:1 light) is decorative only. Any boundary a user must perceive to operate a control uses `border-control` (≥3:1 on every surface in both themes).
- Maximum one containment level. A bordered container inside a bordered container fails the gate. Group with spacing and alignment before reaching for a border or a fill.

### 5.3 Shadows (two tokens; cards have none, deliberately)

```
--shadow-overlay: 0 24px 48px -12px rgba(6,12,14,0.62);   /* dark  */
--shadow-overlay: 0 24px 48px -12px rgba(14,23,26,0.18);  /* light */
--shadow-raised:  0 1px 2px rgba(6,12,14,0.40);           /* dark  */
--shadow-raised:  0 1px 2px rgba(14,23,26,0.08);          /* light */
```
- `--shadow-overlay`: modals, sheets, popovers, the command palette, toasts. Nothing else.
- `--shadow-raised`: only on an element that floats over scrolling content while attached (the sticky filter bar once `scrollY > 0`, the composer's sticky footer). Applied on a state class, never at rest.
- **Cards, rows, chips, and buttons get no shadow at all.** Depth comes from the surface step plus the 1px hairline. `box-shadow: 0 Npx Npx rgba(0,0,0,0.1)` appears nowhere. Shadows are never stacked and never colored.

### 5.4 Interactive states (all eight ship in code for every interactive element)

| State | Treatment | Notes |
|---|---|---|
| default | `border-control`, `text-1`/`text-2`, `--radius-sm` | |
| hover | Inside `@media (hover: hover)`. Background moves exactly **one surface step**; border goes `border-control` → `border-strong`. Buttons additionally `translateY(-1px)`. | Cards, feed rows, and grid items **never** transform. One effect per element: never translate + scale + shadow + color together. |
| `:focus-visible` | `outline: 2px solid var(--color-focus); outline-offset: 2px; border-radius: inherit;` Inputs, textareas, selects use `outline-offset: 1px` and reserve `outline: 2px solid transparent` at rest so geometry never shifts. | Appears instantly. **Zero transition on `outline` or `box-shadow`.** Never removed. |
| `:active` | `translateY(1px)` on buttons, 90ms in, 120ms out. No scale on rows or cards. | |
| disabled | `--color-text-disabled` + `cursor: not-allowed` + `aria-disabled="true"` + a visible reason in the helper slot. **Opacity alone is a defect.** Submit buttons are disabled only while in-flight or known-invalid, never at idle. | |
| loading | Named skeleton matching the real geometry (feed row: 8px radius, 4.5rem tall). Spinner only after 150ms delay, minimum 300ms visible. Copy says what is loading. | |
| error | `border-critical` + Phosphor `WarningCircle` + text naming what broke, why, and what to do. `aria-invalid="true"` + `aria-describedby` pointing at the message node. Error text **replaces** helper text in the same slot. | |
| success | Silent when the effect is visible on screen (a moved row, a posted comment). A toast only when the result is off-screen. | |

**Focus ring proof.** The 2px offset means the ring never touches a filled element; the gap shows the page ground, and both edges clear 3:1: dark ground vs. straw ring **10.21**, dark ground vs. accent fill **6.98**; light ground vs. straw ring **5.49**, light ground vs. accent fill **5.97**.

### 5.5 Form geometry

- Visible `<label>` above every field on every surface. **Placeholder-as-label is banned**, with no exception in auth or the composer.
- Every control 44×44px minimum hit area (expand with `::before { position:absolute; inset:-12px }` without changing visual size); ≥8px between adjacent targets.
- Helper slot `min-height: 1lh` reserved permanently so an appearing error never pushes the page down. A ~24px right-edge slot is reserved permanently for the password show/hide toggle and validation icons.
- Input vertical padding = `(height − line-height-px) / 2`. Textareas `min-height: 6rem`, `resize: vertical`.
- Validation: on blur after first touch, then re-validate on `input`. Never per keystroke from the first character.
- Checkboxes and radios set `accent-color: var(--color-accent)` before any custom build. Slider focus goes on the thumb, not the track.
- Forms are real `<form>` elements posting to Server Actions with `useActionState`, Zod-validated on both client and server, with an `aria-live="polite"` status region for the result. The composer works with JavaScript disabled.

### 5.6 Icons

One library, one variant: **Phosphor Regular**, 1.5px stroke, `currentColor`, sizes 16 / 20 / 24 only. No icon ships without a one-line relevance note in `/design/direction.md`. Rocket, Sparkles, Zap, Wand, Diamond, Robot, and any sparkle/orb glyph are banned. Every decorative `<svg>`, `<canvas>`, or chart carries `aria-hidden="true"` or an `aria-label`. **Zero emoji in UI chrome** (headings, buttons, nav, chips, ratings, empty states, toasts). Emoji inside user-authored feedback text is content and is exempt.

### 5.7 The grit hatch primitive

```
120  stroke-width 3px    spacing 16px   concept
400  stroke-width 2px    spacing 8px    prototype
1000 stroke-width 1.25px spacing 4px    beta
3000 stroke-width 0.75px spacing 2px    release candidate
8000 stroke-width 0.5px  spacing 1px    shipped
```
Stroke color `--color-hatch` (≥3.67:1 on every dark surface, ≥3.59:1 on every light surface). The numeral is always rendered beside the hatch; the hatch alone never carries the value. The feed is sortable by grit, so the number is real data, not ornament. `01 / 02 / 03` ordinal markers appear nowhere; 120 / 400 / 1000 / 3000 / 8000 are the only numeric markers in the product.

---

## 6. MOTION

### 6.1 Tokens

```css
--dur-1: 120ms;   /* hover, press, border/background color, checkbox */
--dur-2: 180ms;   /* popover, dropdown, tooltip, toast, optimistic row insert */
--dur-3: 240ms;   /* modal and sheet enter, tab panel crossfade */
--dur-hero: 360ms;/* the one first-paint sequence, landing only */
--dur-exit-1: 80ms; --dur-exit-2: 120ms; --dur-exit-3: 160ms;   /* exits are 65% of entrance */

--ease-out: cubic-bezier(0.16, 1, 0.3, 1);      /* all entrances */
--ease-in:  cubic-bezier(0.4, 0, 1, 1);         /* all exits */
--ease-grind: cubic-bezier(0.65, 0, 0.35, 1);   /* the hero width sweep only */
```

**400ms is an absolute ceiling.** No animation, transition, or stagger total in the codebase exceeds it.

### 6.2 Per interaction class

| Class | Duration | Easing | Property |
|---|---|---|---|
| Hover / press / color and border change | 120ms in, 80ms out | `--ease-out` / `--ease-in` | `background-color`, `border-color`, `transform: translateY(-1px)` on buttons only |
| Dropdown, popover, tooltip | 180ms in, 120ms out | `--ease-out` / `--ease-in` | `opacity`, `transform: translateY(4px → 0)` |
| Modal, sheet | 240ms in, 160ms out | `--ease-out` / `--ease-in` | `opacity`, `transform: scale(0.98 → 1)` |
| Optimistic comment / feed row insert | 180ms | `--ease-out` | `opacity`, `transform: translateY(8px → 0)` |
| List stagger (inbox first paint only) | 40ms per index via a `--i` custom property, **280ms total cap**, fires once | `--ease-out` | `opacity`, `translateY(8px → 0)` |
| Tab underline | 180ms | `--ease-out` | `transform: translateX` |
| Hero honing sweep (landing, first paint, once per session) | 360ms | `--ease-grind` | `font-variation-settings: 'wdth' 118 → 96` and `letter-spacing 0.03em → -0.025em` on the single word "sharper" |

**Hero exception, scoped.** The width-axis sweep is the only animation of a non-transform/non-opacity property in the product. It is permitted because it runs on one word of ≤7 characters, inside a block with `contain: layout paint` whose `min-inline-size` is reserved at the `wdth: 118` measurement, so it produces zero layout shift. It is `sessionStorage`-gated and does not replay on client-side navigation.

### 6.3 Never animated

`width`, `height`, `top`, `left`, `right`, `bottom`, `margin`, `padding`, `box-shadow`, `outline`, `filter`, `backdrop-filter`, `background-position`, `background-image`. Accordions animate `grid-template-rows: 0fr → 1fr`, never `height`. `transition: all` and `transition-all` appear nowhere. Focus rings never fade in. There are **zero** infinite or ambient animations, zero scroll-triggered reveals of content, zero parallax, zero marquees, zero number counters, zero auto-rotating galleries (if a gallery ever rotates, it pauses on hover **and** focus, SC 2.2.2). Maximum three distinct animation primitives per page.

### 6.4 Reduced motion

Global reset, plus every animation additionally wrapped in a `no-preference` guard:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
The hero renders its end state (`'wdth' 96`, `letter-spacing -0.025em`) statically. Functional motion (skeletons, progress) keeps running, slower. Any keyframe or transform without a reduced-motion path is a P0 auto-fail.

### 6.5 Response budget

Any interaction that posts feedback, applies a filter, or changes the feed renders its new state within **400ms** (Doherty), using `useOptimistic` or a skeleton whose geometry matches the real row (8px radius, 4.5rem height). Anything slower shows a labelled loading state, never a bare spinner.

---

## 7. VOICE

### 7.1 Rules

1. Active voice, named actor. No actorless passive ("feedback was received"), no anthropomorphised product ("the dashboard understands your project").
2. Verbs match through the whole flow: button "Post feedback" → toast "Feedback posted" → inbox row "Posted 4m ago".
3. Buttons are verb phrases and never wrap to two lines (`white-space: nowrap`; shorten before you wrap). "Submit", "Get Started", "Learn More", "Try Now", "Explore", "Discover", "Join Now", "Sign Up Free", "Click here", "OK", "Continue" appear nowhere.
4. Errors have three parts: what broke, why it matters, what to do next. No apology, no "Oops", no "Something went wrong", no exclamation marks.
5. Empty states have exactly three beats: what is empty, why it matters, one button naming the single next action. No illustration, no shrug, no "No data available".
6. Every number rendered is computed from a real row, or is visibly marked "Sample project". No invented counts, reputation scores, sentiment percentages, payouts, or week-over-week deltas. Placeholder people are plausible and role-specific (Maya Okonkwo, solo dev, roguelike deckbuilder), never Jane Doe / John Smith / Acme.
7. No rule-of-three padding, no "It's not just X, it's Y", no aphorisms ("Feedback is the currency of…"), no staccato fragment runs, no bold-every-key-term, no inline-header bullet lists.
8. The tagline "Ship sharper." stands alone, roman, one weight, one color. The subhead states the mechanism in plain words.

### 7.2 Five before/after pairs

| # | Context | Before (fails) | After (ships) |
|---|---|---|---|
| 1 | Landing subhead | "Supercharge your launch with AI-powered feedback, seamlessly." | "Post the build. Pick the questions. Get review notes back, sorted by theme." |
| 2 | Empty feedback inbox | "No feedback yet! 😔 Check back soon." | "No feedback yet. Projects with a specific ask get replies faster. Edit your ask." + button "Edit the ask" |
| 3 | Sign-up error | "Oops! Something went wrong. Please try again." | "That email already has an account. Sign in instead, or use a different address." + link "Sign in" |
| 4 | Composer validation | "Error: invalid form." (submit disabled, no explanation) | "Pick at least one category. Reviewers filter by category, so an uncategorised note reaches fewer of them. Choose the areas you want feedback on." (focus moves to the first incomplete category) |
| 5 | Discover, filtered to nothing | "No results found." | "No projects match Game + Needs playtesting + 8000 grit. Drop the grit filter to see 14 games that need playtesting." + button "Clear grit filter" |

---

## 8. THE BAN LIST

Deduplicated and merged. Every line is grep-able or screenshot-checkable. A build containing any of these does not ship.

### 8.1 Color
1. `#6366f1`, `#8b5cf6`, `#a855f7`, and any Tailwind indigo / violet / purple / fuchsia ramp value as accent, hover, focus, link, badge, or chart color.
2. `#D97757`, `#E2703A`, and any terracotta or warm-clay hue in the HSL 10–30° band as accent or secondary accent.
3. `#F4F1EA` and any warm cream in `#F2EFE8`–`#FAF7F0` as a background, in either theme.
4. `#0B0B0B`, `#111111`, `#1e1e1e`, `#141413`, `#0f172a` (slate-900) as the dark base.
5. Pure `#000000` or `#FFFFFF` as any base surface.
6. Any zero-chroma neutral (`oklch(L 0 H)`); every neutral carries chroma ≥ 0.005.
7. Purple→blue, purple→pink, cyan→magenta, orange→pink gradients. Any `linear-gradient` or `radial-gradient` used as decoration. Three-stop gradients. `background-clip: text` + `text-transparent` on any heading, wordmark, stat, or score.
8. Aurora / mesh-gradient blobs, floating orbs, `blur-3xl` saturated circles, glassmorphism (`backdrop-blur`, `bg-white/10`) on nav, cards, modals, or rails, particle and starfield backgrounds, scanlines, grid-square / blueprint / dot-grid section backgrounds.
9. Neon glow (`box-shadow: 0 0 40px rgba(...)`), text-shadow halos, colored glow on a dark surface.
10. Red/green or any hue as the *sole* carrier of sentiment, rating, status, validity, or required-field meaning.
11. `text-gray-400` / `text-slate-400` body text; any (text, background) pair below 4.5:1 body / 3:1 large asserted without a computed ratio in `/design/contrast.md`.
12. White text on an accent, straw, or critical fill (all three take dark ink); `background: var(--color-accent)` with a hard-coded `color: white`.
13. Any `#hex`, `oklch()`, `rgb()`, `hsl()`, or `font-family` string outside the `@theme` / `[data-theme]` block. Arbitrary Tailwind values (`bg-[#1a1a1a]`, `text-[oklch(...)]`, `p-[17px]`), dynamic class construction (`text-${sentiment}-500`), and `!` important prefixes.

### 8.2 Type
14. Inter, Geist, Space Grotesk, Roboto, Open Sans, Lato, Poppins, Nunito, Montserrat, Raleway, Work Sans, DM Sans, Source Sans, Merriweather, Lora, Playfair Display as body, Arial or Helvetica as a *chosen* face, `system-ui` as the only stack, DejaVu / FreeSans / FreeSerif, Courier New, Consolas.
15. More than three font families on a page; the mono family in more than the code role.
16. Monospace for metadata, stats, timestamps, counts, ratings, prices, scores, headings, or labels.
17. Italic on h1–h6, hero display, section titles, the wordmark, stat figures, or any `<em>`/`<i>` inside a heading.
18. Accenting one word of a headline in a different color, weight, or style.
19. `text-transform: uppercase` + positive `letter-spacing` eyebrow labels above any heading; eyebrow pill badges above an H1; a tag/number/label placed in a column beside the section heading (tag-left header-right, hanging header, left-margin label).
20. `text-5xl font-extrabold tracking-tighter`; more than three weights on a page; weights 500 or 550; `font-light` for body; `tracking-tighter` on any heading; `tracking-wide` on body.
21. Bricolage Grotesque shipped at `'wdth' 100` on h1/h2. The width axis is the headline device.
22. Any prose container outside 45–72ch; any text block over 72ch; body under 16px; any rendered text under 13px.
23. Em dash `—`, spaced `--`, straight quotes, three-period ellipsis, ALL-CAPS emphasis words.
24. Uppercase display text (≥ `--text-lg`) with line-height below 1.0.

### 8.3 Layout and structure
25. A 3-equal-column card grid with icon-above-heading-above-copy tiles, anywhere. `grid-cols-3` as the default for Discover, features, or categories.
26. A card nested inside a card; more than one containment level.
27. A 4–6px colored left stripe on any card, row, thread, or section header.
28. `min-height: 100vh` / `100dvh` heroes; centered H1 + centered subhead + symmetric dual CTA; hero `padding-block-end` < 1.3 × `padding-block-start`; a hero whose headline, lede and primary CTA do not all fit at 1280×800.
29. Uniform `py-20` on every section; everything wrapped in `max-w-7xl mx-auto`; two adjacent sections sharing padding, container width, and column count on the landing page.
30. Two elements at `position: sticky; top: 0` on one page; `z-index: 9999` or any value outside the seven-level scale.
31. `overflow-x: hidden` on `html`/`body` (must be `clip`); `width: 100vw` on anything; horizontal document scroll at any viewport 320–1920px; bare `1fr` on a grid track containing an image; display text without `overflow-wrap: anywhere; min-width: 0`.
32. The four-column Product/Company/Resources/Legal footer; the wordmark-left + 5-links + button-right + hairline-bottom nav used reflexively; any nav or footer link to a route that does not exist or to `href="#"`.
33. `01 / 02 / 03` numbered step markers or numbered circles.
34. Sections that exist because a template has them: a testimonials block with no real testimonials, a three-tier pricing table when there are not three tiers, a generic FAQ ("Is my data secure?", "Can I cancel anytime?"), a "Trusted by" logo strip.

### 8.4 Component and motion
35. A single `border-radius` value used on buttons, cards, inputs and modals alike; `rounded-full` / `border-radius: 9999px` on anything but an `<img>` avatar; pill CTAs.
36. `box-shadow: 0 Npx Npx rgba(0,0,0,0.1)` or any soft grey shadow under cards, chips, rows, or buttons; stacked shadows; colored shadows.
37. `transition: all` / `transition-all`; blanket `hover:scale-105`; `hover:-translate-y-2`; hover lift, scale, or shadow on cards, feed rows, or grid items; more than one simultaneous hover effect on an element.
38. Overshoot or bounce easings (`cubic-bezier(0.34, 1.56, 0.64, 1)` and family); springs on any UI state change.
39. Animating `width`, `height`, `top`, `left`, `margin`, `padding`, `box-shadow`, `outline`, or `filter`; accordions animating `height`.
40. Any animation over 400ms; scroll-triggered fade-and-slide-up on section entry; `IntersectionObserver`-driven `translateY` on content; typewriter effects; marquees; animated gradient backgrounds; infinite or ambient loops; shimmer on non-loading content; number counters; auto-rotating carousels without pause on hover **and** focus; any transform or keyframe without a `prefers-reduced-motion` path.
41. Focus rings that transition or fade in; any transition on `outline` or `box-shadow` at `:focus-visible`; `outline: none` without a same-rule replacement.
42. Star-rating widgets drawn as five identical outline stars; decorative status dots; "Live"/"New" pulsing pills; `animate-pulse` on static data.
43. Emoji as UI iconography (🔥 ⭐ 🚀 ✨ ⚡ 🎯 ✅ 🎮) in ratings, chips, stage labels, empty states, CTAs, nav, or toasts; mixed icon libraries or stroke widths; icons inside gradient rounded squares; rainbow per-icon coloring; decorative icons over 48px.
44. unDraw / Storyset / Humaaans / Corporate-Memphis blobs; 3D clay icons; stock "diverse team at laptop" photos; letter-in-rounded-square logo placeholders; Lottie where CSS or a hand-built SVG reaches; Three.js for a non-interactive object.
45. Hand-built fake browser bars (URL pill + traffic-light dots), fake phone frames, fake terminal or IDE chrome, perspective-tilted dashboard mockups with `rotateY` + `shadow-2xl`.
46. Celebratory toasts for an action whose effect is already visible on screen; confirmation dialogs for reversible actions; equal hover and focus delays on tooltips; hover-only affordances with no focus or tap equivalent; toggles for anything not instantly applied; more than three visible switches on one screen; cookie banners with asymmetric Accept/Reject weighting; a sticky CTA bar that appears on page load.
47. Disabled submit buttons as the validation strategy; placeholder text as the only label; touch targets under 44×44px; border-width changing between input states; a focus ring built from `border`; input height ≠ adjacent button height; a helper slot that collapses when empty; disabled signalled by opacity alone.

### 8.5 Copy and data
48. These strings anywhere in the repo: revolutionize, unleash, supercharge, unlock, elevate, empower, game-changing, seamless, effortless, frictionless, blazing fast, in seconds, robust, scalable, powerful, cutting-edge, world-class, next-generation, 10x, AI-powered, intelligent, for modern teams, "The Future of", "Transform Your Workflow", "Built for the modern team", "Where X meets Y", "Reimagine the way you", "In today's digital landscape", "Innovative solutions", "Seamless integration", "Let's dive in", "at its core", "delve", "landscape", "tapestry", "ensuring", "leveraging", "Oops!", "Uh oh!", "Something went wrong.", "Click here".
49. Generic CTAs: Get Started, Learn More, Try Now, Explore, Discover, Join Now, Sign Up Free, Submit, Sign up now.
50. Fabricated proof: "Trusted by 5,000+ creators", invented counts, invented deltas ("+12% this week"), fabricated testimonials with avatar + name + role, star averages not computed from real rows, "average payout" figures, any quantitative claim the user did not supply, a bare giant number as a hero's only headline text.
51. Filler identities and leftovers: John Doe, Jane Doe, Sarah Chen, johndoe@example.com, Acme, Nexus, Pulse, lorem ipsum, `[placeholder]`, `TODO` in rendered strings.

### 8.6 Code
52. `<div onClick>`, `<div className="cursor-pointer">` as a link, div-soup modals or selects, positive `tabindex`, `autofocus` outside a modal.
53. `fetch` inside `useEffect` for page data; `'use client'` on a `page.tsx` or `layout.tsx`; `useEffect(() => router.push())` redirects; array index as key in the feed, thread, or tracker lists; `any`; `@ts-ignore`; `dangerouslySetInnerHTML` on user-submitted feedback without DOMPurify; `console.log` in committed code; a `useEffect` that subscribes, listens, times, or fetches without a cleanup; derived state stored in `useState` and synced by an effect.
54. Any dependency on Radix, Headless UI, shadcn/ui, MUI, Chakra, Mantine, framer-motion, gsap, or lenis in `package.json`.
55. Missing `fetchpriority="high"`, a missing `poster`, `loading="lazy"`, or autoplay-with-sound on the LCP media element.

---

## 9. THE FINISH GATE

Every line is verifiable by reading code or looking at a screenshot. A `FAIL` on any line blocks the ship. Record the run in `/design/finish-gate.md` with evidence per line.

### 9.1 Tokens and color (grep)
1. `grep -rniE "#[0-9a-f]{3,8}|oklch\(|rgba?\(|hsla?\(" app components --include="*.tsx" --include="*.ts"` returns **zero** hits.
2. `grep -rn "font-family" app components --include="*.tsx"` returns **zero** hits.
3. `grep -rniE "6366f1|8b5cf6|a855f7|d97757|e2703a|f4f1ea|0f172a|1e1e1e|141413" .` returns **zero** hits.
4. `grep -rniE "indigo-|violet-|purple-|fuchsia-" app components` returns **zero** hits.
5. `grep -rniE "bg-gradient|linear-gradient|radial-gradient|bg-clip-text|backdrop-blur|blur-3xl" app components` returns **zero** hits (the one permitted `mask-image` fade on the bevel rail is a `mask-image`, not a gradient background; confirm by reading the rule).
6. `/design/contrast.md` lists a computed ratio for **every** (foreground, surface) pair in both themes, and every body pair is ≥4.5 and every non-text/boundary/focus pair ≥3.0. Cross-check five pairs by hand against §2.2 and §2.3.
7. Screenshot each of the nine surfaces in both themes; accent-colored pixels occupy ≤5% of the viewport (target 3%). Count with any image histogram tool.
8. Toggle to light and back on all nine routes: no element keeps a dark-mode color, and no rule that sets `background-color` fails to set `color` (`grep -rn "background" app/globals.css` and read each block).

### 9.2 Type
9. The face list is closed: `Bricolage Grotesque Variable` and `Newsreader Variable` carry the product, with `Instrument Serif` and `Barlow` each used for exactly one thing. Network tab shows no fifth family.
10. `grep -rn "font-variation-settings" app/globals.css` shows `'wdth' 112` on h1, `'wdth' 108` on h2, `'wdth' 87` on chips and table heads.
11. `grep -rniE "—|\.\.\.|[^&]--[^ >-]" app components --include="*.tsx"` returns zero em dashes, zero three-period ellipses, zero `--` in rendered strings.
12. `grep -rniE "uppercase" app components | grep -i "tracking"` returns zero.
13. Inspect any prose block: computed `max-width` ≤ 66ch; any UI paragraph ≤ 58ch; nothing over 72ch.
14. Every `<input>`, `<select>`, `<textarea>` computes to ≥16px font-size (DevTools, iOS Safari check).
15. Every visible number column in the dashboard and marketplace computes `font-variant-numeric: tabular-nums`.

### 9.3 Layout and responsive
16. Render all nine routes at **320 / 375 / 414 / 768 / 960 / 1280 / 1920px**: no horizontal document scroll, no clipped text, no button or nav label wrapping to two lines.
17. At 375px, zoom text to 200%: no clipping, no horizontal scroll.
18. `grep -rn "overflow-x" app/globals.css` shows `clip`, never `hidden`, on `html`/`body`.
19. `grep -rniE "grid-cols-3|repeat\(3," app components` returns zero, or every hit is justified in writing and is not a feature/card row.
20. `grep -rn "1fr" app components`, every grid track containing an image is `minmax(0, 1fr)`.
21. Exactly one element on each page is `position: sticky; top: 0` (the nav). The Discover filter bar reads `top: var(--nav-h)`.
22. Screenshot the landing hero at 1280×800: headline, lede, and primary CTA are all above the fold; `padding-block-end` ≥ 1.3 × `padding-block-start`.
23. No page contains a 3-across grid of identical cards; each surface matches its row in §4.4.

### 9.4 Accessibility (WCAG 2.2 AA)
24. axe or Lighthouse clean on all nine routes: zero violations, zero "serious", zero "critical".
25. Tab-only traversal of the composer, auth, Discover filters, and the suggestion tracker: focus order follows visual order, every stop shows a 2px focus ring, no stop is hidden behind the sticky nav or the composer footer (SC 2.4.11; `scroll-margin-block: 5rem` present on focusables in sticky contexts).
26. Measure five interactive targets with DevTools: each ≥44×44px including the `::before` expansion, with ≥8px between neighbours (SC 2.5.8 passes with margin).
27. Auth: paste works in every field; `autocomplete="username"`, `"current-password"`, `"new-password"`, `"one-time-code"` are set; no cognitive-function test (SC 3.3.8).
28. Suggestion tracker: every item exposes a "Move to…" menu, so drag is never the only path (SC 2.5.7).
29. Help/contact sits in the same footer slot on all nine surfaces (SC 3.2.6).
30. Every `<dialog>` closes on Escape and restores focus to its trigger. Background content carries `inert`.
31. Screen-reader pass on the composer and one project detail: every grit bar announces "Balance: 3000 of 8000"; every rollup segment announces its label and percentage.
32. Greyscale screenshot of the dashboard rollup and every status chip: all meaning still readable.
33. Each route has one `<h1>`, sequential heading levels, `<nav>/<main>/<aside>/<footer>`, `<ul>/<li>` for feed and thread, `<table>` + `<th scope="col">` for the tracker, `<fieldset>/<legend>` per composer category, `<html lang="en">`, and a skip link to `<main>`.
34. Every decorative `<svg>` carries `aria-hidden="true"` or an `aria-label`.

### 9.5 Motion
35. `grep -rniE "transition-all|transition: all" app components` returns zero.
36. `grep -rnE "[4-9][0-9]{2}ms|[0-9]+\.[0-9]+s|[1-9]s" app/globals.css app components`, every hit is ≤400ms.
37. `grep -rn "@media (prefers-reduced-motion" app/globals.css` shows the global reset plus a guard for every named animation. Toggle reduced motion in the OS: the hero renders its end state, no element moves.
38. `grep -rniE "animate-pulse|animate-bounce|animate-spin|infinite|marquee" app components` returns zero outside a genuine loading indicator.
39. Reload the landing page twice: the hero sequence runs once, then not again (sessionStorage). Client-side navigation away and back does not replay it.
40. Record a click-through of every control on all nine surfaces in both themes and at 375px; attach to the gate report.

### 9.6 Copy and data
41. `grep -rniE "supercharge|unleash|revolutioniz|seamless|effortless|frictionless|game-chang|AI-powered|10x|next-generation|world-class|cutting-edge|Get Started|Learn More|Sign Up Free|Click here|Oops|Something went wrong|Submit" app components` returns zero.
42. `grep -rniE "John Doe|Jane Doe|example.com|lorem|Acme|TODO|placeholder" app components` returns zero in rendered strings.
43. Every rendered number traces to a real row or is labelled "Sample project". Walk the landing page and the dashboard and name the source of each figure.
44. Every empty state on the nine surfaces has exactly three beats and a button naming one action. Screenshot each.
45. Every error message names what broke, why, and what to do, with no exclamation mark.

### 9.7 Code and dependencies
46. `package.json` contains no Radix, Headless UI, shadcn, MUI, Chakra, Mantine, framer-motion, gsap, or lenis.
47. `grep -rn "'use client'" app/**/page.tsx app/**/layout.tsx` returns zero. Discover filters read `searchParams` in a Server Component.
48. Every route segment has `loading.tsx`, `error.tsx`, and `not-found.tsx`.
49. ESLint fails the build on: `no-console`, `jsx-a11y/click-events-have-key-events`, `jsx-a11y/no-static-element-interactions`, `jsx-a11y/anchor-is-valid`, `jsx-a11y/alt-text`, `jsx-a11y/label-has-associated-control`, `jsx-a11y/interactive-supports-focus`, `@typescript-eslint/no-explicit-any`. `prettier-plugin-tailwindcss` is installed.
50. Every file in `/components/ui/` opens with a comment stating its keyboard contract (Arrow keys, Home/End, Escape, roving tabindex, focus restoration).
51. User-submitted feedback renders as structured nodes, or passes through DOMPurify before any `dangerouslySetInnerHTML`.
52. `/design/direction.md` exists and names: the direction (Grit Index), the metaphor vocabulary, the dark-mode reason, the bold element per surface, and at least three things changed between the token plan and the built components, with reasons.
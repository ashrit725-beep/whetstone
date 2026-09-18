# WHETSTONE IMPLEMENTATION PLAYBOOK
### Grit Index · technique layer · v1.0

This merges six research lenses into one buildable document. It sits **under** `/design/CONTRACT.md` (law) and **over** `/design/PRIMITIVES-*.md` (API). Where a lens contradicted the contract, the contract won and the resolution is written out. Every number here is either the contract's or is derived by arithmetic shown in place. Section numbers in `§` refer to CONTRACT.md; gate lines refer to §9.

---

## PREFLIGHT: three repo facts to fix before any surface is built

**P1. `motion` is in `package.json` and is an auto-fail.** Gate line 9.7.46 and ban 54 forbid framer-motion; the `motion` package is framer-motion's current name. Remove it. Nothing in this playbook needs it: every recipe in §3 is CSS plus `@starting-style`, and the two that need JS (tab underline, drag) use `ResizeObserver` and Pointer Events.

```bash
npm rm motion
grep -rn "from ['\"]motion" src/   # must return zero
```

**P2. Icons are `lucide-react`, not Phosphor (§5.6).** Both PRIMITIVES docs record this, but the gate reads `/design/direction.md` and the deviation is not there. Add the row now, or the gate fails on a deviation that was already decided:

| § | Contract says | What shipped | Why |
|---|---|---|---|
| 5.6 | Phosphor Regular | `lucide-react`, `strokeWidth={1.5}`, sizes 16/20/24, `currentColor` | `package.json` ships lucide and no Phosphor package. The substance of the rule (one library, one variant, one stroke width, no banned glyphs) is unchanged. |

**P3. Add five layout constants** to the existing `@theme` block in `src/app/globals.css`, beside `--nav-h` / `--filterbar-h`. Every geometry decision downstream reads one of these, which is what keeps skeleton, sparse floor, intrinsic size and real row in lockstep.

```css
@theme {
  --hairline:     1px;          /* see MOVE 8: do not step to 0.5px without the screenshot test */
  --row-h:        4.5rem;       /* 72px. Register rows: discussions, profile list, inbox */
  --row-h-feed:   5.5rem;       /* 88px. Discover row, which carries a two-line ask. See ROW CRAFT */
  --feed-cols:    48px minmax(0, 1fr) 8rem 6rem 4rem;
  --tap-min:      2.75rem;      /* 44px */
}
```

`--row-h-feed` is a **recorded deviation** (§4.4 surface 2 and §5.4 both say 4.5rem). The arithmetic is in ROW CRAFT; copy the one-line reason into `direction.md` when you add the token.

**Naming note:** Tailwind v4 emits the spacing scale as `--spacing-xs … --spacing-6xl`, not `--space-*`. Every snippet below uses the repo's real names.

---

## 1. THE TEN MOVES

Ranked by how much craft each buys per line of code, across all nine surfaces.

---

### MOVE 1 — One column token drives the row, its skeleton, its sparse floor, and its intrinsic size

**What.** Four separate geometries (real row, loading row, empty list, off-screen placeholder) that drift apart in every hand-built feed are derived from two tokens, so drift is structurally impossible.

```css
/* globals.css, component layer */
.feed            { list-style: none; margin: 0; padding: 0; display: grid; align-content: start; }
.feed > li,
.feed > .row-skeleton {
  display: grid;
  grid-template-columns: var(--feed-cols);
  column-gap: var(--spacing-sm);
  align-items: center;
  min-block-size: var(--row-h-feed);
  padding-block: var(--spacing-sm);
  padding-inline: var(--spacing-sm);
  border-radius: var(--radius-md);
  background-clip: padding-box;          /* hover fill never paints under the hairline */
  content-visibility: auto;
  contain-intrinsic-size: auto var(--row-h-feed);
}
.feed > li + li,
.feed > .row-skeleton + .row-skeleton {
  border-block-start: var(--hairline) solid var(--color-border-hair);
}
/* the bench: a two-row list must not look like a broken page */
.bench { min-block-size: calc(3 * var(--row-h-feed)); }
.bench-empty { display: grid; place-content: center; gap: var(--spacing-sm);
               min-block-size: calc(3 * var(--row-h-feed)); }
```

Rules that come with it: the rule belongs to the **following** row (`li + li`), never `border-bottom` on every row, so there is no orphan hairline under the last row and no doubling against the container edge. Because the first row has no top rule, the sticky filter bar above it must carry its own bottom hairline or there is a visible gap at the top of the feed.

Do **not** draw empty ruling with `repeating-linear-gradient` (ban 7). If you want visible empty rules, render real `<li aria-hidden="true" class="rule-only">` elements.

**Lands on:** Discover feed (2), discussions register (8), profile project list (6), dashboard inbox (5), project-detail feedback thread (3).

---

### MOVE 2 — Top-layer enter *and* exit in pure CSS: `@starting-style` + `allow-discrete` + `overlay`

**What.** The dialog, drawer, popover and menu animate in and out with no `isClosing` state, no `setTimeout` before unmount, and no motion library. The forgotten line is `overlay`: without it the element leaves the top layer instantly and the exit is invisible while looking correct in review.

```css
dialog.panel {
  opacity: 0; transform: scale(0.98);
  transition: opacity   var(--dur-exit-3) var(--ease-in),
              transform var(--dur-exit-3) var(--ease-in),
              overlay   var(--dur-exit-3) allow-discrete,
              display   var(--dur-exit-3) allow-discrete;
}
dialog.panel[open] {
  opacity: 1; transform: scale(1);
  transition: opacity   var(--dur-3) var(--ease-out),
              transform var(--dur-3) var(--ease-out),
              overlay   var(--dur-3) allow-discrete,
              display   var(--dur-3) allow-discrete;
}
/* MUST be written after the [open] rule: same specificity, source order decides */
@starting-style { dialog.panel[open] { opacity: 0; transform: scale(0.98); } }

dialog.panel::backdrop {
  background-color: transparent;
  transition: background-color var(--dur-exit-3) var(--ease-in),
              overlay var(--dur-exit-3) allow-discrete,
              display var(--dur-exit-3) allow-discrete;
}
dialog.panel[open]::backdrop { background-color: var(--color-scrim); }
@starting-style { dialog.panel[open]::backdrop { background-color: transparent; } }
```

React side collapses to `ref.current.showModal()` / `ref.current.close()`.

Three silent traps: `@starting-style` after the `[open]` rule or it never applies; `allow-discrete` inside the shorthand (a separate `transition-behavior` line before a `transition:` shorthand gets reset); never transition `filter` or `box-shadow` here (§6.3).

**Lands on:** `dialog.tsx` (composer, surface 4), `drawer.tsx` (Discover filter sheet below 60rem), `popover.tsx`, `dropdown-menu.tsx`, the tracker's "Move to…" menu (5).

---

### MOVE 3 — The row navigates from a stretched `::after`, and its accessible name stays three words long

**What.** The whole row is clickable, but the only `<a>` is around the title; its `::after` covers the row. Middle-click, cmd-click, right-click-copy-link and the status-bar URL preview all survive, and a screen reader announces the title, not the entire row.

```css
.feed > li { position: relative; }
.feed .row-title a::after { content: ""; position: absolute; inset: 0 8rem 0 0; z-index: 1; }
.feed > li :is(a, button):not(.row-title a) { position: relative; z-index: 2; }
```

`inset: 0 8rem 0 0` stops the overlay before the metadata columns, which does two jobs at once: the grit chip stays clickable as a filter link, and text selection on the ask still works without any JS.

Text selection inside the covered area is restored by one delegated listener on the `<ul>` (not a JSX `onClick` on the `<li>`, which trips `jsx-a11y/click-events-have-key-events`, gate line 49):

```ts
useEffect(() => {
  const ul = ref.current; if (!ul) return
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if ((e.target as Element).closest('a, button')) return
    if (window.getSelection()?.toString()) return
    ;(e.target as Element).closest('li')?.querySelector<HTMLAnchorElement>('.row-title a')?.click()
  }
  ul.addEventListener('click', onClick)
  return () => ul.removeEventListener('click', onClick)   // ban 53 without this
}, [])
```

**Lands on:** Discover rows (2), discussion rows (8), profile project list (6), reviewer rows (7), inbox `<tr>` (5, with the `::after` on `td > a[href]`).

---

### MOVE 4 — Every field is a three-area grid with a permanently reserved message row

**What.** Zero layout shift at the moment a form fails. Helper text and error text share one cell; the error replaces the helper instead of stacking under it; the right-edge adornment slot is reserved whether or not an icon is there.

```css
.field {
  display: grid;
  grid-template-areas: "label" "control" "msg";
  row-gap: var(--spacing-2xs);
}
.field > label        { grid-area: label; }
.field > .control-wrap{ grid-area: control; position: relative; }
.field > .msg {
  grid-area: msg;
  min-block-size: 1lh;                 /* never display:none, ban 47 */
  font-size: var(--text-xs);
  color: var(--color-text-3);
  max-inline-size: 58ch;
}
.field[data-state="error"] > .msg { color: var(--color-critical); }
.control-wrap        { padding-inline-end: calc(var(--spacing-lg) + var(--spacing-xs)); }
.control-wrap > .adornment {
  position: absolute; inset-block: 0; inset-inline-end: var(--spacing-xs);
  inline-size: var(--spacing-lg); display: grid; place-items: center;
}
```

One `.msg` node always exists, so `aria-describedby` points at a stable id that never appears or disappears. This is exactly what `Field` in `field.tsx` already promises ("helper slot keeps `min-height: 1lh` at all times"); this is its CSS.

`1lh` is the message's own line box, so a two-line error still pushes. Cap error copy at one line at 58ch during the string pass, or reserve `2lh` on fields whose errors are known to run long and accept the constant extra 17px.

**Lands on:** all nine surfaces. Composer (4), auth (9), bounty request (7), Discover filter numerics (2).

---

### MOVE 5 — Kill every transition for one frame around a theme flip

**What.** The contract's 120ms `background-color` / `border-color` transitions fire on hundreds of elements at once when the theme toggles, producing a smear. A theme change should be a hard cut.

```css
:root[data-theme-switching] *,
:root[data-theme-switching] *::before,
:root[data-theme-switching] *::after {
  transition: none !important;
  animation: none !important;
}
```

```ts
function setTheme(next: 'dark' | 'light') {
  const root = document.documentElement
  root.setAttribute('data-theme-switching', '')
  root.setAttribute('data-theme', next)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.removeAttribute('data-theme-switching')
  }))
  // backgrounded tabs never fire rAF; without this the app can end up permanently motionless
  window.setTimeout(() => root.removeAttribute('data-theme-switching'), 200)
}
```

Ship the rest of the native plumbing in the same pass, in `@layer base`:

```css
:root { color-scheme: dark; }
:root[data-theme="light"] { color-scheme: light; -webkit-font-smoothing: auto; }
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) { color-scheme: light; -webkit-font-smoothing: auto; }
}
```

`color-scheme` is missing from globals.css today; it is what repaints scrollbars, native form controls and the caret for the theme. `::selection` and dark-mode `antialiased` are already there. Drop `text-rendering: optimizeLegibility` from `body` if a long Literata thread ever measures slow; it forces kerning work per paragraph and buys nothing that the font's own defaults do not.

`theme-color` cannot be a literal (ban 13, gate 9.1.1). Read the live token in the toggle's effect, keyed on the theme value:

```ts
useEffect(() => {
  const c = getComputedStyle(document.documentElement).getPropertyValue('--color-surface-1').trim()
  let m = document.querySelector('meta[name="theme-color"]')
  if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'theme-color'); document.head.appendChild(m) }
  m.setAttribute('content', c)
}, [theme])
```

**Lands on:** `theme-toggle.tsx`, global. Most visible on the inbox scroller (5) and the composer dialog (4).

---

### MOVE 6 — `text-box: trim-both cap alphabetic` on chrome type, then centre geometrically

**What.** CSS half-leading means a "centred" chip label is never centred on its cap height, and the offset differs per family. Whetstone runs three families with three metrics, so no fixed padding fixes all three. Trim removes the half-leading and lets `place-items: center` be literally true.

```css
@supports (text-box: trim-both cap alphabetic) {
  .chip, .btn, .tab, .grit-chip, th, .count, .feed dt, .feed dd {
    text-box: trim-both cap alphabetic;
  }
}
.chip { display: grid; place-items: center; block-size: 1.75rem; padding-inline: var(--spacing-xs); }
.btn  { display: grid; place-items: center; block-size: var(--tap-min); padding-inline: var(--spacing-md); }
```

Scope it **away from form controls**: §5.5 defines input vertical padding as `(height − line-height-px) / 2`, and trimming changes that arithmetic. Leave `input`, `select`, `textarea` untrimmed.

Never pair trim with `overflow: hidden` on a fixed-height box, or descenders clip. The fixed-`block-size` + `place-items: center` form above degrades correctly in engines without trim (1–2px looser, still centred).

Pair with optical nudges on icon lockups, expressed in `em` so they hold at 16/20/24:

```css
.lockup { display: inline-grid; grid-auto-flow: column; align-items: center; gap: var(--spacing-xs); }
.lockup > svg            { flex: none; transform: translateY(-0.03em); }
.lockup > svg[data-dir]  { transform: translate(0.02em, -0.03em); }   /* carets, chevrons */
```

Nudge only lockups you have looked at against a cap-height guide, and never nudge anything that moves a target's visual centre out of its 44px box. If you transform an `<svg>` group, set `transform-box: fill-box; transform-origin: center;` or Safari computes the origin wrong.

**Lands on:** grit chips and hatch labels (`--text-2xs`, `'wdth' 87`), table column heads (5), buttons, tabs, Discover metadata `<dl>` (2), the marketplace price at `--text-lg` (7).

---

### MOVE 7 — Row hover and focus painted by `:has()`; selection carried by geometry that never moves

**What.** The row tints on hover and whenever anything inside it has `:focus-visible`, with no JS and no wrapper. The focus ring stays on the child, so the row says *which row* and the ring says *which control*.

```css
@media (hover: hover) and (pointer: fine) {
  .feed > li:has(> .row-title a:hover) { background-color: var(--color-surface-2); }
  .feed > li:not(:hover) { transition-duration: var(--dur-exit-1); }   /* 80ms out */
}
.feed > li:has(:focus-visible) { background-color: var(--color-surface-2); }
.feed > li { transition-property: background-color; transition-duration: var(--dur-1);
             transition-timing-function: var(--ease-out); }
```

One background step. No transform, no shadow, no scale (§5.4, ban 37).

Selection is **never a fill** (§2.4.6). Use the `grind-mark-on` utility already in globals.css: it is an absolutely positioned 2px `::before`, so unlike a border swap it changes zero geometry between states.

```tsx
<li aria-current={isCurrent ? 'true' : undefined}
    className={isCurrent ? 'grind-mark-on' : undefined}>
```

Three cautions. The attribute is **omitted** when false, never `aria-current="false"`, and at most one row per view carries it (§2.4.7). `grind-mark-on` and `tap-44` both occupy `::before`, so they can never be on the same element. Anchor `:has()` to the `li` with a child combinator, never `body:has(...)`, and keep the hover branch inside `@media (hover: hover)` or touch devices get a stuck tint after every tap.

**Lands on:** every row register in the product.

---

### MOVE 8 — The hairline is one token, and it stays 1px until a screenshot says otherwise

**What.** `border: 1px` renders as 2 device pixels at 2dppx, so the rule carrying Whetstone's entire structure is physically twice its intended weight on every modern laptop. The lens recommended stepping to `0.5px` at `min-resolution: 2dppx`.

**Ruling: keep `--hairline: 1px` and route every decorative rule through the token.** `border-hair` already measures 1.58:1 (dark) and 1.33:1 (light); halving its physical width risks dropping the product's only structural device below perceptual visibility on a dim screen, which is a worse failure than a rule that reads slightly heavy.

The token exists so the decision is one line and testable:

```css
@theme { --hairline: 1px; }
/* Flip only after the test below passes:
@media (min-resolution: 2dppx) { :root { --hairline: 0.5px; } } */
```

**The test, run once, recorded in `direction.md`:** screenshot the Discover feed at 1×, at 2×, and at 200% text zoom (gate line 17), in both themes. Flip to 0.5px only if every rule is still visible in all six shots. Apply to `--color-border-hair` edges **only**. Every `--color-border-control` edge stays a full 1px in every state (§5.2, SC 1.4.11).

**Lands on:** every separator, the landing `<figure>` border (1), the footer rule, the dashboard zebra boundary (5).

---

### MOVE 9 — Menus open on pointerdown; tooltips share one warm timer; keyboard is always instant

**What.** Three latency edits that remove motion from the interactions that repeat most.

```tsx
// dropdown-menu.tsx trigger
onPointerDown={(e) => {
  if (e.button !== 0 || e.ctrlKey) return       // let right-click and ctrl-click pass
  e.preventDefault()                            // keeps focus on the trigger, blocks selection
  setOpen(o => !o)
}}
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); setOpen(true) }
}}
```

`preventDefault` on pointerdown suppresses the following click, so remove any `onClick` or you get a double toggle. Add `touch-action: manipulation` to the trigger. Never use pointerdown-to-open on a drag handle or a destructive control.

Tooltip group timing, one provider per toolbar or row:

```ts
const warm = useRef(false)
const timer = useRef<number | null>(null)
const OPEN_DELAY = 280      // matches tooltip.tsx's documented hover delay
const WARM_WINDOW = 400     // grace after the last close

function onPointerEnter() {
  if (warm.current) return setOpen(true)                       // instant while warm
  timer.current = window.setTimeout(() => setOpen(true), OPEN_DELAY)
}
function onFocus() { setOpen(true) }                            // always instant (ban 46)
function onClose() {
  warm.current = true
  timer.current = window.setTimeout(() => { warm.current = false }, WARM_WINDOW)
}
useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
```

```css
.tooltip[data-warm="true"], .tooltip[data-trigger="focus"] { animation: none; }
```

280ms and 400ms are **delays**, not animations, so §6.1's ceiling is untouched and both pass the `[4-9][0-9]{2}ms` grep at gate line 36.

Keyboard-initiated opens need no key listener: a click synthesised by Enter or Space reports `detail === 0`.

```tsx
onClick={(e) => open({ instant: e.detail === 0 })}
```

Apply "instant" to menus, the tab underline and tooltips. Do **not** apply it to the composer dialog: a modal with zero transition reads as a screen flash.

**Lands on:** Discover sort and filter chips (2), tracker "Move to…" (5), account menu, grit chip tooltips (2, 6), rollup segments (5).

---

### MOVE 10 — Filters are URL state; the pending feed dims instead of turning into skeletons; the detail route prefetches on intent

**What.** The main loop of the product (filter, scan, open) is made to feel instant without a client store and without destroying spatial memory.

```tsx
'use client'
const [isPending, startTransition] = useTransition()
const router = useRouter(); const pathname = usePathname()

const setFilter = (next: URLSearchParams) => {
  startTransition(() => {
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  })
}
```

`replace`, not `push`, or Back stops meaning "the previous page" after four chip toggles. `scroll: false`, or the feed jumps to the top on every toggle.

```css
.feed[data-pending="true"] .row-title { color: var(--color-text-2); }   /* steps down from text-1 */
.feed { transition-property: color; transition-duration: var(--dur-1); transition-timing-function: var(--ease-out); }
```

The rows stay readable. Swapping valid rows for skeletons on a filter change costs the user their place for no information gain. Pair the dim with `aria-busy="true"` on the `<ul>` and a polite live result count, because a dim alone is not announced.

Prefetch on intent, not on viewport entry, or a 200-row feed fires 200 route fetches:

```tsx
const timer = useRef<number | undefined>(undefined)
const seen = useRef(new Set<string>()).current
const arm = () => {
  if (seen.has(href)) return
  timer.current = window.setTimeout(() => { seen.add(href); router.prefetch(href) }, 120)
}
const disarm = () => window.clearTimeout(timer.current)

<Link href={href} prefetch={false}
      onPointerEnter={arm} onPointerLeave={disarm} onFocus={arm} onBlur={disarm}>
```

`onFocus` so the j/k user gets the same speed as the mouse user. 120ms dwell means scrolling past never fires. Prefetching is production-only; verify with `next build && next start`, not `next dev`.

**Lands on:** Discover (2), dashboard inbox filters (5), marketplace category filters (7).

---

## 2. ROW CRAFT

The Discover row is the product's core object. Everything here is measured.

### 2.1 The height arithmetic, and the one recorded deviation

§4.4 specifies a 4.5rem (72px) row containing a 48px thumbnail, a title at `--text-sm`, and an ask clipped to two lines at `--text-xs`. Those do not fit:

```
title  14px × 1.50 = 21.0px
ask    13px × 1.45 = 18.85px × 2 lines = 37.7px
gap    --spacing-3xs                   =  2.0px
                                  total = 60.7px
+ padding-block var(--spacing-sm) × 2   = 24.0px
                                  total = 84.7px   →  72px is 12.7px short
```

**Resolution.** `--row-h: 4.5rem` stays the register-row height everywhere the subtitle is one line (discussions, profile list, inbox). The Discover row becomes `--row-h-feed: 5.5rem` (88px: content box 64px ≥ 60.7px, 48px thumb centres cleanly, still a multiple of 4). Record in `direction.md`:

> §4.4/§5.4 · Discover row is 5.5rem, not 4.5rem · 14px title + two 13px ask lines + 12px padding measures 84.7px; 4.5rem would clip the second ask line or force off-scale padding.

Skeleton, sparse floor and `contain-intrinsic-size` all read the same token, so the deviation cannot drift.

### 2.2 Column plan per breakpoint

Do **not** use `grid-template-columns: subgrid` on the `<li>`. `content-visibility: auto` applies containment, which can force the row into an independent formatting context and silently demote the subgrid to a standalone grid, losing every column alignment with no error. Because every track is either fixed or `minmax(0, 1fr)`, repeating the token is byte-identical:

```css
.feed > li { grid-template-columns: var(--feed-cols); }
```

Subgrid is still correct **inside** the row, where the `<dl>` subgrids off the row's own explicit tracks:

```html
<dl class="meta">
  <div><dt>Category</dt><dd>Game</dd></div>
  <div><dt>Grit</dt><dd class="grit">1000</dd></div>
  <div><dt>Notes</dt><dd class="count">12</dd></div>
</dl>
```

(The `<div>` wrapper around each `dt`/`dd` pair is valid inside `<dl>` and is what makes the subgrid placement legal.)

```css
.feed .meta { grid-column: 3 / -1; display: grid; grid-template-columns: subgrid;
              row-gap: var(--spacing-3xs); margin: 0; }
.feed dt { font-size: var(--text-2xs); font-variation-settings: 'wdth' 87, 'wght' 600;
           color: var(--color-text-3); }
.feed dd { margin: 0; font-size: var(--text-xs); color: var(--color-text-2);
           font-variant-numeric: tabular-nums; }
.feed dd.count { inline-size: 4ch; text-align: end; }      /* 3 and 128 share a right edge */
.feed .grit     { font-feature-settings: 'zero' 1; }
```

Track budget, measured against `--container-feed` 72rem and `--pad-inline` `clamp(1rem, 4vw, 2rem)`:

| Viewport | Tracks | Title column |
|---|---|---|
| ≥80rem | `48px 1fr 8rem 6rem 4rem` | 704px at 1152px container |
| 60–80rem | `48px 1fr 6rem 4rem` (category moves under the title) | ~512px at 960px |
| 40–60rem | `48px 1fr 6rem` (count moves under the title) | ~380px at 768px |
| <40rem | `48px minmax(0, 1fr)`; `.meta { grid-auto-flow: row; grid-template-columns: none; }` | remainder |

Every image track is `minmax(0, 1fr)`, never bare `1fr` (gate line 20).

### 2.3 The ask: two lines, reserved, no orphan

```css
.feed .ask {
  font-family: var(--font-prose);
  font-size: var(--text-xs);
  line-height: 1.45;
  color: var(--color-text-2);
  max-inline-size: 66ch;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;               /* without this you get an ellipsis and no clipping */
  min-block-size: 2lh;            /* a one-line ask must not shorten its row */
  overflow-wrap: anywhere;
}
```

`text-wrap: pretty` is inherited from the base `p` rule in globals.css. **Remove it on `.ask`** (`text-wrap: wrap`): `pretty` changes where the rag falls and therefore which word becomes the clamp point, and it differs between engines. Headings keep `balance` (already set globally); the landing hero `h1` is the one exception, because it runs inside `contain: layout paint` with a reserved `min-inline-size` and re-balancing can change its line count.

### 2.4 Selection without a fill

Three signals, no background change:

1. `grind-mark-on` (2px accent `::before` on the leading edge). Exactly one element per view (§2.4.7).
2. Title steps `--color-text-2` → `--color-text-1`.
3. `aria-current="true"`, omitted entirely when false.

```css
.feed > li[aria-current="true"] .row-title { color: var(--color-text-1); }
```

`--surface-wash` is for info callouts only and is never a row-selection fill.

### 2.5 Keyboard traversal: arrows and j/k on a plain list of links

Do **not** add `role="grid"`/`role="row"`. The moment you do, you owe the full APG grid contract and Tab stops reaching the row's secondary links. The list stays an ordinary `<ul>` of links; arrows are an additive accelerator.

```ts
const onKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return                    // Cmd+J must still reach the browser
  const t = e.target as HTMLElement
  if (t.closest('input, textarea, select, [contenteditable]')) return

  const map: Record<string, 1 | -1 | 'first' | 'last'> = {
    ArrowDown: 1, j: 1, ArrowUp: -1, k: -1, Home: 'first', End: 'last',
  }
  const move = map[e.key]; if (move === undefined) return
  e.preventDefault()

  const links = Array.from(e.currentTarget.querySelectorAll<HTMLAnchorElement>('li > .row-title a'))
  const i = links.indexOf(t.closest('li')!.querySelector('.row-title a')!)
  const next = move === 'first' ? 0
             : move === 'last'  ? links.length - 1
             : Math.min(Math.max(i + move, 0), links.length - 1)

  links[next].focus({ preventScroll: true })
  links[next].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
}
```

`block: 'nearest'` means a row already on screen does not move at all. `behavior: 'instant'` unconditionally, which sidesteps the reduced-motion branch and the 400ms budget on a long jump. `preventScroll: true` plus the manual call is what lets `scroll-padding-top` apply.

SC 2.1.4 (Character Key Shortcuts) is satisfied by **scoping**: the handler is on the `<ul>`, so the shortcut is only active when a component inside it has focus. Binding it to `document` fails the criterion immediately and stomps on the composer textarea. Document this in the file's keyboard-contract header (gate line 50).

### 2.6 Sticky clearance

```css
html { scroll-padding-block-start: calc(var(--nav-h) + var(--filterbar-h)); }   /* 3.5rem + 3rem */
```

One declaration on the container beats `scroll-margin` on every focusable forever, and it covers hash links, `scrollIntoView`, and the browser's own focus scrolling. SC 2.4.11 (Focus Not Obscured) is gate line 25. Keep the contract's `scroll-margin-block: 5rem` on composer focusables as the inner layer, because the dialog is its own scroll container.

Stuck state, no transition (animating `box-shadow` is banned by §6.3, and a shadow that fades in reads as lag):

```css
.filterbar-wrap { position: sticky; top: var(--nav-h); z-index: var(--z-sticky);
                  container-type: scroll-state; }
@container scroll-state(stuck: top) { .filterbar { box-shadow: var(--shadow-raised); } }
.filterbar-wrap[data-stuck="true"] .filterbar { box-shadow: var(--shadow-raised); }
```

Fallback is a 1px sentinel `<div>` above the wrapper watched by `IntersectionObserver` (threshold 0), not a scroll listener, and with a cleanup return.

### 2.7 The inbox table keeps its hairline when it sticks

```css
.inbox { border-collapse: separate; border-spacing: 0; inline-size: 100%; }
.inbox :is(th, td) {
  border-block-end: var(--hairline) solid var(--color-border-hair);
  padding-block: var(--spacing-sm); padding-inline: var(--spacing-md);
  border-radius: var(--radius-0); font-variant-numeric: tabular-nums;
}
.inbox thead th {
  position: sticky; top: var(--nav-h); z-index: var(--z-sticky);
  background-color: var(--color-surface-2); color: var(--color-text-3);   /* both, same rule, §2.4.9 */
  font-size: var(--text-2xs); font-variation-settings: 'wdth' 87, 'wght' 600; text-align: start;
}
.inbox tbody tr:nth-child(odd)  { background-color: var(--color-surface-1); color: var(--color-text-2); }
.inbox tbody tr:nth-child(even) { background-color: var(--color-surface-2); color: var(--color-text-2); }
```

`border-collapse: collapse` drops the border from sticky cells in shipping engines, so the header underline scrolls away and leaves a seam. `border-spacing: 0` is mandatory or every cell gains a 2px gap. The sticky `<th>` needs its own opaque background or rows show through it. This `top: var(--nav-h)` is not `top: 0`, so gate line 21 still passes.

---

## 3. MOTION RECIPES

Copy these whole. Every one is under 400ms, every one has a reduced-motion path, and none animates a property on the §6.3 list.

**House pattern: reduced motion is the base layer.** Write the opacity-only version as the default and add transform inside `@media (prefers-reduced-motion: no-preference)`. The global `*` reset in globals.css stays as a backstop for anything missed, but it must not be the only path, because it produces teleporting elements and frozen indicators.

**Interruptibility rule.** Everything reversible (hover, open/closed, selected) is a `transition` on an attribute or pseudo-class. `@keyframes` is reserved for the three one-shots: the hero grind, the loading indicators, and view-transition pseudo-elements. A transition retargets from its current computed value when interrupted; a keyframe restarts from frame 0.

### 3.1 Dialog (240 in / 160 out)

Use MOVE 2's block verbatim, plus:

```css
@media (prefers-reduced-motion: reduce) {
  dialog.panel, dialog.panel[open] { transform: none; }
}
```

The `overlay`/`display` discrete transitions survive the global reset (it clamps duration, not behaviour); at 0.01ms the close is effectively instant, which is correct.

### 3.2 Popover, dropdown, tooltip (180 in / 120 out), direction-aware

```css
.menu {
  opacity: 0;
  transition-property: opacity;
  transition-duration: var(--dur-exit-2);
  transition-timing-function: var(--ease-in);
}
.menu[data-open] {
  opacity: 1;
  transition-duration: var(--dur-2);
  transition-timing-function: var(--ease-out);
}
@media (prefers-reduced-motion: no-preference) {
  .menu            { transform: translateY(var(--pop-dy, 4px)); transition-property: opacity, transform; }
  .menu[data-open] { transform: translateY(0); }
}
.menu[data-instant] { transition-duration: 0ms; }   /* placed after [data-open]; no !important needed */
```

```ts
// in the same layout effect that positions the panel, every open
panel.style.setProperty('--pop-dy', side === 'top' ? '-4px' : '4px')
```

A menu that flips above its trigger must enter from below. A stale `data-side` set once is worse than no rule, so recompute per open, and measure the **trigger**, never the panel.

### 3.3 Toast stack (180 in / 120 out)

Positions are transform offsets summed from measured heights. Nothing animates `top`, `height` or `margin`.

```tsx
const GAP = 8   // --spacing-xs
const offset = list.slice(0, i).reduce((h, t) => h + (heights[t.id] ?? 0) + GAP, 0)
<li style={{ ['--toast-offset' as string]: `${offset}px` }} ref={measure} />
```

```css
.toaster { position: fixed; z-index: var(--z-toast); pointer-events: none; }
.toast {
  position: absolute; inset-block-end: 0; inset-inline-end: 0;
  pointer-events: auto;
  transform: translateY(calc(var(--toast-offset) * -1));
  transition-property: transform, opacity;
  transition-duration: var(--dur-2);
  transition-timing-function: var(--ease-out);
}
.toast[data-exiting] { opacity: 0; transition-duration: var(--dur-exit-2); transition-timing-function: var(--ease-in); }
.toast::after { content: ''; position: absolute; inset-block-start: 100%; inset-inline: 0; block-size: 8px; }
@media (prefers-reduced-motion: reduce) { .toast { transition-property: opacity; } }
```

The `::after` bridges the 8px gap so the pointer never falls through the seam and un-pauses the timer. Measure with one `ResizeObserver` over the stack (`entry.borderBoxSize[0].blockSize`), not `offsetHeight` per render. Pause timers on tab hide:

```ts
useEffect(() => {
  const on = () => (document.hidden ? pauseAll() : resumeAll())
  document.addEventListener('visibilitychange', on)
  return () => document.removeEventListener('visibilitychange', on)
}, [])
```

Do not copy Sonner's per-index `scale(0.95)`: it reads as a stack of cards and would be the only stacked-card object in a product built on hairline rows.

### 3.4 Optimistic row insert (180ms, once, only on fresh rows)

```css
.row[data-fresh] {
  opacity: 1;
  transition-property: opacity, transform;
  transition-duration: var(--dur-2);
  transition-timing-function: var(--ease-out);
  @starting-style { opacity: 0; transform: translateY(8px); }
}
@media (prefers-reduced-motion: reduce) {
  .row[data-fresh] { @starting-style { transform: none; } }
}
```

```tsx
const [rows, addRow] = useOptimistic(serverRows, (s, next: Reply) => [...s, { ...next, fresh: true }])
<li key={r.id} data-fresh={r.fresh || undefined} className="row">
```

The `[data-fresh]` guard is load-bearing: `@starting-style` fires for **every** element on first render, so without it the whole server-rendered feed slides up on load, which is a scroll reveal in all but name (ban 40). Key on the stable server id, or the row animates twice when the optimistic entry is replaced.

### 3.5 Tab underline (180ms, one element, re-measured on font load)

```tsx
const sync = useCallback(() => {
  const list = listRef.current
  const active = list?.querySelector('[aria-selected="true"]')
  if (!list || !active) return
  const a = active.getBoundingClientRect(), l = list.getBoundingClientRect()
  list.style.setProperty('--tab-x', `${a.left - l.left}px`)
  list.style.setProperty('--tab-w', String(a.width))        // unitless multiplier
}, [])
useLayoutEffect(() => {
  sync()
  const ro = new ResizeObserver(sync); if (listRef.current) ro.observe(listRef.current)
  document.fonts.ready.then(sync)                            // Archivo loads with display:swap
  return () => ro.disconnect()
}, [sync, activeId])
```

```css
.tablist { position: relative; }
.tablist::after {
  content: ''; position: absolute; inset-block-end: 0; inset-inline-start: 0;
  inline-size: 1px; block-size: 2px; background-color: var(--color-accent);
  transform: translateX(var(--tab-x, 0)) scaleX(var(--tab-w, 0));
  transform-origin: 0 50%;
  transition-property: transform; transition-duration: var(--dur-2);
  transition-timing-function: var(--ease-out);
}
.tablist[data-instant]::after { transition-duration: 0ms; }
@media (prefers-reduced-motion: reduce) { .tablist::after { transition-duration: 0.01ms; } }
```

1px base times `scaleX(width)` gives an exact pixel width from a transform-only animation. The `document.fonts.ready` re-measure is the detail nearly everyone misses: the first measurement happens against the Arial fallback. Arrow-key traversal sets `data-instant` so holding Right does not queue five 180ms slides.

### 3.6 List stagger, first paint only, arithmetic-capped

§6.2 allows 40ms per index with a 280ms stagger cap; §6.1 caps any total at 400ms. With `--dur-2` at 180ms the last item's delay must be ≤ 220ms, so the index clamp is 5 (5 × 40 = 200; 200 + 180 = 380ms).

```css
@media (prefers-reduced-motion: no-preference) {
  .stagger > * {
    animation: row-in var(--dur-2) var(--ease-out) both;
    animation-delay: calc(min(var(--i), 5) * 40ms);
  }
  @keyframes row-in { from { opacity: 0; transform: translateY(8px); } }
}
```

```tsx
{rows.map((r, i) => <tr key={r.id} style={{ ['--i' as string]: i }} />)}
```

Fires on the dashboard inbox first paint only. Gate it with the same sessionStorage pattern as the hero if a client-side navigation can remount the table. It is **not** applied to the Discover feed: a staggered feed on every filter change is a scroll reveal.

### 3.7 Landing hero width sweep (360ms, once per session)

```css
.grind { display: inline-block; contain: layout paint;
         min-inline-size: calc(var(--grind-w) * 1em);   /* measured, see below */
         font-variation-settings: 'wdth' 96; letter-spacing: -0.025em; }

@media (prefers-reduced-motion: no-preference) {
  .grind[data-grind] { animation: grind var(--dur-hero) var(--ease-grind) both; }
  @keyframes grind {
    from { font-variation-settings: 'wdth' 118; letter-spacing: 0.03em; }
    to   { font-variation-settings: 'wdth' 96;  letter-spacing: -0.025em; }
  }
}
```

The element's **rest state is the end state**, so reduced motion, JS-off and a late hydration all render `wdth 96` with no flash and no fallback rule needed.

```tsx
'use client'
useEffect(() => {
  if (sessionStorage.getItem('grind')) return
  sessionStorage.setItem('grind', '1')
  ref.current?.setAttribute('data-grind', '')
}, [])
```

**Measuring `--grind-w` (do this once, do not guess).** In DevTools, set the word to `font-variation-settings: 'wdth' 118; letter-spacing: 0.03em`, then read

```js
$0.getBoundingClientRect().width / parseFloat(getComputedStyle($0).fontSize)
```

That ratio is font-size independent, which is what makes it survive the `--text-display` clamp. Write it into globals.css as `--grind-w` and note the measurement in `direction.md`. Zero CLS across the whole clamp range is the reason this exception to §6.3 is permitted at all.

### 3.8 Skeleton to content, zero movement

Geometry already matches (MOVE 1), so the handoff is a crossfade with an asymmetric, non-overlapping schedule:

```css
.skeleton { opacity: 1; transition-property: opacity; transition-duration: var(--dur-exit-2);
            transition-timing-function: var(--ease-in); }
.skeleton[data-resolved] { opacity: 0; }
.rows { opacity: 0; transition-property: opacity; transition-duration: var(--dur-2);
        transition-timing-function: var(--ease-out); transition-delay: var(--dur-exit-2); }
.rows[data-resolved] { opacity: 1; }
```

120 + 180 = 300ms total. No translate on the enter: the skeleton is already at the row's exact position, so any travel is a lie about where the content came from. Do not add a blur keyframe (ban 39).

### 3.9 Spinner delay in CSS, not in a timer

```css
.spinner { opacity: 0; animation: spinner-appear 1ms linear 150ms forwards; }
@keyframes spinner-appear { to { opacity: 1 } }
```

A request that resolves in 90ms never paints a spinner and never schedules a timer that can leak. The rotation itself is the separate, genuine-loading-indicator animation already recorded as a deviation in `PRIMITIVES-overlays.md` (640ms, 1200ms under reduced motion). `useDelayedLoading` from `spinner.tsx` still owns the 300ms minimum-visible half.

### 3.10 Reorder with view transitions (optional, clamp it or skip it)

Only for the Discover re-sort and the tracker's column move.

```ts
export function withReorder(update: () => void) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce || !document.startViewTransition) return update()
  document.startViewTransition(() => flushSync(update))
}
```

```css
::view-transition-group(*) { animation-duration: var(--dur-2); animation-timing-function: var(--ease-out); }
::view-transition { pointer-events: none; }
::view-transition-group(site-header), ::view-transition-group(filter-bar) { animation: none; z-index: 100; }
::view-transition-old(site-header),  ::view-transition-old(filter-bar)  { display: none; }
```

Anchoring the sticky chrome is not optional: a nav that slides during a re-sort removes the user's only fixed reference. The `::view-transition-group(*)` duration override is what stops a UA default creeping past the ceiling, and it is grep-checkable. Duplicate `view-transition-name` values silently cancel the whole transition, so name rows from a stable id.

### 3.11 Drag handoff (drawer sheet, tracker card)

```ts
function onPointerDown(e: React.PointerEvent<HTMLElement>) {
  if (dragging) return                       // ignore a second finger
  const el = e.currentTarget
  el.setPointerCapture(e.pointerId)
  el.style.transition = 'none'               // 1:1 tracking; a transition here is the cheapest-feeling bug
  startY = e.clientY; startT = performance.now(); dragging = true
}
function onPointerMove(e: React.PointerEvent<HTMLElement>) {
  if (!dragging) return
  const dy = e.clientY - startY
  const y = dy < 0 ? dy / (1 + Math.abs(dy) / 200) : dy     // damp the impossible direction
  e.currentTarget.style.transform = `translateY(${y}px)`
}
function onPointerUp(e: React.PointerEvent<HTMLElement>) {
  const el = e.currentTarget; dragging = false
  const dy = e.clientY - startY
  const velocity = Math.abs(dy) / (performance.now() - startT)   // px per ms
  el.style.transition = ''; el.style.transform = ''
  if (dy > el.offsetHeight * 0.28 || velocity > 0.11) close()    // 28% matches drawer.tsx
}
```

Reset `style.transition` in `pointercancel` too, or a cancelled gesture leaves the element permanently untransitioned. Drag is never the only path (SC 2.5.7): the sheet keeps its close button, the tracker keeps "Move to…".

**Do not add a fourth easing token.** The iOS sheet curve `cubic-bezier(0.32, 0.72, 0, 1)` is legal (no overshoot) but would be a §6.1 deviation for a character difference that `--ease-out` already approximates at 240ms. Use `--ease-out`.

---

## 4. FORM CRAFT

### 4.1 Validation timing (the contract's rule, made precise)

§5.5: "on blur after first touch, then re-validate on `input`. Never per keystroke from the first character." Lens 4 argued for submit-only. The contract wins, and the two reconcile cleanly:

| Moment | What runs | What the user sees |
|---|---|---|
| First keystroke → first blur | nothing | nothing |
| Blur, field touched, field invalid | that field's check | that field's `.msg` fills; `aria-invalid="true"` |
| `input`, **only on a field already showing an error** | that field's check | the error clears the moment it is fixed |
| Submit | all checks, server-side too | `ErrorSummary` renders, takes focus, lists every problem |

The native selector does exactly this, for free:

```css
.field input:user-invalid,
.field textarea:user-invalid { border-color: var(--color-critical); }
```

`:user-invalid` matches only after the user has interacted and left the field, which is why it is preferred over `:invalid` (which paints an empty required field red on first paint).

### 4.2 Error summary

`form.tsx` already ships `ErrorSummary` with `role="alert"`, `tabIndex={-1}`, focus-once-per-failed-submit and fragment links. Three implementation notes it depends on:

- Render it **conditionally**, inserted on failure. A `role="alert"` node that exists at rest and is merely emptied does not announce, and can double-announce against the focus move.
- Key `fieldErrors` by the same `id` passed to each `Field`, so the fragment link resolves.
- Title is a count, not an apology: `2 problems with this feedback`. No exclamation mark, no "Oops" (ban 48).
- The summary lives in the dialog's scrolling body, so it needs `scroll-margin-block: 5rem` or the sticky composer footer covers it after the focus scroll.

```css
.error-summary {
  background-color: var(--color-surface-2); color: var(--color-text-1);
  border-inline-start: 2px solid var(--color-critical);
  border-radius: var(--radius-md); padding: var(--spacing-md);
  scroll-margin-block: 5rem;
}
```

Each field-level message still carries the `CircleAlert` glyph plus the sentence: the summary is never the only signal, because no state is carried by hue alone (§2.4.8).

### 4.3 Textarea sizing

```css
.composer-textarea {
  field-sizing: content;
  min-block-size: 6rem;                 /* rows/cols are ignored once field-sizing is content */
  max-block-size: 22rem;
  max-inline-size: 66ch;
  resize: vertical;
  font-family: var(--font-prose);
  font-size: var(--text-prose);
  line-height: 1.65;
  border: 1px solid var(--color-border-control);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-0);
  color: var(--color-text-1);
}
```

Treat `field-sizing` as progressive enhancement: engines without it fall back to the fixed 6rem box with a scrollbar, which is today's behaviour. Its animation type is discrete, so it can never produce a transition and cannot violate the height-animation ban. Pick `max-block-size` so the sticky footer plus one field still fit at 1280×800, and verify at 390px.

### 4.4 Counters

Two nodes, not one. The visible count updates on every keystroke and is hidden from AT; the announced count is debounced and only speaks near the limit, so a screen reader is not read a number per character.

```tsx
<span aria-hidden="true" className="count">{remaining} left</span>
<span className="sr-only" aria-live="polite">{announced}</span>
```

```ts
useEffect(() => {
  if (remaining > 40) { setAnnounced(''); return }
  const t = window.setTimeout(() => setAnnounced(`${remaining} characters left`), 1000)
  return () => window.clearTimeout(t)
}, [remaining])
```

Use a **soft** limit. Never `maxlength`: it silently truncates a paste, which is the exact moment a reviewer loses the most work. Over the limit, show `12 over the limit`, colour the count `--color-critical`, and let submit fail with a real message naming the field.

### 4.5 Drafts

Key on `projectId + category`. Save on `input` debounced 800ms and on `pagehide`. Restore into a `Banner` with a discard action, never silently.

```ts
const key = `ws:draft:${projectId}:${category}`
useEffect(() => {
  const t = window.setTimeout(() => localStorage.setItem(key, value), 800)
  return () => window.clearTimeout(t)
}, [key, value])
useEffect(() => {
  const flush = () => localStorage.setItem(key, value)
  window.addEventListener('pagehide', flush)
  return () => window.removeEventListener('pagehide', flush)
}, [key, value])
```

Clear on a successful action result. `beforeunload` only while the composer is dirty and not submitting, and remove the listener the instant it submits, or the user gets a browser dialog on a successful post.

### 4.6 WCAG 2.2, exactly what the four criteria require in code

**SC 3.3.7 Redundant Entry (A).** Information already entered in the same process is auto-populated or selectable, unless re-entry is essential.

- No "confirm email" and no "confirm password" fields anywhere. Use a reveal toggle in the reserved adornment slot instead (§5.5 already reserves that ~24px slot).
- Sign-up → verification: the verification screen **displays** the address as text, it does not ask for it again.
- Bounty request (7): the reviewer and project are carried in the URL/hidden inputs, never re-typed.
- Composer: a restored draft repopulates the textarea and the grit selection, so a reviewer who navigated away is not re-asked.
- Any multi-step flow renders a check-answers step that shows the values with an "Edit" link per row, rather than re-collecting them.

**SC 3.3.8 Accessible Authentication, Minimum (AA).** No cognitive function test unless an alternative or a mechanism exists.

```tsx
<input id="email" name="email" type="email" autoComplete="username"
       inputMode="email" autoCapitalize="none" spellCheck={false} />
<input id="password" name="password" type="password" autoComplete="current-password" />
<input id="new-password" name="password" type="password" autoComplete="new-password" />
<input id="otp" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" />
```

- Paste must work in every field. Never `onPaste={e => e.preventDefault()}`, never a paste-blocking `onKeyDown`, never six split OTP boxes that reject a pasted six-digit code (use one input).
- No puzzle, no image CAPTCHA, no "third character of your memorable word", no transcription test.
- Password rules are shown **before** the field and validated on submit; they are never a memory test.
- Gate line 27 checks this by hand.

**SC 2.5.7 Dragging Movements (AA).** Every drag has a single-pointer alternative.

- Tracker (5): every item exposes a "Move to…" menu with the same destinations as the drag. This is required, not a nicety (gate line 28).
- Drawer (2): swipe-to-dismiss always accompanied by a visible close button.
- Grit selector (4): it is a radiogroup with roving tabindex and arrow keys, never a slider drag.
- Any range input: arrow keys plus a paired numeric input.

**SC 2.5.8 Target Size, Minimum (AA).** The contract sets 44×44 (§0.11), which clears the 24px minimum with margin.

The trap the contract does not spell out: `tap-44` expands by 12px on each side, so two expanded targets **overlap** unless the visual gap is ≥ 24px (`2 × 12 > 8`). Therefore:

- Icon-only controls that sit in a group (toolbars, row actions, nav) are **physically** `--tap-min` × `--tap-min` with `display: grid; place-items: center`, and do not use `tap-44`.
- `tap-44` is for isolated small controls with ≥24px of clear space: a lone remove-chip affordance, a single inline toggle.
- Inline links inside Literata prose are exempt from 2.5.8 (inline exception) and must not be padded out, which would wreck the measure.
- Verify five targets with DevTools per gate line 26, and check that neighbouring hit rectangles do not overlap.

---

## 5. SHOWING DISAGREEMENT

### 5.1 The problem, stated precisely

Whetstone's ratings are grit verdicts: a reviewer answers "what stage does Balance actually feel like?" on the five-step scale (§4.4 surface 3: `"Balance: 3000 of 8000"`). When nine reviewers answer, the interesting fact is usually **not** the central tendency; it is that four said prototype and three said beta. An average would produce 1700, which is not a grit step and is not a thing anyone said. **Never average an ordinal scale. Never render a number that no reviewer chose.**

### 5.2 The chart form: the Spread Rail

A new display primitive, `src/components/ui/spread-rail.tsx`, server-safe, built entirely from tokens the product already owns. It uses **zero chromatic tokens**, so greyscale readability is structural rather than checked afterwards.

```tsx
<SpreadRail
  label="Balance"
  counts={{ 120: 0, 400: 4, 1000: 3, 3000: 2, 8000: 0 }}
  unit="reviewers"
/>
```

**Geometry.**

| Part | Spec |
|---|---|
| Track | 5 cells, `grid-template-columns: repeat(5, 1fr)`, cell block-size 28px, `--radius-0` |
| Cell divider | `border-inline-start: var(--hairline) solid var(--color-border-hair)` on cells 2–5 |
| Cell ground | the grit hatch for that step at its real stroke/spacing (`GritHatch`, `aria-hidden`), so the axis is the product's own identity, not an invented ramp |
| Unit mark | one 3px × 14px bar per reviewer, `--color-text-2`, 2px gap, centred in the cell; above 8, render `8 bars + "+4"` in `--text-2xs` |
| Cell numeral | always rendered under the cell, `--text-2xs`, `tabular-nums`, `'zero' 1` |
| Median | 2px `--color-text-1` vertical rule, full 28px, at the median cell's centre |
| Range | 1px `--color-border-control` horizontal line from min-cell centre to max-cell centre, 6px below the track, with 5px end caps |
| Axis labels | only the two ends: `120 concept` and `8000 shipped`, `--text-2xs`, `--color-text-3` |
| Summary line | Archivo `--text-xs`, `--color-text-2`, directly beneath |

The median rule is `text-1`, **not** accent: the accent grind-mark is capped at one element per view (§2.4.7) and a page of five rails would blow the ≤3% accent footprint (gate line 7).

**The statistic, defined.**

```ts
const idx = (v: GritValue) => GRIT_VALUES.indexOf(v)          // 0..4
const present = GRIT_VALUES.filter(v => counts[v] > 0)
const spreadSteps = idx(present.at(-1)!) - idx(present[0]!)   // 0..4
const median = weightedMedian(counts)                          // snapped to a real GritValue, never interpolated
```

**The summary copy, computed, no invented numbers** (§7.1.6):

| `spreadSteps` | Sentence |
|---|---|
| 0 | `9 reviewers, all at 1000, beta.` |
| 1 | `9 reviewers, one step apart. 5 say 400, 4 say 1000. Median 400, prototype.` |
| ≥2 | `9 reviewers, split across 3 steps. 4 say 400, 3 say 1000, 2 say 3000. Median 1000, beta.` |

Words only from the permitted vocabulary plus literal product language; "split" is literal. En dash for any numeric range (`120–8000`), no em dash, curly apostrophes.

**Small n.** Below 3 reviewers there is no distribution to draw. `n === 0` renders the three-beat empty state. `n === 1` and `n === 2` render the sentence alone: `2 reviewers, both at 1000, beta.` A rail drawn from two marks reads as a chart making a claim it cannot support.

**Compact variant.** `<SpreadRail compact>` for the Discover row and the inbox: a 40px × 12px five-cell strip with unit marks only, no median rule, no bracket, no axis labels, paired with the median numeral in a `GritChip`. Same data, same `aria-label`.

### 5.3 Accessible fallback

The drawing is `aria-hidden`. The rail itself is `role="img"` with the summary sentence as its accessible name. Under it, a real `<details>` (instant, so it does not trip ban 46) holding the actual table, so keyboard and sighted users get the numbers too, not only screen readers:

```tsx
<figure role="group" aria-labelledby={captionId}>
  <div role="img" aria-label={summary}>{/* hatch cells, marks, median, bracket: aria-hidden */}</div>
  <figcaption id={captionId} className="summary">{summary}</figcaption>
  <details>
    <summary>Show the counts</summary>
    <table>
      <caption className="sr-only">Reviewer verdicts for Balance, by grit step</caption>
      <thead>
        <tr><th scope="col">Grit</th><th scope="col">Stage</th><th scope="col">Reviewers</th><th scope="col">Share</th></tr>
      </thead>
      <tbody>
        {GRIT_VALUES.map(v => (
          <tr key={v}>
            <th scope="row" data-numeric>{v}</th>
            <td>{gritLabel(v)}</td>
            <td data-numeric>{counts[v]}</td>
            <td data-numeric>{pct[v]}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  </details>
</figure>
```

Shares are computed to sum to exactly 100 (the same largest-remainder rule `sentiment-bar.tsx` already uses). Every number traces to a real row (§7.1.6, gate line 43).

### 5.4 Greyscale proof, and which chart to reach for

Desaturate a screenshot of the rail: cells differ by **hatch density**, counts differ by **bar count plus a numeral**, the median differs by **stroke weight**, the range differs by **length**. Nothing depends on hue, so it passes gate line 32 by construction.

| Question | Component |
|---|---|
| How do the notes break down by sentiment? | `SentimentBar` (hue + numeral + label; dashboard rollup, surface 5) |
| Where on the grit scale do reviewers place this, and do they agree? | `SpreadRail` (project detail per category, surface 3; profile aggregate, surface 6) |
| One project's trajectory over time | `Sparkline` (`summary` required) |
| How many projects reached each stage | `GritHistoryStrip` (surface 6) |

Never draw a pie, never a donut, never a radar. Never plot a mean of grit values anywhere in the product.

---

## 6. NEXT.JS 15 PATTERNS

Exact signatures. React 19, Next 15.5, App Router.

### 6.1 Async request APIs

`params`, `searchParams`, `cookies()`, `headers()` and `draftMode()` are all async in 15.

```tsx
// src/app/discover/page.tsx  — Server Component, no 'use client' (gate line 47)
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function DiscoverPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const filters = parseFilters(sp)             // Zod-parsed, defaults applied
  const rows = await listProjects(filters)
  return <Feed rows={rows} filters={filters} />
}
```

```tsx
// src/app/p/[slug]/page.tsx
export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const project = await getProject(slug)
  if (!project) notFound()
  return …
}
```

```ts
import { cookies, headers } from 'next/headers'
const cookieStore = await cookies()
const theme = cookieStore.get('ws-theme')?.value          // read anywhere
// cookieStore.set(...) is only legal inside a Server Action or Route Handler
const h = await headers()
```

Reading `searchParams` or `cookies()` makes the segment dynamic. To opt into dynamic rendering without reading anything, `import { connection } from 'next/server'; await connection()`.

### 6.2 Server Action + `useActionState`

```ts
// src/app/p/[slug]/actions.ts
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import type { FormState } from '@/components/ui/form'

const Schema = z.object({
  category: z.enum(['fun','balance','controls','onboarding','performance']),
  body: z.string().trim().min(40, 'Write at least 40 characters so the creator can act on it.'),
  grit: z.coerce.number().refine(isGritValue, 'Pick a stage.'),
})

export async function postFeedback(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = Schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message
    return { status: 'error', message: 'This form was not posted.', fieldErrors }
  }
  await feedbackRepo.insert(parsed.data)
  revalidatePath(`/p/${parsed.data.slug}`)
  return { status: 'success', message: 'Feedback posted.' }
}
```

```tsx
'use client'
const [state, formAction, isPending] = useActionState(postFeedback, idleFormState)
<form action={formAction}>…</form>
```

`useActionState(action, initialState, permalink?)` returns `[state, formAction, isPending]`, and the action receives `(previousState, formData)`. `SubmitButton` reads `useFormStatus()` from `react-dom` and must render **inside** the `<form>`. Passing the server action straight to `<form action>` is what makes the composer work with JavaScript disabled (§5.5).

### 6.3 `useOptimistic`

```tsx
'use client'
const [notes, addNote] = useOptimistic(
  serverNotes,
  (state, draft: Draft) => [...state, { ...draft, id: draft.tempId, fresh: true }],
)

<form action={async (formData: FormData) => {
  addNote({ tempId: crypto.randomUUID(), body: String(formData.get('body')), … })
  await postFeedback(idleFormState, formData)
}}>
```

A form action is already a transition, so this is legal. If you call `addNote` outside an action, wrap it in `startTransition` or the optimistic state renders for a frame and reverts. `fresh: true` is what MOVE 3.4's `[data-fresh]` guard reads. Key on the server id once it arrives, never on the array index (ban 53).

### 6.4 Streaming the dashboard

Three panes, three boundaries, three geometry-matched skeletons. Do not `await` in the page body before the boundaries, or nothing streams.

```tsx
// src/app/dashboard/page.tsx
export default async function DashboardPage() {
  return (
    <main>
      <Suspense fallback={<TableSkeleton columns={4} rows={6} label="Loading the inbox" />}>
        <InboxPane />                {/* async Server Component; awaits inside */}
      </Suspense>
      <Suspense fallback={<Skeleton h="12rem" label="Loading the theme rollup" />}>
        <RollupPane />
      </Suspense>
      <Suspense fallback={<Skeleton h="24rem" label="Loading the suggestion tracker" />}>
        <TrackerPane />
      </Suspense>
    </main>
  )
}
```

For a pane that must be a Client Component, pass the un-awaited promise and unwrap with `use`:

```tsx
const rows = use(rowsPromise)      // inside the client pane, within its own <Suspense>
```

`loading.tsx`, `error.tsx` and `not-found.tsx` exist on **every** route segment (gate line 48). `error.tsx` is a Client Component and takes `{ error, reset }`.

### 6.5 `generateMetadata`

```tsx
import type { Metadata, ResolvingMetadata } from 'next'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { slug } = await params
  const project = await getProject(slug)
  if (!project) return { title: 'Project not found' }
  const previous = (await parent).openGraph?.images ?? []
  return {
    title: `${project.title} · ${gritLabel(project.grit)}`,
    description: project.ask.slice(0, 155),
    openGraph: { title: project.title, description: project.ask.slice(0, 155), images: previous },
    alternates: { canonical: `/p/${slug}` },
  }
}
```

Put `metadataBase` once in the root layout's static `metadata` export. Do not export both `metadata` and `generateMetadata` from the same file.

### 6.6 OG images, and the two gotchas that will bite

```tsx
// src/app/p/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { OG } from '@/lib/og-tokens'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Whetstone project card'
export const runtime = 'nodejs'

const archivo = fetch(new URL('./archivo-700-wdth112.ttf', import.meta.url)).then(r => r.arrayBuffer())

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const project = await getProject(slug)
  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
                    backgroundColor: OG.surface1, color: OG.text1, padding: 64,
                    fontFamily: 'Archivo OG' }}>
        <div style={{ display: 'flex', fontSize: 64, letterSpacing: '-0.02em' }}>{project.title}</div>
        <div style={{ display: 'flex', fontSize: 28, color: OG.text3, marginTop: 16 }}>
          {project.grit} of 8000, {gritLabel(project.grit)}
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: 'Archivo OG', data: await archivo, weight: 700, style: 'normal' }] },
  )
}
```

**Gotcha 1: the font.** Satori (which backs `ImageResponse`) reads **TTF, OTF and WOFF only, not WOFF2**, and it does not apply variable-font axes. `direction.md` currently says the OG route reads the same `/public` woff2 bytes as the page. It cannot. Ship a **static instance** of Archivo at `wdth 112 / wght 700`, exported as TTF, subset to Latin, placed next to the route file so `new URL(..., import.meta.url)` resolves it. Update the `direction.md` deviation row to say so.

**Gotcha 2: the hexes.** Satori cannot read CSS custom properties, so the OG route needs literal colours, and gate line 9.1.1 greps `app` and `components` for `#hex` in `.ts`/`.tsx` and requires zero hits. Put the literals in exactly one file **outside** both directories, `src/lib/og-tokens.ts`, with a header comment naming the reason, and record it:

> §2.1/§9.1.1 · `src/lib/og-tokens.ts` is the single permitted hex literal location outside `@theme` · satori cannot resolve CSS custom properties and the OG image must render the real palette. Values are copied from `@theme` and must be changed in both places.

Other satori constraints: flexbox only (no CSS grid), every `div` with more than one child needs an explicit `display: flex`, no `var()`, no `gap` on some versions (use margins), limited unit support. Keep the card to two text blocks and one hatch SVG.

### 6.7 Caching notes specific to Next 15

- `fetch` is **not** cached by default. Opt in per call with `cache: 'force-cache'` or `next: { revalidate: N, tags: [...] }`.
- GET Route Handlers are not cached by default; set `export const dynamic = 'force-static'` if you want the old behaviour.
- Client Router Cache: page segments have a 0s stale time by default, so a back-navigation refetches. Do not build UI that assumes a warm client cache.
- `revalidateTag`/`revalidatePath` go **inside** the Server Action, after the write, before any `redirect()`.
- `redirect()` throws; never wrap it in `try/catch` that swallows the error.
- Do not reach for `use cache` / `dynamicIO`: they are experimental in 15.5 and off by default.

---

## 7. THE POLISH CHECKLIST

Check at **1440, 1024, 768, 390px**, in both themes, on all nine routes. Every line is answerable from a screenshot or a DevTools ruler. Record pass/fail per line in `/design/finish-gate.md` with the screenshot attached.

### 7.1 Every page, every width

1. No horizontal document scrollbar. The page body never scrolls sideways; wide tables scroll inside their own container.
2. Every hairline in a list is continuous: no doubled rule under the last row, no missing rule under the sticky filter bar, no gap where the first row meets the bar.
3. Column edges line up down the whole list. Pick the grit column and the count column and sight down them: right edges are identical on row 1 and row 20.
4. Exactly one accent-coloured element is visible. Count the accent objects in the screenshot; the grind-mark counts as one and there is at most one per view.
5. Accent pixels look like a trace, not a stripe. If you have to ask whether it is over 5%, it is over 5% (gate line 7).
6. Straw appears only as a focus ring or a warn border, except on the marketplace, where it fills.
7. Buttons in the same row are the same height: no 38px select beside a 44px button.
8. No element has both a border and a shadow. Cards, rows, chips and buttons have zero shadow.
9. No rounded pill anywhere except an `<img>` avatar.
10. Radii are hierarchical in every nested pair: the inner corner is never larger than its parent's, and the sticky dialog footer carries the dialog's own bottom corners, not its own.
11. Every number that sits in a column is tabular: the 1s and the 8s occupy identical widths.
12. Every grit value is a numeral beside a hatch. No hatch appears alone.
13. Serif text is only ever something a person wrote. No Literata in a label, count, button or nav item; no Archivo in an ask, a feedback body or a bio.
14. Headings are visibly wider than body text (the width axis is working). An h1 or h2 that looks like bold body text means `wdth 100` shipped.
15. No text block exceeds 72ch. Select a paragraph and count: prose ≤66ch, UI copy ≤58ch.
16. Icons sit on the label's cap height, not its baseline or its line box. Zoom to 400% on one lockup and check.
17. Focus a control and screenshot: a 2px straw ring, 2px clear of the element, not clipped by a sticky bar or a dialog edge, on a control whose geometry did not move when it took focus.
18. Tab to the last row of a scrolled feed: the focused row sits fully below the nav and the filter bar.
19. Empty and sparse states: a list with 0, 1 and 2 items still occupies at least three rows of height, and the empty copy is three beats plus one verb button.
20. No exclamation mark, no em dash, no straight quote, no three-period ellipsis in any visible string.
21. Light theme: no element kept a dark-mode colour, and nothing lost its border (light separates elevation with rules, not greys).
22. Greyscale the screenshot: every status, rating, sentiment segment and validation state is still readable.

### 7.2 1440px (≥`--bp-xl`)

23. Containers stopped growing. The feed is 72rem, the detail 80rem, and the extra width went into gutters, not into the content.
24. The Discover row's title column is not so wide that the ask looks stranded: the ask still clips at two lines and is capped at 66ch even though the column is wider.
25. Project detail shows all three zones: the 3rem bevel rail, the 7-column media and ask, the 4-column thread. The rail's mask fade is visible and its hatch is aligned to the ask's first baseline, not the top of the column.
26. The landing hero is a 7/5 split with the figure on the right; the hero's bottom padding is visibly greater than its top padding (≥1.3×).
27. Nothing is centred that should be left-aligned. Project detail, the composer, the dashboard and auth all start at the same left edge as their headings.

### 7.3 1024px (between `--bp-md` and `--bp-lg`)

28. The Discover filter rail is persistent, not a drawer, and the feed did not shift sideways when it appeared.
29. Project detail is **stacked**, not split: the thread sits under the media column, and the bevel rail is still full height beside them.
30. The dashboard's 16rem left rail is present and its three panes are still three different shapes (table, bars, columns). No pane collapsed into a card grid.
31. The Discover row dropped the category column into the metadata line under the title; grit and count are still in their own columns and still aligned.
32. The inbox table has no horizontal scroll and no column head wrapped to two lines.
33. The marketplace's price column is still right-aligned against a consistent edge, with the straw fill intact.

### 7.4 768px (between `--bp-sm` and `--bp-md`)

34. The filter rail is a `<dialog>` drawer, reachable from a labelled trigger, and the trigger is ≥44×44.
35. The dashboard sidebar is gone and its navigation is reachable some other way that is visible in the screenshot (not hover-only).
36. The Discover row is down to thumbnail, title, ask, grit: the count moved under the title and nothing is clipped.
37. The composer dialog fits: header, at least one field and the sticky footer are all visible at once, with the textarea's growth capped short of pushing the footer off.
38. Reply nesting on discussions is still legible at 3 levels: 2px hair rule plus indentation, and the indentation has not eaten the measure.
39. No nav or button label wrapped to two lines.
40. Section rhythm on the landing page is still alternating: no two adjacent sections share padding, width and column count.

### 7.5 390px (below `--bp-sm`)

41. The Discover row metadata is stacked (`grid-auto-flow: row`) and the 48px thumbnail still aligns to the title's cap height.
42. The two-line ask still clips at exactly two lines, and a long unbroken token (a URL, a game title with no spaces) wraps instead of forcing a scrollbar.
43. Display type stepped down; the hero headline, lede and primary action are all visible without scrolling.
44. Every tap target is ≥44px and no two adjacent hit areas overlap. Check the filter chips and the row actions specifically.
45. The composer is usable: the textarea is ≥16px (no iOS zoom on focus), the sticky footer is above the keyboard line, and the grit selector is reachable by scrolling inside the dialog, not by scrolling the page behind it.
46. Drawer and dialog scroll containment works: scrolling to the bottom of a dialog does not drag the page underneath.
47. The grit history strip on the profile still shows five cells with their numerals, not a truncated three.
48. At 200% text zoom (gate line 17): no clipping, no horizontal scroll, no overlapping text.
49. Toasts sit clear of the bottom safe area and never cover the composer's submit button.
50. The footer is still one inline line with the same Help slot as every other surface.

### 7.6 Motion spot-checks (record one screen capture per item)

51. Toggle the theme: the flip is instantaneous and total. No element crossfades.
52. Open and immediately close the composer: the dialog animates out, it does not vanish, and no ghost remains.
53. Open a menu near the bottom of the viewport: it flips above the trigger **and** enters from below.
54. Sweep the pointer across a row of grit chips: the first tooltip waits, the rest appear instantly, none re-animates.
55. Post a feedback note: the row appears once, moving 8px, and does not animate a second time when the server row replaces it.
56. Reload the landing page twice: the hero grind runs once, then never again, and client-side navigation away and back does not replay it.
57. Turn on Reduce Motion at the OS level: nothing travels, the hero renders at `wdth 96`, and the loading indicators keep turning.
58. Filter the feed: the rows dim and stay readable, the scroll position does not jump to the top, and the URL changed.

---

### Deviations this playbook creates (add all four to `/design/direction.md`)

| § | Contract says | What ships | Why |
|---|---|---|---|
| 4.4 / 5.4 | Discover row 4.5rem | `--row-h-feed: 5.5rem` for the Discover row; 4.5rem stays the register-row height | 14px title + two 13px ask lines + 12px padding measures 84.7px |
| 5.6 | Phosphor Regular | `lucide-react` at `strokeWidth={1.5}`, sizes 16/20/24 | already shipped in `package.json`; one library, one variant, no banned glyphs |
| 3.1 | OG route reads the same `/public` woff2 | a static TTF instance of Archivo at `wdth 112 / wght 700` beside the route file | satori reads TTF/OTF/WOFF only and does not apply variable axes |
| 2.1 / 9.1.1 | no hex outside `@theme` | one file, `src/lib/og-tokens.ts`, outside the gate's grep scope, values mirrored from `@theme` | satori cannot resolve CSS custom properties |
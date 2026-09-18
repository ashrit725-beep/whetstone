# Primitives: data display, identity, and the grit language

API reference for `src/components/ui/` group 3. Every file opens with its own
keyboard contract (Finish Gate §9.7.50); this page is the index.

Import from the file, not from a barrel: `import { GritChip } from '@/components/ui/grit'`.

---

## Module kinds

| Kind | Files | Rule |
|---|---|---|
| Server-safe | `card` `surface` `badge` `avatar` `stat` `table` `breadcrumbs` `pagination` `step-indicator` `code-block` `sentiment-bar` `sparkline` `cover-art` `kbd` `separator` `visually-hidden` `prose` | Render anywhere. No hooks, no handlers. |
| Shared (no directive) | `chip` `grit` | Pure exports render in Server Components. The exports that take handlers (`Chip` with `onRemove`, `FilterChip`, `GritScale`) compile into whichever **client** module imports them. Rendering those three straight from a Server Component is a build error, by design. |
| Client | `tabs` `timestamp` `copy-button` `theme-toggle` | `'use client'`. |

---

## grit.tsx — the identity

The five steps, exactly as §5.7 specifies:

| value | key | label | strokeWidth | spacing |
|---|---|---|---|---|
| 120 | `concept` | Concept | 3 | 16 |
| 400 | `prototype` | Prototype | 2 | 8 |
| 1000 | `beta` | Beta | 1.25 | 4 |
| 3000 | `release-candidate` | Release candidate | 0.75 | 2 |
| 8000 | `shipped` | Shipped | 0.5 | 1 |

```ts
GRIT_VALUES            // readonly [120, 400, 1000, 3000, 8000]
type GritValue         // 120 | 400 | 1000 | 3000 | 8000
GRIT_STEPS             // readonly GritStep[] — value, key, label, description, strokeWidth, spacing
isGritValue(n: number): n is GritValue
gritStep(value: number): GritStep        // never throws; snaps to the nearest step
gritLabel(value: number): string
gritDescription(value: number): string   // "1000 of 8000, beta"
GRIT_NUMERAL_STYLE     // tabular-nums + 'zero' 1 — put it on every grit numeral you render yourself
```

```tsx
<GritHatch value={1000} orientation="horizontal" />   // aria-hidden, fills its box
<GritChip  value={1000} size="md" showLabel />        // hatch + numeral, the pairing is the rule
<GritRail  value={1000} />                            // 3rem full-height bevel rail, project detail only
<GritScale value={v} onChange={setV} name="grit" labelledBy="grit-q" />
<GritHistoryStrip counts={{ 120: 41, 8000: 12 }} />   // public profile header
```

- `GritHatch` is an SVG `<pattern>` in user space, so a 16px chip and a 600px
  rail draw strokes of identical weight. Its pattern id is derived from the
  props: two hatches of the same grit share one definition. Always `aria-hidden`.
- `GritChip` is the only correct way to show a grit value in a row. **The hatch
  never carries the value alone.** Sizes: `sm` (16×12 swatch) and `md` (24×16).
- `GritRail` is the one bold element on Project detail. It carries the only
  `mask-image` fade in the product (§9.1.5). Give it a flex parent with a
  stretch height. `role="img"` with the full scale in its name.
- `GritScale` is a radiogroup with a roving tabindex; selection follows focus.
  It emits a hidden `<input name>` so the composer posts with JS disabled. Pass
  `labelledBy` pointing at the visible question — do not rely on `label`.
- `GritHistoryStrip` takes `Partial<Record<GritValue, number>>`; missing keys
  read as 0 and render a hairline, not an empty cell.

## cover-art.tsx

```tsx
<CoverArt seed={project.slug} title={project.title} className="h-full w-full" />
<CoverArt seed={id} title={t} decorative={false} />   // only when no adjacent title
```

Deterministic from `hashCode(seed)`: split axis, band count, split ratio, five
hatch densities, two angles, 1–2 hairline rules, one 2px accent grind-mark.
Same seed renders identically everywhere; two projects differ in five dimensions
at once. Decorative by default. `preserveAspectRatio="xMidYMid slice"`, so give
it a sized box.

## sentiment-bar.tsx

```tsx
<SentimentBar label="Controls" positive={18} neutral={7} critical={4} unit="notes" />
```

Percentages are computed to sum to exactly 100. Every segment carries its own
numeral; the legend beneath repeats word + percentage; a `sr-only` `<table>`
carries the same rows. Zero total renders a three-beat empty state, not a bar.
Pass `words` to relabel the three segments for a non-sentiment axis.

## sparkline.tsx

```tsx
<Sparkline points={[3,5,4,9]} summary="Feedback received per week over four weeks." pointLabels={weeks} />
```

`summary` is required. Drawing is `aria-hidden`; the series is also a `sr-only`
`<table>`. Fewer than two points renders the summary alone. Last point carries
the accent mark.

---

## Layout and containment

### card.tsx
```tsx
<Card interactive selected={isOpen}>
  <CardBody>
    <CardTitle><CardLink href="/p/x">Sundermoon</CardLink></CardTitle>
  </CardBody>
  <CardFooter>…</CardFooter>
</Card>
<CardSkeleton lines={2} label="Loading project" />
```
`surface-3` + hairline + 8px radius, **never a shadow, never a transform**.
`interactive` needs exactly one `CardLink`, whose `::after` covers the card; the
ring is drawn on the card via `:has(a:focus-visible)`. Any *other* control inside
an interactive card needs `relative` so it stays clickable. One containment
level: no Card inside a Card.

### surface.tsx
```tsx
<Surface level={3} border radius="md" as="section">…</Surface>
<Well>…</Well>   // level 0, 4px radius
```
`level` 0–4. Level 4 is the only level that carries `shadow-overlay`. Every
level sets `color` in the same rule as `background-color`.

### separator.tsx / visually-hidden.tsx / kbd.tsx
```tsx
<Separator orientation="vertical" />          // decorative by default
<SeparatorLabel>Earlier</SeparatorLabel>
<VisuallyHidden as="div">…</VisuallyHidden>
<LiveAnnouncer>Feedback posted</LiveAnnouncer> // role=status, polite
<Kbd>Esc</Kbd>  <KbdSequence keys={['Ctrl','K']} />
```

---

## Status and identity

### badge.tsx
```tsx
<Badge tone="positive" icon={Check}>Shipped</Badge>
<CountBadge count={12} noun="reply" />
```
Tones: `neutral` `accent` `positive` `critical` `warn` `money`. `money` is the
only straw **fill** and is legal on the reviewer marketplace only. Children are
required: no status is ever carried by hue alone. Non-interactive, always.

### chip.tsx
```tsx
<Chip onRemove={drop} removeLabel="Remove the Game filter">Game</Chip>
<FilterChip pressed={on} onPressedChange={setOn} count={14}>Needs playtesting</FilterChip>
<FilterChipLink href="?type=game" selected count={14}>Game</FilterChipLink>
```
2px radius, 1px border in every state, ≥44px tall from padding, so a chip row
sits at `gap-xs`. URL-driven filters use `FilterChipLink` (`aria-current`), page
state uses `FilterChip` (`aria-pressed`). Disabled chips stay focusable and must
supply `disabledReason` with an `id`.

### avatar.tsx
```tsx
<Avatar userId={u.id} name={u.name} src={u.avatarUrl} size="md" />
<Avatar userId={u.id} name={u.name} standalone />   // no adjacent name in the DOM
<AvatarGroup people={reviewers} max={4} label="Reviewers on this project" />
```
`src` renders a circular `<img>` (the one legal `rounded-full`). No `src` renders
a generated 2px-square tile: initials over one of four surface steps with a grit
hatch band along the bottom edge. `alt=""` unless `standalone`. `AvatarGroup`
collapses the remainder into a `+N` button backed by the **platform Popover API**
(Escape closes, focus returns, zero JS of ours).

---

## Tabular and numeric

### table.tsx
```tsx
<Table caption="Feedback received, newest first" captionVisible={false}>
  <THead>
    <TR>
      <TH sort="descending" sortHref="?sort=date">Received</TH>
      <TH numeric>Grit</TH>
    </TR>
  </THead>
  <TBody>
    <TR interactive selected={isOpen}><TD>…</TD><TD numeric>1000</TD></TR>
  </TBody>
</Table>
```
`caption` is required (hide it, never omit it). The whole table lives in a named
`tabIndex={0}` scroll region. Sorting is links + `aria-sort`, never client state.
States, each replacing `<TBody>`:
```tsx
<TableSkeleton columnWidths={[18, 8, 6]} rows={5} />
<TableEmpty colSpan={3} title="No feedback yet" detail="…" action={<Button…/>} />
<TableError colSpan={3} title="The inbox did not load" detail="…" action={retry} />
```

### stat.tsx
```tsx
<StatGroup label="Inbox this week">
  <Stat label="Notes received" value={41} delta="12 since Monday" deltaDirection="up" />
  <Stat label="Median grit" loading width={4} />
  <Stat label="Payouts" value={null} hint="No bounties have closed yet." />
</StatGroup>
```
`StatGroup` is a `<dl>`. Delta is arrow + words; `deltaTone` is optional and
never the only signal. Loading holds `width` in `ch`. Empty renders an en dash
plus `hint`. Numbers render final on first paint: **no count-up, ever**.

### timestamp.tsx
```tsx
<Timestamp ts={row.createdAt} prefix="Posted" />
```
Server paints an absolute UTC date; the client upgrades to local relative time
after mount, with the local absolute date in `title`. Identical on both renders,
so no hydration warning and no suppression.

---

## Navigation

```tsx
<Breadcrumbs items={[{label:'Discover',href:'/discover'},{label:'Sundermoon'}]} />
<Pagination page={2} pageCount={9} hrefFor={(p)=>`?page=${p}`} label="Discover results" />
<StepIndicator label="Publish a project" steps={[{id:'a',label:'Details',status:'done',href:'/x'}]} />
```
Pagination omits Previous/Next at the ends rather than disabling them (a
disabled link is a dead tab stop) and shows a windowed range with `…` gaps.
StepIndicator uses words (`Done` / `You are here` / `Not started`) plus the
grind-mark. No numbered circles.

### tabs.tsx
```tsx
// in-page state
<Tabs idBase="composer" label="Feedback categories" tabs={cats} value={v} onValueChange={setV} />
<TabPanel idBase="composer" value="fun" activeValue={v}>…</TabPanel>

// route state
<Tabs mode="links" label="Profile sections" value={section} tabs={[{value:'projects',label:'Projects',href:'/u/maya'}]} />
```
Underline moves with `translateX` over 180ms; its width is set instantly.
Panels stay mounted and use the `hidden` attribute, so an in-progress draft in
an unselected panel still posts.

---

## Text

### prose.tsx
```tsx
<Prose content={feedback.body} allow="comment" />
<Prose content={project.summaryMd} allow="article" />
```
Hand-rolled markdown subset, no dependency, **no `dangerouslySetInnerHTML`**.
User text becomes React nodes, so a pasted `<script>` renders as characters.
Grammar: headings (`article` shifts `#`→`h2`, capped at `h6`; `comment` demotes
them to a bold line), `**strong**`, `*em*`, `` `code` ``, fenced code, one level
of `-`/`1.` lists, `>` quotes, paragraphs. Links accept `https:`, `http:`,
`mailto:` and internal `/routes` only; anything else keeps its words and loses
its href. External links get `rel="ugc nofollow noopener"`. A typographic pass
curls quotes, folds a three-period run to `…` and a double hyphen to `–`,
outside code. Applies `.prose-human` (Literata, 66ch).
Also exported: `parseBlocks(source)` and `smarten(text)`.

### code-block.tsx
```tsx
<CodeBlock code={snippet} label="next.config.ts" copyable />
<InlineCode>useActionState</InlineCode>
```
`<pre>` is a named `tabIndex={0}` scroll region. Code scrolls; it never wraps.

### copy-button.tsx / theme-toggle.tsx
```tsx
<CopyButton value={url} what="the embed URL" iconOnly />
<ThemeToggle initial={cookieTheme} showLabel />
```
CopyButton announces through a polite live region, not a toast, and has a real
error path (the clipboard can be blocked). ThemeToggle cycles
system → light → dark, writes the `ws_theme` cookie, and sets
`documentElement.dataset.theme` synchronously so there is no flash; `system`
deletes both. Its accessible name always states the current setting and the next
one. Pass `initial` from a server `cookies()` read to avoid a one-frame label.

---

## Three deviations, recorded

1. **Icons are lucide-react**, not Phosphor (§5.6), per the build brief. The
   substance of the rule is kept: one library, `strokeWidth={1.5}`, sizes 16/20/24,
   `currentColor`, decorative icons `aria-hidden`, none of the banned glyphs.
2. **Avatar identity is not a generated hue.** §8.1.13 forbids any colour outside
   the token set, and all five hues already mean something. Variance comes from
   four surface steps × five hatch densities × two angles: forty stable variants
   that survive greyscale and keep initials above 9.9:1.
3. **Tab overflow is marked with a 1px `border-strong` edge rule, not a fade.**
   §9.1.5 grants exactly one masked fade, and it belongs to the bevel rail.

## Things this group will not do for you

- No hover state on a card or row that moves anything. Background steps one
  surface, border firms up, nothing translates.
- No component invents a number. Every figure is a prop.
- No `rounded-full` outside `Avatar`'s `<img>`.
- No spinner, pulse, shimmer or count-up. Loading states are static geometry
  plus `aria-busy` plus a sentence.

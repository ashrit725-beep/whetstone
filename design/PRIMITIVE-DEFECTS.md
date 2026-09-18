# Primitive defects

Append-only. One entry per defect found in `src/components/ui/**`, with the
exact fix and the local workaround that is shipping until the fix lands.

---

## 1. `CoverArt` scales its hatch fields, so every small instance renders as flat grey

**File:** `src/components/ui/cover-art.tsx`
**Found by:** marketing, on the landing hero figure (48px thumbnails)
**Severity:** the drawing is unreadable at every size the feed row uses.

### What is wrong

`CoverArt` draws on a `viewBox="0 0 480 300"` and fills its box with
`preserveAspectRatio="xMidYMid slice"`. The whole drawing, patterns included,
is therefore scaled by the ratio of the rendered box to the viewBox. In a 48px
thumbnail that ratio is `48 / 300 = 0.16`, which turns the five grit stages
into this:

| grit | authored stroke / spacing | rendered at 48px |
|---|---|---|
| 120 | 3 / 16 | 0.48px / 2.56px |
| 400 | 2 / 8 | 0.32px / 1.28px |
| 1000 | 1.25 / 4 | 0.20px / 0.64px |
| 3000 | 0.75 / 2 | 0.12px / 0.32px |
| 8000 | 0.5 / 1 | 0.08px / 0.16px |

Every one of those is sub-pixel, so all five stages resolve to the same flat
grey wash and the composition disappears with them: the 1px hairline rules land
at 0.16px and the 2px grind-mark, the drawing's single accent element, lands at
0.32px and is not painted at all. Two projects that are supposed to differ in
split, density, angle, rule placement and accent position come out identical.

`GritHatch` in `src/components/ui/grit.tsx` does not have this problem, and its
own doc comment says why: its `<pattern>` is in screen space, so "a 16px chip
and a 600px rail get strokes of exactly the same weight". `CoverArt` is the one
place in the product where the grit language is drawn at a scale factor, and it
is the one place where it stops reading.

### The exact fix

Draw the cover in screen space like `GritHatch` does: drop the `viewBox` and the
`slice`, size the `<svg>` at 100% of its box, and lay the zones out in
percentages (`x="0" y="0" width="38%" height="100%"`) rather than in user units
of a 480x300 canvas. The `<pattern>` elements then keep `patternUnits="userSpaceOnUse"`
with the authored `strokeWidth` and `spacing` straight off `GRIT_STEPS`, and a
48px thumbnail, a 320px card and a 960px header all render the same stroke
weights, exactly as §5.7 specifies them. The hairline rules and the 2px
grind-mark become real 1px and 2px lines at every size. The seeded generator,
the zone split ratios and the accent placement need no change: only the
coordinate space they are expressed in.

If the viewBox has to stay for another caller, the minimum fix is to accept a
rendered size and divide every `strokeWidth`, `spacing`, rule width and accent
width by the scale factor, so the painted weights come out at the authored
values. That is more arithmetic for the same result.

### Local workaround shipping now

`src/components/marketing/marketing.module.css`, rule `.thumb > svg`: the
marketing feed row lays the drawing out at half scale (240x150 CSS px) inside
the 48px thumbnail and lets the thumbnail crop a 96x96 window out of the middle
of it. Strokes land between 0.25px and 1.5px instead of between 0.08px and
0.48px, the coarse and fine stages separate again, and the row geometry is
untouched: the box is still exactly 48px with a 2px radius. It is a crop, not a
fix, so the composition is only partly visible; it is in place only until the
primitive is corrected, and should be deleted in the same change.

---

## 2. `CoverArt` at 48px, seen a second time on Discover (confirms defect 1)

**File:** `src/components/ui/cover-art.tsx`
**Found by:** discover and search, on the feed row cover (`src/components/discover/feed-row.tsx`)
**Severity:** twenty rows of identical grey rectangles; the cover column carried
no information and read as twenty failed image loads.

Same cause and same arithmetic as defect 1 above, found independently on a
second surface, which settles that this is the primitive and not one caller.
Two further notes the first entry does not cover:

**The composition needs a rule, not only a coordinate space.** Even drawn at the
right scale, `buildZones` can hand two neighbouring grit steps to two adjacent
zones (400 beside 1000, say), and those two densities are not far enough apart to
read as two fields at any size. The fix wants a constraint alongside the
coordinate-space change: force adjacent zones at least two density steps and a
quarter turn apart, and leave one zone bare so the drawing has somewhere for the
eye to rest.

**The accent has to come off at row scale.** §2.4.5 caps the accent at one
filled element per viewport and §2.4.7 spends the grind-mark on the current row.
A feed of twenty covers each carrying a 2px accent bar breaks both, so the
`size="row"` path wants the grind-mark replaced by a 2px `--color-hatch` bevel
line on a zone edge. At 48px it reads as the same gesture and costs nothing from
the accent budget.

### Local workaround shipping now

`src/components/discover/cover-mark.tsx`: a 48px-native `CoverMark`, used only by
`src/components/discover/feed-row.tsx`. It authors in a `0 0 48 48` viewBox with
`preserveAspectRatio="xMidYMid meet"` (no crop), draws its hatch from a ladder
that resolves at that size (spacing 12 / 8 / 5 / 3, strokes 3 / 2 / 1.25 / 0.75),
applies the two-step-and-a-quarter-turn rule above, and carries a 2px hatch bevel
instead of an accent mark. `CoverArt` is untouched and `media-slot.tsx` still
calls it, correctly, at lead size. Delete `CoverMark` and call the fixed
primitive once the coordinate-space change lands.

---

## 3. `GritHatch` inside `GritChip size="sm"` reads as a solid block

**File:** `src/components/ui/grit.tsx`
**Found by:** discover and search, on the feed row grit chip and the filter rail
**Severity:** cosmetic, not an accessibility defect: the numeral is rendered
beside the swatch and the swatch is `aria-hidden`, so no information is carried
by the drawing alone. But three of five steps are visually identical, which
costs the chip the at-a-glance reading the grit language exists for.

### What is wrong

The `sm` chip swatch is 16×12 CSS px (`h-sm w-md`). Into that box, 1000 grit is a
1.25px stroke on 4px spacing, 3000 is 0.75 on 2 and 8000 is 0.5 on 1. The last
two average to a flat tone at chip size and the third is close behind, so 1000,
3000 and 8000 all render as the same dark rectangle. Only 120 and 400 separate.
This is the same family of problem as defects 1 and 2, in a smaller box, and it
holds even though `GritHatch` itself draws in screen space: the authored ladder
simply runs out of room below about 20px of swatch height.

### The exact fix

Give `GritHatch` a `density` prop, `'rail' | 'chip'`, defaulting to `'rail'`,
where `'chip'` substitutes a ladder scaled to a 12px box: spacing
`10 / 7 / 5 / 3.5 / 2.5` with strokes `3 / 2 / 1.5 / 1 / 0.75`. Five
distinguishable densities fit inside 12px; the current five do not. The
coarse-to-fine reading, the ordering and the numeral pairing are all unchanged,
so §5.7 still holds: the hatch never carries the value alone, it is the
at-a-glance companion to the numeral that does.

### Local workaround shipping now

None, deliberately. `GritChip` appears on Discover, project detail, the dashboard
inbox, public profiles and the marketplace. A Discover-local copy would make
Discover the one surface whose chips do not match every other surface's, which is
a worse defect than the one it fixes. Recorded and left alone.

## `components/ui/cover-art.tsx` — the hatch scales with the frame, so the grit language dies at both ends

**Reported by:** project detail / composer / project creation agent (`proj`).
**Severity:** the drawing is the largest single element on project detail and the
identity mark on every feed row, and at neither size does it show the five grades.

**Defect.** `CoverArt` draws the whole composition inside `viewBox="0 0 480 300"`,
and the hatch `<pattern>` elements are declared in that same user space. The SVG
is then stretched to whatever box it is given, so the strokes scale with it:

| Rendered at | 120-grit stroke (3px in user space) | 8000-grit stroke (0.5px) |
|---|---|---|
| 48px feed thumbnail | 0.3px | 0.05px |
| 660px project figure | 4.1px | 0.7px |

At 48px every grade collapses into the same flat grey; at 660px the coarse field
becomes a set of fat bars and the fine ones are the only thing still reading as
hatch. Either way the drawing stops being "a picture of the number", which is the
whole justification for it (§5.7). Two further consequences: `preserveAspectRatio
="xMidYMid slice"` on a 1.6 ratio viewBox inside an `aspect-video` (1.777) frame
crops 10% off the top and bottom of every composition, and the zone layout is only
ever two or three parallel bands, so two projects differ by band ratio alone.

**Exact fix.** Stop putting the hatch in the viewBox.

1. Delete the `viewBox` / `preserveAspectRatio` on the root `<svg>` and render the
   zones as positioned elements with percentage geometry, so only the *layout*
   scales.
2. Declare each hatch as its own `<svg>` with **no** `viewBox`, pattern in
   `patternUnits="userSpaceOnUse"`, exactly as `GritHatch` already does it. The
   stroke is then the literal `strokeWidth` from `GRIT_STAGES` at every size.
3. Replace the two- or three-band split with a seeded guillotine carve on a 12x8
   module grid (4-6 zones, minimum 2 modules a side) and record each cut so it can
   be drawn as a 1px `border-hair` rule.
4. Assign fills by taking evenly spaced entries from the density ramp
   `[bare, 8000, 3000, 1000, 400, 120]` ordered against zone area, so every cover
   holds both extremes and survives the 48px macro read. Seed a flip between
   quiet-large and loud-large for variety.
5. Keep exactly one accent element: the 2px grind-mark on the leading edge of the
   coarsest zone.

**Worked around locally** in `src/components/project/cover-composition.tsx`
(`ProjectCover`), which implements all five points and is what
`src/components/project/media-slot.tsx` now renders. It is deliberately not
imported from `components/ui`; lifting it there (and pointing
`components/discover/feed-row.tsx` and `components/marketing/feed-row.tsx` at it)
is the real fix and needs the primitive's owner.

---

## `components/ui/avatar.tsx` — `AvatarGroup` stacked tiles abut into one word

Found on surface 8 (discussions) at 1440 and 1024, dark and light.

**Defect.** `AvatarGroup` overlaps its faces with `-ml-2xs` (−4px) and gives the
overlapped tile no separating edge of its own. A real `<img>` avatar is a circle,
so a −4px overlap still reads as two discs. The generated tile is a 2px-radius
square whose only boundary is a 1px `border-hair` (1.58:1 dark, 1.33:1 light,
decorative by §2.2/§2.3 and below the 3:1 floor a user needs to perceive a
boundary). Four square tiles overlapped by 4px therefore render as one
unbroken strip: `SK KM MS IV` reads as the string "SKKMMSIV", not as four
people. The 25%-height grit band at the foot of each tile compounds it, since
the bands also run together into a single hatched rail.

**Exact fix** (needs the primitive's owner; do not apply from a surface):
in `AvatarGroup`, give each overlapped item a ring in the page ground so the
stack has a readable gap, and stop overlapping tiles that have no circular
silhouette. Concretely, replace

```tsx
<li key={person.id} className="-ml-2xs first:ml-0">
```

with

```tsx
<li key={person.id} className="-ml-2xs rounded-xs outline-2 outline-surface-1 first:ml-0">
```

(`outline`, not `ring` or `box-shadow`: §5.3 allows no shadow here, and an
outline paints outside the border box without changing geometry.) The same
`outline-surface-1` goes on the `+N` button. On any surface whose rows sit on a
step other than `surface-1`, the outline colour has to follow the row's own
fill, so the cleanest version is a `groundClass` prop defaulting to
`outline-surface-1`.

**Worked around locally** by not rendering the group at all:
`src/components/discussions/thread-register.tsx` no longer shows thread
participants. Surface 8 spends no boldness (§1), and four generated tiles per
row were the loudest object on the register while telling the reader less than
the reply count beside them. When the primitive is fixed, the register can take
the group back; `listThreadParticipants` in `src/server/queries/discussions.ts`
is still there and still correct.

---

## 4. Every `sr-only` string inside a scroll region widens the document

**Files:** `src/components/ui/table.tsx`, `src/components/ui/skeleton.tsx`
(`TableSkeleton`), and by extension any `overflow-x-auto` region in the product
**Found by:** dashboard, on `/dashboard/inbox`
**Severity:** P0. The page scrolled sideways at 1024, 768 and 390. Contract
§8.3.31 makes horizontal document scroll at any viewport an auto-fail.

### What is wrong

The `sr-only` utility in `globals.css` is `position: absolute` with
`width: 1px`. An absolutely positioned box is clipped by an ancestor's
`overflow` **only when its containing block is inside that ancestor**. None of
these strings has a positioned ancestor, so their containing block is the
initial containing block: the viewport. They are laid out at their static
position, which for a string in column seven of a wide table is a thousand
pixels out, and `documentElement.scrollWidth` grows to reach them.

`Table` renders exactly that: the sort-state sentence inside every sortable
`<th>`, plus whatever the caller puts in a cell. So the inbox table clipped
correctly inside its own region, and the *page* still scrolled to 1361px at
1024, 1103px at 768 and 1089px at 390. The 1px visible width is irrelevant: it
is the static position that does the damage.

The same mechanism made `/dashboard`, `/dashboard/insights` and
`/dashboard/suggestions` scroll to 498px at 390: the visually hidden count on
the last rail link sat past the right edge of a horizontally scrolling nav.

### The exact fix

In `src/components/ui/table.tsx`, add `relative` to the `<table>`:

```tsx
<table className={cn('relative w-full border-collapse text-left', className)}>
```

One declaration. The table is inside the scroll region, so once it is the
containing block for its own hidden strings they are clipped with the rest of
the row and the document stops growing. Do the same for the inner grid of
`TableSkeleton` in `src/components/ui/skeleton.tsx`.

### The local workaround shipping now

`src/components/dashboard/inbox-table.tsx` passes `className="relative"` through
`Table`'s existing `className` prop (it lands on the `<table>`), and adds
`relative` to the group header `<tr>`. `src/components/dashboard/settings-forms.tsx`
sets it on its own notification matrix, and `suggestion-board.tsx` and
`skeletons.tsx` set it on the board grid. `dashboard-rail.tsx` stopped scrolling
sideways altogether: the sub-60rem nav wraps now, which removes the escape route
and stops clipping “Suggestions” at 390 into the bargain.

---

## 5. `TableSkeleton` is a focusable region with no accessible name

**File:** `src/components/ui/skeleton.tsx`
**Found by:** dashboard, on `/dashboard/inbox`
**Severity:** SC 2.4.6 / 4.1.2. A keyboard user reaches a tab stop that
announces nothing.

### What is wrong

```tsx
<div className={cn('w-full overflow-x-auto', className)} data-scroll-region tabIndex={0}>
```

`tabIndex={0}` with no `role` and no name. The sibling primitive it stands in
for, `Table`, gets this right: `role="region"`, `aria-label={caption}`,
`tabIndex={0}`. The contract requires wide content to scroll inside its own
focusable region **with an accessible name**; the loading state is a tab stop
too, and `label` is already a prop on this component.

### The exact fix

```tsx
<div
  role="region"
  aria-label={label ?? 'Loading table'}
  tabIndex={0}
  data-scroll-region
  className={cn('w-full overflow-x-auto', className)}
>
```

### The local workaround shipping now

None is possible from the outside: the attributes are on the primitive's own
root and no prop reaches them. Every dashboard caller already passes `label`, so
the fix is one line and needs no caller change.

---

## 6. `SentimentBar` puts the percentage on the segment but the word only in the legend

**File:** `src/components/ui/sentiment-bar.tsx`
**Found by:** dashboard, on the theme rollup (`/dashboard/insights`)
**Severity:** contract §4.4.5 and §2.4.8 are literal about this: “each segment
carrying its percentage numeral **and label**”, and the rollup “must be fully
readable in greyscale”.

### What is wrong

Each segment renders `{percent}%` and nothing else. The word that gives the
number meaning (`Praise` / `Minor` / `Serious`) is in the legend underneath, in
segment order, with its own repeated percentage. Greyscale readability is
therefore satisfied, but only by reading two rows and mapping one onto the
other. The letter of the contract asks for the label on the segment itself.

The primitive's caution is not unfounded: the segment is `h-lg` (24px) with
`overflow: hidden`, and a 12% segment at 390px is 43px wide, which cannot hold
`Serious 12%` at `--text-2xs` without clipping mid-word.

### The exact fix

Render the word inside the segment when it fits and fall back to the numeral
when it does not, rather than choosing once for every size:

```tsx
<span className="flex items-center justify-center gap-2xs overflow-hidden px-3xs text-2xs whitespace-nowrap">
  <span className="hidden @[7rem]/segment:inline">{segment.word}</span>
  <span className="tnum">{segment.percent}%</span>
</span>
```

with `@container/segment` on the segment and `container-type: inline-size`. A
container query is the right tool because the decision depends on the segment's
own width, not the viewport's. Keep the legend either way: it is what carries
the raw counts.

### The local workaround shipping now

None. `src/components/dashboard/theme-rollup.tsx` keeps using the primitive and
passes `words={{ positive: 'Praise', neutral: 'Minor', critical: 'Serious' }}`,
because rebuilding a bar chart inside one consumer to win a label placement
would put two divergent rollups in the product, which is worse than the gap.
The rollup is readable in greyscale today; this entry is for the letter of
§4.4.5.

---

## `ThemeToggle` — the visible label is lowercase, so the control reads as a raw token

Reported by the app-chrome surface. Seen in the mobile sheet, where the theme
control sits under a heading and `showLabel` is on.

### The defect

`src/components/ui/theme-toggle.tsx` keeps one string per setting and spends it
in two registers that want different capitalisation:

```tsx
const META: Record<ThemeSetting, { icon: typeof Monitor; word: string }> = {
  system: { icon: Monitor, word: 'follow the system' },
  light:  { icon: Sun,     word: 'light' },
  dark:   { icon: Moon,    word: 'dark' },
}
…
aria-label={`Theme: ${current.word}. Switch to ${META[next].word}.`}
{showLabel ? <span aria-hidden="true">{current.word}</span> : null}
```

The accessible name is a sentence, so `word` is correctly lowercase there
("Theme: dark. Switch to follow the system."). The visible label is not a
sentence — it is a standalone control label — and it renders as `dark` beside a
heading that reads `Appearance`. Two capitalisations in one row, and the
control reads as a debug value rather than a setting. `text-transform:
capitalize` cannot fix it either: it would turn the system case into "Follow
The System".

### The exact fix

Carry the two registers separately. `word` stays as it is, for the sentence;
add `label` for the chip, and read it in the `showLabel` branch only.

```tsx
const META: Record<ThemeSetting, { icon: typeof Monitor; word: string; label: string }> = {
  system: { icon: Monitor, word: 'follow the system', label: 'System' },
  light:  { icon: Sun,     word: 'light',             label: 'Light' },
  dark:   { icon: Moon,    word: 'dark',              label: 'Dark' },
}
…
{showLabel ? <span aria-hidden="true">{current.label}</span> : null}
```

Nothing else changes: the `aria-label`, the live region and the cycle order are
untouched, and `showLabel={false}` callers are unaffected.

### The local workaround shipping now

`src/components/chrome/chrome-styles.tsx` capitalises the first letter of that
one span, scoped by a `ws-theme-word` class the chrome puts on the wrapper:

```css
.ws-theme-word button > span[aria-hidden="true"] { display: inline-block; }
.ws-theme-word button > span[aria-hidden="true"]::first-letter { text-transform: uppercase; }
```

`::first-letter` needs a block-level box, which is what the `display` rule buys.
It changes the rendered glyph only, so the accessible name still reads as the
sentence the primitive intends. "follow the system" becomes "Follow the system"
under it, which is the sentence case the rest of the chrome uses.

---

## 7. `GritHistoryStrip` draws a zero column with no baseline, so an empty cell reads as a failed render

**File:** `src/components/ui/grit.tsx` (`GritHistoryStrip`)
**Found by:** profiles / experts / bounties (`prof`), on `/u/mirasolvang` and `/u/wrenashby`, dark and light, every width.
**Severity:** cosmetic but structural. This strip is the bold element of surface 6
(§1, §4.4 row 6) and it is the first thing a reader looks at on a profile. On a
brand-new account every one of its five cells is a zero, so the whole bold
element renders as five empty rectangles.

### What is wrong

```tsx
<div
  className="relative w-full"
  style={{ blockSize: count === 0 ? '1px' : `${String(Math.max(share, 6))}%` }}
>
  {count === 0 ? <div className="h-full w-full bg-border-hair" /> : <GritHatch … />}
</div>
```

The zero bar is 1px of `--color-border-hair`, inside a 48px frame whose own
border is also `--color-border-hair`. §2.2 measures that token at **1.58:1** on
dark and §2.3 at **1.33:1** on light, and both tables label it "decorative
only. Never the sole boundary of a control or the sole carrier of a grouping."
Here it is the sole carrier of the chart's baseline, so at 1px it is not
perceivable at all: the cell paints as an empty frame, indistinguishable from a
cell whose contents failed to load.

Mira Solvang's profile shows this at its worst. She has one project, at 1000,
so `max` is 1: cell three is a hatch field at 100% height and the other four
are blank. The strip reads as one solid block and four holes rather than as a
distribution with four zeroes in it. Wren Ashby's brand-new profile is five
holes.

### The exact fix

Give the zero column a baseline a reader can actually see, in a token that
clears the 3:1 floor for a non-text boundary (§2.2, §5.2):

```tsx
<div
  className="relative w-full"
  style={{ blockSize: count === 0 ? '2px' : `${String(Math.max(share, 6))}%` }}
>
  {count === 0 ? <div className="h-full w-full bg-border-control" /> : <GritHatch … />}
</div>
```

`--color-border-control` measures 3.49:1 on `surface-3` dark and 3.90:1 on
`surface-1` light, so the baseline is visible in both themes and in greyscale,
and 2px matches the grind-mark's own weight rather than inventing a third
hairline value. Nothing else changes: the frame, the 48px height, the numeral,
the label and the count are all already correct, and the accessible reading is
unaffected because the count is rendered as text beside every cell.

A second, smaller point for the same pass: when every count is zero the cells
are all `1px`, which is a chart with no data rather than a chart of zeroes.
Reading better there is a matter of the baseline above, not of hiding the
strip: five visible baselines and five "0 projects" is an honest empty state,
five empty frames is not.

### The local workaround shipping now

None, deliberately, on the precedent of defect 3 above. `GritHistoryStrip` has
exactly one caller, `src/components/profile/profile-header.tsx`, and the only
handles a caller has on it are `counts` and `className` on the `<dl>`. Reaching
the zero bar from outside would mean a descendant selector keyed to a Tailwind
utility class (`.ws-grit-history .bg-border-hair`) plus an `!important` to beat
the inline `blockSize`, and §8.1.13 bans `!important` outright. A fork would put
a second, divergent copy of the profile's own bold element in the product. Two
lines in the primitive is the whole fix; it is recorded here and left alone.

---

## 8. `GritHistoryStrip` label rows overflow their own grid tracks and print over the cell beside them

**File:** `src/components/ui/grit.tsx` (`GritHistoryStrip`)
**Found by:** profiles / experts / bounties (`prof`), on `/u/mirasolvang` and
`/u/mirasolvang/projects` at 390px, dark and light.
**Severity:** P0 by the brief's own wording. Text collides with the adjacent
column, on the one element §1 nominates as this surface's bold move.

### What is wrong

```tsx
<dl className={cn('grid grid-cols-5 gap-2xs', className)}>
  …
  <dt className="flex items-baseline gap-2xs text-2xs text-text-3">
    <span className="text-text-2" style={GRIT_NUMERAL_STYLE}>{step.value}</span>
    <span style={GRIT_LABEL_STYLE} className="break-words">{step.label}</span>
  </dt>
```

`grid-cols-5` is five `minmax(0, 1fr)` tracks, so at 390px, inside the
`pad-inline` gutters, a track is about 64px. The `<dt>` is a `nowrap` flex line
carrying a numeral and a label; the widest label is "Release candidate", whose
min-content width is roughly 100px, and a flex item does not shrink below its
own min-content (`min-width: auto`). The line therefore runs out of its track
and paints over the next cell. At 390 the strip reads, literally:

```
120 Concept  400 Prototype1000 Beta   3000 Release8000 Shipped
0 projects   0 projects   1 project           candidate0 projects
```

`break-words` on the label cannot save it, because the span's automatic
min-size keeps it at min-content before the break rule is ever consulted.
PLAYBOOK 7.5.47 requires all five cells and their numerals at 390, so
collapsing to three cells is not the answer either.

### The exact fix

Let the label drop to its own line inside the cell, and let the long word break
when even that is not enough. Two declarations:

```tsx
<dt className="flex flex-wrap items-baseline gap-2xs text-2xs text-text-3">
  <span className="text-text-2" style={GRIT_NUMERAL_STYLE}>{step.value}</span>
  <span style={GRIT_LABEL_STYLE} className="min-w-0 break-words">{step.label}</span>
</dt>
```

`flex-wrap` puts "Release candidate" under "3000" at 390 and changes nothing at
1024 and above, where the line already fits. `min-w-0` is what makes the
existing `break-words` reachable. The five cells, the numerals, the counts and
the accessible reading are all unchanged.

### The local workaround shipping now

`src/components/profile/profile-styles.tsx`, a two-rule surface stylesheet
hoisted the way `discover-styles.tsx` is, scoped by a `ws-grit-history` class
the profile header passes through the primitive's own `className` prop:

```css
.ws-grit-history dt { flex-wrap: wrap; }
.ws-grit-history dt > span { min-inline-size: 0; }
```

Element-plus-class specificity beats the single utility class, so no
`!important` is involved (§8.1.13) and no arbitrary Tailwind value is
introduced. It is the same two declarations as the real fix, applied from
outside; delete the file when the primitive takes them.

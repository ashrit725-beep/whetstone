/**
 * Discover's own CSS, hoisted once by React 19's `<style href precedence>` (the
 * same mechanism `skeleton.tsx` already uses). It is here, rather than in
 * `globals.css`, because it is surface CSS and nothing outside Discover reads
 * it; and it is CSS rather than utilities because the row needs `:has()`,
 * `line-clamp`, a stretched `::after`, subgrid-free fixed tracks and four
 * breakpoints, none of which survive being spelled as class strings.
 *
 * Every value is a token. There is no colour literal, no length off the
 * spacing scale, no `transition: all`, no animation, and nothing on §6.3's
 * never-animate list.
 *
 * Keyboard contract: none. This module renders no DOM of its own.
 *
 * Geometry contract (PLAYBOOK MOVE 1): the real row, the skeleton row and the
 * sparse floor all read `--row-h-feed` and the same grid template, so the three
 * cannot drift and nothing moves when data lands.
 */

const CSS = `
/* ------------------------------------------------------------ the shell -- */
.ws-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--spacing-xl);
  align-items: start;
}
@media (min-width: 60rem) {
  .ws-shell { grid-template-columns: var(--container-rail) minmax(0, 1fr); gap: var(--spacing-2xl); }

  /* The rail is thirty-odd 44px targets tall, which is taller than a short
     result set will ever be. Left in flow it drove the page: at
     /discover?type=game&grit=1000 the results measured 581px and the rail
     2119px, so four fifths of the page was empty ground beside a column of
     filters. It is therefore its own scroll region, one viewport tall, pinned
     under the nav. Page height is now driven by the results, and no filter is
     hidden: they are all still there, still links, still working with
     JavaScript off.
     It is focusable so the scroll region is operable from the keyboard
     (SC 2.1.1), and it takes its accessible name from the "Filters" heading the
     <aside> already points at. */
  .ws-aside {
    position: sticky;
    inset-block-start: calc(var(--nav-h) + var(--spacing-md));
    max-block-size: calc(100dvh - var(--nav-h) - var(--spacing-xl));
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
    padding-inline-end: var(--spacing-xs);
    border-radius: var(--radius-sm);
  }
  .ws-aside:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  /* A region cut off at the viewport has to say that it continues. The last
     row fades into the paper while there is more below it (FilterAside sets
     the attribute from the real scroll geometry), and the fade is gone once the
     end is on screen, so it never sits over the last filter. The pseudo-element
     takes no room: its negative margin cancels its own height. */
  .ws-aside::after {
    content: "";
    position: sticky;
    inset-block-end: 0;
    display: block;
    block-size: var(--spacing-2xl);
    margin-block-start: calc(-1 * var(--spacing-2xl));
    pointer-events: none;
    background-image: linear-gradient(to bottom, transparent, var(--color-surface-1));
    visibility: hidden;
  }
  .ws-aside[data-more-below="true"]::after { visibility: visible; }
}

/* The filter bar is the only sticky element Discover owns; the app nav is the
   page's one top: 0 element (§4.3). */
.ws-filterbar {
  position: sticky;
  top: var(--nav-h);
  z-index: var(--z-sticky);
  background-color: var(--color-surface-1);
  color: var(--color-text-2);
  border-block-end: var(--hairline) solid var(--color-border-hair);
  padding-block: var(--spacing-sm);
}

/* The persistent rail below 60rem.
   It is taken out of flow and hidden with 'visibility', which removes it from
   the accessibility tree and from the tab order, so the reader never meets two
   copies of the same thirty links: the filter drawer carries its own. Each
   'GritHatch' owns its <pattern> id, so hiding this copy leaves the drawer's
   hatches painted. (They were blank while the ids were shared: 'url(#id)'
   resolved to the first copy, this one, and a pattern inside a hidden subtree
   paints nothing.) */
@media (max-width: 59.999rem) {
  .ws-aside {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    inline-size: var(--container-rail);
    visibility: hidden;
    pointer-events: none;
  }
}

/* --------------------------------------------------------------- the ul -- */
.ws-feed {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  align-content: start;
}

.ws-feed > li {
  position: relative;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  column-gap: var(--spacing-sm);
  align-items: start;
  min-block-size: var(--row-h-feed);
  padding-block: var(--spacing-sm);
  padding-inline: var(--spacing-sm);
  border-radius: var(--radius-md);
  background-clip: padding-box;
}

/* There is no content-visibility here, and the omission is deliberate. It was
   on this rule, and one page of the feed is twenty rows: at 88px a row that is
   1760px of list, so it skipped rendering for perhaps eleven rows on a 900px
   viewport and saved nothing measurable. What it cost was real: a skipped row
   paints its own border and none of its contents, so any capture of the whole
   page (a print, a PDF, the design shooter) showed nine real rows, an 1100px
   void, and two orphan hairlines floating in it. A row is cheap. Let it
   render. */
.ws-feed > li {
  transition-property: background-color;
  transition-duration: var(--dur-1);
  transition-timing-function: var(--ease-out);
}

/* The rule belongs to the following row, so there is no orphan hairline under
   the last one and none doubling against the bar above the first. */
.ws-feed > li + li {
  border-block-start: var(--hairline) solid var(--color-border-hair);
}

/* A two-row list must not look like a broken page. */
.ws-bench { min-block-size: calc(3 * var(--row-h-feed)); }

/* Search's discussion and expert registers: the same row, without the 48px
   cover column, at the shorter register height. */
.ws-feed-flat > li { grid-template-columns: minmax(0, 1fr); min-block-size: var(--row-h); }

/* ------------------------------------------------------------- the parts -- */
.ws-thumb {
  inline-size: 48px;
  block-size: 48px;
  overflow: hidden;
  border-radius: var(--radius-xs);
  border: var(--hairline) solid var(--color-border-hair);
  background-color: var(--color-surface-0);
}

.ws-avatar-slot { inline-size: 48px; block-size: 48px; display: grid; place-items: center; }

.ws-row-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  row-gap: var(--spacing-xs);
  align-items: center;
  min-inline-size: 0;
}
@media (min-width: 80rem) {
  .ws-row-body { grid-template-columns: minmax(0, 1fr) max-content; column-gap: var(--spacing-lg); row-gap: 0; }
}

.ws-row-main { display: grid; row-gap: var(--spacing-3xs); min-inline-size: 0; }

.ws-row-title {
  margin: 0;
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  line-height: 1.5;
  letter-spacing: 0;
  font-variation-settings: "wdth" 100, "wght" 600;
  color: var(--color-text-2);
  overflow-wrap: anywhere;
  transition-property: color;
  transition-duration: var(--dur-1);
  transition-timing-function: var(--ease-out);
}
.ws-row-title a { color: inherit; text-decoration: none; }
@media (hover: hover) and (pointer: fine) {
  .ws-row-title a:hover { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 0.15em; }
}

/* MOVE 3: the row navigates from the title's single <a>, so middle-click,
   cmd-click and copy-link all survive and the accessible name stays the title.
   The overlay stops before the metadata columns, which keeps the grit chip
   clickable as a filter and leaves the meta text selectable. */
.ws-row-title a::after {
  content: "";
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  inset-inline-end: var(--ws-overlay-end, 0px);
  z-index: var(--z-base);
}
.ws-feed > li :is(a, button):not(.ws-row-title a) { position: relative; z-index: var(--z-raised); }
@media (min-width: 80rem) { .ws-feed { --ws-overlay-end: 27rem; } }

/* Focus scrolls clear of the app nav and the sticky filter bar (SC 2.4.11). */
.ws-feed a, .ws-feed button { scroll-margin-block-start: calc(var(--nav-h) + var(--filterbar-h) + var(--spacing-md)); }

/* The ask: Literata, exactly two lines, reserved so a one-line ask cannot
   shorten its row. text-wrap: pretty is removed on purpose: it moves the rag
   and therefore the clamp point, and it differs between engines. */
.ws-row-ask {
  margin: 0;
  font-size: var(--text-xs);
  line-height: 1.45;
  letter-spacing: 0.005em;
  color: var(--color-text-2);
  max-inline-size: 66ch;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  min-block-size: 2lh;
  overflow-wrap: anywhere;
  text-wrap: wrap;
  font-variation-settings: "opsz" 13, "wght" 400;
}

/* --------------------------------------------------------------- the dl -- */
.ws-meta {
  margin: 0;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  column-gap: var(--spacing-lg);
  align-items: start;
}
.ws-meta > div { display: grid; row-gap: var(--spacing-3xs); min-inline-size: 0; }
.ws-meta dt {
  font-size: var(--text-2xs);
  line-height: 1.3;
  letter-spacing: 0.01em;
  font-variation-settings: "wdth" 87, "wght" 600;
  color: var(--color-text-3);
  white-space: nowrap;
}
.ws-meta dd {
  margin: 0;
  font-size: var(--text-xs);
  line-height: 1.45;
  color: var(--color-text-2);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
}
.ws-meta .ws-meta-num { justify-items: end; text-align: end; }

/* The grit chip is a live filter link, so it carries a real 44px hit area
   without changing the chip's drawn size (§5.5). It is drawn with ::before
   rather than min-block-size: a 44px box inside the <dd> pushed the chip 11px
   below the baseline of "Video" and "Game" in the columns either side of it, so
   the one row of metadata sat on two different baselines. */
.ws-grit-link {
  position: relative;
  display: inline-grid;
  align-items: center;
  justify-items: start;
  min-block-size: 1lh;
  align-content: center;
  border-radius: var(--radius-xs);
  text-decoration: none;
}
.ws-grit-link::before {
  content: "";
  position: absolute;
  inset: -12px;
}

/* Fixed tracks from 40rem up, not only at 80rem. With max-content columns
   every row sized its own metadata, so Type started at a different x on every
   row and the four facts read as four ragged stacks instead of four columns.
   These four widths hold the longest real value in each slot
   ("Invited reviewers only", "API or dev tool", the 8000 chip, three digits). */
@media (min-width: 40rem) {
  .ws-meta { grid-auto-flow: row; grid-auto-columns: auto; grid-template-columns: 8.5rem 7rem 5rem 3.5rem; column-gap: var(--spacing-sm); }
  .ws-meta > div { grid-row: 1; }
}
/* Below 40rem the pairs sit in a fixed two-by-two grid rather than stacking
   into four full-width rows: the same four facts, in two lines instead of four.
   It is a grid, not a wrapping flex row, because a wrap point that depends on
   the length of the Wants value put Notes alone on the second line of one row
   and beside Grit on the next. minmax(0, …) lets a long value such as
   "Invited reviewers only" wrap inside its cell instead of overflowing. */
@media (max-width: 39.999rem) {
  .ws-meta { grid-auto-flow: row; grid-template-columns: repeat(2, minmax(0, max-content)); align-items: center; column-gap: var(--spacing-md); row-gap: var(--spacing-2xs); }
  .ws-meta > div { grid-template-columns: max-content minmax(0, max-content); column-gap: var(--spacing-2xs); align-items: center; row-gap: 0; }
  .ws-meta .ws-meta-num { justify-items: start; text-align: start; }
}

/* ------------------------------------------------- hover, focus, current -- */
/* MOVE 7: one background step, no transform, no shadow, no scale. The ring
   stays on the focused child, so the row says which row and the ring says which
   control. */
@media (hover: hover) and (pointer: fine) {
  .ws-feed > li:has(.ws-row-title a:hover) { background-color: var(--color-surface-2); }
  .ws-feed > li:not(:hover) { transition-duration: var(--dur-exit-1); }
}
.ws-feed > li:has(:focus-visible) { background-color: var(--color-surface-2); }

/* Selection is never a fill (§2.4.6): the 2px grind-mark on the leading edge,
   the title stepping text-2 to text-1, and aria-current. */
.ws-feed > li[aria-current="true"] .ws-row-title { color: var(--color-text-1); }

.ws-feed[aria-busy="true"] .ws-row-ask,
.ws-feed[aria-busy="true"] .ws-meta dd { color: var(--color-text-3); }

/* --------------------------------------------------------- the grit rail -- */
/* Discover's one bold element (§1): the five real hatches at their real stroke
   widths, each with its live count. */
.ws-grit-rail {
  display: grid;
  border: var(--hairline) solid var(--color-border-control);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background-color: var(--color-surface-2);
  color: var(--color-text-2);
}
.ws-grit-cell {
  position: relative;
  display: grid;
  grid-template-columns: 3.25rem 1rem minmax(0, 1fr) max-content;
  align-items: center;
  column-gap: var(--spacing-sm);
  min-block-size: var(--tap-min);
  padding-inline: var(--spacing-sm);
  padding-block: var(--spacing-2xs);
  color: var(--color-text-2);
  text-decoration: none;
  transition-property: color, background-color;
  transition-duration: var(--dur-1);
  transition-timing-function: var(--ease-out);
}
.ws-grit-cell + .ws-grit-cell { border-block-start: var(--hairline) solid var(--color-border-hair); }
@media (hover: hover) and (pointer: fine) {
  .ws-grit-cell:not([data-empty]):hover { background-color: var(--color-surface-3); color: var(--color-text-1); }
}
.ws-grit-cell[aria-current="true"] { color: var(--color-text-1); }
.ws-grit-cell[data-empty] { color: var(--color-text-3); }
.ws-grit-swatch {
  block-size: 1.5rem;
  inline-size: 3.25rem;
  overflow: hidden;
  border-radius: var(--radius-0);
  background-color: var(--color-surface-0);
}

/* ------------------------------------------------------------- rail bits -- */
.ws-rail-group { display: grid; row-gap: var(--spacing-sm); }
.ws-rail-heading {
  font-size: var(--text-2xs);
  line-height: 1.3;
  letter-spacing: 0.01em;
  font-variation-settings: "wdth" 87, "wght" 600;
  color: var(--color-text-3);
  margin: 0;
}
.ws-option-list { list-style: none; margin: 0; padding: 0; display: grid; row-gap: var(--spacing-3xs); }
.ws-option {
  display: grid;
  grid-template-columns: 1rem minmax(0, 1fr) max-content;
  align-items: center;
  column-gap: var(--spacing-xs);
  min-block-size: var(--tap-min);
  padding-inline: var(--spacing-2xs);
  border-radius: var(--radius-xs);
  font-size: var(--text-sm);
  color: var(--color-text-2);
  text-decoration: none;
  transition-property: color, background-color;
  transition-duration: var(--dur-1);
  transition-timing-function: var(--ease-out);
}
@media (hover: hover) and (pointer: fine) {
  .ws-option:not([data-empty]):hover { background-color: var(--color-surface-2); color: var(--color-text-1); }
}
.ws-option[aria-current="true"] { color: var(--color-text-1); }
/* A zero-count option is text, not a link: printed so the counts still add up,
   one ink step down so it does not read as a destination. */
.ws-option[data-empty] { color: var(--color-text-3); }

.ws-saved { display: grid; grid-template-columns: minmax(0, 1fr) max-content; align-items: center; column-gap: var(--spacing-2xs); }
.ws-saved-link {
  display: grid;
  row-gap: var(--spacing-3xs);
  align-content: center;
  min-block-size: var(--tap-min);
  min-inline-size: 0;
  padding-inline: var(--spacing-2xs);
  border-radius: var(--radius-xs);
  text-decoration: none;
  transition-property: background-color, color;
  transition-duration: var(--dur-1);
  transition-timing-function: var(--ease-out);
}
@media (hover: hover) and (pointer: fine) {
  .ws-saved-link:hover { background-color: var(--color-surface-2); }
  .ws-saved-link:hover span:first-child { color: var(--color-text-1); }
}

/* --------------------------------------------------------- removable pill -- */
.ws-active-filters { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--spacing-xs); }
.ws-clear {
  display: inline-grid;
  grid-auto-flow: column;
  align-items: center;
  gap: var(--spacing-2xs);
  min-block-size: var(--tap-min);
  padding-inline: var(--spacing-sm);
  border: var(--hairline) solid var(--color-border-control);
  border-radius: var(--radius-xs);
  background-color: var(--color-surface-2);
  color: var(--color-text-2);
  font-size: var(--text-xs);
  font-variation-settings: "wdth" 87, "wght" 600;
  text-decoration: none;
  white-space: nowrap;
  transition-property: color, background-color, border-color;
  transition-duration: var(--dur-1);
  transition-timing-function: var(--ease-out);
}
@media (hover: hover) and (pointer: fine) {
  .ws-clear:hover { border-color: var(--color-border-strong); background-color: var(--color-surface-3); color: var(--color-text-1); }
}

/* --------------------------------------------------------------- search -- */
.ws-search { max-inline-size: 36rem; }
.ws-search-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  column-gap: var(--spacing-xs);
  align-items: center;
}

/* --------------------------------------------------------- search registers -- */
/* Search's three section labels are structure, not headline. At the global h2
   size (31px) they out-shouted every result under them: the eye landed on the
   word "Discussions" rather than on the first discussion. They keep their h2
   semantics and take the h4 step. */
.ws-register-heading {
  margin: 0;
  font-size: var(--text-md);
  line-height: 1.4;
  letter-spacing: -0.005em;
  font-variation-settings: "wdth" 100, "wght" 600;
  color: var(--color-text-1);
}

/* --------------------------------------------------------------- header -- */
.ws-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--spacing-sm); }

/* The accelerator hint: told, not hidden in a tooltip, but quiet. It is not
   drawn where there is no keyboard to press: on a coarse pointer it was two
   wrapped lines of key caps between the results count and the first row. */
.ws-hint { color: var(--color-text-3); }
@media (max-width: 39.999rem), (pointer: coarse) { .ws-hint { display: none; } }
.ws-summary-line { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-sm); }

/* ------------------------------------------------------------ skeletons -- */
/* The skeleton reuses the row's own selectors and these four slots, each of
   which inherits the real element's font-size and line-height. The placeholder
   is therefore exactly the height of the thing it stands in for, in every
   theme and at every text-zoom level, with no magic numbers to drift. */
.ws-title-slot { min-block-size: 1lh; font-size: var(--text-sm); line-height: 1.5; display: grid; align-content: center; }
.ws-ask-slot { min-block-size: 2lh; font-size: var(--text-xs); line-height: 1.45; display: grid; align-content: center; row-gap: var(--spacing-3xs); }
.ws-dt-slot { min-block-size: 1lh; font-size: var(--text-2xs); line-height: 1.3; display: grid; align-content: center; }
.ws-dd-slot { min-block-size: 1lh; font-size: var(--text-xs); line-height: 1.45; display: grid; align-content: center; }

/* The same trick for the chrome the skeleton stands in for: Field's <label>,
   its hint line, its permanently reserved helper slot, and the one-line
   paragraph that follows a rail heading. Each inherits the real element's
   font-size and line-height, so the placeholder is its exact height at every
   text-zoom level with no magic numbers to drift. */
.ws-label-slot { min-block-size: 1lh; font-size: var(--text-base); line-height: 1.55; display: grid; align-content: center; }
.ws-hint-slot { min-block-size: 1lh; font-size: var(--text-xs); line-height: 1.45; display: grid; align-content: center; }
.ws-note-slot { font-size: var(--text-xs); line-height: 1.45; display: grid; align-content: center; row-gap: var(--spacing-3xs); }
`

export function DiscoverStyles() {
  return (
    <style href="whetstone-discover" precedence="medium">
      {CSS}
    </style>
  )
}

export default DiscoverStyles

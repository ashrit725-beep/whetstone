/**
 * The rules the discussions register cannot express as utilities: the row grids,
 * the `:has()` tint, the stretched row link, the metadata cells, the nesting
 * rule, and the optimistic reply entrance.
 *
 * Hoisted with React 19's `<style href precedence>`, the same way the overlay
 * primitives ship their CSS, so it is deduplicated across every route that
 * renders a register and it never lands in `globals.css`.
 *
 * Keyboard contract: none. This component renders no interactive elements.
 */

export const DISCUSSION_CSS = `
.ws-register { list-style: none; margin: 0; padding: 0; }

/* The rule belongs to the following row, so there is no orphan hairline under
   the last row and none doubling against the container edge. */
.ws-register > li + li {
  border-block-start: var(--hairline) solid var(--color-border-hair);
}

.ws-row {
  position: relative;
  min-block-size: var(--row-h);
  padding-block: var(--spacing-sm);
  padding-inline: var(--spacing-sm);
  border-radius: var(--radius-md);
  background-clip: padding-box;
  transition-property: background-color;
  transition-duration: var(--dur-exit-1);
  transition-timing-function: var(--ease-in);
}

/* Row tint moves exactly one surface step. No transform, no shadow (§5.4). */
.ws-row:has(:focus-visible) { background-color: var(--color-surface-2); }
@media (hover: hover) and (pointer: fine) {
  .ws-register > .ws-row:has(.ws-row-title a:hover) {
    background-color: var(--color-surface-2);
    transition-duration: var(--dur-1);
    transition-timing-function: var(--ease-out);
  }
}

/* The whole row is the target, but the only link is around the title, so the
   accessible name stays the title and middle-click still opens a tab. */
.ws-row-title a::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
}
.ws-row :is(a, button):not(.ws-row-title a) { position: relative; z-index: 2; }

/* --- row grids ------------------------------------------------------------ */

.ws-channel-row,
.ws-thread-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  row-gap: var(--spacing-xs);
  align-items: center;
}
@media (min-width: 40rem) {
  .ws-channel-row,
  .ws-thread-row {
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: var(--spacing-lg);
    align-items: baseline;
  }
}

.ws-row-side {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}
@media (min-width: 40rem) {
  /* Baseline, not centre: the first metadata label has to sit on the title's
     baseline, or a three-line title block leaves the counts floating at its
     optical middle and the register reads as two unrelated grids. */
  .ws-row-side { align-items: baseline; justify-content: flex-end; }
}

/* --- metadata cells ------------------------------------------------------- */

.ws-cell {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: var(--spacing-2xs);
}
.ws-cell dt {
  font-size: var(--text-2xs);
  line-height: 1.3;
  letter-spacing: 0.01em;
  font-variation-settings: "wdth" 87, "wght" 600;
  color: var(--color-text-3);
}
/* The value out-reads its own label: one step up the scale, so the eye lands on
   the number and not on the word "Replies" printed down the register. */
.ws-cell dd {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1;
  color: var(--color-text-2);
  font-variant-numeric: tabular-nums;
}
@media (min-width: 40rem) {
  .ws-cell { display: block; text-align: end; }
  .ws-cell dd { margin-block-start: var(--spacing-2xs); }
  .ws-cell-count { inline-size: 4rem; }
  .ws-cell-when { inline-size: 9rem; }
}

/* --- reply tree ----------------------------------------------------------- */

.ws-replies { list-style: none; margin: 0; padding: 0; }

/* Reply nesting: a 2px hair rule plus indentation, so the level survives a
   320px reflow where indentation alone would be eaten (SC 1.4.10).
   The margin matters as much as the rule: without it the child rule starts at
   the parent's own leading edge, which is where the accepted answer's accent
   grind-mark lives, and the two run together into one long stripe. Offsetting
   the rule to the parent's text column keeps the grind-mark a mark. */
.ws-nest {
  margin-inline-start: var(--spacing-2xs);
  border-inline-start: 2px solid var(--color-border-hair);
  padding-inline-start: var(--spacing-sm);
}
@media (min-width: 40rem) {
  .ws-nest {
    margin-inline-start: var(--spacing-md);
    padding-inline-start: var(--spacing-lg);
  }
}

/* Every reply article reserves the grind-mark gutter, accepted or not, so the
   replies at one level share a text edge exactly instead of the accepted one
   sitting 12px right of its siblings. */
.ws-reply > article { padding-inline-start: var(--spacing-sm); }

/* Separation between replies is rhythm, not more rules: the vertical nest rule
   is already doing the grouping, and a horizontal hairline across it closes a
   box, which is a second containment level (§5.2). */
.ws-replies > li + li {
  border-block-start: var(--hairline) solid var(--color-border-hair);
}
.ws-nest > li + li { border-block-start: 0; }

/* Optimistic insert: 180ms, once, and only on the reply that is actually new.
   Without the [data-fresh] guard @starting-style fires for every reply on
   first paint, which is a scroll reveal by another name. */
.ws-reply[data-fresh] {
  opacity: 1;
  transform: translateY(0);
  transition-property: opacity, transform;
  transition-duration: var(--dur-2);
  transition-timing-function: var(--ease-out);
  @starting-style { opacity: 0; transform: translateY(8px); }
}
@media (prefers-reduced-motion: reduce) {
  .ws-reply[data-fresh] { @starting-style { transform: none; } }
}
`

export function DiscussionStyles() {
  return (
    <style href="whetstone-discussions" precedence="medium">
      {DISCUSSION_CSS}
    </style>
  )
}

export default DiscussionStyles

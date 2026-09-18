/**
 * CSS for the project surfaces.
 *
 * Spacing is written as `calc(var(--spacing) * n)` against Tailwind's own 4px
 * step rather than as `var(--spacing-n)`. The token layer used to define named
 * steps 1 to 11; it does not any more, and a stylesheet that still asked for
 * `--spacing-3` silently got nothing.
 *
 * It lives here rather than in globals.css because globals.css is the token
 * layer and belongs to nobody in particular. Every value below reads a token:
 * no literal colour, no radius above 3px, nothing over 240ms, and every
 * transform sits behind a `prefers-reduced-motion: no-preference` guard.
 *
 * Three classes here are load-bearing outside this folder. `.ws-composer`,
 * `.ws-scaffold` and `.ws-type-link` are used by `components/composer` and by
 * `/new`, which are not ours to edit, so they keep their names and gain the
 * Paper & Ink treatment rather than being renamed.
 */

const CSS = `
/* ---------------------------------------------------------- the composer -- */

.ws-composer {
  position: fixed;
  inset: 0;
  margin: auto;
  inline-size: min(calc(100vw - 2rem), 40rem);
  block-size: fit-content;
  max-block-size: min(80vh, 40rem);
  padding: 0;
  border: 1.5px solid var(--color-ink);
  border-radius: var(--radius-xs);
  background-color: var(--color-paper-hi);
  color: var(--color-ink);
  box-shadow: var(--shadow-overlay);
  opacity: 0;
  transition: opacity var(--dur-2) var(--ease),
              overlay var(--dur-2) allow-discrete,
              display var(--dur-2) allow-discrete;
}
.ws-composer[open] {
  opacity: 1;
  transition: opacity var(--dur-3) var(--ease-out),
              overlay var(--dur-3) allow-discrete,
              display var(--dur-3) allow-discrete;
}
@starting-style {
  .ws-composer[open] { opacity: 0; }
}

@media (prefers-reduced-motion: no-preference) {
  .ws-composer {
    transform: translateY(6px);
    transition: opacity var(--dur-2) var(--ease),
                transform var(--dur-2) var(--ease),
                overlay var(--dur-2) allow-discrete,
                display var(--dur-2) allow-discrete;
  }
  .ws-composer[open] {
    transform: none;
    transition: opacity var(--dur-3) var(--ease-out),
                transform var(--dur-3) var(--ease-out),
                overlay var(--dur-3) allow-discrete,
                display var(--dur-3) allow-discrete;
  }
  @starting-style {
    .ws-composer[open] { opacity: 0; transform: translateY(6px); }
  }
}

.ws-composer::backdrop {
  background-color: transparent;
  transition: background-color var(--dur-2) var(--ease),
              overlay var(--dur-2) allow-discrete,
              display var(--dur-2) allow-discrete;
}
.ws-composer[open]::backdrop {
  background-color: var(--color-scrim);
  transition: background-color var(--dur-3) var(--ease-out),
              overlay var(--dur-3) allow-discrete,
              display var(--dur-3) allow-discrete;
}
@starting-style {
  .ws-composer[open]::backdrop { background-color: transparent; }
}

/* SC 2.4.11: nothing focusable ends up under the sticky footer. */
.ws-composer-scope :is(a, button, input, select, textarea, summary, [tabindex]) {
  scroll-margin-block: 5rem;
}

/* ----------------------------------------------------- hand-built controls -- */

/* The small square control: a ruled box that gains an ink underline on hover.
   44px tall, because a 30px target is a target you miss. */
.ws-scaffold {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: calc(var(--spacing) * 2);
  min-block-size: 44px;
  padding-inline: calc(var(--spacing) * 3);
  border: 1.5px solid var(--color-rule-2);
  border-radius: var(--radius-xs);
  background-color: var(--color-paper-hi);
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-variation-settings: "wght" 600;
  text-align: start;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color var(--dur-1) var(--ease), box-shadow var(--dur-1) var(--ease);
}
@media (hover: hover) {
  .ws-scaffold:hover { border-color: var(--color-ink); box-shadow: inset 0 -2px 0 var(--color-ink); }
}
.ws-scaffold[aria-pressed="true"] {
  border-color: var(--color-ink);
  background-color: var(--color-paper-sub);
}
.ws-scaffold[disabled], .ws-scaffold[aria-disabled="true"] {
  color: var(--color-ink-3);
  border-color: var(--color-rule);
  cursor: not-allowed;
  box-shadow: none;
}

/* A scaffold labelled in the creator's own words, which can run to a sentence:
   it wraps inside the column rather than pushing a phone's page sideways. */
.ws-scaffold-wrap {
  max-inline-size: 100%;
  padding-block: calc(var(--spacing) * 2);
  white-space: normal;
}

/* A quiet third action: no border until it is wanted. */
.ws-btn-quiet { border-color: transparent; }
.ws-btn-quiet:hover { border-color: var(--color-rule-2); }

/* A personal toggle (save, follow): no box until it is wanted, and a ruled box
   once it is on, so its state is a shape as well as a word. */
.ws-toggle {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  min-block-size: 44px;
  padding-inline: calc(var(--spacing) * 3);
  border: 1.5px solid transparent;
  border-radius: var(--radius-xs);
  background-color: transparent;
  color: var(--color-ink-2);
  font-size: var(--text-sm);
  font-variation-settings: "wght" 600;
  text-decoration: none;
  cursor: pointer;
  transition: border-color var(--dur-1) var(--ease), color var(--dur-1) var(--ease);
}
@media (hover: hover) {
  .ws-toggle:hover { border-color: var(--color-rule-2); color: var(--color-ink); }
}
.ws-toggle[aria-pressed="true"] { border-color: var(--color-ink); color: var(--color-ink); }

/* The sort strip: rules, not buttons. */
.ws-area-link {
  display: inline-flex;
  align-items: center;
  min-block-size: 44px;
  padding-inline: calc(var(--spacing) * 2);
  color: var(--color-ink-3);
  font-size: var(--text-xs);
  font-variation-settings: "wght" 600;
  text-decoration: none;
  box-shadow: inset 0 -1px 0 var(--color-rule);
  transition: box-shadow var(--dur-1) var(--ease), color var(--dur-1) var(--ease);
}
@media (hover: hover) {
  .ws-area-link:hover { color: var(--color-ink); box-shadow: inset 0 -2px 0 var(--color-ink-2); }
}
.ws-area-link[aria-current="true"] {
  color: var(--color-ink);
  box-shadow: inset 0 -2px 0 var(--color-ink);
}

/* The section tabs on the masthead. */
.ws-tab {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  min-block-size: 44px;
  padding-inline: calc(var(--spacing) * 1);
  color: var(--color-ink-3);
  font-size: var(--text-sm);
  font-variation-settings: "wght" 600;
  text-decoration: none;
  transition: color var(--dur-1) var(--ease), box-shadow var(--dur-1) var(--ease);
  box-shadow: inset 0 -1px 0 transparent;
}
@media (hover: hover) {
  .ws-tab:hover { color: var(--color-ink); box-shadow: inset 0 -2px 0 var(--color-rule-2); }
}
.ws-tab[aria-current="page"] {
  color: var(--color-ink);
  box-shadow: inset 0 -2px 0 var(--color-ink);
}

.ws-type-link {
  padding-inline: calc(var(--spacing) * 2);
  margin-inline: calc(calc(var(--spacing) * 2) * -1);
  border-radius: var(--radius-xs);
  transition: background-color var(--dur-1) var(--ease);
}
@media (hover: hover) {
  .ws-type-link:hover { background-color: var(--color-paper-sub); }
}

/* ------------------------------------------------------------ small parts -- */

/* The mark, as a glyph. Square, because there is one round thing in this
   product and it is a photograph of a person. */
.ws-dot {
  inline-size: 7px;
  block-size: 7px;
  background-color: var(--color-mark);
  flex: none;
}

.ws-dot-ink { background-color: var(--color-ink); }

.ws-grit { display: inline-flex; align-items: center; gap: calc(var(--spacing) * 2); }

/* ------------------------------------------------------------- the stage -- */

/* The media stage. Where a project has artwork it holds it at its real size;
   where it does not, the space is composed from rule, type and ink density
   rather than filled with a grey rectangle. */
.ws-stage {
  position: relative;
  background-color: var(--color-paper-deep);
  border: 1.5px solid var(--color-ink);
  isolation: isolate;
}
/* The field is inset exactly as far as the stage's content (p-4, then p-8 from
   40rem), so no panel runs on past the base band into the stage's margin. */
.ws-stage-strip {
  position: absolute;
  inset: 0;
  display: grid;
  gap: calc(var(--spacing) * 3);
  padding: calc(var(--spacing) * 4);
  z-index: 0;
}
@media (min-width: 40rem) {
  .ws-stage-strip { padding: calc(var(--spacing) * 8); }
}
/* Each panel is one step of the grit scale drawn as line density: the stage
   itself is the scale, at the size of a picture. */
.ws-panel {
  display: block;
  min-inline-size: 0;
  border: 1px solid rgb(var(--ink-rgb) / 0.22);
  color: var(--color-ink);
}
/* Drawn inside the panel's box, so the base band covers it like every other
   line in the field; outside the box its right edge ran on past the band. */
.ws-panel-here { outline: 1.5px solid var(--color-ink); outline-offset: -1.5px; }

/* Outlined display type: the same outline-to-solid idea as the honing word,
   held at the outline end. */
.ws-outline {
  color: transparent;
  -webkit-text-stroke: 2px var(--color-ink);
  paint-order: stroke fill;
}
@supports not (-webkit-text-stroke: 2px black) {
  .ws-outline { color: var(--color-ink-3); }
}
.ws-outline-thin { -webkit-text-stroke-width: 1.25px; }

/* ------------------------------------------------- the disagreement plot -- */

/* Drawn in the same hand as the landing page's figure, so the reading a
   visitor met there is the one they meet here. What the plot is of, and what
   the two ends of its scale mean, is said once in the head, above a 1.5px
   rule the steps stand under. */
.ws-plot-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: calc(var(--spacing) * 4) calc(var(--spacing) * 12);
  padding-block-end: calc(var(--spacing) * 4);
  border-block-end: 1.5px solid var(--color-ink);
}
.ws-plot-key {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--spacing) * 1) calc(var(--spacing) * 4);
  font-size: var(--text-xs);
  color: var(--color-ink-2);
}
.ws-plot-key b {
  font-weight: normal;
  font-variation-settings: "wght" 750;
  color: var(--color-ink);
  margin-inline-end: calc(var(--spacing) * 1);
}

/* Below 60rem each step is a row: numeral and count in a fixed first column,
   names in the second. Every row has the same padding, so nothing in the
   median row sits a pixel away from where it sits in the others. */
.ws-plot-cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  margin: 0;
  padding: 0;
  list-style: none;
}
.ws-plot-col {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr);
  align-items: center;
  column-gap: calc(var(--spacing) * 4);
  padding: calc(var(--spacing) * 4) calc(var(--spacing) * 3);
  border-block-end: 1px solid var(--color-rule);
}

/* The median is a ground, not a rule: it adds no padding and no border, and a
   lighter paper holds in greyscale where a hue would not. */
.ws-plot-col[data-median="true"] { background-color: var(--color-paper-hi); }

.ws-plot-foot {
  display: grid;
  gap: calc(var(--spacing) * 1);
  min-inline-size: 0;
  margin: 0;
}
.ws-plot-step {
  position: relative;
  justify-self: start;
  font-size: var(--text-md);
  line-height: 1;
  color: var(--color-ink);
  font-variation-settings: "wght" 800;
}
/* Hung off the numeral's right edge rather than set beside it, so "4" sits
   exactly where "3" and "5" sit whether or not it is the median. */
.ws-plot-tag {
  position: absolute;
  inset-inline-start: calc(100% + 8px);
  inset-block-end: 2px;
  white-space: nowrap;
  font-size: var(--text-2xs);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-ink-2);
  font-variation-settings: "wght" 700;
}

.ws-plot-stack {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(var(--spacing) * 2) calc(var(--spacing) * 5);
  min-inline-size: 0;
}
/* A reviewer: a square of ink and a name. Stacked, the squares are the bar. */
.ws-voter {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  min-inline-size: 0;
  font-size: var(--text-xs);
  line-height: 1.45;
  color: var(--color-ink-2);
}
.ws-voter::before {
  content: "";
  flex: none;
  inline-size: 8px;
  block-size: 8px;
  background-color: var(--color-ink);
}
.ws-voter > span {
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ws-plot-more {
  padding-inline-start: calc(var(--spacing) * 4);
  font-size: var(--text-xs);
  color: var(--color-ink-3);
}
/* Nobody chose this step. A hairline keeps the place without shouting. */
.ws-plot-none {
  display: block;
  inline-size: 24px;
  block-size: 1px;
  background-color: var(--color-rule-2);
}

.ws-plot-bracket { display: none; }

/* A reading restated in prose, hung off the same 7rem register as the rows.
   Baseline-aligned, so the label sits on the paragraph's first line. */
.ws-plot-words {
  display: grid;
  align-items: baseline;
  gap: calc(var(--spacing) * 4);
  margin-block-start: calc(var(--spacing) * 12);
}

/* Above 60rem the same markup stands up: the steps as columns on a ruled
   baseline, names stacked upward from it, and under each column its numeral
   and count. The columns stretch to one height, so every baseline is the same
   baseline. */
@media (min-width: 60rem) {
  .ws-plot-cols {
    grid-template-columns: repeat(var(--steps, 5), minmax(0, 1fr));
    min-block-size: 13rem;
  }
  .ws-plot-col {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: calc(var(--spacing) * 6) calc(var(--spacing) * 4) 0;
    border-block-end: 0;
    border-inline-start: 1px solid var(--color-rule);
  }
  .ws-plot-col:last-child { border-inline-end: 1px solid var(--color-rule); }

  /* The names stand on their step, as a bar stands on its tick. */
  .ws-plot-stack {
    order: 1;
    flex-direction: column-reverse;
    flex-wrap: nowrap;
    align-items: stretch;
    gap: calc(var(--spacing) * 2);
    max-inline-size: 100%;
  }

  /* The baseline is each foot's top edge. The foot is pulled one pixel past
     the column's padding on both sides, over the column rule, so the edges
     meet as one unbroken line. */
  .ws-plot-foot {
    order: 2;
    align-self: stretch;
    justify-items: center;
    margin: calc(var(--spacing) * 4) -17px 0;
    padding: calc(var(--spacing) * 3) 17px calc(var(--spacing) * 4);
    border-block-start: 1.5px solid var(--color-ink);
  }
  .ws-plot-step { justify-self: center; }

  /* The bracket spans only the steps the reviewers actually used. */
  .ws-plot-bracket {
    display: grid;
    grid-template-columns: repeat(var(--steps, 5), minmax(0, 1fr));
    margin-block-start: calc(var(--spacing) * 4);
  }
  .ws-plot-bracket-bar {
    position: relative;
    grid-row: 1;
    display: flex;
    justify-content: center;
    margin-inline: calc(var(--spacing) * 4);
    padding-block-start: calc(var(--spacing) * 2);
    border-block-start: 1px solid var(--color-ink-3);
    font-size: var(--text-2xs);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-ink-2);
    font-variation-settings: "wght" 700;
  }
  .ws-plot-bracket-bar::before,
  .ws-plot-bracket-bar::after {
    content: "";
    position: absolute;
    inset-block-start: -5px;
    block-size: 9px;
    inline-size: 1px;
    background-color: var(--color-ink-3);
  }
  .ws-plot-bracket-bar::before { inset-inline-start: 0; }
  .ws-plot-bracket-bar::after { inset-inline-end: 0; }

  .ws-plot-words {
    grid-template-columns: 7rem minmax(0, 1fr);
    gap: calc(var(--spacing) * 12);
  }
}

/* -------------------------------------------------------------- the notes -- */

.ws-rule-list > li + li { border-block-start: 1px solid var(--color-rule); }

/* A row that is a link: the paper steps down, nothing floats. */
.ws-rowlink {
  display: block;
  text-decoration: none;
  color: inherit;
  transition: background-color var(--dur-1) var(--ease);
}
@media (hover: hover) {
  .ws-rowlink:hover { background-color: var(--color-paper-sub); }
}

/* ------------------------------------------------- the optimistic insert -- */

/* Guarded by the attribute: @starting-style fires for every element on first
   render, and without the guard the whole server-rendered thread would slide
   up on load, which is a scroll reveal by another name. */
.ws-note[data-fresh] {
  opacity: 1;
  transition-property: opacity;
  transition-duration: var(--dur-2);
  transition-timing-function: var(--ease-out);
}
@starting-style {
  .ws-note[data-fresh] { opacity: 0; }
}
@media (prefers-reduced-motion: no-preference) {
  .ws-note[data-fresh] {
    transform: translateY(0);
    transition-property: opacity, transform;
  }
  @starting-style {
    .ws-note[data-fresh] { opacity: 0; transform: translateY(8px); }
  }
}
`

export function ProjectStyles() {
  return <style>{CSS}</style>
}

export default ProjectStyles

/**
 * The chrome's own stylesheet, hoisted once by React 19's `precedence`.
 *
 * Only rules that a utility class cannot express live here: the sticky
 * clearance for the whole document, the geometry of the command palette's
 * `<dialog>`, and the two `::before` rules that carry state without moving any
 * geometry. Every value reads a token; no literal colour appears.
 */

const CHROME_CSS = `
/* PLAYBOOK 2.6: one declaration covers hash links, scrollIntoView and the
   browser's own focus scrolling, so no focusable ever lands under the nav. */
html { scroll-padding-block-start: calc(var(--nav-h) + var(--filterbar-h)); }

/* ---------------------------------------------------------------- nav --- */

/* The current link is marked by geometry that is always present and never
   moves: a 2px accent rule sitting on the nav's own bottom hairline, plus the
   label stepping from text-2 to text-1. No fill, no transition (contract §2.4.6). */
.ws-navlink::after {
  content: "";
  position: absolute;
  inset-inline: var(--spacing-sm);
  inset-block-end: 0;
  block-size: 2px;
  background-color: var(--color-accent);
  transform: scaleX(0);
  transform-origin: 0 50%;
}
.ws-navlink[aria-current="page"]::after { transform: scaleX(1); }

/* ---------------------------------------------------- command palette --- */

/* Anchored near the top rather than centred: a palette that opens under the
   reader's eye costs no saccade. Two classes beat the primitive's one. */
.whetstone-dialog.ws-palette {
  inline-size: min(calc(100vw - 2rem), 40rem);
  max-block-size: min(72dvh, 34rem);
  inset-block-start: 10dvh;
  inset-block-end: auto;
  margin-block: 0;
}

/* Namespaced "cmd": these rules are unlayered, and Discover's filter rail owns
   an unlayered .ws-option grid that would otherwise reshape every row here
   into its 1rem check column on the pages that load it. */
.ws-cmd-option { position: relative; }
.ws-cmd-option[aria-selected="true"] {
  background-color: var(--color-surface-2);
  color: var(--color-text-1);
}
/* The identity motif: 2px accent on the leading edge of the one active option.
   Absolutely positioned, so nothing shifts as the selection moves. */
.ws-cmd-option[aria-selected="true"]::before {
  content: "";
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  inline-size: 2px;
  background-color: var(--color-accent);
}

/* --------------------------------------------------------- theme word --- */

/* Workaround for the ThemeToggle defect recorded in PRIMITIVE-DEFECTS.md: the
   primitive spends one lowercase string on both the accessible sentence and
   the visible chip. This capitalises the rendered glyph only, so the chip is
   sentence case beside its "Appearance" heading while the accessible name
   stays the sentence the primitive wrote. ::first-letter needs a block box. */
.ws-theme-word button > span[aria-hidden="true"] { display: inline-block; }
.ws-theme-word button > span[aria-hidden="true"]::first-letter { text-transform: uppercase; }

/* --------------------------------------------------- notification bell --- */

/* The product's most important moment reads as a shipped edge: positive hue,
   plus a Check glyph and the word, so it survives greyscale (contract §2.4.8). */
.ws-notif-shipped::before {
  content: "";
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  inline-size: 2px;
  background-color: var(--color-positive);
}
`

export function ChromeStyles() {
  return (
    <style href="whetstone-chrome" precedence="medium">
      {CHROME_CSS}
    </style>
  )
}

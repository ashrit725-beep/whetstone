/**
 * The honing word: the page's one bold element.
 *
 * The word is drawn in two layers. Underneath, the whole word in one run,
 * stroked, and filled with the paper. On top, absolutely positioned over it,
 * the same letters again as eight spans with no stroke at all, each filled to a
 * fixed ink density.
 *
 * Two layers rather than one because at -0.045em the glyphs overlap, and a
 * browser paints a letter's stroke after the previous letter's fill: with one
 * layer the "r" outline was drawn across the "a" bowl, and seams showed at s|h,
 * a|r, r|p and p|e with a stray contour running out of the "e". Split in two,
 * every stroke is painted before every fill, so what shows is the silhouette
 * and nothing inside it.
 *
 * The silhouette has to be one run, not eight. Eight stroked spans are eight
 * runs, and each one's outline is drawn over the body of the letter before it,
 * which put the seams back: a contour down the "p" bowl and a line out of the
 * "e" into the second "r", visible under the finished fills. One run strokes
 * the union of the glyphs and leaves the interior clean.
 *
 * One run and eight spans only land on the same pixels if they shape the same
 * way, so both layers turn kerning and ligatures off in CSS. With kerning on,
 * the run closes the r|p and e|r pairs by a fraction of a pixel and the spans
 * cannot, and the drift draws a second contour beside the first.
 *
 * The fills are the five grit-cell densities, not a continuous ramp: 0.1, 0.1,
 * 0.26, 0.48, 0.48, 0.74, 1, 1 across "sharper." — the same five values the
 * grit reading draws everywhere else in the product. A smooth ramp read as a
 * gradient on the second word, which is somebody else's house style; five steps
 * read as the product's own scale, because they are it.
 *
 * Three properties hold, in order of how much they matter:
 *
 *   Zero layout shift. Only `color` animates. The stroke, the width axis and
 *   the letter-spacing are identical on the first frame and the last, so the
 *   word occupies its final box from first paint and nothing below it moves.
 *
 *   The rest state is the end state. With no JavaScript, with reduced motion,
 *   or on a client-side navigation back to this page, the finished ramp paints
 *   and nothing animates.
 *
 *   It cannot flash. The attribute that arms the CSS is set by a blocking
 *   script the page renders above the hero (`HONE_BOOT` in the landing page),
 *   so it is on the document element before the word is parsed. It used to be
 *   set by an effect: on a slow connection the finished word painted at 776ms
 *   and the effect reset it to paper and refilled it at about 2.3s, which a
 *   phone reader saw as the headline blanking itself a second after it arrived.
 *
 * Keyboard contract: none. This is text inside a heading and takes no focus.
 * The word is in the document once, on the stroke layer; the ink layer is
 * hidden from assistive technology and cannot be selected.
 */

import type { CSSProperties } from 'react'
import styles from './paper.module.css'

/** The grit reading's five cells, in the same order. */
const DENSITY = [0.1, 0.26, 0.48, 0.74, 1] as const

export interface HoneProps {
  /** The word to hone, including any trailing punctuation. Keep it to one word. */
  word: string
}

/**
 * The ink ramp, snapped to the five densities. Trailing punctuation belongs to
 * the last letter and arrives solid with it. The exponent leans the ramp late,
 * so the word starts as outline for two letters and only the last two are solid.
 */
function inkFractions(word: string): readonly number[] {
  const letters = [...word]
  const lastLetter = letters.reduce(
    (found, character, index) => (/[\p{L}\p{N}]/u.test(character) ? index : found),
    letters.length - 1,
  )
  const span = Math.max(1, lastLetter)

  return letters.map((_, index) => {
    if (index >= lastLetter) return 1
    const step = Math.round((index / span) ** 1.3 * (DENSITY.length - 1))
    return DENSITY[Math.min(DENSITY.length - 1, Math.max(0, step))] ?? 1
  })
}

export function Hone({ word }: HoneProps) {
  const fractions = inkFractions(word)

  return (
    <span className={styles.hone}>
      {/* The silhouette: one run, so the whole word is stroked once and no
          letter's outline is drawn across its neighbour's body. Both layers
          turn kerning off, which is what lets one run and eight spans land on
          the same pixels.

          This layer is also the word itself — the text a screen reader reads,
          find-in-page finds and a drag selects. It used to carry `aria-hidden`
          beside an `sr-only` copy, which put three copies of "sharper." in the
          heading: one read and two not, but all three selectable and all three
          matched by a search. */}
      <span className={styles.honeStroke}>{word}</span>

      {/* The ink, letter by letter, sitting exactly over the run above. */}
      <span aria-hidden="true" className={styles.honeFill}>
        {[...word].map((character, index) => (
          <span
            // The letters of one fixed word: index is the identity here.
            key={`${character}-${String(index)}`}
            style={
              {
                '--f': String(fractions[index] ?? 1),
                '--i': String(index),
              } as CSSProperties
            }
          >
            {character}
          </span>
        ))}
      </span>
    </span>
  )
}

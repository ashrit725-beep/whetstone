'use client'

/**
 * The honing word: the page's one bold element.
 *
 * Each letter carries `--f`, the fraction of ink in its fill, and every letter
 * keeps the same stroke. The word therefore travels from outline to solid
 * across its own length, which is the grit scale drawn as a word: 120 is the
 * first letter, 8000 is the last. The same ramp draws every grit reading in
 * the product, so the identity and the data are one device.
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
 *   It runs once per session. `sessionStorage` gates the attribute that arms
 *   the CSS, so a reload inside the session and an App Router remount both
 *   leave it still.
 *
 * Keyboard contract: none. This is text inside a heading and takes no focus.
 */

import { useEffect, useRef, type CSSProperties } from 'react'
import styles from './paper.module.css'

const SESSION_KEY = 'ws-hone'

export interface HoneProps {
  /** The word to hone, including any trailing punctuation. Keep it to one word. */
  word: string
}

/**
 * The ink ramp. Letters ease from outline to solid; trailing punctuation
 * belongs to the last letter and arrives with it.
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
    const t = index / span
    return Math.round(t ** 1.8 * 100) / 100
  })
}

export function Hone({ word }: HoneProps) {
  const ref = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    try {
      if (window.sessionStorage.getItem(SESSION_KEY) !== null) return
      window.sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      // Private-mode storage throws on read. Arming once per mount is still
      // bounded and still cannot replay on a client-side navigation.
    }
    node.setAttribute('data-ink', '')
  }, [])

  const fractions = inkFractions(word)

  return (
    <>
      <span className="sr-only">{word}</span>
      <span ref={ref} aria-hidden="true" className={`hone ${styles.hone}`}>
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
    </>
  )
}

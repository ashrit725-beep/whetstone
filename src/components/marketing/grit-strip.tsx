/**
 * The grit scale in one line: five swatches, five numerals, five words.
 *
 * The compact form, for a page that has to say what the numbers are without
 * spending a section on it. The full five-column band, with what is standing on
 * each step, lives on How it works.
 */

import type { CSSProperties } from 'react'
import { GRIT_STAGES } from '@/lib/taxonomy'
import styles from './paper.module.css'

/** How solid each of the five cells is. Coarse to fine, concept to shipped. */
const DENSITY = [0.1, 0.26, 0.48, 0.74, 1] as const

export function GritStrip() {
  return (
    <ol className={styles.gritStrip} aria-label="The grit scale, 120 to 8000">
      {GRIT_STAGES.map((stage, index) => (
        <li key={stage.key}>
          <span
            aria-hidden="true"
            className={styles.gritSwatch}
            style={{ '--d': String(DENSITY[index] ?? 0.1) } as CSSProperties}
          />
          <span className="tnum block text-base text-ink" style={{ fontVariationSettings: '"wght" 750' }}>
            {stage.grit}
          </span>
          <span className="block text-2xs uppercase text-ink-3" style={{ fontVariationSettings: '"wght" 650' }}>
            {stage.label}
          </span>
        </li>
      ))}
    </ol>
  )
}

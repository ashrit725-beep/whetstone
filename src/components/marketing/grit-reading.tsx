/**
 * A grit reading: five cells of ink density beside the literal numeral.
 *
 * The cells are the same ramp as the honing word, so "how finished is this"
 * looks the same everywhere it is said. The project's own step is outlined and
 * taller than its neighbours, which means the reading survives greyscale, a
 * monochrome printer and every form of colour blindness: the shape carries it,
 * the density only reinforces it.
 *
 * The numeral is always present. A picture of a number is not a number.
 */

import type { CSSProperties } from 'react'
import { GRIT_STAGES } from '@/lib/taxonomy'
import styles from './paper.module.css'

/** How solid each of the five cells is. Coarse to fine, concept to shipped. */
const DENSITY = [0.1, 0.26, 0.48, 0.74, 1] as const

export interface GritReadingProps {
  /** 120, 400, 1000, 3000 or 8000. */
  value: number
  /** Show the stage word after the numeral. */
  showLabel?: boolean
}

export function GritReading({ value, showLabel = true }: GritReadingProps) {
  const index = GRIT_STAGES.findIndex((stage) => stage.grit === value)
  const step = index >= 0 ? index : 0
  const label = GRIT_STAGES[step]?.label ?? 'Concept'

  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <span className="sr-only">
        Grit {value}, {label.toLowerCase()}, step {step + 1} of 5
      </span>

      <span aria-hidden="true" className={styles.cells}>
        {DENSITY.map((density, cell) => (
          <i
            key={density}
            className="grit-cell"
            data-on={cell === step ? 'true' : undefined}
            style={{ '--d': String(density) } as CSSProperties}
          />
        ))}
      </span>

      <span aria-hidden="true" className="tnum text-xs" style={{ fontVariationSettings: '"wght" 700' }}>
        {value}
      </span>

      {showLabel ? (
        <span
          aria-hidden="true"
          className="text-2xs uppercase text-ink-3"
          style={{ fontVariationSettings: '"wght" 650' }}
        >
          {label}
        </span>
      ) : null}
    </span>
  )
}

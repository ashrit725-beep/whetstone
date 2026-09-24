/**
 * One scale, 120 to 8000, explained once and drawn in ink.
 *
 * Each step is one column, on the page's own grid: the band and its top rule run
 * edge to edge, the five columns sit inside `max-w-page` with the rest of the
 * page. They used to pad to `--pad-inline` instead, which is the band's own edge
 * padding and not the page gutter, so at 1440 the first column began 32px left
 * of the heading above it and at 1920 it began 272px left of it.
 *
 * The density swatch is a fixed 16px square, the same cell the grit reading
 * draws, and the number of projects standing on the step is printed as a
 * numeral. It used to be a bar whose height was the count and whose ink was the
 * step, which encoded two different facts in one mark and read as a row of paint
 * swatches.
 */

import NextLink from 'next/link'
import type { CSSProperties } from 'react'
import type { ScaleStep } from '@/app/(marketing)/_data'
import styles from './paper.module.css'

const DENSITY: Record<string, number> = {
  concept: 0.1,
  prototype: 0.26,
  beta: 0.48,
  release_candidate: 0.74,
  shipped: 1,
}

export interface ScaleStripProps {
  steps: readonly ScaleStep[]
}

export function ScaleStrip({ steps }: ScaleStripProps) {
  return (
    <div className={styles.scaleBand}>
      <ol className={styles.scale} aria-label="The grit scale, and what is standing on each step">
        {steps.map((step) => (
          <li key={step.stageKey} className={styles.scaleStep}>
            <span
              aria-hidden="true"
              className={styles.scaleSwatch}
              style={{ '--d': String(DENSITY[step.stageKey] ?? 0.1) } as CSSProperties}
            />

            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                className="tnum text-lg text-ink"
                style={{ fontVariationSettings: '"wght" 800' }}
              >
                {step.grit}
              </span>
              <span
                className="text-2xs uppercase text-ink-3"
                style={{ fontVariationSettings: '"wght" 650' }}
              >
                {step.label}
              </span>
            </p>

            <p className="text-xs text-ink-2">{step.definition}</p>

            <p className="text-xs text-ink-3">
              {step.count > 0 && step.exampleSlug !== null ? (
                <>
                  <span className="tnum text-ink-2">{step.count.toLocaleString('en')}</span>
                  {step.count === 1 ? ' project here, ' : ' projects here, '}
                  <NextLink href={`/p/${step.exampleSlug}`} className="link text-ink-2">
                    {step.exampleTitle}
                  </NextLink>{' '}
                  among them.
                </>
              ) : (
                'Nothing sits here today. Posting here puts you at the front of it.'
              )}
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}

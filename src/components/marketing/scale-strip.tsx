/**
 * One scale, 120 to 8000, explained once and drawn in ink.
 *
 * Each step is one column. The column's ink density is the step: 120 is the
 * faintest wash, 8000 is solid. How far the ink rises is how many published
 * projects are standing on that step right now, so the strip is a reading of
 * the site rather than a diagram of the idea. Both facts are stated in words
 * underneath, because a bar is not a number.
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
  const busiest = steps.reduce((most, step) => Math.max(most, step.count), 0)

  return (
    <ol className={styles.scale} aria-label="The grit scale, and what is standing on each step">
      {steps.map((step) => {
        const share = busiest === 0 ? 0 : Math.round((step.count / busiest) * 100)
        return (
          <li key={step.stageKey} className={styles.scaleStep}>
            <span
              aria-hidden="true"
              className={styles.scaleBar}
              style={{ '--d': String(DENSITY[step.stageKey] ?? 0.1) } as CSSProperties}
            >
              <i style={{ blockSize: `${String(Math.max(share, 4))}%` }} />
            </span>

            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="tnum text-lg text-ink" style={{ fontVariationSettings: '"wght" 800' }}>
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
        )
      })}
    </ol>
  )
}

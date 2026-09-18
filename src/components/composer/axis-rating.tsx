'use client'

/**
 * One area's rating: where it sits for this reviewer, 1 to 5, between the two
 * anchors the project type wrote for it.
 *
 * Keyboard contract: one native radio per step in one named group, so the
 * browser owns the behaviour. Tab enters at the checked cell (or the first), the
 * arrows move and select, Tab leaves. Each input lies invisibly over its own
 * cell, so a click, a tap and a screen reader's cursor all land on the real
 * control, and the form posts `rating-<axis>` with JavaScript turned off.
 *
 * Why this and not the grit selector: grit says how finished a whole build is,
 * and a rating says how one area of it went. The composer used to ask the first
 * and store the second, so a reviewer who picked "Release candidate" appeared on
 * the project page as "4 of 5" under end labels they had never been shown.
 *
 * Optional on purpose. An area left alone is stored as nothing, never as a 3, so
 * "I did not get that far" cannot drag the median. Once scripts run, Clear
 * empties the group, which a native radio group cannot do on its own.
 */

import { useRef } from 'react'
import { cn, inSentence } from '@/lib/utils'

export interface AxisRatingProps {
  /** Posted with the form: `rating-<axis key>`. */
  name: string
  /** The area, as a heading would print it. Names the Clear button. */
  axisLabel: string
  lowLabel: string
  highLabel: string
  /** The top of the scale. The server reads the same constant it came from. */
  scale: number
  value: number | null
  onChange: (next: number | null) => void
}

export function AxisRating({ name, axisLabel, lowLabel, highLabel, scale, value, onChange }: AxisRatingProps) {
  const group = useRef<HTMLDivElement | null>(null)
  const steps = Array.from({ length: scale }, (_, i) => i + 1)

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2xs border-0 p-0">
      <legend className="mb-2xs flex flex-wrap items-baseline gap-xs p-0 text-base text-ink">
        Your rating{' '}
        <span className="text-xs text-ink-3">optional</span>
      </legend>

      <div className="flex items-start gap-sm">
        <div className="flex w-full max-w-[25rem] min-w-0 flex-col gap-2xs">
          <div
            ref={group}
            className="grid border border-rule-2 bg-paper-hi"
            style={{ gridTemplateColumns: `repeat(${String(scale)}, minmax(0, 1fr))` }}
          >
            {steps.map((step) => (
              <label
                key={step}
                className={cn(
                  'relative flex h-11 cursor-pointer items-center justify-center text-md text-ink',
                  'transition-[background-color,color] duration-[var(--dur-1)] ease-[var(--ease)]',
                  'hover:bg-paper-sub has-checked:bg-ink has-checked:text-paper-hi has-checked:hover:bg-ink',
                  // The input is invisible, so the ring is drawn on its cell and
                  // lifted over the neighbour that would otherwise paint across it.
                  'has-focus-visible:z-10 has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-ink',
                  step < scale && 'border-e border-rule-2',
                )}
              >
                <input
                  type="radio"
                  name={name}
                  value={step}
                  checked={value === step}
                  onChange={() => {
                    onChange(step)
                  }}
                  className="absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0"
                />
                <span className="tnum" style={{ fontVariationSettings: '"wght" 600' }}>
                  {step}
                </span>
                {step === 1 ? <span className="sr-only">{`, ${lowLabel}`}</span> : null}
                {step === scale ? <span className="sr-only">{`, ${highLabel}`}</span> : null}
              </label>
            ))}
          </div>

          {/* The anchors, under the cells they belong to. The radios already carry
              them in their names, so this copy is for the eye only. */}
          <p aria-hidden="true" className="flex justify-between gap-md text-xs text-ink-3">
            <span className="max-w-[50%]">{lowLabel}</span>
            <span className="max-w-[50%] text-end">{highLabel}</span>
          </p>
        </div>

        {/* Holds its place when there is nothing to clear, so choosing a cell
            never narrows the strip under the pointer. */}
        <button
          type="button"
          onClick={() => {
            onChange(null)
            group.current?.querySelector('input')?.focus()
          }}
          className={cn('ws-scaffold ws-btn-quiet shrink-0', value === null && 'invisible')}
        >
          Clear
          <span className="sr-only">{` the ${inSentence(axisLabel)} rating`}</span>
        </button>
      </div>
    </fieldset>
  )
}

export default AxisRating

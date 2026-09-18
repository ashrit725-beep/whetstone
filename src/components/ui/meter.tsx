/**
 * Meter: a measurement inside a known range.
 *
 * This is not Progress. A meter says “how much of the thing is there right
 * now” (grit position, sentiment split, storage used). It never implies a task
 * that will finish, and it carries `role="meter"`, not `role="progressbar"`.
 *
 * Keyboard contract: none. A meter is not focusable and takes no input. When it
 * is segmented, the bar is decorative and every number lives in the visible
 * legend, so the whole thing survives greyscale (contract §2.4 rule 8).
 *
 * Motion: none. A measurement renders final on first paint.
 */

import { clamp, cn } from '@/lib/utils'

export type MeterTone = 'accent' | 'positive' | 'critical' | 'straw' | 'neutral'

const FILL: Record<MeterTone, string> = {
  accent: 'bg-accent',
  positive: 'bg-positive',
  critical: 'bg-critical',
  straw: 'bg-straw-fill',
  neutral: 'bg-hatch',
}

export interface MeterSegment {
  /** Shown in the legend beside its numeral. Required: hue never carries meaning alone. */
  label: string
  /** In the same unit as every other segment. Shares are computed from the sum. */
  value: number
  tone?: MeterTone
}

export interface MeterProps {
  /** Single-value form. Ignored when `segments` is given. */
  value?: number
  min?: number
  max?: number
  /**
   * The value this measurement is aiming at. Used to pick the tone: at or above
   * optimum reads positive, below half of optimum reads critical, anything
   * between reads accent. Pass `tone` to override.
   */
  optimum?: number
  /** Stacked form: the dashboard theme rollup. Each segment carries its own numeral. */
  segments?: readonly MeterSegment[]
  /** Visible label above the bar. */
  label: string
  /** Spoken instead of the raw number, e.g. “Balance: 3000 of 8000”. */
  valueText?: string
  tone?: MeterTone
  className?: string
}

const DEFAULT_SEGMENT_TONES: readonly MeterTone[] = ['positive', 'neutral', 'critical', 'accent', 'straw']

function toneFor(value: number, min: number, max: number, optimum: number | undefined): MeterTone {
  if (optimum === undefined) return 'accent'
  if (value >= optimum) return 'positive'
  if (value <= min + (optimum - min) / 2) return 'critical'
  return 'accent'
}

export function Meter({
  value = 0,
  min = 0,
  max = 100,
  optimum,
  segments,
  label,
  valueText,
  tone,
  className,
}: MeterProps) {
  if (segments && segments.length > 0) {
    const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0)
    const shares = segments.map((s, i) => {
      const share = total > 0 ? Math.max(0, s.value) / total : 0
      return {
        label: s.label,
        value: s.value,
        percent: Math.round(share * 100),
        share,
        tone: s.tone ?? DEFAULT_SEGMENT_TONES[i % DEFAULT_SEGMENT_TONES.length] ?? 'neutral',
      }
    })

    return (
      <div className={cn('flex flex-col gap-xs', className)}>
        <span className="text-sm text-text-2">{label}</span>
        <div
          aria-hidden="true"
          className="flex w-full overflow-hidden rounded-xs border border-border-hair bg-surface-0"
          style={{ blockSize: '0.75rem' }}
        >
          {shares.map((s) => (
            <span
              key={s.label}
              className={cn('block h-full', FILL[s.tone])}
              style={{ inlineSize: `${s.share * 100}%` }}
            />
          ))}
        </div>
        <dl className="m-0 flex flex-wrap gap-x-md gap-y-2xs">
          {shares.map((s) => (
            <div key={s.label} className="flex items-baseline gap-2xs">
              <dt className="text-xs text-text-3">{s.label}</dt>
              <dd className="tnum m-0 text-xs text-text-1">{s.percent}%</dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }

  const safeMin = min
  const safeMax = max > min ? max : min + 1
  const current = clamp(value, safeMin, safeMax)
  const share = (current - safeMin) / (safeMax - safeMin)
  const resolvedTone = tone ?? toneFor(current, safeMin, safeMax, optimum)
  const text = valueText ?? `${label}: ${current} of ${safeMax}`

  return (
    <div className={cn('flex flex-col gap-2xs', className)}>
      <div className="flex items-baseline justify-between gap-sm">
        <span className="text-sm text-text-2">{label}</span>
        <span className="tnum text-xs text-text-1" aria-hidden="true">
          {current}
          <span className="text-text-3">{` of ${safeMax}`}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-valuenow={current}
        aria-valuemin={safeMin}
        aria-valuemax={safeMax}
        aria-valuetext={text}
        aria-label={label}
        className="w-full overflow-hidden rounded-xs border border-border-hair bg-surface-0"
        style={{ blockSize: '0.75rem' }}
      >
        <span className={cn('block h-full', FILL[resolvedTone])} style={{ inlineSize: `${share * 100}%` }} />
      </div>
    </div>
  )
}

export default Meter

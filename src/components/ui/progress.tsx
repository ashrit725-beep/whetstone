/**
 * Progress: a determinate task moving toward completion.
 *
 * This is not Meter. Progress is “how far through the upload are we”; Meter is
 * “how full is the disk”. They carry different ARIA roles and are never
 * interchangeable. If the answer is unknowable, use a Spinner with a label,
 * not a fake bar.
 *
 * Keyboard contract: none. Progress is not focusable and takes no input.
 *
 * Motion: the fill animates `transform: scaleX`, never `width` (contract §6.3),
 * for 240ms with the entrance ease, and only where motion is welcome.
 */

import { clamp, cn } from '@/lib/utils'

export type ProgressTone = 'accent' | 'positive' | 'critical'

const FILL: Record<ProgressTone, string> = {
  accent: 'bg-accent',
  positive: 'bg-positive',
  critical: 'bg-critical',
}

export interface ProgressProps {
  /** Where the task is now, in the same unit as `max`. */
  value: number
  max?: number
  /** Visible above the bar. Name the task, not the widget. */
  label: string
  /** Spoken instead of the raw percentage, e.g. “3 of 8 files uploaded”. */
  valueText?: string
  /** Hide the numeral beside the label. The bar then carries no readable value, so only do this when the value is stated elsewhere. */
  hideValue?: boolean
  tone?: ProgressTone
  className?: string
  id?: string
}

export function Progress({
  value,
  max = 100,
  label,
  valueText,
  hideValue = false,
  tone = 'accent',
  className,
  id,
}: ProgressProps) {
  const safeMax = max > 0 ? max : 100
  const current = clamp(value, 0, safeMax)
  const ratio = current / safeMax
  const percent = Math.round(ratio * 100)
  const text = valueText ?? `${percent}%`

  return (
    <div className={cn('flex flex-col gap-2xs', className)} id={id}>
      <div className="flex items-baseline justify-between gap-sm">
        <span className="text-sm text-text-2">{label}</span>
        {hideValue ? null : (
          <span className="tnum text-xs text-text-3" aria-hidden="true">
            {text}
          </span>
        )}
      </div>
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuetext={text}
        aria-label={label}
        className="w-full overflow-hidden rounded-xs border border-border-hair bg-surface-0"
        style={{ blockSize: '0.5rem' }}
      >
        <div
          className={cn('h-full w-full origin-left rounded-xs motion-safe:transition-transform motion-safe:duration-[240ms] motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]', FILL[tone])}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
    </div>
  )
}

export default Progress

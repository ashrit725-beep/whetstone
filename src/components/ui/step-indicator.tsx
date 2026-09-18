/**
 * StepIndicator: where you are in a multi-step flow.
 *
 * Keyboard contract: an ordered list. Steps you have already completed are
 * links and are reachable by Tab; the current step and steps ahead of you are
 * text. Nothing here is a button that looks like a link.
 *
 * Contract notes: no numbered circles and no `01 / 02 / 03` markers (§8.3.33).
 * The only numeric markers in this product are the five real grit values. State
 * is carried by a word ("Done", "You are here", "Not started") plus the
 * grind-mark on the current step, never by a coloured dot (§5.1, §2.4.8).
 *
 * Where the row does not fit, it becomes one line, "Step 2 of 6" and the step's
 * name, over a 2px rule drawn to the same fraction, with a link back to the step
 * before it.
 */

import { Check } from 'lucide-react'
import Link from 'next/link'
import { cn, inSentence } from '@/lib/utils'

export type StepStatus = 'done' | 'current' | 'ahead'

export interface Step {
  id: string
  label: string
  /** Only followed for completed steps. */
  href?: string
  status: StepStatus
}

const STATUS_WORD: Record<StepStatus, string> = {
  done: 'Done',
  current: 'You are here',
  ahead: 'Not started',
}

export interface StepIndicatorProps {
  steps: readonly Step[]
  /** Names the flow, e.g. "Publish a project". */
  label: string
  className?: string
}

export function StepIndicator({ steps, label, className }: StepIndicatorProps) {
  const index = steps.findIndex((step) => step.status === 'current')
  const current = steps[index]
  const previous = index > 0 ? steps[index - 1] : undefined
  // The row needs every status word on one line. Six steps need 42rem for that
  // and two need far less, so the switch reads the nav's own width, not the
  // viewport's: stacked, six steps pushed the first question below the fold.
  const wide = steps.length > 3

  return (
    <nav aria-label={label} className={cn('@container w-full', className)}>
      {current ? (
        <div className={cn('flex flex-col gap-2xs', wide ? '@min-[42rem]:hidden' : '@min-[26rem]:hidden')}>
          <p className="flex flex-wrap items-center justify-between gap-x-sm">
            <span className="flex items-baseline gap-xs" aria-current="step">
              <span className="text-xs text-text-3">{`Step ${String(index + 1)} of ${String(steps.length)}`}</span>
              <span className="text-sm text-text-1" style={{ fontVariationSettings: '"wdth" 94, "wght" 600' }}>
                {current.label}
              </span>
            </span>
            {previous?.status === 'done' && previous.href ? (
              <Link href={previous.href} className="inline-flex min-h-11 items-center text-xs text-text-2 underline">
                {`Back to ${inSentence(previous.label)}`}
              </Link>
            ) : null}
          </p>
          <span aria-hidden="true" className="block h-[2px] bg-border-hair">
            <span
              className="block h-full bg-text-1"
              style={{ inlineSize: `${String(((index + 1) / steps.length) * 100)}%` }}
            />
          </span>
        </div>
      ) : null}

      <ol
        className={cn(
          'flex-row gap-xs',
          !current ? 'flex' : wide ? 'hidden @min-[42rem]:flex' : 'hidden @min-[26rem]:flex',
        )}
      >
        {steps.map((step) => {
          const isCurrent = step.status === 'current'
          const body = (
            <span className="flex w-full flex-col gap-3xs">
              <span className="flex items-center gap-2xs">
                {step.status === 'done' ? (
                  <Check size={16} strokeWidth={1.5} aria-hidden="true" className="text-positive" />
                ) : null}
                <span
                  className={cn('text-sm', isCurrent ? 'text-text-1' : 'text-text-2')}
                  style={{ fontVariationSettings: '"wdth" 94, "wght" 600' }}
                >
                  {step.label}
                </span>
              </span>
              <span className="text-xs whitespace-nowrap text-text-3">{STATUS_WORD[step.status]}</span>
            </span>
          )

          return (
            <li
              key={step.id}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'flex min-h-2xl flex-1 items-center border-l px-sm py-xs',
                // The grind-mark sits inside the step's own rule; inking that
                // rule too makes one solid bar rather than a grey line beside
                // a black one.
                isCurrent ? 'border-ink grind-mark-on' : 'border-border-hair',
              )}
            >
              {step.status === 'done' && step.href ? (
                <Link
                  href={step.href}
                  className="w-full no-underline transition-[color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:underline"
                >
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

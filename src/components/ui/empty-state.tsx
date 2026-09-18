'use client'

/**
 * EmptyState: three beats and one button.
 *
 * Beat 1, the title: what is empty. Beat 2, the body: why that matters here.
 * Beat 3: one button naming the single next action. No illustration, no shrug,
 * no “No data available”, no exclamation mark (contract §7.1 rule 5).
 *
 * Write the copy for the situation, not for the component. “No projects match
 * Game + Needs playtesting + 8000 grit” is an empty state; “Nothing here” is
 * not.
 *
 * Keyboard contract:
 *   Tab            reaches the primary action, then the secondary, in that order.
 *   Enter / Space  activate the focused action.
 * Nothing traps focus and nothing auto-focuses: an empty state is a place you
 * land, not a thing that interrupts you.
 */

import { CircleCheck, Inbox, SearchX, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MessageAction, type MessageActionSpec } from './banner'

export type EmptyStateVariant = 'default' | 'filtered' | 'success'

const VARIANT: Record<EmptyStateVariant, { icon: LucideIcon; ink: string }> = {
  default: { icon: Inbox, ink: 'text-text-3' },
  filtered: { icon: SearchX, ink: 'text-text-3' },
  /* Inbox zero is a result, not a failure. The positive hue says so. */
  success: { icon: CircleCheck, ink: 'text-positive' },
}

export interface EmptyStateProps {
  /** Overrides the variant’s icon. Keep it literal: no rocket, no sparkle. */
  icon?: LucideIcon
  /** What is empty, stated specifically. */
  title: string
  /** Why it matters and what changes it. One or two sentences. */
  body: string
  /** The single next action. */
  primaryAction?: MessageActionSpec
  /** An escape hatch, when there genuinely is a second path. */
  secondaryAction?: MessageActionSpec
  variant?: EmptyStateVariant
  /** Keeps the document outline sequential. Defaults to h2. */
  headingLevel?: 2 | 3 | 4
  className?: string
}

export function EmptyState({
  icon,
  title,
  body,
  primaryAction,
  secondaryAction,
  variant = 'default',
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const config = VARIANT[variant]
  const Icon = icon ?? config.icon
  const Heading = `h${headingLevel}` as const

  return (
    <section
      className={cn(
        'flex flex-col items-start gap-sm rounded-md border border-border-hair bg-surface-2 p-xl',
        className,
      )}
      aria-live="polite"
    >
      <Icon size={24} strokeWidth={1.5} aria-hidden="true" className={cn('shrink-0', config.ink)} />

      <div className="flex flex-col gap-2xs">
        <Heading className="text-md text-text-1" style={{ fontVariationSettings: '"wdth" 100, "wght" 600' }}>
          {title}
        </Heading>
        <p className="measure-ui text-sm text-text-2">{body}</p>
      </div>

      {primaryAction || secondaryAction ? (
        <div className="mt-2xs flex flex-wrap items-center gap-md">
          {primaryAction ? <MessageAction action={{ ...primaryAction, primary: true }} /> : null}
          {secondaryAction ? <MessageAction action={{ ...secondaryAction, primary: false }} /> : null}
        </div>
      ) : null}
    </section>
  )
}

export default EmptyState

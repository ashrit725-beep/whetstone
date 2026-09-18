/**
 * Separator: a hairline rule.
 *
 * Keyboard contract: none. A decorative separator is removed from the
 * accessibility tree entirely; a labelled one is announced as a group boundary
 * and is never focusable.
 *
 * Contract note (§5.2): `border-hair` is decorative and carries no information.
 * If a boundary must be perceived to operate something, that is a control edge
 * (`border-control`), not a separator.
 */

import { cn } from '@/lib/utils'

export interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical'
  /** Decorative separators are hidden from assistive tech. Default true. */
  decorative?: boolean
  /** Announced name for a meaningful separator, e.g. "Older feedback". */
  label?: string
  className?: string
}

export function Separator({
  orientation = 'horizontal',
  decorative = true,
  label,
  className,
}: SeparatorProps) {
  const isVertical = orientation === 'vertical'
  return (
    <div
      role={decorative && !label ? 'none' : 'separator'}
      aria-hidden={decorative && !label ? true : undefined}
      aria-orientation={!decorative || label ? orientation : undefined}
      aria-label={label}
      className={cn(
        'shrink-0 bg-border-hair',
        isVertical ? 'h-full w-px self-stretch' : 'h-px w-full',
        className,
      )}
    />
  )
}

/**
 * A rule with a caption sitting in it, for breaking a long list into named runs
 * ("Today", "Earlier"). The text is real content, so it is not hidden.
 */
export function SeparatorLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-sm', className)}>
      <span className="h-px grow bg-border-hair" aria-hidden="true" />
      <span
        className="text-2xs text-text-3"
        style={{ fontVariationSettings: '"wdth" 87, "wght" 600' }}
      >
        {children}
      </span>
      <span className="h-px grow bg-border-hair" aria-hidden="true" />
    </div>
  )
}

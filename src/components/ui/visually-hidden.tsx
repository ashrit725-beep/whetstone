/**
 * VisuallyHidden: text for assistive technology only.
 *
 * Keyboard contract: none. This element is never focusable and never contains a
 * focusable child. If you need a control that appears on focus, use the
 * `.skip-link` pattern in globals.css instead, which un-hides itself on :focus.
 */

import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface VisuallyHiddenProps {
  children: ReactNode
  /** Defaults to `span`. Use `div` inside flow content, `caption` inside a table. */
  as?: ElementType
  className?: string
}

export function VisuallyHidden({ children, as, className }: VisuallyHiddenProps) {
  const Tag: ElementType = as ?? 'span'
  return <Tag className={cn('sr-only', className)}>{children}</Tag>
}

/**
 * A polite live region. Mount it once near the thing it describes and write the
 * result into it; screen readers announce without moving focus.
 */
export function LiveAnnouncer({
  children,
  assertive = false,
}: {
  children: ReactNode
  assertive?: boolean
}) {
  return (
    <div
      className="sr-only"
      role="status"
      aria-live={assertive ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {children}
    </div>
  )
}

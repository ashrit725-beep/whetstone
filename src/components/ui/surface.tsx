/**
 * Surface: the elevation primitive.
 *
 * Keyboard contract: none. A Surface is a container, never a control. If a
 * surface needs to be clickable it is a Card with a real <a> inside it.
 *
 * Contract note (§2.4): dark reads elevation as a lighter fill (five steps,
 * zero shadow); light collapses levels 2/3/4 onto one fill and reads elevation
 * from the 1px hairline instead, plus `shadow-overlay` at level 4 only. Both of
 * those fall out of the tokens, so this component only picks the step and never
 * branches on theme.
 */

import type { ElementType, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type SurfaceLevel = 0 | 1 | 2 | 3 | 4
export type SurfaceRadius = 'none' | 'xs' | 'sm' | 'md' | 'lg'

/** Every fill sets its own ink in the same rule (§2.4.9). */
const LEVEL_CLASS: Record<SurfaceLevel, string> = {
  0: 'bg-surface-0 text-text-1',
  1: 'bg-surface-1 text-text-1',
  2: 'bg-surface-2 text-text-1',
  3: 'bg-surface-3 text-text-1',
  4: 'bg-surface-4 text-text-1',
}

const RADIUS_CLASS: Record<SurfaceRadius, string> = {
  none: 'rounded-none',
  xs: 'rounded-xs',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
}

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  /** 0 recessed · 1 page ground · 2 raised · 3 card · 4 top of stack. */
  level?: SurfaceLevel
  /** 1px hairline. Off only when a parent already draws the boundary. */
  border?: boolean
  radius?: SurfaceRadius
  as?: ElementType
}

export function Surface({
  level = 3,
  border = true,
  radius = 'md',
  as,
  className,
  children,
  ...rest
}: SurfaceProps) {
  const Tag: ElementType = as ?? 'div'
  return (
    <Tag
      className={cn(
        LEVEL_CLASS[level],
        RADIUS_CLASS[radius],
        border && 'border border-border-hair',
        // Level 4 is the top of the stack: modal, sheet, popover, toast. It is
        // the only level that carries a shadow, and the only place the shadow
        // token is legal at all (§5.3).
        level === 4 && 'shadow-overlay',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/**
 * A recessed well: code blocks, input interiors, the inside of a scroll region.
 * Always level 0, always square-ish, never elevated.
 */
export function Well({ className, children, ...rest }: Omit<SurfaceProps, 'level'>) {
  return (
    <Surface level={0} radius="sm" className={className} {...rest}>
      {children}
    </Surface>
  )
}

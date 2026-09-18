/**
 * Card: a bounded block of related content. `surface-3`, 1px hairline, 8px
 * radius, and no shadow, ever (§5.3).
 *
 * Keyboard contract: the card itself is never a tab stop. An interactive card
 * contains exactly one real <a> (CardLink) whose ::after is stretched over the
 * whole card, so the pointer target is the card and the keyboard target is the
 * link. The focus ring is drawn on the card via :focus-within, so a keyboard
 * user sees the whole block outlined rather than a word of the title. Any other
 * control inside an interactive card (a menu button, a secondary link) must set
 * `relative z-base` so it sits above the stretched pseudo-element and stays
 * separately reachable.
 *
 * Never: a <div onClick>, a transform, a scale, a lift, or a card inside a card
 * (§4.4, §5.2, §8.4.37).
 */

import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Adds the hover step and the :focus-within ring. Requires one CardLink. */
  interactive?: boolean
  /** The one open ask / selected thread in this view. Draws the grind-mark. */
  selected?: boolean
  as?: ElementType
}

export function Card({
  interactive = false,
  selected = false,
  as,
  className,
  children,
  ...rest
}: CardProps) {
  const Tag: ElementType = as ?? 'div'
  return (
    <Tag
      data-selected={selected ? 'true' : undefined}
      className={cn(
        'relative isolate rounded-md border bg-surface-3 text-text-1',
        selected ? 'border-border-control grind-mark-on' : 'border-border-hair',
        interactive && [
          // One effect only: the background steps up exactly one surface, the
          // hairline firms up. No translate, no scale, no shadow.
          'transition-[background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
          // Tailwind v4 already scopes `hover:` inside @media (hover: hover),
          // so a touch device never sticks in the hover state.
          'hover:border-border-control hover:bg-surface-4',
          // Focus lives on the block, not on the word.
          'has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-focus has-[a:focus-visible]:outline-offset-2',
        ],
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export interface CardLinkProps {
  href: string
  children: ReactNode
  className?: string
  /** Set when the visible text is not a sufficient name on its own. */
  'aria-label'?: string
}

/**
 * The single real link inside an interactive Card. Its ::after covers the card,
 * which is what makes the whole block clickable without a div handler.
 */
export function CardLink({ href, children, className, ...rest }: CardLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'no-underline outline-none after:absolute after:inset-0 after:content-[""] hover:underline',
        className,
      )}
      {...rest}
    >
      {children}
    </Link>
  )
}

export function CardTitle({
  children,
  className,
  as,
}: {
  children: ReactNode
  className?: string
  as?: ElementType
}) {
  const Tag: ElementType = as ?? 'h3'
  return (
    <Tag className={cn('text-md text-text-1', className)}>{children}</Tag>
  )
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-md', className)}>{children}</div>
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-sm border-t border-border-hair px-md py-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Geometry-matched loading state. Static by design: the contract allows no
 * ambient or infinite animation, so a skeleton holds still and says what it is
 * waiting for (§6.3).
 */
export function CardSkeleton({
  lines = 2,
  className,
  label = 'Loading project',
}: {
  lines?: number
  className?: string
  label?: string
}) {
  const rows = Array.from({ length: lines }, (_, i) => i)
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cn('rounded-md border border-border-hair bg-surface-3 p-md', className)}
    >
      <span className="sr-only">{label}…</span>
      <div aria-hidden="true" className="space-y-xs">
        <div className="h-md w-1/2 rounded-xs bg-surface-4" />
        {rows.map((i) => (
          <div
            key={`skeleton-line-${String(i)}`}
            className={cn('h-sm rounded-xs bg-surface-2', i === lines - 1 ? 'w-2/3' : 'w-full')}
          />
        ))}
      </div>
    </div>
  )
}

'use client'

/**
 * The three primary destinations, in both registers the chrome needs.
 *
 * Keyboard contract
 *   Tab / Shift+Tab  move through the links in reading order.
 *   Enter            follows the focused link. Space does not: these are links.
 *   The current link carries `aria-current="page"`, so a screen reader says
 *   where it is without relying on the accent rule that says it visually.
 *
 * This is a client island purely so `usePathname()` stays correct across
 * client-side navigation. A layout does not re-render when only the page below
 * it changes, so a server-computed `aria-current` would go stale on the first
 * in-app link the reader follows.
 */

import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/** Archivo carries chrome labels at wght 600; the body sets
 *  `font-variation-settings`, and that property inherits, so a weight utility
 *  alone would be ignored. */
const LABEL_AXES = { fontVariationSettings: '"wdth" 100, "wght" 600' } as const

export interface NavItem {
  readonly href: string
  readonly label: string
}

/** The three primary destinations, in the bar and at the top of the sheet.
 *  Every href is a route that exists; a nav link to a 404 is banned outright
 *  (contract ban 32). Discussions ship at `/c`, not `/community`. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/discover', label: 'Discover' },
  { href: '/c', label: 'Discussions' },
  { href: '/experts', label: 'Experts' },
]

/** Destinations the bar has no room for. Rendered in the sheet only, under
 *  their own heading, so the bar keeps three and nothing is unreachable. */
export const SECONDARY_ITEMS: readonly NavItem[] = [
  { href: '/bounties', label: 'Bounties' },
]

function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

const BAR_LINK = cn(
  'ws-navlink relative inline-flex items-center self-stretch rounded-none px-sm text-sm',
  'transition-[color,background-color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
)

const STACK_LINK = cn(
  'relative flex min-h-2xl items-center rounded-none border-b border-border-hair px-md text-sm',
  'transition-[color,background-color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
)

export interface NavLinksProps {
  /** `bar` sits in the nav at ≥60rem. `stack` is the mobile sheet's list. */
  variant: 'bar' | 'stack'
  /** Defaults to the three primary destinations. */
  items?: readonly NavItem[]
  /** Called after a link is followed, so the mobile sheet can close itself. */
  onNavigate?: () => void
  className?: string
}

export function NavLinks({ variant, items = NAV_ITEMS, onNavigate, className }: NavLinksProps) {
  const pathname = usePathname()
  const bar = variant === 'bar'

  return (
    <ul
      className={cn(
        'm-0 flex list-none p-0',
        bar ? 'h-full items-stretch gap-xs' : 'flex-col',
        className,
      )}
    >
      {items.map((item) => {
        const current = isCurrent(pathname, item.href)
        return (
          <li key={item.href} className={bar ? 'flex' : undefined}>
            <NextLink
              href={item.href}
              aria-current={current ? 'page' : undefined}
              onClick={onNavigate}
              className={cn(
                bar ? BAR_LINK : STACK_LINK,
                /* Selection steps the ink, never fills the row (§2.4.6). */
                current
                  ? 'text-text-1'
                  : 'text-text-2 hover:bg-surface-3 hover:text-text-1',
                !bar && current ? 'grind-mark-on' : undefined,
              )}
              /* One weight in every state: a nav label that thickens on arrival
                 re-flows the whole bar. The accent rule and the ink step carry
                 the state instead. */
              style={LABEL_AXES}
            >
              {item.label}
            </NextLink>
          </li>
        )
      })}
    </ul>
  )
}

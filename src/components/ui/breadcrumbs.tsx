/**
 * Breadcrumbs: where this page sits.
 *
 * Keyboard contract: an ordered list of links inside a named <nav>. Tab reaches
 * each ancestor, Enter follows it. The current page is the last item, is not a
 * link, and carries `aria-current="page"`.
 *
 * Contract notes: the separator is a decorative icon, `aria-hidden`, so a
 * screen reader hears "Discover, Games, Sundermoon" rather than three slashes.
 * The trail collapses on narrow screens by scrolling inside its own region, not
 * by pushing the page sideways (§8.3.31).
 */

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface Crumb {
  label: string
  /** Omitted on the last crumb, which is the current page. */
  href?: string
}

export interface BreadcrumbsProps {
  items: readonly Crumb[]
  className?: string
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn('w-full', className)}>
      <ol
        data-scroll-region
        className="flex w-full items-center gap-2xs overflow-x-auto text-xs whitespace-nowrap"
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            // The current crumb is the one that gives way: it is usually the
            // longest and is repeated in full by the page heading below it, so
            // it ends in an ellipsis rather than being clipped mid-word.
            <li
              key={`${item.label}-${String(index)}`}
              className={cn('flex items-center gap-2xs', isLast && 'min-w-0')}
            >
              {index > 0 ? (
                <ChevronRight
                  size={16}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="shrink-0 text-text-3"
                />
              ) : null}
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={cn('text-text-1', isLast && 'truncate')}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="rounded-xs py-2xs text-text-3 no-underline transition-[color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-text-1 hover:underline"
                >
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

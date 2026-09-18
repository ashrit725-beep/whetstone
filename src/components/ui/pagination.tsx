/**
 * Pagination: page links, as links.
 *
 * Keyboard contract: a named <nav> containing an ordered list of links. Tab
 * reaches each, Enter follows. The current page is not a link; it is text with
 * `aria-current="page"`, so a keyboard user never tabs onto a control that does
 * nothing. Previous and Next are omitted at the ends rather than disabled,
 * because a disabled link is a dead tab stop.
 *
 * Contract notes: every target is ≥44px from padding alone, and neighbours sit
 * `gap-xs` (8px) apart (§0.11). Numerals are tabular so the strip does not
 * shuffle as the page number widens (§3.4).
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface PaginationProps {
  page: number
  pageCount: number
  /** Builds the href for a page number. Keeps every other search param intact. */
  hrefFor: (page: number) => string
  /** Names the set being paged, e.g. "Discover results". */
  label: string
  className?: string
}

const CELL =
  'inline-flex min-h-2xl min-w-2xl items-center justify-center rounded-sm border px-sm text-sm no-underline transition-[background-color,border-color,color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]'

/** A short window around the current page, with the ends always reachable. */
function pageWindow(page: number, pageCount: number): number[] {
  const pages = new Set<number>([1, pageCount, page])
  if (page - 1 >= 1) pages.add(page - 1)
  if (page + 1 <= pageCount) pages.add(page + 1)
  return [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b)
}

export function Pagination({ page, pageCount, hrefFor, label, className }: PaginationProps) {
  if (pageCount <= 1) return null
  const pages = pageWindow(page, pageCount)

  return (
    <nav aria-label={label} className={cn('w-full', className)}>
      <ol className="flex flex-wrap items-center gap-xs">
        {page > 1 ? (
          <li>
            <Link
              href={hrefFor(page - 1)}
              rel="prev"
              className={cn(CELL, 'border-border-control bg-surface-2 text-text-2 hover:border-border-strong hover:bg-surface-3 hover:text-text-1')}
            >
              <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Previous</span>
            </Link>
          </li>
        ) : null}

        {pages.map((p, index) => {
          const previous = pages[index - 1]
          const gap = previous !== undefined && p - previous > 1
          return (
            <li key={p} className="flex items-center gap-xs">
              {gap ? (
                <span aria-hidden="true" className="px-2xs text-xs text-text-3">
                  …
                </span>
              ) : null}
              {p === page ? (
                <span
                  aria-current="page"
                  className={cn(CELL, 'tnum border-accent bg-surface-3 text-text-1')}
                >
                  <span className="sr-only">Page </span>
                  {p}
                </span>
              ) : (
                <Link
                  href={hrefFor(p)}
                  className={cn(
                    CELL,
                    'tnum border-border-control bg-surface-2 text-text-2 hover:border-border-strong hover:bg-surface-3 hover:text-text-1',
                  )}
                >
                  <span className="sr-only">Page </span>
                  {p}
                </Link>
              )}
            </li>
          )
        })}

        {page < pageCount ? (
          <li>
            <Link
              href={hrefFor(page + 1)}
              rel="next"
              className={cn(CELL, 'border-border-control bg-surface-2 text-text-2 hover:border-border-strong hover:bg-surface-3 hover:text-text-1')}
            >
              <span>Next</span>
              <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </li>
        ) : null}
      </ol>

      <p className="mt-xs text-xs text-text-3">
        Page <span className="tnum">{page}</span> of <span className="tnum">{pageCount}</span>
      </p>
    </nav>
  )
}

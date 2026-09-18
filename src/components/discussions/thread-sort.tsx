/**
 * Sorting the channel register. URL state, read by a Server Component, so the
 * control is a set of links and not a client store (§9.7.47).
 *
 * Server-safe. The accent rule is already spent on the current channel,
 * so the selected sort is carried by the label stepping to text-1, a standing
 * underline, and `aria-current="true"`. No hue, no fill.
 *
 * Keyboard contract: Tab walks the links; Enter follows. Nothing is a button,
 * because activating one navigates.
 */

import { cn } from '@/lib/utils'
import { Link } from '@/components/ui'
import { THREAD_SORTS, type ThreadSortKey } from './labels'

export interface ThreadSortProps {
  channelSlug: string
  current: ThreadSortKey
}

export function ThreadSort({ channelSlug, current }: ThreadSortProps) {
  return (
    <nav aria-label="Sort the threads" className="flex flex-wrap items-center gap-xs">
      <span className="pe-2xs text-2xs text-text-3" style={{ fontVariationSettings: '"wdth" 87, "wght" 600' }}>
        Sort
      </span>
      {THREAD_SORTS.map((sort) => {
        const selected = sort.value === current
        return (
          <Link
            key={sort.value}
            href={sort.value === 'hot' ? `/c/${channelSlug}` : `/c/${channelSlug}?sort=${sort.value}`}
            variant="inline"
            aria-current={selected ? 'true' : undefined}
            className={cn(
              'inline-flex items-center px-sm py-sm text-sm whitespace-nowrap',
              selected ? 'text-text-1 underline' : 'text-text-2 no-underline hover:underline',
            )}
          >
            {sort.label}
          </Link>
        )
      })}
    </nav>
  )
}

export default ThreadSort

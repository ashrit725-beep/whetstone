/**
 * Moving between channels without going back to the index.
 *
 * Server-safe. Selection is carried three ways and never by a fill: a 2px
 * accent rule under the label, the label stepping from text-2 to text-1, and
 * `aria-current="page"` (§2.4.6). The rule is the one accent object on the
 * channel view. It sits under the label rather than on the leading edge because
 * this is a horizontal strip, where a vertical rule between two labels reads as
 * a divider; the top navigation marks its current item the same way, and the
 * profile tabs draw the same under-rule in ink. It is a border, not a shadow,
 * so it survives forced colours.
 *
 * The strip wraps rather than scrolls. As a scroll region it opened at
 * scrollLeft 0 and nothing brought the current channel into view, so at 390px
 * Craft, Show your work and About Whetstone were selected entirely off screen,
 * and at 768px the last label was cut at the edge. Six labels take two lines at
 * phone width, which costs less than a selection nobody can see.
 *
 * Keyboard contract: an ordinary list of links. Tab walks them in reading
 * order, Enter follows.
 */

import { cn } from '@/lib/utils'
import { Link } from '@/components/ui'

export interface ChannelNavItem {
  readonly slug: string
  readonly label: string
}

export interface ChannelNavProps {
  channels: readonly ChannelNavItem[]
  currentSlug: string
}

export function ChannelNav({ channels, currentSlug }: ChannelNavProps) {
  return (
    <nav aria-label="Channels" className="border-b border-border-hair">
      <ul className="flex flex-wrap items-center gap-x-xs">
        {channels.map((channel) => {
          const current = channel.slug === currentSlug
          return (
            <li key={channel.slug}>
              <Link
                href={`/c/${channel.slug}`}
                variant="inline"
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center rounded-b-none border-b-2 px-sm py-sm text-sm whitespace-nowrap no-underline',
                  current
                    ? 'border-accent text-text-1'
                    : 'border-transparent text-text-2 hover:text-text-1 hover:underline',
                )}
              >
                {channel.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default ChannelNav

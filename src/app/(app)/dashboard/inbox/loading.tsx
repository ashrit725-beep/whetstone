/**
 * Inbox loading state: the header rule, the filter chips, the bulk row and the
 * rows in whichever shape the inbox will draw at this width, so nothing jumps
 * when they land.
 */

import { Skeleton } from '@/components/ui'
import { InboxRowsSkeleton } from '@/components/dashboard/skeletons'

export default function InboxLoading() {
  return (
    <>
      <div aria-hidden="true" className="flex flex-col gap-2xs border-b border-border-hair pb-md">
        <Skeleton w="18ch" h="2.4414rem" />
        <Skeleton w="44ch" h="0.875rem" />
      </div>

      <div aria-hidden="true" className="flex flex-col gap-md">
        <div className="flex flex-wrap gap-xs">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} w="8rem" h="2.75rem" radius="xs" />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-md">
          <Skeleton w="18ch" h="0.875rem" />
          <div className="flex gap-xs">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} w="9rem" h="2.75rem" radius="sm" />
            ))}
          </div>
        </div>
      </div>

      <InboxRowsSkeleton label="Loading the feedback on your projects" />
    </>
  )
}

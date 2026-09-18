/**
 * Tracker loading state: the header rule, then five columns of three cards at
 * the real card geometry, so the board does not reflow when it arrives.
 */

import { Skeleton } from '@/components/ui'
import { BoardSkeleton } from '@/components/dashboard/skeletons'

export default function SuggestionsLoading() {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        Loading the tracker…
      </p>

      <div aria-hidden="true" className="flex flex-col gap-2xs border-b border-border-hair pb-md">
        <Skeleton w="20ch" h="2.4414rem" />
        <Skeleton w="46ch" h="0.875rem" />
      </div>

      <div className="flex flex-col gap-md">
        <Skeleton w="6ch" h="1.9531rem" />
        <BoardSkeleton />
      </div>
    </>
  )
}

/**
 * Insights loading state: the header rule, the project picker row and the
 * bars, at the heights the loaded page uses.
 *
 * It holds the same shapes the page does and no others: the week strip and the
 * ranked list moved back to the overview, and a skeleton for a pane that never
 * arrives is a promise the page does not keep.
 */

import { Skeleton } from '@/components/ui'
import { RollupSkeleton } from '@/components/dashboard/skeletons'

export default function InsightsLoading() {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        Loading your insights…
      </p>

      <div aria-hidden="true" className="flex flex-col gap-2xs border-b border-border-hair pb-md">
        <Skeleton w="9ch" h="2.4414rem" />
        <Skeleton w="34ch" h="0.875rem" />
      </div>

      <div aria-hidden="true" className="flex flex-wrap gap-xs">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} w="10rem" h="2.75rem" radius="xs" />
        ))}
      </div>

      <div className="flex flex-col gap-md">
        <Skeleton w="8ch" h="1.9531rem" />
        <RollupSkeleton />
      </div>
    </>
  )
}

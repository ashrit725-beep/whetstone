/**
 * Insights loading state: header rule, the five-figure week strip, the ranked
 * list and the bars, at the heights the loaded page uses.
 */

import { Skeleton } from '@/components/ui'
import {
  FixFirstSkeleton,
  MetricStripSkeleton,
  RollupSkeleton,
} from '@/components/dashboard/skeletons'

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

      <div className="flex flex-col gap-md">
        <Skeleton w="22ch" h="1.9531rem" />
        <MetricStripSkeleton />
      </div>

      <div className="flex flex-col gap-md">
        <Skeleton w="18ch" h="1.9531rem" />
        <FixFirstSkeleton />
      </div>

      <div className="flex flex-col gap-md">
        <Skeleton w="8ch" h="1.9531rem" />
        <RollupSkeleton />
      </div>
    </>
  )
}

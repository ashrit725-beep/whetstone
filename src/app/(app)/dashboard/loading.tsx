/**
 * Overview loading state. Box for box the geometry of `page.tsx`: the header
 * rule, the five-figure strip, the ranked list and the register, in that order
 * and at those heights, so nothing moves when the data lands.
 */

import { Skeleton } from '@/components/ui'
import {
  FixFirstSkeleton,
  MetricStripSkeleton,
  RegisterSkeleton,
} from '@/components/dashboard/skeletons'

export default function DashboardLoading() {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        Loading your dashboard…
      </p>

      <div
        aria-hidden="true"
        className="flex flex-col gap-2xs border-b border-border-hair pb-md"
      >
        <Skeleton w="14ch" h="2.4414rem" />
        <Skeleton w="38ch" h="0.875rem" />
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
        <RegisterSkeleton />
      </div>
    </>
  )
}

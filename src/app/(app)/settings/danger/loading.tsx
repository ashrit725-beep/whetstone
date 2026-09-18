/**
 * Danger zone, loading. Three sections at the heights the real ones use, so the
 * confirm field does not arrive under a pointer that was aimed somewhere else.
 */

import { Skeleton } from '@/components/ui'
import { DangerSkeleton } from '@/components/dashboard/skeletons'

export default function DangerSettingsLoading() {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        Loading the danger zone…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-2xs border-b border-border-hair pb-md">
        <Skeleton w="12ch" h="2.4414rem" />
        <Skeleton lines={2} w="54ch" h="1.3125rem" />
      </div>
      <DangerSkeleton />
    </>
  )
}

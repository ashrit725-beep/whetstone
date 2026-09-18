/**
 * Notification settings, loading. The preferences are a table, so the
 * placeholder is a table band inside the same bordered scroll region, then the
 * save button.
 */

import { Skeleton } from '@/components/ui'
import { PrefsTableSkeleton } from '@/components/dashboard/skeletons'

export default function NotificationSettingsLoading() {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        Loading your notification settings…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-2xs border-b border-border-hair pb-md">
        <Skeleton w="14ch" h="2.4414rem" />
        <Skeleton lines={2} w="52ch" h="1.3125rem" />
      </div>
      <div aria-hidden="true" className="flex flex-col gap-lg">
        <PrefsTableSkeleton rows={8} />
        <Skeleton w="13rem" h="2.75rem" radius="sm" />
      </div>
    </>
  )
}

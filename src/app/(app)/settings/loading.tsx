/**
 * `/settings` redirects to `/settings/profile`, so this only ever flashes for
 * the length of that redirect. It holds the header rule and one field so the
 * page that follows starts from the same top edge.
 */

import { Skeleton } from '@/components/ui'
import { FieldSkeleton } from '@/components/dashboard/skeletons'

export default function SettingsLoading() {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        Loading your settings…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-2xs border-b border-border-hair pb-md">
        <Skeleton w="7ch" h="2.4414rem" />
        <Skeleton w="46ch" h="1.3125rem" />
      </div>
      <div aria-hidden="true" className="flex max-w-prose flex-col gap-lg">
        <FieldSkeleton label="18ch" hint="40ch" />
      </div>
    </>
  )
}

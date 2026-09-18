/**
 * Appearance settings, loading. One choice of three, the callout about motion,
 * and the save button.
 */

import { Skeleton } from '@/components/ui'
import { ChoiceSkeleton } from '@/components/dashboard/skeletons'

export default function AppearanceSettingsLoading() {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        Loading your appearance settings…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-2xs border-b border-border-hair pb-md">
        <Skeleton w="11ch" h="2.4414rem" />
        <Skeleton w="52ch" h="1.3125rem" />
      </div>
      <div aria-hidden="true" className="flex max-w-prose flex-col gap-lg">
        <ChoiceSkeleton legend="6ch" hint="54ch" options={3} />
        <div className="rounded-md border border-border-hair p-md">
          <div className="flex flex-col gap-xs">
            <Skeleton w="34ch" h="1.25rem" />
            <Skeleton lines={3} h="1.3125rem" />
          </div>
        </div>
        <Skeleton w="9rem" h="2.75rem" radius="sm" />
      </div>
    </>
  )
}

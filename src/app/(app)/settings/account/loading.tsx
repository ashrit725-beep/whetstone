/**
 * Account settings, loading. Handle, the read-only email with its reason, the
 * two-up language and messaging pair, the adult-content checkbox, and save.
 */

import { Skeleton } from '@/components/ui'
import { CheckboxSkeleton, FieldSkeleton, FormSkeleton } from '@/components/dashboard/skeletons'

export default function AccountSettingsLoading() {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        Loading your account settings…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-2xs border-b border-border-hair pb-md">
        <Skeleton w="7ch" h="2.4414rem" />
        <Skeleton w="44ch" h="1.3125rem" />
      </div>
      <FormSkeleton
        submit="10rem"
        fields={[
          { label: '14ch', hint: '54ch' },
          { label: '11ch', hint: '56ch' },
        ]}
      >
        <div className="grid gap-lg sm:grid-cols-2">
          <FieldSkeleton label="14ch" />
          <FieldSkeleton label="22ch" />
        </div>
        <CheckboxSkeleton label="42ch" description="56ch" />
      </FormSkeleton>
    </>
  )
}

/**
 * Profile settings, loading.
 *
 * Measured against `ProfileForm`: name, bio with its counter, the two-up pair,
 * the availability choice, the searchable checkbox and the save button. The
 * bio block is five prose rows plus its padding, which is what `rows={5}` on
 * the real textarea computes to, so the choice group below it does not step up
 * when the row arrives.
 */

import { Skeleton } from '@/components/ui'
import {
  CheckboxSkeleton,
  ChoiceSkeleton,
  FieldSkeleton,
  FormSkeleton,
} from '@/components/dashboard/skeletons'

export default function ProfileSettingsLoading() {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        Loading your profile settings…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-2xs border-b border-border-hair pb-md">
        <Skeleton w="7ch" h="2.4414rem" />
        <Skeleton w="46ch" h="1.3125rem" />
      </div>
      <FormSkeleton
        submit="10rem"
        fields={[
          { label: '18ch', hint: '40ch' },
          { label: '12ch', hint: '52ch', control: '10.375rem', counter: true },
        ]}
      >
        <div className="grid gap-lg sm:grid-cols-2">
          <FieldSkeleton label="16ch" />
          <FieldSkeleton label="18ch" />
        </div>
        <ChoiceSkeleton legend="32ch" hint="48ch" options={3} />
        <CheckboxSkeleton label="30ch" description="54ch" />
      </FormSkeleton>
    </>
  )
}

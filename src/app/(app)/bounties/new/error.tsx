'use client'

import { ErrorState } from '@/components/ui'

export default function NewBountyError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="column-prose w-full py-xl">
      <ErrorState
        title="The bounty form did not load"
        body="Nothing was posted and no amount was committed. Reload the page, and if it fails again your projects are all still there."
        requestId={error.digest}
        onRetry={reset}
        backHref="/bounties"
        backLabel="Back to open bounties"
      />
    </div>
  )
}

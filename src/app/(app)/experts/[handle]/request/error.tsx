'use client'

import { ErrorState } from '@/components/ui'

export default function RequestError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      className="pad-inline mx-auto w-full py-xl"
      style={{ maxInlineSize: 'var(--container-prose)' }}
    >
      <ErrorState
        title="The request form did not load"
        body="Nothing was sent and nothing was committed. Reload the page, and if it fails again the reviewer’s rate card has the same amount and turnaround on it."
        requestId={error.digest}
        onRetry={reset}
        backHref="/experts"
        backLabel="Back to the reviewer list"
      />
    </div>
  )
}

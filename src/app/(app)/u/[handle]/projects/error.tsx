'use client'

import { ErrorState } from '@/components/ui'

export default function SectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="This tab did not load"
      body="The rest of the profile is fine; only this section failed to read. Try it again, or pick another tab above."
      requestId={error.digest}
      onRetry={reset}
      backHref="/discover"
      headingLevel={2}
    />
  )
}

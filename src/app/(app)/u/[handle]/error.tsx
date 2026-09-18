'use client'

/**
 * The overview tab failed to read. The header sits in the layout above this
 * boundary and has already rendered, so the copy is about the tab, the same
 * as the other three tabs' boundaries, and the heading is an h2 under the
 * profile's h1.
 */

import { ErrorState } from '@/components/ui'

export default function ProfileError({
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

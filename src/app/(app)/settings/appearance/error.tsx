'use client'

/**
 * Settings failure. Nothing was written: these routes read the current values
 * before they render a form, and that read failed.
 */

import { ErrorState } from '@/components/ui'

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="This settings page did not load"
      body="Nothing was changed. The page reads your current settings before it draws the form, and that read failed. Try again."
      {...(error.digest ? { requestId: error.digest } : {})}
      onRetry={reset}
      backHref="/dashboard"
      backLabel="Back to the dashboard"
    />
  )
}

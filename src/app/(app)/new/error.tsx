'use client'

/**
 * Catches a step failing to load and a step failing while it saves. The copy
 * used to promise that nothing entered was lost, which is not true of a step
 * that failed in flight, so it now says which answers are kept.
 *
 * Trying again refreshes from the server before it re-renders: a bare `reset`
 * re-renders what the page was first given, so after a failure on the server
 * the button changed nothing.
 */

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ErrorState } from '@/components/ui'

export default function NewProjectError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()
  return (
    <div className="pad-inline w-full">
      <div className="mx-auto w-full max-w-prose py-xl">
        <ErrorState
          title="The project form stopped"
          body="Every step you finished from Basics on is saved to your draft, so those answers are still there. A step that failed while it was saving was not saved. Try again, and the form comes back with your saved answers in it."
          requestId={error.digest}
          onRetry={() => {
            startTransition(() => {
              router.refresh()
              reset()
            })
          }}
          backHref="/discover"
          backLabel="Back to Discover"
        />
      </div>
    </div>
  )
}

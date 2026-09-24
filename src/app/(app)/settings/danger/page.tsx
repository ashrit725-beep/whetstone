/**
 * The danger zone.
 *
 * Every warning on this page is a counted number rather than a generic one, so
 * the reader is deciding about their own rows and not about an abstraction.
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { accountFootprint, feedbackStates } from '@/server/queries/settings'
import { PageHeader } from '@/components/dashboard/section'
import { DangerZone } from '@/components/dashboard/danger-zone'

export const metadata: Metadata = { title: 'Danger zone' }

export default async function DangerSettingsPage() {
  const claims = await currentClaimsLive()
  if (!claims) redirect('/sign-in?next=%2Fsettings%2Fdanger')

  const footprint = accountFootprint(claims.uid)
  // Counted in SQL rather than from a page of rows, and counted as the write
  // does: `closeAllFeedback` closes an invite-only project too, so anything
  // not already closed is something the button would act on.
  const feedback = feedbackStates(claims.uid)

  return (
    <>
      <PageHeader
        title="Danger zone"
        lede="Three settings you will not want to press by accident, in order of how hard each is to undo. Each one says what it will actually do to your rows."
      />
      <div className="max-w-prose">
        <DangerZone
          handle={claims.handle}
          projects={footprint.projects}
          openProjects={feedback.taking}
          closedProjects={feedback.closed}
          feedbackReceived={footprint.feedbackReceived}
          feedbackWritten={footprint.feedbackWritten}
          openSuggestions={footprint.openSuggestions}
          liveSessions={footprint.liveSessions}
        />
      </div>
    </>
  )
}

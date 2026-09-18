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
import { listMyProjects } from '@/server/repos/projects'
import { accountFootprint } from '@/server/queries/settings'
import { PageHeader } from '@/components/dashboard/section'
import { DangerZone } from '@/components/dashboard/danger-zone'

export const metadata: Metadata = { title: 'Danger zone' }

export default async function DangerSettingsPage() {
  const claims = await currentClaimsLive()
  if (!claims) redirect('/sign-in?next=%2Fsettings%2Fdanger')

  const footprint = accountFootprint(claims.uid)
  const projects = listMyProjects(claims.uid, { limit: 50 })
  const openProjects = projects.filter((project) => project.feedbackState === 'open').length

  return (
    <>
      <PageHeader
        title="Danger zone"
        lede="Three things that are hard to undo, in order of how hard. Each one says what it will actually do to your rows."
      />
      <div className="max-w-prose">
        <DangerZone
          handle={claims.handle}
          projects={footprint.projects}
          openProjects={openProjects}
          feedbackReceived={footprint.feedbackReceived}
          feedbackWritten={footprint.feedbackWritten}
          openSuggestions={footprint.openSuggestions}
          liveSessions={footprint.liveSessions}
        />
      </div>
    </>
  )
}

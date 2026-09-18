/**
 * The creator dashboard shell: full-bleed, with a 16rem left rail (§4.4
 * surface 5).
 *
 * The rail counts are real rows, read once here in grouped queries rather than
 * once per page, per project, so the number beside “Inbox” is the number in
 * the inbox for the project in view. The rail picks that project from the URL
 * itself, since a layout is not given the search params.
 *
 * Below 60rem the rail becomes a horizontal row above the content: the
 * navigation changes shape, it never disappears behind a hover affordance.
 */

import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { getInboxCounts } from '@/server/repos/feedback'
import { getSuggestionCounts } from '@/server/repos/suggestions'
import { creatorScope, openSuggestionsByProject } from '@/server/queries/dashboard'
import { DashboardRail, type RailItem, type RailProject } from '@/components/dashboard/dashboard-rail'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const claims = await currentClaimsLive()
  if (!claims) redirect('/sign-in?next=%2Fdashboard')

  const scope = creatorScope(claims.uid, undefined)
  const inbox = getInboxCounts(claims.uid)
  const suggestions = getSuggestionCounts({ ownerId: claims.uid })
  const openByProject = openSuggestionsByProject(claims.uid)
  const projects: RailProject[] = scope.projects.map((project) => ({
    id: project.id,
    title: project.title,
    grit: project.grit,
    stageLabel: project.stageLabel,
    unread: project.counts.unread,
    openSuggestions: openByProject.get(project.id) ?? 0,
  }))

  const primary: RailItem[] = [
    { href: '/dashboard', label: 'Overview', icon: 'overview', scoped: true },
    {
      href: '/dashboard/inbox',
      label: 'Inbox',
      icon: 'inbox',
      count: 'unread',
      countNoun: 'not read yet',
      scoped: true,
    },
    { href: '/dashboard/insights', label: 'Insights', icon: 'insights', scoped: true },
    {
      href: '/dashboard/suggestions',
      label: 'Suggestions',
      icon: 'suggestions',
      // The tracker's Open column: open and under review.
      count: 'openSuggestions',
      countNoun: 'still open',
      scoped: true,
    },
  ]

  // Help is not repeated here: the app shell's footer carries it in the same
  // slot on every surface, which is what SC 3.2.6 asks for.
  const secondary: RailItem[] = [
    { href: '/settings/profile', label: 'Settings', icon: 'settings' },
  ]

  return (
    // At least one screen tall beside the nav, so the rail's ground runs to the
    // footer on a short page. `h-full` did nothing here: <main> grows as a flex
    // item with no definite height, so the percentage resolved to auto and the
    // rail stopped a band short of the footer.
    <div
      className="md:grid md:min-h-[calc(100dvh-var(--nav-h))]"
      style={{ gridTemplateColumns: 'var(--container-rail) minmax(0, 1fr)' }}
    >
      <DashboardRail
        label="Dashboard"
        primary={primary}
        secondary={secondary}
        projects={projects}
        defaultProjectId={scope.project?.id ?? null}
        totals={{
          unread: inbox.byState.new,
          openSuggestions: suggestions.byStatus.open + suggestions.byStatus.under_review,
        }}
      />
      {/* The shell already owns <main id="main">; this is the content column
          inside it, so the skip link still lands in exactly one place. */}
      <div className="pad-inline flex min-w-0 flex-col gap-xl py-xl">{children}</div>
    </div>
  )
}

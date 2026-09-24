/**
 * Creator overview.
 *
 * Three shapes, none of them a tile: a definition list of counts, a ranked
 * ordered list of what to fix, and a hairline-ruled register of what happened.
 * The dense table, the stacked bars and the column board each live on their own
 * route, so no two panes on this surface repeat a shape (§4.4 surface 5).
 *
 * The ranked list is the slow one: it clusters every note on the project and
 * then ranks the clusters. It renders inside `<Suspense>` with a skeleton
 * measured against the real markup, so the counts and the register paint
 * immediately and nothing moves when the ranking lands.
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { EmptyState, Link as UiLink } from '@/components/ui'
import { getInboxCounts } from '@/server/repos/feedback'
import { getDashboardSummary, getRecentActivity } from '@/server/repos/stats'
import { creatorScope, themeBoard, weekMetrics } from '@/server/queries/dashboard'
import { PageHeader, Section } from '@/components/dashboard/section'
import { WeekMetrics } from '@/components/dashboard/week-metrics'
import { FixFirst } from '@/components/dashboard/fix-first'
import { FixFirstSkeleton } from '@/components/dashboard/skeletons'
import { ActivityRegister } from '@/components/dashboard/activity-register'
import { ProjectPicker } from '@/components/dashboard/project-picker'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'What reviewers sent you this week, and what to do about it.',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const claims = await currentClaimsLive()
  if (!claims) redirect('/sign-in?next=%2Fdashboard')

  const params = await searchParams
  const projectParam = typeof params['project'] === 'string' ? params['project'] : undefined
  const scope = creatorScope(claims.uid, projectParam)

  if (scope.projects.length === 0) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          lede="Post a build, write the one question you actually want answered, and this fills up."
        />
        <EmptyState
          title="No projects yet"
          body="Reviewers pick what to review from the ask, so the first thing to write is the question. A project with a specific ask gets its first note in about a day."
          primaryAction={{ label: 'Post your first project', href: '/new' }}
          secondaryAction={{ label: 'See what other people posted', href: '/discover' }}
        />
      </>
    )
  }

  const activity = getRecentActivity(claims.uid, { limit: 8 })
  const project = scope.project
  // The strip counts open themes on the board the ranking below is built from.
  // Answering from what is already known takes milliseconds, and the ranking
  // reuses this same run, so it costs the first paint almost nothing.
  const board = project ? await themeBoard(project.id, claims.uid) : null
  const metrics = weekMetrics(claims.uid, project?.id ?? null, board)
  // Counted for the project in view. The account-wide figure said "no feedback
  // yet" about nothing in particular, and hid an empty project behind a busy one.
  const notes = project
    ? getInboxCounts(claims.uid, project.id).total
    : getDashboardSummary(claims.uid).feedbackReceived
  const noFeedbackYet = notes === 0

  return (
    <>
      <PageHeader
        title="Dashboard"
        lede={
          project
            ? `${project.title}, ${project.stageLabel.toLowerCase()} at ${String(project.grit)} grit.`
            : 'Across every project you own.'
        }
        aside={
          <>
            {/* The one way into the project editor from this side of the
                product. Only with a project in scope: "every project" has no
                one project to edit. */}
            {project ? (
              <UiLink href={`/p/${project.slug}/edit`} variant="standalone">
                Edit the project
              </UiLink>
            ) : null}
            <UiLink
              href={
                project
                  ? `/dashboard/inbox?project=${encodeURIComponent(project.id)}`
                  : '/dashboard/inbox?project=all'
              }
              variant="standalone"
            >
              Open the inbox
            </UiLink>
          </>
        }
      />

      <ProjectPicker
        projects={scope.projects}
        selected={project?.id ?? 'all'}
        href={(id) => `/dashboard?project=${encodeURIComponent(id)}`}
        allowAll
      />

      {noFeedbackYet ? (
        <EmptyState
          title="No feedback yet"
          body="Nothing is broken. Projects with one specific ask get replies faster than projects asking for general thoughts, so the ask is the thing to sharpen while you wait."
          // Scoped to every project there is no one project to open, and the
          // href was `/p/`, which is a 404.
          primaryAction={
            project
              ? { label: 'Open the project', href: `/p/${project.slug}` }
              : { label: 'Review someone else’s build', href: '/discover' }
          }
          {...(project
            ? { secondaryAction: { label: 'Review someone else’s build', href: '/discover' } }
            : {})}
        />
      ) : (
        <>
          <Section
            id="this-week"
            title="This week against last"
            lede="Two seven-day windows, counted from your rows. Nothing here is estimated."
          >
            <WeekMetrics metrics={metrics} label="This week against last week" />
          </Section>

          {project ? (
            <Section
              id="fix-first"
              title="What to fix first"
              lede={
                board?.enoughNotes
                  ? `${project.title} has ${String(notes)} ${notes === 1 ? 'note' : 'notes'}. These are the things more than one person is waiting on.`
                  : `${project.title} has ${String(notes)} ${notes === 1 ? 'note' : 'notes'} so far.`
              }
            >
              <Suspense fallback={<FixFirstSkeleton />}>
                <FixFirst userId={claims.uid} projectId={project.id} />
              </Suspense>
            </Section>
          ) : null}
        </>
      )}

      <Section
        id="activity"
        title="Lately"
        lede="Across all your projects and the reviews you wrote, newest first."
      >
        <ActivityRegister entries={activity} />
      </Section>
    </>
  )
}

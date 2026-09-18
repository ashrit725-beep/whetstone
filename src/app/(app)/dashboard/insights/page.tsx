/**
 * Insights: what changed, what to fix first, and the theme rollup.
 *
 * The rollup is this surface’s one bold element. Everything else on the page is
 * type and hairlines, so the bars are the only thing competing for the eye.
 *
 * Both AI-backed panels stream, and neither waits on a model: each answers from
 * the last model run or the local clusterer, says which, and the model runs
 * after the response. A slow model must never hold a creator’s own numbers
 * hostage, which is why the week strip is rendered outside both boundaries and
 * paints first. It reads the same board the panels draw, so the open-theme
 * figure and the bars below it are one count.
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { Banner, EmptyState, Meter } from '@/components/ui'
import { getInboxCounts } from '@/server/repos/feedback'
import {
  THEME_FLOOR,
  creatorScope,
  themeBoard,
  weekMetrics,
} from '@/server/queries/dashboard'
import { PageHeader, Section } from '@/components/dashboard/section'
import { WeekMetrics } from '@/components/dashboard/week-metrics'
import { FixFirst } from '@/components/dashboard/fix-first'
import { RollupPane } from '@/components/dashboard/theme-rollup'
import { FixFirstSkeleton, RollupSkeleton } from '@/components/dashboard/skeletons'
import { ProjectPicker } from '@/components/dashboard/project-picker'

export const metadata: Metadata = {
  title: 'Insights',
  description: 'What changed since last week, and which three notes are worth acting on.',
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const claims = await currentClaimsLive()
  if (!claims) redirect('/sign-in?next=%2Fdashboard%2Finsights')

  const params = await searchParams
  const projectParam = typeof params['project'] === 'string' ? params['project'] : undefined
  // Themes are worked out per project, so there is no all-projects view here.
  // The page it would be is the default one, at the address that says so.
  if (projectParam === 'all') redirect('/dashboard/insights')
  const scope = creatorScope(claims.uid, projectParam)
  const project = scope.project

  if (!project) {
    return (
      <>
        <PageHeader title="Insights" lede="Themes need notes, and notes need a project." />
        <EmptyState
          title="No projects yet"
          body="Once a build is live and a handful of people have written about it, their notes get grouped here by what they are actually about."
          primaryAction={{ label: 'Post your first project', href: '/new' }}
        />
      </>
    )
  }

  const counts = getInboxCounts(claims.uid, project.id)
  const picker = (
    <ProjectPicker
      projects={scope.projects}
      selected={project.id}
      href={(id) => `/dashboard/insights?project=${encodeURIComponent(id)}`}
    />
  )

  if (counts.total < THEME_FLOOR) {
    // No board is drawn below the floor, so the strip leaves open themes out.
    const metrics = weekMetrics(claims.uid, project.id, null)
    return (
      <>
        <PageHeader
          title="Insights"
          lede={`${project.title}, ${project.stageLabel.toLowerCase()} at ${String(project.grit)} grit.`}
        />
        {picker}
        <Section
          id="not-yet"
          title="Not enough notes to group yet"
          lede="A theme over two notes is noise dressed as insight, so this waits."
        >
          <Meter
            value={counts.total}
            min={0}
            max={THEME_FLOOR}
            label="Notes toward a first grouping"
            valueText={`${String(counts.total)} of ${String(THEME_FLOOR)} notes`}
          />
          <Banner variant="info" title="What happens at five">
            At five notes the clustering runs and this page fills with themes, each showing how
            many separate people hit it. Until then the inbox has everything, unsorted.
          </Banner>
        </Section>
        <Section id="week" title="This week against last">
          <WeekMetrics metrics={metrics} label="This week against last week" />
        </Section>
      </>
    )
  }

  // Open themes in the strip are counted on the board drawn below it. Reading
  // the board answers from what is already known, in milliseconds, and both
  // streamed panels reuse this same run.
  const board = await themeBoard(project.id, claims.uid)
  const metrics = weekMetrics(claims.uid, project.id, board)

  return (
    <>
      <PageHeader
        title="Insights"
        lede={`${project.title}, ${project.stageLabel.toLowerCase()} at ${String(project.grit)} grit.`}
      />
      {picker}

      <Section
        id="week"
        title="This week against last"
        lede="Two seven-day windows, counted from your rows. Nothing here is estimated."
      >
        <WeekMetrics metrics={metrics} label="This week against last week" />
      </Section>

      <Section
        id="fix-first"
        title="What to fix first"
        lede={`${project.title} has ${String(counts.total)} notes. These are the things more than one person is waiting on.`}
      >
        <Suspense fallback={<FixFirstSkeleton />}>
          <FixFirst userId={claims.uid} projectId={project.id} />
        </Suspense>
      </Section>

      <Section
        id="rollup"
        title="Themes"
        lede="One bar per group. Each splits its points by how serious they are, with the share written on the segment and repeated in the legend."
      >
        <Suspense fallback={<RollupSkeleton />}>
          <RollupPane projectId={project.id} userId={claims.uid} />
        </Suspense>
      </Section>
    </>
  )
}

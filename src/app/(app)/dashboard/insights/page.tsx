/**
 * Insights: the theme rollup, and nothing the overview already showed.
 *
 * The rollup is this surface’s one bold element. Everything else on the page is
 * type and hairlines, so the bars are the only thing competing for the eye.
 *
 * This page used to open on the week strip and the ranked list, byte for byte
 * the overview’s own first screen, and the work only it does began 1,400px
 * down. The counts and the ranking live on the overview now; Insights opens on
 * the bars and links back for the rest.
 *
 * The rollup streams and never waits on a model: it answers from the last model
 * run or the local clusterer, says which, and the model runs after the
 * response. A slow model must never hold a creator’s own numbers hostage.
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { Banner, EmptyState, Link as UiLink, Meter } from '@/components/ui'
import { getInboxCounts } from '@/server/repos/feedback'
import { THEME_FLOOR, creatorScope } from '@/server/queries/dashboard'
import { PageHeader, Section } from '@/components/dashboard/section'
import { RollupPane } from '@/components/dashboard/theme-rollup'
import { RollupSkeleton } from '@/components/dashboard/skeletons'
import { ProjectPicker } from '@/components/dashboard/project-picker'

export const metadata: Metadata = {
  title: 'Insights',
  description: 'Every note on your project, grouped by what it is actually about.',
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
  // The week’s counts and the ranked list are the overview’s work. Both pages
  // are about the project in view, so the link carries it.
  const overviewHref = `/dashboard?project=${encodeURIComponent(project.id)}`
  const backToOverview = (
    <UiLink href={overviewHref} variant="standalone">
      This week, and what to fix first
    </UiLink>
  )

  if (counts.total < THEME_FLOOR) {
    return (
      <>
        <PageHeader
          title="Insights"
          lede={`${project.title}, ${project.stageLabel.toLowerCase()} at ${String(project.grit)} grit.`}
          aside={backToOverview}
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
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Insights"
        lede={`${project.title}, ${project.stageLabel.toLowerCase()} at ${String(project.grit)} grit.`}
        aside={backToOverview}
      />
      {picker}

      <Section
        id="rollup"
        title="Themes"
        // Not "every one of the N notes, grouped": a group needs a point that
        // came up more than once, and the line under the bars says how many
        // points sat in no group at all. The two have to agree.
        lede={`All ${String(counts.total)} notes on this project, read point by point. A group is a point that came up more than once; one bar per group, split by how serious its points are, with the share written on the segment and repeated in the legend.`}
      >
        <Suspense fallback={<RollupSkeleton />}>
          <RollupPane projectId={project.id} userId={claims.uid} />
        </Suspense>
      </Section>
    </>
  )
}

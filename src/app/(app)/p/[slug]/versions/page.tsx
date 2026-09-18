/**
 * Builds.
 *
 * Two audiences on one page. A creator posts a build and its changelog. A
 * reviewer who has already reviewed an older build gets the one thing that
 * makes a second pass worth their evening: what moved since they last looked,
 * in the creator's own words, with a link straight back into the composer.
 */

import type { Metadata } from 'next'
import { listPlaytestRounds, listVersionTimeline, viewerReviewStamp } from '@/server/queries/project-surface'
import { postVersion } from '@/server/actions/project'
import { ProjectHeader } from '@/components/project/project-header'
import { ProjectShell, Wrap } from '@/components/project/project-shell'
import { toggleFollowing, toggleSaved } from '../actions'
import { projectForViewer } from '../viewer-project'
import { EmptySection } from '@/components/project/empty-section'
import { VersionTimeline } from '@/components/project/version-timeline'
import { VersionCompare } from '@/components/project/version-compare'
import { NewBuildForm } from '@/components/project/new-build-form'

type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { project } = await projectForViewer((await params).slug)
  return { title: `Builds of ${project.title}` }
}

export default async function VersionsPage({ params }: { params: Params }) {
  const { project, viewerId } = await projectForViewer((await params).slug)

  const versions = listVersionTimeline(project.id)
  const rounds = listPlaytestRounds(project.id, viewerId)
  const stamp = viewerReviewStamp(project.id, viewerId)
  const isOwner = project.viewer.isOwner || project.viewer.canEdit

  const openRound = rounds.find((r) => r.status === 'recruiting' || r.status === 'running') ?? null

  return (
    <ProjectShell>
      <Wrap className="pt-12 pb-8 lg:pt-16">
        <ProjectHeader
          project={project}
          section="versions"
          versionCount={versions.length}
          roundCount={rounds.length}
          openRoundTitle={openRound?.title ?? null}
          viewerSignedIn={viewerId !== null}
          reviewStamp={stamp}
          saveAction={toggleSaved}
          followAction={toggleFollowing}
        />
      </Wrap>

      {isOwner ? (
        <Wrap className="pb-12">
          <NewBuildForm slug={project.slug} action={postVersion} suggestedLabel={nextLabel(versions.length)} />
        </Wrap>
      ) : null}

      <Wrap className="pt-6 pb-24">
        {versions.length === 0 ? (
          <EmptySection
            title="No builds posted yet"
            body={
              isOwner
                ? 'Reviewers cite a build when they report, and a project with none collects notes that cannot be traced to a version. Post the one people are looking at.'
                : 'The creator has not named a build for this project yet, so reviews here are against the project as a whole.'
            }
            action={
              isOwner
                ? { label: 'Post the first build', href: '#new-build' }
                : { label: 'Write feedback anyway', href: `/p/${project.slug}/feedback` }
            }
          />
        ) : (
          <div className="flex flex-col gap-16">
            {versions.length > 1 && versions[0] && versions[1] ? (
              <VersionCompare previous={versions[1]} current={versions[0]} />
            ) : null}
            <VersionTimeline versions={versions} stamp={stamp} slug={project.slug} />
          </div>
        )}
      </Wrap>
    </ProjectShell>
  )
}

/** A plain suggestion, not a claim: the creator names their own builds. */
function nextLabel(count: number): string {
  return `Build ${count + 1}`
}

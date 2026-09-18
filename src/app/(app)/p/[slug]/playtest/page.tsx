/**
 * Playtest rounds.
 *
 * A round is a protocol: an ordered list of tasks a tester is asked to do, with
 * one reported outcome each. That is what makes two testers comparable, and it
 * is the difference between "four of seven could not finish task two" and "the
 * tutorial felt confusing".
 *
 * The creator defines the tasks. Testers join and report per task. Everyone
 * else reads the results, which are counts from real rows and nothing else.
 */

import type { Metadata } from 'next'
import { listPlaytestRounds, listVersionTimeline, viewerReviewStamp } from '@/server/queries/project-surface'
import { createRound, joinPlaytestRound, reportTask } from '@/server/actions/project'
import { ProjectHeader } from '@/components/project/project-header'
import { ProjectShell, Wrap } from '@/components/project/project-shell'
import { EmptySection } from '@/components/project/empty-section'
import { toggleFollowing, toggleSaved } from '../actions'
import { projectForViewer } from '../viewer-project'
import { PlaytestRoundView } from '@/components/project/playtest-round'
import { NewRoundForm } from '@/components/project/new-round-form'
import { TaskReportForm } from '@/components/project/task-report-form'

type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { project } = await projectForViewer((await params).slug)
  return { title: `Playtest rounds on ${project.title}` }
}

export default async function PlaytestPage({ params }: { params: Params }) {
  const { project, viewerId } = await projectForViewer((await params).slug)

  const rounds = listPlaytestRounds(project.id, viewerId)
  const versions = listVersionTimeline(project.id)
  const isOwner = project.viewer.isOwner || project.viewer.canEdit
  const reviewStamp = project.viewer.hasReviewed ? viewerReviewStamp(project.id, viewerId) : undefined

  const openRound = rounds.find((r) => r.status === 'recruiting' || r.status === 'running') ?? null

  return (
    <ProjectShell>
      <Wrap className="pt-12 pb-8 lg:pt-16">
        <ProjectHeader
          project={project}
          section="playtest"
          versionCount={versions.length}
          roundCount={rounds.length}
          openRoundTitle={openRound?.title ?? null}
          viewerSignedIn={viewerId !== null}
          reviewStamp={reviewStamp}
          saveAction={toggleSaved}
          followAction={toggleFollowing}
        />
      </Wrap>

      {isOwner ? (
        <Wrap className="pb-12">
          <NewRoundForm slug={project.slug} action={createRound} />
        </Wrap>
      ) : null}

      <Wrap className="pt-6 pb-24">
        {rounds.length === 0 ? (
          <EmptySection
            title="No playtest rounds yet"
            body={
              isOwner
                ? 'A round turns \u201ctell me what you think\u201d into an ordered list of tasks with one reported outcome each, which is what makes two testers comparable. Three tasks is enough to start.'
                : 'The creator has not opened a round on this project. Written feedback is still open, and the composer walks the same areas a round would.'
            }
            action={
              isOwner
                ? { label: 'Open a round', href: '#new-round' }
                : { label: 'Write feedback instead', href: `/p/${project.slug}/feedback` }
            }
          />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-24 p-0">
            {rounds.map((round) => {
              const joined = round.viewerInvitationId !== null
              const canReport = viewerId !== null && !isOwner && round.status !== 'closed' && round.status !== 'cancelled'

              const taskForms: Record<string, React.ReactNode> = {}
              if (canReport) {
                for (const task of round.tasks) {
                  taskForms[task.id] = (
                    <TaskReportForm
                      slug={project.slug}
                      roundId={round.id}
                      taskId={task.id}
                      taskTitle={task.title}
                      action={reportTask}
                      current={task.viewerOutcome}
                    />
                  )
                }
              }

              return (
                <li key={round.id}>
                  <PlaytestRoundView round={round} taskForms={taskForms}>
                    {canReport && !joined ? (
                      <form action={joinPlaytestRound}>
                        <input type="hidden" name="roundId" value={round.id} />
                        <input type="hidden" name="slug" value={project.slug} />
                        <button type="submit" className="btn">
                          Join this round
                        </button>
                      </form>
                    ) : null}
                    {!viewerId ? (
                      <p className="text-xs text-ink-3">
                        Sign in to take a seat in this round and report per task.
                      </p>
                    ) : null}
                  </PlaytestRoundView>
                </li>
              )
            })}
          </ul>
        )}
      </Wrap>
    </ProjectShell>
  )
}

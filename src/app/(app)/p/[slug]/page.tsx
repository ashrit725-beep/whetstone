/**
 * Project detail: the signature screen.
 *
 * A launch crossed with a case study. The composition is offset rather than
 * boxed, the vertical rhythm is deliberately uneven so no two adjacent sections
 * breathe alike, and the one change of ground on the page is the disagreement
 * band, because that is the thing worth stopping on.
 *
 * Reading order is the argument:
 *
 *   the ask         — the question the page exists to answer
 *   the build       — what the creator says it is
 *   the spread      — where reviewers actually put it, drawn rather than averaged
 *   what would help — which asks are answered and which are still open
 *   the notes       — with full provenance and the creator's replies attached
 *   the loop        — what came in, what it named, what went out
 *   the scale       — the measure the whole product is denominated in
 *
 * Every number on it is a column read at render time. There is no metric on
 * this page that the database cannot produce.
 */

import type { Metadata } from 'next'
import { gritLabelFor } from '@/components/project/grit-values'
import { listProjects } from '@/server/repos/projects'
import { listFeedbackForProject, listReplies } from '@/server/repos/feedback'
import { asksForProjects } from '@/server/queries/discover'
import {
  anchorsForProject,
  axisVerdictsForProject,
  listPlaytestRounds,
  listVersionTimeline,
  loopLedger,
  shippedMarksForProject,
  viewerReviewStamp,
} from '@/server/queries/project-surface'
import {
  markPointShipped,
  postFeedback,
  replyToFeedback,
  revealedProjects,
  skipBlindStep,
  voteOnFeedback,
  voteOnPoint,
} from '@/server/actions/feedback'
import { toggleFollowing, toggleSaved } from './actions'
import { projectForViewer } from './viewer-project'
import { ProjectHeader } from '@/components/project/project-header'
import { ProjectShell, Wrap } from '@/components/project/project-shell'
import { MediaStage } from '@/components/project/media-stage'
import { artworkFor } from '@/components/project/artwork'
import {
  AboutBuild,
  GritStrip,
  HelpChecklist,
  ProgressLadder,
  TheAsk,
  WhereToGetIt,
} from '@/components/project/project-overview'
import {
  AgreementRow,
  DisagreementPlot,
  readAxis,
  type AxisReading,
} from '@/components/project/disagreement-plot'
import { RelatedProjects } from '@/components/project/related-projects'
import { FeedbackThread } from '@/components/project/feedback-thread'
import { BlindVeil } from '@/components/project/blind-veil'
import { buildComposerData, reviewRefusal } from '@/components/project/composer-data'
import { plural } from '@/components/project/paper'
import { isThreadSort, type ThreadNote, type ThreadSort } from '@/components/project/thread-types'
import type { ProjectCard } from '@/lib/types'

type Params = Promise<{ slug: string }>
type Search = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { project } = await projectForViewer((await params).slug)
  return {
    title: `${project.title} · ${gritLabelFor(project.grit)}`,
    description: project.tagline ?? project.asks[0]?.prompt?.slice(0, 155) ?? undefined,
    alternates: { canonical: `/p/${project.slug}` },
  }
}

export default async function ProjectPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { project, viewerId } = await projectForViewer((await params).slug)
  const sp = await searchParams

  const sortParam = typeof sp['sort'] === 'string' ? sp['sort'] : ''
  const sort: ThreadSort = isThreadSort(sortParam) ? sortParam : 'most_helpful'
  // A project with two dozen reviews is a scroll, not a case study, so the page
  // shows the top of the thread and the rest is one addressable click away.
  const showAllNotes = sp['notes'] === 'all'
  // "Read all 34 notes" delivered 20 and stopped, with nothing saying so and no
  // control to reach the rest. The ceiling is high enough that no project in the
  // index reaches it, and the thread says so when one does.
  const ALL_NOTES_CEILING = 200
  const noteLimit = showAllNotes ? ALL_NOTES_CEILING : 5

  const versions = listVersionTimeline(project.id)
  const rounds = listPlaytestRounds(project.id, viewerId)
  // "Read the 20 notes against v0.7.1" on the builds page lands here. Only a
  // build of this project is honoured, so a stale or edited id shows the whole
  // thread rather than an empty one.
  const buildParam = typeof sp['build'] === 'string' ? sp['build'] : null
  const build = versions.find((v) => v.id === buildParam) ?? null
  const openRound = rounds.find((r) => r.status === 'recruiting' || r.status === 'running') ?? null

  const ledger = loopLedger(project.id)
  const anchors = anchorsForProject(project.id)
  const shippedMarks = shippedMarksForProject(project.id)

  // The spread, split into the part worth arguing about and the part that is
  // settled. Contested axes get the full plot; agreement gets one line and is
  // said to be worth less of the reader's attention, which is the honest
  // hierarchy rather than five identical charts.
  const readings = axisVerdictsForProject(project.id)
    .map(readAxis)
    .filter((r): r is AxisReading => r !== null)
  const contested = readings.filter((r) => r.contested).sort((a, b) => b.spread - a.spread)
  const agreed = readings.filter((r) => !r.contested)
  // One person cannot agree or disagree with anyone, so a project nobody but
  // its first reviewer has rated is said to have one reading, not a consensus.
  const secondOpinion = readings.some((r) => r.count > 1)

  const revealed = await revealedProjects()
  const isOwner = project.viewer.isOwner || project.viewer.canEdit
  // The composer's own gate. The veil asks for a first impression, so it only
  // stands in front of someone who is able to write one.
  const canReview = viewerId !== null && reviewRefusal(project) === null
  const blind =
    canReview &&
    !project.viewer.hasReviewed &&
    !revealed.has(project.id) &&
    project.stats.feedback > 0

  const page = blind
    ? null
    : listFeedbackForProject(project.id, {
        sort,
        viewerId,
        includePrivate: isOwner,
        versionId: build?.id ?? null,
        limit: noteLimit,
      })

  const notes: ThreadNote[] = (page?.items ?? []).map((view) => {
    const replies = view.counts.replies > 0 ? listReplies(view.id) : []
    return {
      id: view.id,
      reviewerName: view.reviewer.displayName,
      reviewerHandle: view.reviewer.handle,
      reviewerAvatarUrl: view.reviewer.avatarUrl,
      reviewerIsExpert: view.reviewer.isExpert,
      reviewerTierLabel: view.reviewer.tierLabel,
      reviewerScore: view.reviewer.score,
      headline: view.headline,
      submittedAt: view.submittedAt,
      versionLabel: view.versionLabel,
      isQualified: view.isQualified,
      responseState: view.responseState,
      creatorMarkedHelpful: view.creatorMarkedHelpful,
      helpfulCount: view.counts.helpful,
      viewerVote: view.viewer.vote,
      points: view.points.map((point) => ({
        id: point.id,
        bodyMd: point.bodyMd,
        severityKey: point.severity,
        severityLabel: point.severityLabel,
        actionabilityLabel: point.actionabilityLabel,
        categoryLabel: point.categoryLabel,
        upvoteCount: point.upvoteCount,
        viewerUpvoted: point.viewerUpvoted,
        isResolved: point.isResolved,
        anchorLabel: point.anchor?.value ?? null,
        shippedInVersion: shippedMarks.get(point.id)?.versionLabel ?? null,
      })),
      replies: replies.map((reply) => ({
        id: reply.id,
        authorName: reply.author.displayName,
        authorHandle: reply.author.handle,
        isCreator: reply.isCreator,
        bodyMd: reply.bodyMd,
        createdAt: reply.createdAt,
      })),
    }
  })

  const composer = canReview ? buildComposerData(project, viewerId) : null

  // Projects of one type can frame their asks the same way with only the noun
  // changed ("Where in the camera window did you hesitate?", "Where in the
  // USB-C port did you hesitate?"), and rows that share a frame read as a
  // template. A candidate is passed over when its ask shares a frame with this
  // project's or with a row already chosen, so the pool is drawn deeper than
  // the four rows shown. Passed-over rows only come back to fill the list, and
  // never one whose first sentence is already on the page word for word.
  const candidates = listProjects(
    { typeSlug: project.typeSlug, openOnly: true },
    { limit: 16, viewerId, sort: 'ranked' },
  ).items.filter((card) => card.id !== project.id)
  const relatedAsks = asksForProjects(candidates.map((c) => c.id))
  const related = pickUnlikeAsks(candidates, relatedAsks, project.asks[0]?.prompt, 4)

  const reviewStamp = project.viewer.hasReviewed ? viewerReviewStamp(project.id, viewerId) : undefined

  return (
    <ProjectShell>
      <Wrap className="pt-12 pb-8 lg:pt-16">
        <ProjectHeader
          project={project}
          section="overview"
          versionCount={versions.length}
          roundCount={rounds.length}
          openRoundTitle={openRound?.title ?? null}
          viewerSignedIn={viewerId !== null}
          reviewStamp={reviewStamp}
          saveAction={toggleSaved}
          followAction={toggleFollowing}
        />
      </Wrap>

      <Wrap className="pb-6">
        <MediaStage
          slug={project.slug}
          title={project.title}
          grit={project.grit}
          typeLabel={project.typeLabel}
          versionLabel={project.currentVersion?.label ?? null}
          reviewerCount={project.stats.reviewers}
          anchors={anchors}
          artwork={artworkFor(project.slug)}
        />
      </Wrap>

      <Wrap className="pt-24 pb-12">
        <TheAsk project={project} />
      </Wrap>

      {project.summaryMd ? (
        <Wrap className="pb-16">
          <AboutBuild project={project} />
        </Wrap>
      ) : null}

      {readings.length > 0 ? (
        <div className="border-y-[1.5px] border-ink bg-paper-sub">
          <Wrap className="py-24 lg:py-32">
            <div className="flex flex-col gap-32">
              {contested.length > 0 ? (
                <div className="flex flex-col gap-24">
                  {/* The argument for drawing people instead of an average is
                      made once, here. Each plot below carries its own headline,
                      read off its own counts. */}
                  <div className="grid gap-x-16 gap-y-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
                    <div>
                      <span className="eyebrow text-ink-3">
                        {`${String(contested.length)} of ${String(readings.length)} ${plural(readings.length, 'area', 'areas')} contested`}
                      </span>
                      <h2 className="mt-3 text-lg lg:text-xl">Where they do not agree.</h2>
                    </div>
                    <p className="voice text-base">
                      Every reviewer put the work at one step of each scale. Averaging them would
                      produce a number none of them chose, so each step below says who stood on it.
                      The spread is the finding.
                    </p>
                  </div>
                  {contested.map((reading) => (
                    <DisagreementPlot key={reading.axisId} reading={reading} />
                  ))}
                </div>
              ) : secondOpinion ? (
                <div className="grid gap-x-16 gap-y-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
                  <h2 className="text-lg lg:text-xl">They agree on this one.</h2>
                  <p className="voice text-base">
                    Every axis came back within one step. There is no argument to read here, so spend
                    the time on the notes instead: that is where the specifics are.
                  </p>
                </div>
              ) : (
                <div className="grid gap-x-16 gap-y-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
                  <h2 className="text-lg lg:text-xl">One reading so far.</h2>
                  <p className="voice text-base">
                    A spread takes two people, and one reviewer has rated this so far. Their reading
                    is below. The next review is the one that shows whether it holds.
                  </p>
                </div>
              )}

              {agreed.length > 0 ? (
                <div>
                  <div className="flex items-baseline gap-4">
                    <span className="eyebrow text-ink-3">
                      {secondOpinion ? 'Not in dispute, and worth less of your time' : 'Their reading, area by area'}
                    </span>
                    <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-rule" />
                  </div>
                  <ul className="m-0 mt-4 flex list-none flex-col divide-y divide-rule border-t border-rule p-0">
                    {agreed.map((reading) => (
                      <AgreementRow key={reading.axisId} reading={reading} />
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </Wrap>
        </div>
      ) : null}

      <Wrap className="pt-16 pb-12">
        <HelpChecklist project={project} printedAskId={project.asks[0]?.id ?? null} />
      </Wrap>

      <Wrap className="pt-8 pb-24">
        {blind ? (
          <BlindVeil
            slug={project.slug}
            projectId={project.id}
            projectTitle={project.title}
            hiddenCount={project.stats.feedback}
            reviewerCount={project.stats.reviewers}
            skipAction={skipBlindStep}
          />
        ) : (
          <FeedbackThread
            slug={project.slug}
            notes={notes}
            sort={sort}
            totalCount={build ? build.feedbackCount : project.stats.feedback}
            build={build ? { id: build.id, label: build.label } : null}
            viewerIsCreator={isOwner}
            viewerSignedIn={viewerId !== null}
            viewerHasReviewed={project.viewer.hasReviewed}
            currentVersionId={project.currentVersion?.id ?? null}
            composer={composer}
            composerAction={postFeedback}
            voteAction={voteOnFeedback}
            pointVoteAction={voteOnPoint}
            replyAction={replyToFeedback}
            shipAction={markPointShipped}
            askPrompt={project.asks[0]?.prompt ?? null}
            shippedNoteCount={ledger.notesShipped}
            showingAll={showAllNotes}
          />
        )}
      </Wrap>

      <div className="border-t border-rule">
        <Wrap className="pt-16 pb-16">
          <ProgressLadder project={project} ledger={ledger} />
        </Wrap>
      </div>

      <Wrap className="pt-12 pb-24">
        <GritStrip project={project} />
      </Wrap>

      <Wrap className="pb-12">
        <WhereToGetIt project={project} buildCount={versions.length} />
      </Wrap>

      {related.length > 0 ? (
        <div className="border-t-[1.5px] border-ink bg-paper-deep">
          <Wrap className="py-24">
            <RelatedProjects projects={related} typeLabel={project.typeLabel} asks={relatedAsks} />
          </Wrap>
        </div>
      ) : null}
    </ProjectShell>
  )
}

/**
 * Up to `count` candidates whose asks do not read alike: first those sharing
 * no frame with `ownAsk` or with each other, then, only if that leaves the
 * list short, those whose first sentence is at least not a repeat.
 */
function pickUnlikeAsks(
  candidates: readonly ProjectCard[],
  asks: ReadonlyMap<string, string>,
  ownAsk: string | undefined,
  count: number,
): ProjectCard[] {
  const frames = new Set(frameOf(ownAsk))
  const picked: ProjectCard[] = []
  const passedOver: ProjectCard[] = []
  for (const card of candidates) {
    if (picked.length === count) break
    const frame = frameOf(asks.get(card.id))
    if (frame.some((f) => frames.has(f))) {
      passedOver.push(card)
      continue
    }
    for (const f of frame) frames.add(f)
    picked.push(card)
  }

  const openings = new Set([ownAsk, ...picked.map((c) => asks.get(c.id))].map(openingOf))
  for (const card of passedOver) {
    if (picked.length === count) break
    const opening = openingOf(asks.get(card.id))
    if (openings.has(opening)) continue
    openings.add(opening)
    picked.push(card)
  }
  return picked
}

/**
 * The first sentence of an ask, folded for comparison. Empty when there is no
 * ask.
 */
function openingOf(prompt: string | undefined): string {
  const first = (prompt ?? '').trim().split(/(?<=[.?!])\s+/)[0] ?? ''
  return first.toLowerCase().replace(/\s+/g, ' ')
}

/**
 * The frame of an ask: the first two and the last three words of its first
 * sentence, which is where a sentence built around a changing noun keeps its
 * shape. None when there is no ask, so a project without one never matches.
 */
function frameOf(prompt: string | undefined): readonly string[] {
  const words = openingOf(prompt).split(' ').filter((w) => w.length > 0)
  if (words.length === 0) return []
  return [`${words.slice(0, 2).join(' ')} …`, `… ${words.slice(-3).join(' ')}`]
}

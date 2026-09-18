/**
 * The feedback composer as a page.
 *
 * Where boldness is spent on this surface: the rating strip under each area,
 * a ruled scale that fills with ink where the reviewer puts it (CONTRACT §1).
 * Everything else is one column of labelled fields, left-aligned under the h1.
 *
 * This route is the thing that works: a real form posting to a Server Action,
 * usable with JavaScript turned off. The dialog on the project page renders the
 * same component and is the enhancement, not the implementation.
 *
 * Two steps, and the first one is the point. Until a reviewer has written their
 * unanchored first impression, this project's existing notes stay hidden from
 * them, here and on the project page. They can open them at any moment with the
 * skip button, and the choice is recorded rather than punished.
 *
 * Who may write here is `reviewRefusal`'s answer, the same one the project
 * page and both composer actions read: not the project's own team, not while
 * feedback is closed, and only its invited reviewers while it is invite-only.
 *
 * The blind step only exists for someone who has not read the thread. A
 * reviewer who already reviewed this project has read it, so they go straight
 * to the areas, told which build their first review was of and that this one
 * is added beside it rather than replacing it.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Banner, Breadcrumbs, EmptyState, StepIndicator } from '@/components/ui'
import type { ProjectDetail } from '@/lib/types'
import { getBlindDraft, viewerReviewStamp, type ReviewStamp } from '@/server/queries/project-surface'
import { postFeedback, recordFirstImpression, revealedProjects, skipBlindStep } from '@/server/actions/feedback'
import { buildComposerData, reviewRefusal } from '@/components/project/composer-data'
import { BlindStep } from '@/components/composer/blind-step'
import { ComposerForm } from '@/components/composer/composer-form'
import { projectForViewer } from '../viewer-project'

type Params = Promise<{ slug: string }>
type Search = Promise<Record<string, string | string[] | undefined>>

function headingFor(project: ProjectDetail): string {
  switch (reviewRefusal(project)) {
    case 'own':
      return `${project.title} is yours`
    case 'closed':
      return `${project.title} is not taking feedback`
    case 'invite':
      return `${project.title} takes invited reviewers only`
    default:
      return `Write feedback on ${project.title}`
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const { project } = await projectForViewer(slug)
  return { title: headingFor(project) }
}

export default async function ComposerPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params
  const sp = await searchParams
  const { project, viewerId } = await projectForViewer(slug)

  if (!viewerId) redirect(`/sign-in?next=${encodeURIComponent(`/p/${slug}/feedback`)}`)

  const refused = reviewRefusal(project)
  const heading = <h1 className="text-2xl text-ink">{headingFor(project)}</h1>

  if (refused) {
    // Nothing here is a feedback form, so the breadcrumb does not end in one.
    return (
      <Column crumbs={[{ label: 'Discover', href: '/discover' }, { label: project.title }]}>
        {heading}
        {refused === 'own' ? (
          <EmptyState
            title="Creators do not review their own builds"
            body="The ratings would stop meaning anything if they could. Share the link instead, and reply to the reviews you get."
            primaryAction={{ label: 'Back to the project', href: `/p/${project.slug}` }}
            secondaryAction={
              project.stats.feedback > 0
                ? { label: 'See what reviewers wrote', href: `/p/${project.slug}#thread` }
                : undefined
            }
            headingLevel={2}
          />
        ) : refused === 'closed' ? (
          <EmptyState
            title="Feedback is closed on this build"
            body="The creator stopped taking reviews on this version. Follow the project and you will hear when the next build opens."
            primaryAction={{ label: 'Back to the project', href: `/p/${project.slug}` }}
            headingLevel={2}
          />
        ) : (
          <EmptyState
            title="This build is reviewed by invitation"
            body="The creator is taking notes on it only from the reviewers they asked: experts they awarded one of its bounties and testers they invited into a playtest round. Everything already written stays readable on the project page, and following it tells you when the next build is posted."
            primaryAction={{ label: 'Back to the project', href: `/p/${project.slug}` }}
            secondaryAction={
              project.stats.feedback > 0
                ? { label: 'Read what reviewers wrote', href: `/p/${project.slug}#thread` }
                : undefined
            }
            headingLevel={2}
          />
        )}
      </Column>
    )
  }

  const crumbs = [
    { label: 'Discover', href: '/discover' },
    { label: project.title, href: `/p/${project.slug}` },
    { label: 'Write feedback' },
  ]
  const data = buildComposerData(project, viewerId)
  const composer = (
    <ComposerForm data={data} action={postFeedback} cancelHref={`/p/${project.slug}`} variant="page" />
  )

  // Someone who has reviewed this project has read its thread: there is nothing
  // left to be blind to, and a second review sits beside the first.
  const stamp = project.viewer.hasReviewed ? viewerReviewStamp(project.id, viewerId) : undefined
  if (stamp) {
    return (
      <Column crumbs={crumbs}>
        {heading}
        <Banner
          title={`You reviewed ${stamp.versionLabel ?? project.title}${stamp.submittedAt ? ` on ${dayOf(stamp.submittedAt)}` : ''}`}
          action={{ label: 'Read your first review', href: `/p/${project.slug}?notes=all#note-${stamp.feedbackId}` }}
        >
          {secondReviewLine(stamp, project)}
        </Banner>
        {composer}
      </Column>
    )
  }

  const draft = getBlindDraft(project.id, viewerId)
  const requested = typeof sp['step'] === 'string' ? sp['step'] : ''
  // A saved impression opens on the areas, and the step row's link reopens the
  // impression itself: that link used to land on the areas again. Without one,
  // `?step=notes` goes straight to the areas and the row says the first step
  // was not written rather than calling it done. Notes kept from an earlier
  // visit open on the areas too: that is where the reviewer left off.
  const step: 'impression' | 'notes' =
    requested === 'impression'
      ? 'impression'
      : draft || requested === 'notes' || data.savedNotes
        ? 'notes'
        : 'impression'
  const notesRead = (await revealedProjects()).has(project.id)

  return (
    <Column crumbs={crumbs}>
      {heading}

      <StepIndicator
        label={`Reviewing ${project.title}`}
        steps={[
          {
            id: 'impression',
            label: 'First impression',
            status: step === 'impression' ? 'current' : draft ? 'done' : 'ahead',
            href: step === 'notes' && draft ? `/p/${project.slug}/feedback?step=impression` : undefined,
          },
          {
            id: 'notes',
            label: 'Area by area',
            status: step === 'notes' ? 'current' : 'ahead',
          },
        ]}
      />

      {step === 'impression' ? (
        <>
          <BlindStep
            project={data.project}
            action={recordFirstImpression}
            skipAction={skipBlindStep}
            noteCount={project.stats.feedback}
            notesRead={notesRead}
            saved={draft ? { impression: draft.headline, seconds: draft.dwellSeconds ?? 0 } : undefined}
          />
          <p className="text-xs text-ink-3">
            Changed your mind?{' '}
            <Link href={`/p/${project.slug}`} className="link text-ink">
              Back to {project.title}
            </Link>
          </p>
        </>
      ) : (
        composer
      )}
    </Column>
  )
}

/**
 * 42rem of content, with the page gutter outside it. The gutter used to come
 * out of a 66ch box, which left the five area tabs too little room at 1440 and
 * cut the last one off behind the scroll edge.
 */
function Column({ crumbs, children }: { crumbs: { label: string; href?: string }[]; children: React.ReactNode }) {
  return (
    <div className="pad-inline w-full">
      <div className="mx-auto flex w-full max-w-prose flex-col gap-8 py-8">
        <Breadcrumbs items={crumbs} />
        {children}
      </div>
    </div>
  )
}

/**
 * A calendar day in the form the rest of the product prints ("Mar 14, 2026"),
 * fixed to UTC because this is rendered on the server for every reader.
 */
const DAY = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function dayOf(ts: number): string {
  return DAY.format(new Date(ts))
}

function secondReviewLine(stamp: ReviewStamp, project: ProjectDetail): string {
  const current = project.currentVersion
  const kept = 'Your first review stays exactly as you posted it.'
  if (current && stamp.versionId === current.id) {
    return `This is a second review of the same build, added beside the first. ${kept}`
  }
  if (current) return `This one is a review of ${current.label}. ${kept}`
  return `This adds a second review. ${kept}`
}

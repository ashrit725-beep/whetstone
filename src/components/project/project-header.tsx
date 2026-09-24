/**
 * The masthead: who made this, what it is, how finished it is, and the three
 * things a reader can do about it.
 *
 * Composed rather than boxed. The name sits on the left at the top of the type
 * scale; the tagline, the grit reading and the actions sit on the right on the
 * same baseline, with the space between them left empty on purpose. Nothing
 * here is centred and nothing here is in a card.
 *
 * The actions are ranked, not equal: one inked, one ruled, and the personal
 * toggles (save, follow) quiet on a line of their own. Rank is the whole point
 * of having more than one.
 */

import Link from 'next/link'
import type { ProjectDetail } from '@/lib/types'
import type { ReviewStamp } from '@/server/queries/project-surface'
// Imported rather than passed in like the two personal toggles: this one is the
// creator's own switch on their own project, so every page that renders this
// header for them gets it without threading a prop through four call sites.
import { setFeedbackState } from '@/server/actions/project'
import { GritReading, Initials, SectionLabel, plural } from './paper'
import { FollowButton } from './follow-button'
import { SaveButton } from './save-button'

export interface ProjectHeaderProps {
  project: ProjectDetail
  section: 'overview' | 'versions' | 'playtest' | 'edit'
  versionCount: number
  roundCount: number
  /** A round taking testers right now, if there is one. */
  openRoundTitle: string | null
  viewerSignedIn: boolean
  /** The viewer's latest review of this project, when they have written one. */
  reviewStamp?: ReviewStamp | undefined
  saveAction: (formData: FormData) => void | Promise<void>
  followAction: (formData: FormData) => void | Promise<void>
}

const STATE_WORDS: Readonly<Record<string, string>> = {
  open: 'Open for feedback',
  invite_only: 'Invited reviewers only',
  closed: 'Feedback closed',
}

export function ProjectHeader({
  project,
  section,
  versionCount,
  roundCount,
  openRoundTitle,
  viewerSignedIn,
  reviewStamp,
  saveAction,
  followAction,
}: ProjectHeaderProps) {
  const stateWord = STATE_WORDS[project.feedbackState] ?? 'Open for feedback'
  const isOwner = project.viewer.isOwner || project.viewer.canEdit
  // "Invited reviewers only" is enforced by the composer, so the header does not
  // offer a form it would refuse. See `reviewRefusal` in composer-data.
  const uninvited = !isOwner && project.feedbackState === 'invite_only' && !project.viewer.invitedToReview
  const closes = project.feedbackClosesAt
  const closesWord = closes !== null && closes > Date.now() ? closingWord(closes) : null

  return (
    <header className="flex flex-col gap-8">
      <div className="grid gap-x-16 gap-y-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="eyebrow text-ink-2">
              {project.feedbackState === 'closed' ? null : (
                <span aria-hidden="true" className="ws-dot ws-dot-ink" />
              )}
              {stateWord}
              {closesWord ? <span className="text-ink-3">{closesWord}</span> : null}
            </span>
          </p>

          <h1 className="mt-4 text-xl sm:text-2xl lg:text-3xl">{project.title}</h1>

          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-base text-ink-2">
            <Link
              href={`/u/${project.owner.handle}`}
              className="link tap-44 inline-flex items-center gap-3 text-ink"
            >
              <Initials name={project.owner.displayName} src={project.owner.avatarUrl} size="sm" />
              {project.owner.displayName}
            </Link>
            <span className="text-ink-3">{project.typeLabel}</span>
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {project.tagline ? (
            <p className="voice max-w-[28ch] text-md italic">{project.tagline}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <GritReading grit={project.grit} />
            <span className="tnum text-xs text-ink-3">
              {project.stats.reviewers} {plural(project.stats.reviewers, 'reviewer', 'reviewers')} ·{' '}
              {project.stats.feedback} {plural(project.stats.feedback, 'note', 'notes')}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              {/* No action links to the section it is already on: the form for
                  it is directly below the header there. */}
              {isOwner ? (
                <>
                  {section === 'versions' ? null : (
                    <Link href={`/p/${project.slug}/versions#new-build`} className="btn">
                      Post a build
                    </Link>
                  )}
                  {section === 'playtest' ? null : (
                    <Link href={`/p/${project.slug}/playtest#new-round`} className="btn btn-secondary">
                      Open a round
                    </Link>
                  )}
                  {/* This one project's switch. The publish step promises the
                      creator they can close feedback whenever they like, and the
                      danger zone says each project reopens from its own page:
                      until this button, neither was true, and reopening meant
                      posting a build. No confirmation, because the button that
                      undoes it is this one with the other label. */}
                  <form action={setFeedbackState}>
                    <input type="hidden" name="slug" value={project.slug} />
                    <input
                      type="hidden"
                      name="open"
                      value={project.feedbackState === 'closed' ? 'true' : 'false'}
                    />
                    <button type="submit" className="btn btn-secondary">
                      {project.feedbackState === 'closed' ? 'Take notes again' : 'Stop taking notes'}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  {project.feedbackState === 'closed' || (viewerSignedIn && uninvited) ? (
                    // A shut door is said on the button, unless this reader
                    // already wrote a review: then the useful thing is theirs.
                    reviewStamp ? (
                      <YourReviewLink slug={project.slug} stamp={reviewStamp} />
                    ) : (
                      <span className="btn" aria-disabled="true">
                        {project.feedbackState === 'closed' ? 'Feedback is closed' : 'By invitation only'}
                      </span>
                    )
                  ) : viewerSignedIn ? (
                    <ReviewAction project={project} stamp={reviewStamp} />
                  ) : (
                    <Link href={`/sign-in?next=/p/${project.slug}/feedback`} className="btn">
                      Sign in to give feedback
                    </Link>
                  )}
                  {section === 'playtest' ? null : (
                    <Link href={`/p/${project.slug}/playtest`} className="btn btn-secondary">
                      {openRoundTitle ? 'Join the playtest' : 'See the rounds'}
                    </Link>
                  )}
                </>
              )}
            </div>

            {/* The two personal toggles get their own quieter line under the
                ranked actions. Sharing one row, four controls outgrew the
                column at 1440 and dropped Follow onto a line by itself. The
                negative margin lines their icons up with the buttons above. */}
            <div className="-ml-3 flex flex-wrap items-center gap-1">
              <SaveButton
                slug={project.slug}
                saved={project.viewer.bookmarked}
                signedIn={viewerSignedIn}
                action={saveAction}
              />
              {/* A creator's own project is already in their dashboard, so the
                  control that would notify them about themselves is not shown. */}
              {isOwner ? null : (
                <FollowButton
                  slug={project.slug}
                  following={project.viewer.follows}
                  signedIn={viewerSignedIn}
                  action={followAction}
                />
              )}
            </div>
          </div>

          {project.feedbackState === 'closed' ? (
            <p className="max-w-[46ch] text-xs text-ink-3">
              {isOwner
                ? // Said to the person who can change it, beside the button that
                  // changes it. It used to read as though only a new build could.
                  'You have stopped taking notes on this build. Everything already written stays readable, and Take notes again opens it without posting anything.'
                : 'The creator has stopped taking notes on this build. Everything already written stays readable, and a new build reopens it.'}
            </p>
          ) : uninvited ? (
            <p className="max-w-[46ch] text-xs text-ink-3">
              The creator is taking notes on this build from the reviewers they invited: experts they
              awarded one of its bounties and testers they asked into a round. Everything already
              written stays readable.
            </p>
          ) : null}
        </div>
      </div>

      <SectionLabel>
        {openRoundTitle ? `Round open · ${openRoundTitle}` : `${project.typeLabel} · ${project.stats.views.toLocaleString('en-GB')} views`}
      </SectionLabel>

      <nav aria-label={`Sections of ${project.title}`}>
        <ul className="m-0 flex list-none flex-wrap items-center gap-x-8 gap-y-1 p-0">
          <TabLink href={`/p/${project.slug}`} current={section === 'overview'}>
            Overview
          </TabLink>
          <TabLink href={`/p/${project.slug}/versions`} current={section === 'versions'} count={versionCount}>
            Builds
          </TabLink>
          <TabLink href={`/p/${project.slug}/playtest`} current={section === 'playtest'} count={roundCount}>
            Playtest
          </TabLink>
          {/* Owner-only, and in the navigation rather than among the actions:
              editing a live project is a place to go, not a thing to do once,
              and it is reachable from all four of its pages. */}
          {isOwner && project.status !== 'draft' ? (
            <TabLink href={`/p/${project.slug}/edit`} current={section === 'edit'}>
              Edit
            </TabLink>
          ) : null}
        </ul>
      </nav>
    </header>
  )
}

/**
 * A signed-in reader's main button, which depends on what they already wrote.
 *
 * Someone who has not reviewed is asked to. Someone whose review predates the
 * current build is asked to review the new one, which is the second pass the
 * builds page makes cheap. Someone who has reviewed the build that is up now
 * has nothing new to look at, so the button takes them to what they wrote.
 */
function ReviewAction({ project, stamp }: { project: ProjectDetail; stamp: ReviewStamp | undefined }) {
  const feedbackHref = `/p/${project.slug}/feedback`
  if (!stamp) {
    return (
      <Link href={feedbackHref} className="btn">
        Give feedback
      </Link>
    )
  }

  // A review not filed against a named build still has a date, and a build
  // posted after that date is one the reviewer has not seen.
  const current = project.currentVersion
  const newBuild =
    current !== null &&
    current.id !== stamp.versionId &&
    (stamp.versionId !== null || (current.releasedAt ?? current.createdAt) > (stamp.submittedAt ?? 0))

  return newBuild ? (
    <Link href={feedbackHref} className="btn">
      Review the new build
    </Link>
  ) : (
    <YourReviewLink slug={project.slug} stamp={stamp} />
  )
}

/** The whole thread, so the note is on the page whatever its rank, opened at it. */
function YourReviewLink({ slug, stamp }: { slug: string; stamp: ReviewStamp }) {
  return (
    <Link href={`/p/${slug}?notes=all#note-${stamp.feedbackId}`} className="btn">
      See your review
    </Link>
  )
}

function TabLink({
  href,
  current,
  count,
  children,
}: {
  href: string
  current: boolean
  count?: number
  children: React.ReactNode
}) {
  return (
    <li>
      <Link href={href} className="ws-tab" aria-current={current ? 'page' : undefined}>
        {children}
        {count === undefined ? null : <span className="tnum text-xs text-ink-3">{count}</span>}
      </Link>
    </li>
  )
}

/** “closes Friday”, and nothing more precise than the data supports. */
function closingWord(ts: number): string {
  const days = Math.round((ts - Date.now()) / 86_400_000)
  if (days <= 0) return '· closes today'
  if (days === 1) return '· closes tomorrow'
  if (days < 7) return `· closes in ${String(days)} days`
  const weeks = Math.round(days / 7)
  return `· closes in ${String(weeks)} ${weeks === 1 ? 'week' : 'weeks'}`
}

export default ProjectHeader

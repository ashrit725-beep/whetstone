'use server'

/**
 * Mutations for the feedback thread and the composer.
 *
 * Every one of these is posted by a real `<form>`, so the composer, the vote,
 * the reply and the reveal all work with JavaScript turned off. The client
 * islands add optimism on top; they are never the only path.
 */

import { actionRefusal } from './limits'
import { cookies } from 'next/headers'
import {
  canSeeFeedback,
  canSeeProject,
  feedbackAccess,
  isCollaborator,
  pointAccess,
  projectAccess,
} from '@/server/queries/access'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
// Every write below authorises from `claims.uid`, so the claims must come from
// a session that is still live. A signature proves the cookie is authentic and
// nothing more: a JWT stays valid until it expires, so a cookie revoked by a
// sign-out or a password reset would otherwise keep authorising writes for up
// to thirty days. `currentClaimsLive()` puts the revocation check in front.
import { currentClaimsLive } from '@/server/queries/auth'
import type { FormState } from '@/components/ui/form'
import {
  ACTIONABILITY_KEYS,
  RATING_SCALE_MAX,
  SEVERITY_KEYS,
  axesFor,
  categoriesFor,
  type ActionabilityKey,
  type SeverityKey,
} from '@/lib/taxonomy'
import { inSentence, truncate } from '@/lib/utils'
import type { ProjectDetail } from '@/lib/types'
import { getProjectBySlug } from '@/server/repos/projects'
import {
  createFeedback,
  createReply,
  markHelpful,
  setPointResolved,
  voteFeedback,
  votePoint,
} from '@/server/repos/feedback'
import { createSuggestion, setSuggestionStatus, SuggestionStatusError } from '@/server/repos/suggestions'
import { discardBlindDraft, saveBlindDraft } from '@/server/queries/project-surface'
import { DRAFT_SCHEMA_VERSION, deleteComposerDraftForProject, saveComposerDraft } from '@/server/queries/drafts'
import { consume } from '@/server/api/rate-limit'
import { LIMITS } from '@/server/api/limits'
import { coachLabel, generate as coachGenerate } from '@/server/ai/coach'
import { isProjectType } from '@/server/ai'
import { projectVocabularyFor } from '@/server/queries/cluster-input'
import { reviewerQualityScore } from '@/server/repos/stats'
import {
  SavedNotesPayload,
  askAnsweredBy,
  defaultCategoryFor,
  hasBuildToOpen,
  isEmptyNotes,
  keepClock,
  reviewRefusal,
  stepsIn,
  type ReviewRefusal,
} from '@/components/project/composer-data'
import { NOTE_CHARS } from '@/components/composer/types'

const BLIND_COOKIE = 'ws_blind'

/* --------------------------------------------------------- the blind gate -- */

async function readRevealed(): Promise<string[]> {
  const jar = await cookies()
  const raw = jar.get(BLIND_COOKIE)?.value
  if (!raw) return []
  return raw.split('.').filter((s) => s.length > 0)
}

/** Projects whose existing notes this viewer has already been shown. */
export async function revealedProjects(): Promise<ReadonlySet<string>> {
  return new Set(await readRevealed())
}

async function reveal(projectId: string): Promise<void> {
  const current = await readRevealed()
  if (current.includes(projectId)) return
  // Keep the cookie small: the last twenty projects is more than a session needs.
  const next = [projectId, ...current].slice(0, 20).join('.')
  const jar = await cookies()
  jar.set(BLIND_COOKIE, next, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 })
}

/**
 * "Skip, and show me the notes." An explicit, recorded choice, because a gate
 * a reader cannot open is a paywall rather than a method.
 */
export async function skipBlindStep(formData: FormData): Promise<void> {
  const projectId = String(formData.get('projectId') ?? '')
  const slug = String(formData.get('slug') ?? '')
  if (!projectId || !slug) return
  await reveal(projectId)
  revalidatePath(`/p/${slug}`)
  redirect(`/p/${slug}#thread`)
}

/**
 * The project a signed-in reviewer may write on: public and published, as the
 * composer page requires before it renders. Both steps looked the slug up with
 * no visibility check, so a direct post could review a private draft by name.
 * A project's own team gets it back, to be refused by the self-review rule.
 */
function reviewable(slug: string, viewerId: string): ProjectDetail | undefined {
  const project = getProjectBySlug(slug, { viewerId })
  if (!project) return undefined
  if (project.viewer.canEdit) return project
  return project.visibility === 'public' && project.status === 'published' ? project : undefined
}

/**
 * What each refusal of `reviewRefusal` says from inside a form. It is the
 * composer page's gate, so the page, the project page and these actions turn
 * the same people away for the same reasons.
 */
function refusalMessage(refusal: ReviewRefusal): string {
  switch (refusal) {
    case 'own':
      return 'This is your own project, so there is nothing to review.'
    case 'closed':
      return 'This creator closed feedback on this build. Follow the project to hear about the next one.'
    case 'invite':
      return 'This build takes notes from invited reviewers only, and this account is not one of them. Everything already written stays readable on the project page.'
  }
}

/* ------------------------------------------------ step 1: first impression -- */

const FirstImpression = z.object({
  slug: z.string().min(1),
  impression: z
    .string()
    .trim()
    .min(30, 'Write at least thirty characters. A first reaction is only useful if it says what happened.')
    // The textarea already caps at 600 and step two's schema does too. This
    // line is what makes it true: without it a request that skips the form
    // writes an unbounded string straight into `feedback.headline`, which the
    // note renders as its opening paragraph.
    .max(600, 'Six hundred characters is the limit for a first impression. The detail belongs in the points.'),
  seconds: z.coerce.number().int().min(0).max(60 * 60 * 8).default(0),
})

export async function recordFirstImpression(_prev: FormState, formData: FormData): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return { status: 'error', message: 'Sign in to write feedback.' }
  const held = actionRefusal('impression', claims.uid)
  if (held) return { status: 'error', message: held }

  const parsed = FirstImpression.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? 'impression')] = issue.message
    return { status: 'error', message: 'This step was not saved.', fieldErrors }
  }

  const project = reviewable(parsed.data.slug, claims.uid)
  if (!project) return { status: 'error', message: 'That project is no longer here.' }
  // A first impression opens a review, so a project that would refuse the
  // review refuses this too, rather than keeping a draft that can never post.
  const refused = reviewRefusal(project)
  if (refused) return { status: 'error', message: refusalMessage(refused) }

  saveBlindDraft({
    projectId: project.id,
    projectTypeId: project.typeSlug,
    reviewerId: claims.uid,
    versionId: project.currentVersion?.id ?? null,
    headline: parsed.data.impression,
    dwellSeconds: parsed.data.seconds,
  })
  // The row above keeps the dwell in whole minutes, which is the unit a posted
  // review's context line is written in and no use to a clock: twenty seconds
  // came back as 0:00 and started again. The exact number goes on the
  // composer's own draft, beside any notes already saved there.
  keepClock(claims.uid, project.id, parsed.data.seconds)
  await reveal(project.id)
  revalidatePath(`/p/${project.slug}`)
  redirect(`/p/${project.slug}/feedback?step=notes`)
}

/* --------------------------------------------------------- the full review -- */

const Review = z.object({
  slug: z.string().min(1),
  impression: z.string().trim().max(600).optional(),
  seconds: z.coerce.number().int().min(0).max(60 * 60 * 8).default(0),
  openedArtifact: z.coerce.boolean().default(false),
})

export async function postFeedback(_prev: FormState, formData: FormData): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return { status: 'error', message: 'Sign in to post feedback.' }
  const held = actionRefusal('review', claims.uid)
  if (held) return { status: 'error', message: held }

  const parsed = Review.safeParse({
    slug: formData.get('slug'),
    impression: formData.get('impression') ?? undefined,
    seconds: formData.get('seconds') ?? 0,
    openedArtifact: formData.get('openedArtifact') ?? false,
  })
  if (!parsed.success) return { status: 'error', message: 'This review was not posted. The project was missing.' }

  const project = reviewable(parsed.data.slug, claims.uid)
  if (!project) return { status: 'error', message: 'That project is no longer here.' }
  // Collaborators count as the project's own: the ratings would stop meaning
  // anything if a build's makers could score it. `invite_only` admits the
  // creator's invited reviewers and nobody else; it used to post like `open`.
  const refused = reviewRefusal(project)
  if (refused) return { status: 'error', message: refusalMessage(refused) }

  const categoryKeys = new Set(categoriesFor(project.typeSlug).map((c) => c.key))
  const axes = axesFor(project.typeSlug)
  const fieldErrors: Record<string, string> = {}

  const points: {
    categoryKey: string
    bodyMd: string
    severity: SeverityKey
    actionability: ActionabilityKey
    askId: string | null
    reproSteps: string | null
  }[] = []
  const ratings: { axisKey: string; value: number }[] = []

  for (const axis of axes) {
    // The verdict, on the scale the project page plots it on and between the
    // anchors the reviewer was shown. Anything that is not a whole step of that
    // scale, including no answer, is "not rated" and stores nothing.
    const rating = Number(formData.get(`rating-${axis.key}`) ?? '')
    if (Number.isInteger(rating) && rating >= 1 && rating <= RATING_SCALE_MAX) {
      ratings.push({ axisKey: axis.key, value: rating })
    }

    const body = String(formData.get(`note-${axis.key}`) ?? '').trim()
    if (body.length === 0) continue
    if (body.length < NOTE_CHARS.min) {
      fieldErrors[`note-${axis.key}`] =
        `Write at least forty characters on ${inSentence(axis.label)}, or clear the box. A one-line note cannot be acted on.`
      continue
    }
    // The counter under the box says this number. Without the check a request
    // that skipped the form could post a note of any length.
    if (body.length > NOTE_CHARS.max) {
      fieldErrors[`note-${axis.key}`] =
        `The note on ${inSentence(axis.label)} runs past ${String(NOTE_CHARS.max)} characters. Trim it, or move what belongs to another area under that area.`
      continue
    }

    // A category the type does not offer, or none at all, files the note where
    // the composer would have preselected it for this area.
    const categoryRaw = String(formData.get(`category-${axis.key}`) ?? '')
    const categoryKey = categoryKeys.has(categoryRaw) ? categoryRaw : defaultCategoryFor(project.typeSlug, axis)
    const severityRaw = String(formData.get(`severity-${axis.key}`) ?? 'minor')
    const actionabilityRaw = String(formData.get(`actionability-${axis.key}`) ?? 'suggestion')
    const severity = (SEVERITY_KEYS as readonly string[]).includes(severityRaw)
      ? (severityRaw as SeverityKey)
      : ('minor' as SeverityKey)
    const actionability = (ACTIONABILITY_KEYS as readonly string[]).includes(actionabilityRaw)
      ? (actionabilityRaw as ActionabilityKey)
      : ('suggestion' as ActionabilityKey)
    // What the note carries besides its words, taken from its words: the ask
    // it answers, and the steps of a note marked as carrying them. Specificity
    // credits both, and without them every review posted here was scored as
    // if it answered nothing.
    points.push({
      categoryKey,
      bodyMd: body,
      severity,
      actionability,
      askId: askAnsweredBy(project.asks, project.typeSlug, categoryKey, body),
      reproSteps: actionability === 'repro' ? stepsIn(body) : null,
    })
  }

  // Only when nothing was written at all. A note that is too short or too long
  // already has its own message, and "write a note" under it contradicts it.
  if (points.length === 0 && Object.keys(fieldErrors).length === 0) {
    fieldErrors['composer-notes'] =
      'Write a note under at least one heading. Reviewers and creators both filter by these, so an uncategorised review reaches nobody.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: 'error',
      message: `${Object.keys(fieldErrors).length} ${Object.keys(fieldErrors).length === 1 ? 'problem' : 'problems'} with this review.`,
      fieldErrors,
    }
  }

  createFeedback({
    projectId: project.id,
    reviewerId: claims.uid,
    versionId: project.currentVersion?.id ?? null,
    origin: 'organic',
    visibility: 'public',
    headline: parsed.data.impression && parsed.data.impression.length > 0 ? parsed.data.impression : null,
    // The impression is the headline and nothing else. Writing it to the body
    // as well printed the same sentence twice in every profile review row,
    // where `ReviewRow` falls back to the first specific point instead.
    summaryMd: null,
    // Kept on the row as well, so the score can be recomputed with the dwell
    // it was first computed with.
    timeSpentMinutes: Math.round(parsed.data.seconds / 60),
    dwellSeconds: parsed.data.seconds,
    // Only a project with a build has a build to leave unopened. Every other
    // review was capped at 0.4 for not clicking a link the form never showed.
    openedArtifact: hasBuildToOpen(project) ? parsed.data.openedArtifact : undefined,
    points,
    ratings,
  })

  discardBlindDraft(project.id, claims.uid)
  deleteComposerDraftForProject(claims.uid, project.id)
  await reveal(project.id)
  revalidatePath(`/p/${project.slug}`)
  redirect(`/p/${project.slug}#thread`)
}

/* ------------------------------------------- notes kept between visits -- */

const SaveNotesInput = z.object({
  projectId: z.string().min(1).max(64),
  payload: SavedNotesPayload,
})

/**
 * Keeps what a reviewer has written under the areas while they write it, so
 * leaving the page, closing the dialog to keep writing later, or a post that
 * fails on its way out does not take the review with it. Clearing every box
 * clears the saved copy too.
 *
 * Quiet by design: it answers whether the notes were kept and never throws.
 * A save that did not happen is retried with the next change, and nothing
 * about saving may interrupt the writing. What is posted still goes through
 * every check in `postFeedback`; this only keeps the words.
 */
export async function saveComposerNotes(input: { projectId: string; payload: SavedNotesPayload }): Promise<boolean> {
  const claims = await currentClaimsLive()
  if (!claims) return false
  if (!consume([LIMITS.draftSave], `uid:${claims.uid}`).allowed) return false
  // The argument arrives from the network whatever its type says.
  const parsed = SaveNotesInput.safeParse(input)
  if (!parsed.success) return false
  // The composer's own gate: nothing is kept for a review that could not post.
  const access = projectAccess(parsed.data.projectId)
  if (!access || !canSeeProject(access, claims.uid)) return false
  const project = reviewable(access.slug, claims.uid)
  if (!project || project.id !== access.id || reviewRefusal(project)) return false

  if (isEmptyNotes(parsed.data.payload.notes)) {
    // Every box cleared. The words go and nothing is brought back from a draft
    // with none in it, but the clock stays: the reviewer has had this review
    // open that long, and the only other copy of the number is the draft row's
    // whole minutes, where a twenty-second read is zero.
    if (parsed.data.payload.seconds > 0) keepClock(claims.uid, project.id, parsed.data.payload.seconds, {})
    else deleteComposerDraftForProject(claims.uid, project.id)
    return true
  }
  saveComposerDraft({
    reviewerId: claims.uid,
    projectId: project.id,
    payload: parsed.data.payload,
    schemaVersion: DRAFT_SCHEMA_VERSION,
  })
  return true
}

/* --------------------------------------------------------------- the thread */

export async function voteOnFeedback(formData: FormData): Promise<void> {
  const claims = await currentClaimsLive()
  if (!claims) return
  if (actionRefusal('vote', claims.uid)) return
  const feedbackId = String(formData.get('feedbackId') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const nextRaw = String(formData.get('vote') ?? '0')
  const next = nextRaw === '1' ? 1 : nextRaw === '-1' ? -1 : 0
  if (!feedbackId) return
  // The API twin at /api/feedback/[feedbackId]/vote enforces both of these and
  // this action enforced neither, so a signed-in caller could vote on a
  // creator-only review by id, or upvote their own.
  const target = feedbackAccess(feedbackId)
  if (!target || !canSeeFeedback(target, claims.uid)) return
  if (target.reviewerId === claims.uid) return
  voteFeedback(feedbackId, claims.uid, next)
  if (slug) revalidatePath(`/p/${slug}`)
}

export async function voteOnPoint(formData: FormData): Promise<void> {
  const claims = await currentClaimsLive()
  if (!claims) return
  if (actionRefusal('vote', claims.uid)) return
  const pointId = String(formData.get('pointId') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const on = String(formData.get('on') ?? 'true') === 'true'
  if (!pointId) return
  // A point inherits its note's visibility, and its note's author cannot
  // agree with their own point.
  const owningPoint = pointAccess(pointId)
  const owningNote = owningPoint ? feedbackAccess(owningPoint.feedbackId) : undefined
  if (!owningNote || !canSeeFeedback(owningNote, claims.uid)) return
  if (owningNote.reviewerId === claims.uid) return
  votePoint(pointId, claims.uid, on)
  if (slug) revalidatePath(`/p/${slug}`)
}

const Reply = z.object({
  feedbackId: z.string().min(1),
  slug: z.string().min(1),
  body: z.string().trim().min(2, 'Write a reply before you post it.').max(4000),
})

export async function replyToFeedback(_prev: FormState, formData: FormData): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return { status: 'error', message: 'Sign in to reply.' }
  const held = actionRefusal('reply', claims.uid)
  if (held) return { status: 'error', message: held }
  const parsed = Reply.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? 'body')] = issue.message
    return { status: 'error', message: 'This reply was not posted.', fieldErrors }
  }
  // Posting into a thread requires being able to read it. Without this, a
  // creator-only review could be replied to by anyone holding its id.
  const thread = feedbackAccess(parsed.data.feedbackId)
  if (!thread || !canSeeFeedback(thread, claims.uid)) {
    return { status: 'error', message: 'That review is no longer here.' }
  }
  createReply({ feedbackId: parsed.data.feedbackId, authorId: claims.uid, bodyMd: parsed.data.body })
  revalidatePath(`/p/${parsed.data.slug}`)
  return { status: 'success', message: 'Reply posted.' }
}

export async function markFeedbackHelpful(formData: FormData): Promise<void> {
  const claims = await currentClaimsLive()
  if (!claims) return
  if (actionRefusal('mark', claims.uid)) return
  const feedbackId = String(formData.get('feedbackId') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const helpful = String(formData.get('helpful') ?? 'true') === 'true'
  if (!feedbackId) return
  // "The creator found this helpful" is the creator's own endorsement: it feeds
  // the reviewer's reputation and the ranking. Any signed-in account could set
  // it on any review by id.
  const note = feedbackAccess(feedbackId)
  if (!note) return
  const owns = note.projectOwnerId === claims.uid || isCollaborator(note.projectId, claims.uid)
  if (!owns) return
  markHelpful(feedbackId, helpful, claims.uid)
  if (slug) revalidatePath(`/p/${slug}`)
}

/** The longest a ship note may be; the field's counter prints the same number. */
const SHIP_NOTE_MAX = 600
const SHIP_TITLE_MAX = 120

/**
 * "This shipped." The close-the-loop move: it resolves the point, records a
 * shipped suggestion against the build it went out in, and the suggestion
 * repository notifies every reviewer whose note fed it.
 */
export async function markPointShipped(_prev: FormState, formData: FormData): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return { status: 'error', message: 'Sign in first.' }
  // Each one writes a suggestion and notifies a reviewer, so it is metered like
  // any other write that reaches another person.
  const held = actionRefusal('ship', claims.uid)
  if (held) return { status: 'error', message: held }

  const slug = String(formData.get('slug') ?? '')
  const pointId = String(formData.get('pointId') ?? '')
  // The form sends the note this is about in full; the tracker's title is cut
  // here, where the limit lives, on a word boundary and with an ellipsis.
  const title = truncate(String(formData.get('title') ?? ''), SHIP_TITLE_MAX)
  const note = String(formData.get('note') ?? '').trim()
  const versionId = String(formData.get('versionId') ?? '')

  if (!slug || !pointId) return { status: 'error', message: 'That note is no longer here.' }

  const project = getProjectBySlug(slug, { viewerId: claims.uid })
  if (!project) return { status: 'error', message: 'That project is no longer here.' }
  if (!project.viewer.canEdit) {
    return { status: 'error', message: 'Only the creator can mark a note as shipped.' }
  }
  // The slug and the point id arrive separately, so they have to be checked
  // against each other: ownership of one project was letting a creator resolve
  // a point on somebody else's and notify its reviewer.
  const shippedPoint = pointAccess(pointId)
  const shippedNote = shippedPoint ? feedbackAccess(shippedPoint.feedbackId) : undefined
  if (!shippedNote || shippedNote.projectId !== project.id) {
    return { status: 'error', message: 'That note is not on this project.' }
  }
  if (note.length < 10) {
    return {
      status: 'error',
      message: 'This note was not marked as shipped.',
      fieldErrors: { note: 'Say what you changed. The reviewer sees this sentence, and it is what makes the credit auditable.' },
    }
  }
  if (note.length > SHIP_NOTE_MAX) {
    return {
      status: 'error',
      message: 'This note was not marked as shipped.',
      fieldErrors: {
        note: `Keep it to ${String(SHIP_NOTE_MAX)} characters. The reviewer reads it as the line that credits them, not as a changelog.`,
      },
    }
  }
  // The build is a row of this project, the way the tracker's move checks it:
  // an id from another project would put the credit on somebody else's build.
  if (versionId.length > 0 && !project.versions.some((v) => v.id === versionId)) {
    return { status: 'error', message: 'That build is not one of this project’s. Reload the page and try again.' }
  }

  const suggestionId = createSuggestion({
    projectId: project.id,
    createdBy: claims.uid,
    title: title.length > 0 ? title : 'Shipped from a review note',
    bodyMd: note,
    sourcePointIds: [pointId],
  })

  try {
    setSuggestionStatus({
      suggestionId,
      status: 'shipped',
      actorId: claims.uid,
      note,
      shippedInVersionId: versionId.length > 0 ? versionId : (project.currentVersion?.id ?? null),
    })
  } catch (error) {
    if (error instanceof SuggestionStatusError) {
      return { status: 'error', message: 'This note was not marked as shipped.', fieldErrors: { [error.field]: error.message } }
    }
    throw error
  }

  setPointResolved(pointId, true)
  revalidatePath(`/p/${slug}`)
  return { status: 'success', message: 'Marked as shipped. Every reviewer whose note fed it has been told.' }
}

/* ------------------------------------------------------------- the coach --- */

export interface CoachReading {
  readonly verdict: string
  readonly checks: Readonly<Record<string, boolean>>
  readonly suggestions: readonly { prompt: string; scaffold: string }[]
  /** Honest provenance. Says "Writing tips" when no key is configured. */
  readonly label: string
  readonly usedModel: boolean
}

const CoachInput = z.object({
  draftId: z.string().min(1).max(64),
  draft: z.string().max(4_000),
  projectId: z.string().min(1).max(64),
  axisKey: z.string().max(64),
  ask: z.string().max(600),
})

/**
 * The quality coach. Advisory, never blocking: it has no verb, it cannot stop a
 * submit, and it returns silence far more often than it speaks. The module
 * itself enforces the nudge budget and the cooldown, server-side, so a chatty
 * client cannot make it noisy.
 */
export async function coachNote(input: {
  draftId: string
  draft: string
  projectId: string
  axisKey: string
  ask: string
}): Promise<CoachReading | null> {
  const claims = await currentClaimsLive()
  if (!claims) return null
  if (actionRefusal('aiCoach', claims.uid)) return null
  // The argument arrives from the network whatever its type says, and the
  // draft is forwarded to a paid provider, so it is parsed and bounded here.
  const parsed = CoachInput.safeParse(input)
  if (!parsed.success) return null
  const { draftId, draft, projectId, axisKey, ask } = parsed.data
  if (draft.trim().length < NOTE_CHARS.min) return null
  // A project this reviewer can read, and a note they could post: the
  // composer's own gate, so the paid reading is never spent on a review of
  // their own build, a closed one, or one taking invited reviewers only.
  const access = projectAccess(projectId)
  if (!access || !canSeeProject(access, claims.uid)) return null
  const project = reviewable(access.slug, claims.uid)
  if (!project || project.id !== projectId || reviewRefusal(project)) return null

  const quality = reviewerQualityScore(claims.uid)
  const result = await coachGenerate({
    // The coach's per-draft nudge budget keys on this string. The API route
    // namespaces it by viewer for exactly that reason and this action did not,
    // so two reviewers sharing a draft id shared one budget.
    draftId: `${claims.uid}:${draftId}`,
    draft,
    projectId,
    // The type and the project's own words, both already in hand. Without them
    // `scaffoldFor` fell through to the generic table on every project, so the
    // per-type scaffolds were unreachable, and the `specific` check skipped its
    // vocabulary pass — naming an in-product term stopped counting as specific.
    ...(isProjectType(project.typeSlug) ? { projectType: project.typeSlug } : {}),
    axisKey,
    ask,
    vocabulary: projectVocabularyFor(projectId),
    reviewerId: claims.uid,
    // The rule that leaves a consistently good reviewer alone had no figure to
    // read, so it never fired for anyone. Null until they have written ten.
    ...(quality === null ? {} : { reviewerQuality: quality }),
  })

  return {
    verdict: result.data.verdict,
    checks: result.data.checks,
    suggestions: result.data.suggestions.map((s) => ({ prompt: s.prompt, scaffold: s.scaffold })),
    label: coachLabel(result),
    usedModel: result.source === 'ai',
  }
}

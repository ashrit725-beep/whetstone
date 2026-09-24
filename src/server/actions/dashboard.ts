'use server'

/**
 * Creator dashboard mutations: triage state, the creator’s helpful mark, and
 * promoting a theme into a tracked suggestion.
 *
 * Every action re-derives identity from the session cookie and re-checks
 * ownership per row, because a form field is a request, not a permission.
 * Nothing here trusts a hidden input for anything but the subject id.
 */

import { actionRefusal } from './limits'
import { revalidatePath } from 'next/cache'
import { feedbackAccess, pointAccess } from '@/server/queries/access'
import { z } from 'zod'
// Every write below authorises from `claims.uid`, so the claims must come from
// a session that is still live. A signature proves the cookie is authentic and
// nothing more: a JWT stays valid until it expires, so a cookie revoked by a
// sign-out or a password reset would otherwise keep authorising writes for up
// to thirty days. `currentClaimsLive()` puts the revocation check in front.
import { currentClaimsLive } from '@/server/queries/auth'
import type { FormState } from '@/components/ui'
import {
  getFeedback,
  markHelpful,
  setInboxState,
} from '@/server/repos/feedback'
import { createSuggestion } from '@/server/repos/suggestions'
import { getProjectById } from '@/server/repos/projects'
import type { InboxState } from '@/lib/types'

const INBOX_PATH = '/dashboard/inbox'

const STATES = ['new', 'read', 'triaged', 'actioned', 'archived'] as const

/** More rows than any page of the inbox shows, and a ceiling on one request's work. */
const BULK_MAX = 500

const BulkSchema = z.object({
  state: z.enum(STATES),
  ids: z
    .array(z.string().min(1).max(64))
    .min(1, 'Select at least one note before moving it.')
    .max(BULK_MAX, `Move at most ${String(BULK_MAX)} notes at a time.`),
})

function fail(message: string): FormState {
  return { status: 'error', message }
}

async function requireCreator(): Promise<string | null> {
  const claims = await currentClaimsLive()
  return claims?.uid ?? null
}

/**
 * Moves one or many reviews to a triage state. The count in the result is the
 * number actually written, so a partial failure reports the real number rather
 * than the number requested.
 */
export async function moveInboxState(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireCreator()
  if (!userId) return fail('Your session ended. Sign in again to triage this inbox.')
  const held = actionRefusal('mark', userId)
  if (held) return fail(held)

  const parsed = BulkSchema.safeParse({
    state: formData.get('state'),
    ids: formData.getAll('ids').map(String),
  })
  if (!parsed.success) {
    // No field: the checkboxes are the rows themselves, so there is no one
    // input to link to, and naming one repeated this sentence under itself.
    const first = parsed.error.issues[0]
    return fail(first?.message ?? 'That move was not applied.')
  }

  const { state, ids } = parsed.data
  let moved = 0
  for (const id of ids) {
    const row = getFeedback(id, userId)
    if (!row || !row.viewer.isCreator) continue
    setInboxState(id, state as InboxState)
    moved += 1
  }

  if (moved === 0) {
    return fail('None of those notes are on a project you own, so nothing moved.')
  }

  revalidatePath(INBOX_PATH)
  revalidatePath('/dashboard')
  const noun = moved === 1 ? 'note' : 'notes'
  return { status: 'success', message: `${String(moved)} ${noun} moved to ${LABEL[state]}.` }
}

const LABEL: Record<(typeof STATES)[number], string> = {
  new: 'New',
  read: 'Read',
  triaged: 'Triaged',
  actioned: 'Actioned',
  archived: 'Archived',
}

/**
 * The creator’s helpful mark. Worth less the more freely it is given, and worth
 * nothing on a bounty-paid review, both of which the repository handles.
 */
export async function toggleHelpful(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireCreator()
  if (!userId) return fail('Your session ended. Sign in again to mark this note.')
  const held = actionRefusal('mark', userId)
  if (held) return fail(held)

  const id = String(formData.get('feedbackId') ?? '')
  const helpful = String(formData.get('helpful') ?? '') === 'true'
  const row = getFeedback(id, userId)
  if (!row || !row.viewer.isCreator) {
    return fail('That note is not on a project you own.')
  }

  markHelpful(id, helpful, userId)
  revalidatePath(INBOX_PATH)
  return {
    status: 'success',
    message: helpful
      ? `Marked helpful. ${row.reviewer.displayName} will see it.`
      : 'Helpful mark removed.',
  }
}

const PromoteSchema = z.object({
  projectId: z.string().min(1),
  title: z
    .string()
    .trim()
    .min(6, 'Give the suggestion a title a reviewer would recognise, at least six characters.')
    .max(120, 'Keep the title under 120 characters so it fits a tracker card.'),
  body: z.string().trim().max(2000).optional(),
  pointIds: z.array(z.string().min(1)),
  themeLabel: z.string().trim().max(120).optional(),
})

/**
 * Turns a theme into a tracked suggestion, carrying the evidence with it.
 *
 * The `sourcePointIds` link is the whole mechanic: it is what lets the tracker
 * tell each of those reviewers, by name, that their note shipped.
 */
export async function promoteThemeToSuggestion(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireCreator()
  if (!userId) return fail('Your session ended. Sign in again to track this theme.')
  const held = actionRefusal('mark', userId)
  if (held) return fail(held)

  const parsed = PromoteSchema.safeParse({
    projectId: formData.get('projectId'),
    title: formData.get('title'),
    body: formData.get('body') ?? undefined,
    pointIds: formData.getAll('pointIds').map(String),
    themeLabel: formData.get('themeLabel') ?? undefined,
  })
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'title')
      fieldErrors[key] = issue.message
    }
    return {
      status: 'error',
      message: 'This suggestion was not created.',
      fieldErrors,
    }
  }

  const project = getProjectById(parsed.data.projectId)
  if (!project || project.owner_id !== userId) {
    return fail('You can only track suggestions on a project you own.')
  }

  // The point ids arrive from the form and become the suggestion's evidence
  // trail, which the reviewer is later credited for. Owning the project the
  // suggestion is on does not make somebody else's points evidence for it.
  const foreign = parsed.data.pointIds.filter((id) => {
    const point = pointAccess(id)
    const note = point ? feedbackAccess(point.feedbackId) : undefined
    return !note || note.projectId !== parsed.data.projectId
  })
  if (foreign.length > 0) {
    return fail('One of those points is not on this project.')
  }

  createSuggestion({
    projectId: parsed.data.projectId,
    createdBy: userId,
    title: parsed.data.title,
    bodyMd: parsed.data.body ?? null,
    sourcePointIds: parsed.data.pointIds,
  })

  revalidatePath('/dashboard/suggestions')
  revalidatePath('/dashboard/insights')
  const n = parsed.data.pointIds.length
  return {
    status: 'success',
    message:
      n > 0
        ? `Tracked in Open, carrying ${String(n)} ${n === 1 ? 'note' : 'notes'} as evidence.`
        : 'Tracked in Open.',
  }
}

'use server'

/**
 * The suggestion tracker’s one write, and the most important mechanic in the
 * product.
 *
 * Moving a suggestion to Shipped is what closes the loop: every reviewer whose
 * note fed it is notified by name and credited in the reputation ledger, inside
 * the same transaction as the status change (`setSuggestionStatus`). This action
 * reads the contributors *before* the move so the result can name how many
 * people were thanked, rather than reporting a row id.
 *
 * The two product refusals are surfaced, not swallowed: shipping links a
 * version or a note, and declining owes the reviewer a reason.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
// Every write below authorises from `claims.uid`, so the claims must come from
// a session that is still live. A signature proves the cookie is authentic and
// nothing more: a JWT stays valid until it expires, so a cookie revoked by a
// sign-out or a password reset would otherwise keep authorising writes for up
// to thirty days. `currentClaimsLive()` puts the revocation check in front.
import { currentClaimsLive } from '@/server/queries/auth'
import type { FormState } from '@/components/ui'
import { getProjectById } from '@/server/repos/projects'
import { projectVersions } from '@/server/queries/dashboard'
import {
  getSuggestion,
  setSuggestionStatus,
  SuggestionStatusError,
  statusLabel,
} from '@/server/repos/suggestions'
import type { SuggestionStatus } from '@/lib/types'

const TRACKER_PATH = '/dashboard/suggestions'

const MOVE_TARGETS = [
  'open',
  'under_review',
  'planned',
  'in_progress',
  'shipped',
  'declined',
  'wont_fix',
] as const

const MoveSchema = z.object({
  suggestionId: z.string().min(1),
  status: z.enum(MOVE_TARGETS),
  note: z.string().trim().max(600).optional(),
  version: z.string().trim().max(60).optional(),
  /** Where the card landed, 1-based, for the announcement. */
  position: z.coerce.number().int().min(0).optional(),
  total: z.coerce.number().int().min(0).optional(),
})

function fail(message: string, field?: string): FormState {
  return { status: 'error', message, ...(field ? { fieldErrors: { [field]: message } } : {}) }
}

/**
 * Moves one suggestion. The same action backs the drag, the “Move to…” menu and
 * the shipped and declined dialogs, so the three paths cannot drift apart.
 */
export async function moveSuggestion(_prev: FormState, formData: FormData): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return fail('Your session ended. Sign in again to move this suggestion.')

  const parsed = MoveSchema.safeParse({
    suggestionId: formData.get('suggestionId'),
    status: formData.get('status'),
    note: formData.get('note') ?? undefined,
    version: formData.get('version') ?? undefined,
    position: formData.get('position') ?? undefined,
    total: formData.get('total') ?? undefined,
  })
  if (!parsed.success) {
    return fail('That move was not applied. Pick a column and try it again.')
  }

  const { suggestionId, status, note, version } = parsed.data
  const current = getSuggestion(suggestionId, claims.uid)
  if (!current) return fail('That suggestion no longer exists. Reload the tracker.')

  const project = getProjectById(current.projectId)
  if (!project || project.owner_id !== claims.uid) {
    return fail('You can only move suggestions on a project you own.')
  }
  if (current.status === status) {
    return { status: 'success', message: `${current.title} is already in ${statusLabel(status)}.` }
  }

  const thanked = current.contributors.length
  // A version is a real row, not free text: an id that is not this project’s
  // would break the foreign key, so an unknown one is dropped and the note
  // carries the record instead.
  const versionId =
    version && projectVersions(current.projectId).some((v) => v.id === version) ? version : null

  try {
    setSuggestionStatus({
      suggestionId,
      status: status as SuggestionStatus,
      actorId: claims.uid,
      note: note && note.length > 0 ? note : null,
      shippedInVersionId: versionId,
    })
  } catch (error) {
    if (error instanceof SuggestionStatusError) {
      return fail(error.message, error.field)
    }
    return fail('The tracker did not save that move. The card is back where it was. Try again.')
  }

  revalidatePath(TRACKER_PATH)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/insights')

  return { status: 'success', message: resultLine(current.title, status, thanked, parsed.data) }
}

function resultLine(
  title: string,
  status: (typeof MOVE_TARGETS)[number],
  thanked: number,
  place: { position?: number; total?: number },
): string {
  const where =
    place.position && place.total
      ? `${statusLabel(status)}, position ${String(place.position)} of ${String(place.total)}`
      : statusLabel(status)

  if (status === 'shipped' && thanked > 0) {
    const people = thanked === 1 ? '1 reviewer' : `${String(thanked)} reviewers`
    return `${title} moved to ${where}. ${people} heard about it, and each was credited.`
  }
  if ((status === 'declined' || status === 'wont_fix') && thanked > 0) {
    const people = thanked === 1 ? '1 reviewer' : `${String(thanked)} reviewers`
    return `${title} moved to ${where}. ${people} ${thanked === 1 ? 'was' : 'were'} told why.`
  }
  return `${title} moved to ${where}.`
}

'use server'

/**
 * Settings mutations.
 *
 * Every one of these is a real `<form action>` posting to a Server Action, Zod
 * validated on the server whatever the browser did, and keyed by the same field
 * ids the forms pass to `Field`, so an error lands on the control that caused it
 * rather than in a banner that names nothing.
 *
 * Appearance is the exception that proves the rule: it writes a cookie and a
 * row, and there is no network dependency that can fail, so it has no error
 * path to design.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
// Authorises from `claims.uid`, so the claims must come from a session that is
// still live: a signature alone cannot tell a revoked cookie from a good one.
import { clearSessionCookie } from '@/lib/auth'
import { currentClaimsLive } from '@/server/queries/auth'
import type { FormState } from '@/components/ui'
import { HandleSchema } from '@/app/(auth)/schema'
import { actionRefusal } from '@/server/actions/limits'
import { HttpsUrl } from '@/server/api/schema'
import { getNotificationPrefs, setNotificationPref } from '@/server/repos/notifications'
import { replaceProfileLinks, updateProfile, updateSettings } from '@/server/repos/profiles'
import { getUserById, handleIsTaken, normalizeHandle, revokeAllSessions, setHandle } from '@/server/repos/users'
import { closeAllFeedback, deactivateAccount, reopenAllFeedback } from '@/server/queries/settings'
import type { NotificationKind } from '@/lib/types'

function fail(message: string, fields?: Record<string, string>): FormState {
  return { status: 'error', message, ...(fields ? { fieldErrors: fields } : {}) }
}

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) out[String(issue.path[0] ?? 'form')] = issue.message
  return out
}

/* ------------------------------------------------------------------ profile */

const ProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'A display name is what reviewers see beside your notes. One character is enough.')
    .max(60, 'Keep the display name to 60 characters or fewer.'),
  bio: z.string().trim().max(600, 'The bio is capped at 600 characters.').optional(),
  // Every message names its own field: the error summary lists these lines
  // with nothing else around them, and Zod's default ("String must contain at
  // most 40 character(s)") names neither the field nor the product's voice.
  pronouns: z.string().trim().max(40, 'Keep pronouns to 40 characters or fewer.').optional(),
  location: z.string().trim().max(80, 'Keep where you are to 80 characters or fewer.').optional(),
  availability: z.enum(['open', 'limited', 'closed']),
  searchable: z.enum(['on', 'off']),
})

/**
 * The link rows on the profile form.
 *
 * The public profile has always printed these and nothing could write one, so
 * twenty-six members had a link attributed to them that they could not correct.
 * A row needs both halves: a label with no address has nowhere to go, and an
 * address with no label would print as a bare URL beside hand-written ones.
 */
const PROFILE_LINK_ROWS = 5
const LinkLabel = z.string().trim().max(40, 'Keep a link label to 40 characters or fewer.')

function profileLinksFrom(formData: FormData): {
  links: { label: string; url: string }[]
  errors: Record<string, string>
} {
  const links: { label: string; url: string }[] = []
  const errors: Record<string, string> = {}

  for (let i = 0; i < PROFILE_LINK_ROWS; i++) {
    const labelKey = `link-label-${String(i)}`
    const urlKey = `link-url-${String(i)}`
    const rawLabel = String(formData.get(labelKey) ?? '').trim()
    const rawUrl = String(formData.get(urlKey) ?? '').trim()
    if (rawLabel === '' && rawUrl === '') continue

    const label = LinkLabel.safeParse(rawLabel)
    if (!label.success) errors[labelKey] = label.error.issues[0]?.message ?? 'That label is too long.'
    else if (label.data === '') errors[labelKey] = 'Give this link a label, or clear the address.'

    const url = HttpsUrl.safeParse(rawUrl)
    if (!url.success) errors[urlKey] = url.error.issues[0]?.message ?? 'That is not a link.'

    if (label.success && label.data !== '' && url.success) {
      links.push({ label: label.data, url: url.data })
    }
  }

  return { links, errors }
}

export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return fail('Your session ended. Sign in again to save your profile.')

  const parsed = ProfileSchema.safeParse({
    displayName: formData.get('displayName'),
    bio: formData.get('bio') ?? undefined,
    pronouns: formData.get('pronouns') ?? undefined,
    location: formData.get('location') ?? undefined,
    availability: formData.get('availability') ?? 'open',
    searchable: formData.get('searchable') === 'on' ? 'on' : 'off',
  })
  const linkRows = profileLinksFrom(formData)
  if (!parsed.success || Object.keys(linkRows.errors).length > 0) {
    return {
      status: 'error',
      message: 'This form was not saved.',
      fieldErrors: {
        ...(parsed.success ? {} : fieldErrorsOf(parsed.error)),
        ...linkRows.errors,
      },
    }
  }

  updateProfile(claims.uid, {
    displayName: parsed.data.displayName,
    bio: parsed.data.bio ?? null,
    pronouns: parsed.data.pronouns ?? null,
    location: parsed.data.location ?? null,
    availability: parsed.data.availability,
    isSearchable: parsed.data.searchable === 'on',
  })
  replaceProfileLinks(claims.uid, linkRows.links)

  revalidatePath('/settings/profile')
  revalidatePath(`/u/${claims.handle}`)
  return { status: 'success', message: 'Profile saved.' }
}

/* ------------------------------------------------------------------ account */

// Sign-up's rule, imported rather than restated: this one had drifted to allow
// underscores, capitals, thirty characters and a leading hyphen, so a rename
// could produce a handle no one could have signed up with.
const AccountSchema = z.object({ handle: HandleSchema })

export async function saveAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return fail('Your session ended. Sign in again to save your account.')

  const parsed = AccountSchema.safeParse({ handle: formData.get('handle') })
  if (!parsed.success) {
    return { status: 'error', message: 'This form was not saved.', fieldErrors: fieldErrorsOf(parsed.error) }
  }

  const current = getUserById(claims.uid)
  const wanted = normalizeHandle(parsed.data.handle)
  const changingHandle = current !== undefined && normalizeHandle(current.handle) !== wanted

  const taken = 'That handle is taken. Pick another one, or add a number to this one.'

  if (changingHandle) {
    // Availability first, then the limit. A taken handle is public knowledge,
    // and checking one should not cost an attempt — sign-up says so in as many
    // words and orders its own checks this way. Charging for it meant the
    // reader's *next* try, the real one, was refused for ten seconds.
    if (handleIsTaken(parsed.data.handle, claims.uid)) {
      return fail('That handle is taken.', { handle: taken })
    }
    const held = actionRefusal('handle', claims.uid)
    if (held) return fail('Your handle was not changed.', { handle: held })

    try {
      setHandle(claims.uid, parsed.data.handle)
    } catch (error) {
      // Two renames racing for one handle land on the unique index. Sign-up
      // answers that with a field error, so this does too rather than throwing.
      if (String(error).includes('users.handle_normalized')) {
        return fail('That handle is taken.', { handle: taken })
      }
      throw error
    }
  }

  revalidatePath('/settings/account')
  return {
    status: 'success',
    message: changingHandle
      ? `Saved. Your profile is now at /u/${parsed.data.handle}, and the old address stops working.`
      : 'Account saved.',
  }
}

/* ------------------------------------------------------------ notifications */

// The kinds the form offers, in the form's order. `mention` is not among them:
// nothing in the product parses an @handle, so the switch governed a
// notification with no producer. The kind stays in the schema for when one
// exists; writing a preference for it here would be writing a row nothing can
// ever read.
const KINDS: readonly NotificationKind[] = [
  'feedback_received',
  'feedback_reply',
  'feedback_helpful',
  'suggestion_shipped',
  'suggestion_status',
  'new_follower',
  'bounty_awarded',
]

/**
 * The bell, per kind. Only the in-app switch is written: nothing sends email,
 * so the form no longer offers an email switch or a weekly brief, and a stored
 * email preference is left as it was rather than rewritten from a missing box.
 */
export async function saveNotifications(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return fail('Your session ended. Sign in again to save these preferences.')

  for (const kind of KINDS) {
    setNotificationPref(claims.uid, kind, { inApp: formData.get(`in-app:${kind}`) === 'on' })
  }

  revalidatePath('/settings/notifications')
  const off = getNotificationPrefs(claims.uid, KINDS).filter((pref) => !pref.inApp).length
  return {
    status: 'success',
    message:
      off === 0
        ? 'Saved. Every kind still reaches your bell.'
        : `Saved. ${String(off)} ${off === 1 ? 'kind' : 'kinds'} will no longer reach your bell.`,
  }
}

/* --------------------------------------------------------------- appearance */

// Theme only. There is no motion switch on the form (motion follows the
// operating system), and parsing a missing one as "off" overwrote the stored
// value on every save.
const AppearanceSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
})

export async function saveAppearance(_prev: FormState, formData: FormData): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return fail('Your session ended. Sign in again to save these settings.')

  const parsed = AppearanceSchema.safeParse({ theme: formData.get('theme') ?? 'system' })
  if (!parsed.success) {
    return { status: 'error', message: 'These settings were not saved.', fieldErrors: fieldErrorsOf(parsed.error) }
  }

  const jar = await cookies()
  if (parsed.data.theme === 'system') {
    jar.delete('ws_theme')
  } else {
    jar.set('ws_theme', parsed.data.theme, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }

  updateSettings(claims.uid, { theme: parsed.data.theme })

  revalidatePath('/settings/appearance')
  return {
    status: 'success',
    message:
      parsed.data.theme === 'system'
        ? 'Saved. Whetstone follows your system setting.'
        : `Saved. Whetstone stays ${parsed.data.theme} on this browser.`,
  }
}

/* ------------------------------------------------------------- danger zone */

export async function closeFeedbackEverywhere(
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return fail('Your session ended. Sign in again to change this.')

  const closed = closeAllFeedback(claims.uid)
  revalidatePath('/settings/danger')
  revalidatePath('/dashboard')
  return {
    status: 'success',
    message:
      closed === 0
        ? 'Nothing changed: every project was already closed to new feedback.'
        : `${String(closed)} ${closed === 1 ? 'project is' : 'projects are'} closed to new feedback. “Take feedback again” below undoes this.`,
  }
}

/**
 * The other half of the button above. Closing skipped confirmation because it
 * called itself reversible, and nothing in the product could reverse it short
 * of posting a new build — so the reverse is here, one press away, and the
 * claim is true.
 */
export async function reopenFeedbackEverywhere(
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return fail('Your session ended. Sign in again to change this.')

  const reopened = reopenAllFeedback(claims.uid)
  revalidatePath('/settings/danger')
  revalidatePath('/dashboard')
  return {
    status: 'success',
    message:
      reopened === 0
        ? 'Nothing changed: no project of yours was closed.'
        : `${String(reopened)} ${reopened === 1 ? 'project is' : 'projects are'} taking feedback again.`,
  }
}

export async function signOutEverywhere(_prev: FormState, _formData: FormData): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return fail('Your session ended already.')

  const count = revokeAllSessions(claims.uid)
  await clearSessionCookie()
  redirect(`/sign-in?next=%2Fsettings%2Fdanger&signed-out=${String(count)}`)
}

const DeactivateSchema = z.object({
  handle: z.string().trim().min(1),
  confirm: z.string().trim().min(1),
})

/**
 * Confirm by typing the handle. Not a checkbox, and not a second “are you
 * sure”: typing your own handle is the one confirmation that cannot be clicked
 * through by muscle memory.
 */
export async function deactivate(_prev: FormState, formData: FormData): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return fail('Your session ended. Sign in again to close your account.')

  const parsed = DeactivateSchema.safeParse({
    handle: claims.handle,
    confirm: formData.get('confirm'),
  })
  if (!parsed.success) {
    return fail('Type your handle to confirm.', {
      confirm: `Type ${claims.handle} exactly as it appears to confirm.`,
    })
  }
  if (normalizeHandle(parsed.data.confirm) !== normalizeHandle(claims.handle)) {
    return fail('That is not your handle.', {
      confirm: `That does not match. Type ${claims.handle} exactly as it appears.`,
    })
  }

  deactivateAccount(claims.uid)
  await clearSessionCookie()
  // A page that says so, at the top of it. `/?account=closed` landed the reader
  // on the marketing home — part-way down it, where the danger zone had been
  // scrolled to — and no code read the parameter, so nothing on the page
  // mentioned the account at all.
  redirect('/account-closed')
}

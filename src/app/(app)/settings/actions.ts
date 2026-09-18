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
import { getNotificationPrefs, setNotificationPref } from '@/server/repos/notifications'
import { updateProfile, updateSettings } from '@/server/repos/profiles'
import { getUserById, handleIsTaken, normalizeHandle, revokeAllSessions, setHandle } from '@/server/repos/users'
import { closeAllFeedback, deactivateAccount } from '@/server/queries/settings'
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
  pronouns: z.string().trim().max(40).optional(),
  location: z.string().trim().max(80).optional(),
  availability: z.enum(['open', 'limited', 'closed']),
  searchable: z.enum(['on', 'off']),
})

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
  if (!parsed.success) {
    return { status: 'error', message: 'This form was not saved.', fieldErrors: fieldErrorsOf(parsed.error) }
  }

  updateProfile(claims.uid, {
    displayName: parsed.data.displayName,
    bio: parsed.data.bio ?? null,
    pronouns: parsed.data.pronouns ?? null,
    location: parsed.data.location ?? null,
    availability: parsed.data.availability,
    isSearchable: parsed.data.searchable === 'on',
  })

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

  if (changingHandle) {
    const held = actionRefusal('handle', claims.uid)
    if (held) return fail('Your handle was not changed.', { handle: held })
  }

  if (changingHandle && handleIsTaken(parsed.data.handle, claims.uid)) {
    return fail('That handle is taken.', {
      handle: 'That handle is taken. Pick another one, or add a number to this one.',
    })
  }

  if (changingHandle) setHandle(claims.uid, parsed.data.handle)

  revalidatePath('/settings/account')
  return {
    status: 'success',
    message: changingHandle
      ? `Saved. Your profile is now at /u/${parsed.data.handle}, and the old address stops working.`
      : 'Account saved.',
  }
}

/* ------------------------------------------------------------ notifications */

const KINDS: readonly NotificationKind[] = [
  'feedback_received',
  'feedback_reply',
  'feedback_helpful',
  'suggestion_shipped',
  'suggestion_status',
  'new_follower',
  'mention',
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
        : `${String(closed)} ${closed === 1 ? 'project is' : 'projects are'} closed to new feedback. Reopen one from its project page.`,
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
  redirect('/?account=closed')
}

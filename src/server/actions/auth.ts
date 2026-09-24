'use server'

/**
 * Server Actions for sign up, sign in, and the password reset pair.
 *
 * Every one of them is the authority: the client re-uses the same Zod module
 * for its blur checks, but nothing here trusts that it ran. Each action is
 * rate limited, writes an `auth_sessions` row so the cookie it issues can be
 * revoked, and returns messages that never say whether an address has an
 * account.
 */

import { randomBytes } from 'node:crypto'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import {
  LONG_SESSION_S,
  SHORT_SESSION_S,
  hashPassword,
  needsRehash,
  setSessionCookie,
  signSession,
  verifyPassword,
} from '@/lib/auth'
import { now } from '@/lib/utils'
import type { UserRow, UserStatus } from '@/lib/types'
import { linkOrigin, mailDelivery, sendPasswordReset, type MailDelivery } from '@/server/mail'
import {
  consumeAuthToken,
  createAuthToken,
  createUser,
  emailIsTaken,
  getAuthTokenState,
  getUserByEmail,
  getUserById,
  handleIsTaken,
  revokeAllSessions,
  setPasswordHash,
} from '@/server/repos/users'
import {
  RATE_POLICIES,
  clearRateLimit,
  consumeRateLimit,
  SITE_SUBJECT,
  accountSubject,
  credentialSubject,
  peekRateLimit,
  refundRateLimit,
  hashToken,
  invalidateResetTokens,
  newSecret,
  recordSession,
  requestSubject,
  suggestHandles,
} from '@/server/queries/auth'
import {
  ForgotSchema,
  ResetSchema,
  SignInSchema,
  SignUpSchema,
  HandleSchema,
  retryPhrase,
  safeNextPath,
  type AuthFormState,
  type HandleCheck,
} from '@/app/(auth)/schema'

/* ------------------------------------------------------------------------- *
 * Shared plumbing
 * ------------------------------------------------------------------------- */

const RESET_TTL_MS = 30 * 60 * 1000

/**
 * Maps a Zod failure onto the `Field` ids the forms render, so every entry in
 * the error summary is a working fragment link. Keyed by schema field, in the
 * order the fields sit on every form, which is the order the summary lists
 * them in. A form whose control carries a different id passes it in `ids`.
 */
const FIELD_IDS = {
  token: 'token',
  displayName: 'display-name',
  handle: 'handle',
  email: 'email',
  password: 'password',
} as const

type SchemaField = keyof typeof FIELD_IDS

function isSchemaField(key: string): key is SchemaField {
  return key in FIELD_IDS
}

function fieldErrorsFrom(
  issues: readonly { path: readonly (string | number)[]; message: string }[],
  ids: Partial<Record<SchemaField, string>> = {},
  known: Partial<Record<SchemaField, string>> = {},
): Record<string, string> {
  const messages: Partial<Record<SchemaField, string>> = { ...known }
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '')
    if (isSchemaField(key)) messages[key] ??= issue.message
  }
  const out: Record<string, string> = {}
  for (const key of Object.keys(FIELD_IDS) as SchemaField[]) {
    const message = messages[key]
    if (message) out[ids[key] ?? FIELD_IDS[key]] = message
  }
  return out
}

function invalid(fieldErrors: Record<string, string>, message: string): AuthFormState {
  return { status: 'error', message, fieldErrors }
}

/** A form-level refusal: nothing to point at in the fields, only a sentence. */
function refused(message: string): AuthFormState {
  return { status: 'error', message }
}

/**
 * An unknown address must cost the same as a known one, or the response time
 * becomes the enumeration oracle the generic message was written to close.
 */
let decoyHash: Promise<string> | null = null
function decoy(): Promise<string> {
  decoyHash ??= hashPassword(randomBytes(24).toString('hex'))
  return decoyHash
}

/*
 * Nothing is revalidated here on purpose. Every surface that renders the reader
 * reads the session cookie, which makes it dynamic already, so a sign-in has no
 * cached page to correct. The one call this used to make — `revalidatePath('/',
 * 'layout')` — expired the implicit `/layout` tag, which every cached page and
 * every `unstable_cache` entry in the app carries, so one sign-in threw away the
 * whole public site: the next visitor to `/` waited 2.5–7.8s on a rebuild that
 * had nothing to do with them.
 */
async function startSession(userId: string, handle: string, stay: boolean): Promise<void> {
  const ttl = stay ? LONG_SESSION_S : SHORT_SESSION_S
  const token = await signSession({ uid: userId, handle }, ttl)
  await setSessionCookie(token, stay)
  await recordSession({ userId, token, expiresAt: now() + ttl * 1000 })
}

/* ------------------------------------------------------------------------- *
 * Sign in
 * ------------------------------------------------------------------------- */

const CREDENTIALS_WRONG =
  'Email or password is incorrect. Check both, or reset your password if you no longer have it.'

/**
 * What an account that cannot sign in is told once its password has verified.
 *
 * Saying this to somebody holding the right password reveals nothing they could
 * not already see, and the alternative was worse than silence: a closed account
 * heard CREDENTIALS_WRONG and was sent to reset a password that was correct,
 * where the reset quietly issues no link because the account is not active.
 * None of these mentions resetting, because none of them would be fixed by it.
 */
const CANNOT_SIGN_IN: Record<Exclude<UserStatus, 'active'>, string> = {
  deactivated:
    'This account was closed, so it can no longer be signed in to. The password was right: closing an account is what stops it, and there is no undo. Its email address and handle stay reserved to it, so a new account needs a different address.',
  suspended:
    'This account is suspended, so it cannot be signed in to at the moment. The password was right. A moderator has to lift the suspension before the account works again.',
  banned:
    'This account has been closed by a moderator and cannot be signed in to. The password was right; nothing entered here will change that.',
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = SignInSchema.safeParse({
    email: formData.get('email') ?? '',
    password: formData.get('password') ?? '',
    stay: formData.get('stay') ?? undefined,
    next: formData.get('next') ?? undefined,
  })

  if (!parsed.success) {
    return invalid(
      fieldErrorsFrom(parsed.error.issues),
      'Sign-in needs both fields before it can run. Fix the entries below and try again.',
    )
  }

  const { email, password, stay, next } = parsed.data
  const ipSubject = await requestSubject()
  const subject = credentialSubject(email, ipSubject)
  const limit = consumeRateLimit(RATE_POLICIES.signIn, subject)

  if (!limit.allowed) {
    return refused(
      `Five sign-in attempts have failed for this address on this device, so sign-in is paused. You can try again ${retryPhrase(limit.retryAfterSeconds)}, or reset your password now.`,
    )
  }

  // The per-device limit above keys on an address the caller can choose. This
  // one keys on the account alone, so spreading guesses across forged
  // addresses stops after twenty.
  const account = accountSubject(email)
  const accountLimit = consumeRateLimit(RATE_POLICIES.signInAccount, account)
  if (!accountLimit.allowed) {
    return refused(
      `This account has had too many failed sign-in attempts, so sign-in is paused for it. You can try again ${retryPhrase(accountLimit.retryAfterSeconds)}, or reset your password now.`,
    )
  }

  // And this one keys on the network alone, for one password tried against
  // many accounts, which leaves a single failure on each.
  const networkLimit = consumeRateLimit(RATE_POLICIES.signInNetwork, ipSubject)
  if (!networkLimit.allowed) {
    refundRateLimit(RATE_POLICIES.signInAccount, account)
    return refused(
      `Too many sign-in attempts have failed from this network, so sign-in is paused on it. You can try again ${retryPhrase(networkLimit.retryAfterSeconds)}, or reset your password now.`,
    )
  }

  // Both count failures only: they are charged above, atomically, and a
  // success below gives the charge back, so a person who types the right
  // password is never locked out by somebody else's guessing (they are still
  // paused while a bucket is empty, which is the point).
  const user = getUserByEmail(email)

  if (!user || !user.password_hash) {
    await verifyPassword(password, await decoy())
    return refused(CREDENTIALS_WRONG)
  }

  const ok = await verifyPassword(password, user.password_hash)
  if (!ok) return refused(CREDENTIALS_WRONG)

  // The password verified, so this is not a guess and must not be counted as
  // one: the person would otherwise read the same refusal five times and then
  // be told to wait fifteen minutes for a sign-in that will never work.
  if (user.status !== 'active') {
    clearRateLimit(RATE_POLICIES.signIn, subject)
    clearRateLimit(RATE_POLICIES.signInAccount, account)
    refundRateLimit(RATE_POLICIES.signInNetwork, ipSubject)
    return refused(CANNOT_SIGN_IN[user.status])
  }

  if (needsRehash(user.password_hash)) {
    setPasswordHash(user.id, await hashPassword(password))
  }

  // The network bucket gets this attempt's token back and no more: emptying it
  // on success would let a script reset its own count by signing in to an
  // account it owns between guesses.
  clearRateLimit(RATE_POLICIES.signIn, subject)
  clearRateLimit(RATE_POLICIES.signInAccount, account)
  refundRateLimit(RATE_POLICIES.signInNetwork, ipSubject)
  // Remembering the password retires every reset link still sitting in a
  // mailbox: it is now a liability rather than a convenience.
  invalidateResetTokens(user.id)
  await startSession(user.id, user.handle, stay)
  redirect(safeNextPath(next))
}

/* ------------------------------------------------------------------------- *
 * Sign up
 * ------------------------------------------------------------------------- */

/** The sign-up form's address and password controls are the "new" ones. */
const SIGN_UP_IDS = { email: 'new-email', password: 'new-password' } as const

const NOT_CREATED = 'This account was not created. Fix the entries below and try again.'
const HANDLE_TAKEN_SUMMARY = 'This account was not created. Pick a different handle and try again.'
const EMAIL_TAKEN = 'That email already has an account. Sign in instead, or use a different address.'
const EMAIL_TAKEN_SUMMARY = 'This account was not created. That address is already registered.'

/** Handles are public at /u/<handle>, so saying one is taken reveals nothing. */
function handleTakenMessage(handle: string): string {
  const free = suggestHandles(handle)
  const tail = free.length > 0 ? ` Free right now: ${free.join(', ')}.` : ''
  return `The handle ${handle} is taken.${tail}`
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = SignUpSchema.safeParse({
    displayName: formData.get('displayName') ?? '',
    handle: formData.get('handle') ?? '',
    email: formData.get('email') ?? '',
    password: formData.get('password') ?? '',
    next: formData.get('next') ?? undefined,
  })

  if (!parsed.success) {
    // Zod judges each field on its own and cannot know a handle is taken. A
    // summary that left it out would send the person round a second time for
    // a problem that was already knowable, so it is asked here as well.
    const handle = HandleSchema.safeParse(formData.get('handle') ?? '')
    const taken = handle.success && handleIsTaken(handle.data)
    return invalid(
      fieldErrorsFrom(
        parsed.error.issues,
        SIGN_UP_IDS,
        taken ? { handle: handleTakenMessage(handle.data) } : {},
      ),
      NOT_CREATED,
    )
  }

  const { displayName, handle, email, password, next } = parsed.data

  // Availability is racy, so it is re-checked here even though the field
  // checked it while the person was typing. It is checked before the limit
  // below is charged: a taken handle is public knowledge, and picking one
  // should not cost one of the three attempts an hour.
  if (handleIsTaken(handle)) {
    return invalid({ handle: handleTakenMessage(handle) }, HANDLE_TAKEN_SUMMARY)
  }

  const ipSubject = await requestSubject()
  const limit = consumeRateLimit(RATE_POLICIES.signUp, ipSubject)

  if (!limit.allowed) {
    return refused(
      `Sign-up is limited to three attempts an hour from one device, and this device has reached it. You can try again ${retryPhrase(limit.retryAfterSeconds)}.`,
    )
  }

  const siteLimit = consumeRateLimit(RATE_POLICIES.signUpSite, SITE_SUBJECT)
  if (!siteLimit.allowed) {
    return refused(
      `Sign-ups are paused for a few minutes while we deal with an unusual number of new accounts. Nothing you entered was wrong. Try again ${retryPhrase(siteLimit.retryAfterSeconds)}.`,
    )
  }

  // After the limit on purpose: this answer says an address has an account,
  // so each ask of it costs an attempt.
  if (emailIsTaken(email)) {
    return invalid({ [SIGN_UP_IDS.email]: EMAIL_TAKEN }, EMAIL_TAKEN_SUMMARY)
  }

  const passwordHash = await hashPassword(password)
  let user: UserRow
  try {
    user = createUser({ email, handle, displayName, passwordHash })
  } catch (error) {
    // Two sign-ups racing for one handle or one address both pass the checks
    // above; the unique index decides, and the one that lost hears why.
    const conflict =
      error instanceof Error
        ? /UNIQUE constraint failed: users\.(handle|email)_normalized/.exec(error.message)?.[1]
        : undefined
    if (conflict === 'handle') {
      return invalid({ handle: handleTakenMessage(handle) }, HANDLE_TAKEN_SUMMARY)
    }
    if (conflict === 'email') {
      return invalid({ [SIGN_UP_IDS.email]: EMAIL_TAKEN }, EMAIL_TAKEN_SUMMARY)
    }
    throw error
  }

  await startSession(user.id, user.handle, true)
  redirect(safeNextPath(next))
}

/* ------------------------------------------------------------------------- *
 * Forgot password
 * ------------------------------------------------------------------------- */

/**
 * Identical whether or not the address has an account. That is the point. The
 * page above it already says how long a link lasts, so this does not repeat it.
 */
const RESET_SENT = 'If an account exists for that address, a reset link is on its way.'

/** MAIL_TRANSPORT=outbox: the link is a file on this server, not an email. */
const RESET_OUTBOX =
  'If an account exists for that address, a reset link is waiting in this server’s outbox for whoever runs it to pass on.'

/** Outside production with no mail provider, where the link goes to the log. */
const RESET_LOGGED =
  'If an account exists for that address, a reset link was written to the server log. No mail provider is configured, so nothing was emailed.'

const RESET_MESSAGES = {
  provider: RESET_SENT,
  outbox: RESET_OUTBOX,
  log: RESET_LOGGED,
} as const satisfies Record<MailDelivery, string>

/** Production with no mail provider. The page says so before anyone types. */
const RESET_UNAVAILABLE =
  'No link was sent, because outgoing email is not set up on this server. Nothing about your account has changed.'

export async function forgotPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = ForgotSchema.safeParse({
    email: formData.get('email') ?? '',
    next: formData.get('next') ?? undefined,
  })

  if (!parsed.success) {
    return invalid(
      fieldErrorsFrom(parsed.error.issues),
      'No link was sent. Correct the address below and try again.',
    )
  }

  const delivery = mailDelivery()
  if (!delivery) return refused(RESET_UNAVAILABLE)

  const { email } = parsed.data
  // Re-validated here rather than trusted from the form, because the value it
  // ends up in is a link that leaves this server and comes back as a request.
  const next = safeNextPath(parsed.data.next, '')
  const ipSubject = await requestSubject()

  // Every refusal below names its own limit and its own wait. None depends on
  // whether the address has an account, so none of them is an oracle either.
  const limit = consumeRateLimit(RATE_POLICIES.forgot, credentialSubject(email, ipSubject))
  if (!limit.allowed) {
    return refused(
      `Three reset links have been requested for this address from this device in the last hour, which is the limit. You can request another ${retryPhrase(limit.retryAfterSeconds)}.`,
    )
  }
  const accountLimit = consumeRateLimit(RATE_POLICIES.forgotAccount, accountSubject(email))
  if (!accountLimit.allowed) {
    return refused(
      `Five reset links have been requested for this address in the last hour, which is the limit. You can request another ${retryPhrase(accountLimit.retryAfterSeconds)}.`,
    )
  }
  const networkLimit = consumeRateLimit(RATE_POLICIES.forgotNetwork, ipSubject)
  if (!networkLimit.allowed) {
    return refused(
      `Reset links have been requested for too many addresses from this network in the last hour, so requests are paused on it. You can request another ${retryPhrase(networkLimit.retryAfterSeconds)}.`,
    )
  }
  const siteLimit = peekRateLimit(RATE_POLICIES.forgotSite, SITE_SUBJECT)
  if (!siteLimit.allowed) {
    return refused(
      `Reset links are paused for a few minutes while we deal with an unusual number of requests. Nothing you entered was wrong. Try again ${retryPhrase(siteLimit.retryAfterSeconds)}.`,
    )
  }

  const user = getUserByEmail(email)
  let devResetPath: string | undefined

  if (user && user.status === 'active') {
    // Only the newest link works, so a mailbox holding three has one live
    // token in it rather than three.
    invalidateResetTokens(user.id)
    const secret = newSecret()
    createAuthToken({
      userId: user.id,
      purpose: 'password_reset',
      tokenHash: hashToken(secret),
      expiresAt: now() + RESET_TTL_MS,
    })
    const path = next
      ? `/reset-password?token=${secret}&next=${encodeURIComponent(next)}`
      : `/reset-password?token=${secret}`
    const url = `${await linkOrigin()}${path}`
    // Sent once the response has gone. A provider round trip inside the
    // request would make an address with an account measurably slower to
    // answer than one without, which is the oracle the wording above closes.
    after(() => sendPasswordReset(user.email, url))
    // The log is a development convenience and the one case where the link is
    // also handed back. Everything else counts towards the site limit: an
    // outbox fills a disk the way a provider fills a sending quota.
    if (delivery === 'log') devResetPath = path
    else consumeRateLimit(RATE_POLICIES.forgotSite, SITE_SUBJECT)
  }

  return {
    status: 'success',
    message: RESET_MESSAGES[delivery],
    resetDelivery: delivery,
    devResetPath,
  }
}

/* ------------------------------------------------------------------------- *
 * Reset password
 * ------------------------------------------------------------------------- */

const RESET_DEAD =
  'This reset link no longer works. A link lasts 30 minutes, works once, and stops working when a newer one is requested. Request a new one.'

export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = ResetSchema.safeParse({
    token: formData.get('token') ?? '',
    password: formData.get('password') ?? '',
    next: formData.get('next') ?? undefined,
  })

  if (!parsed.success) {
    return invalid(
      fieldErrorsFrom(parsed.error.issues, { password: 'new-password' }),
      'Your password was not changed. Fix the entry below and try again.',
    )
  }

  const { token, password } = parsed.data
  const ipSubject = await requestSubject()
  const limit = consumeRateLimit(RATE_POLICIES.reset, ipSubject)

  if (!limit.allowed) {
    return refused(
      `Five reset attempts have been made from this device in the last hour, which is the limit. You can try again ${retryPhrase(limit.retryAfterSeconds)}.`,
    )
  }

  const tokenHash = hashToken(token)
  const state = getAuthTokenState(tokenHash)

  if (state.state !== 'valid' || state.purpose !== 'password_reset' || !state.userId) {
    return refused(RESET_DEAD)
  }

  // A link issued before an account was suspended must not be the way back in.
  const user = getUserById(state.userId)
  if (!user || user.status !== 'active') return refused(RESET_DEAD)

  // Single use: the UPDATE only matches a row that is still unconsumed, so two
  // simultaneous submissions cannot both succeed.
  if (!consumeAuthToken(tokenHash)) return refused(RESET_DEAD)

  setPasswordHash(user.id, await hashPassword(password))
  // Any other reset link for this account dies with the one just used.
  invalidateResetTokens(user.id)
  // A password change signs out every other device, which is the whole reason
  // sessions are rows and not just signatures.
  revokeAllSessions(user.id)

  await startSession(user.id, user.handle, true)
  // Where the reader was going when they were sent to sign in, carried through
  // the emailed link. `safeNextPath` is what stops that link from becoming an
  // open redirect, and it falls back to Discover for anything off this origin.
  redirect(safeNextPath(parsed.data.next))
}

/* ------------------------------------------------------------------------- *
 * Handle availability
 * ------------------------------------------------------------------------- */

export async function checkHandleAction(raw: string): Promise<HandleCheck> {
  const parsed = HandleSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      status: 'invalid',
      message: parsed.error.issues[0]?.message ?? 'Check the handle.',
    }
  }

  const ipSubject = await requestSubject()
  const limit = consumeRateLimit(RATE_POLICIES.handle, ipSubject)
  if (!limit.allowed) {
    return {
      status: 'limited',
      // One short line: this is rendered into the handle's reserved single-line
      // guidance slot, and a message that wraps there would move the control.
      message: `Checks are paused. They resume ${retryPhrase(limit.retryAfterSeconds)}.`,
    }
  }

  const handle = parsed.data
  if (!handleIsTaken(handle)) return { status: 'available', handle }
  return { status: 'taken', handle, suggestions: suggestHandles(handle) }
}

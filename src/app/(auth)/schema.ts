/**
 * The one schema module for authentication.
 *
 * Imported by the client forms (blur validation) and by the Server Actions
 * (authoritative validation), so a rule can never drift between the two. It is
 * deliberately free of node built-ins and of any `@/server` import, which is
 * what lets a client component pull it in.
 *
 * Every message here is a rendered string: what broke, why it matters, what to
 * do next. No exclamation marks, no apologies, curly punctuation throughout.
 */

import { z } from 'zod'
import type { FormState } from '@/components/ui'

/* ------------------------------------------------------------------ atoms -- */

export const HANDLE_MIN = 3
export const HANDLE_MAX = 24
export const PASSWORD_MIN = 12
export const PASSWORD_MAX = 200
/** Issued tokens are 43 characters; anything under this was never one of them. */
export const RESET_TOKEN_MIN = 16

/** Letters, numbers and hyphens; cannot start or end with a hyphen. */
export const HANDLE_PATTERN = '^[a-z0-9](?:[a-z0-9-]{1,22})[a-z0-9]$'
const HANDLE_RE = new RegExp(HANDLE_PATTERN)

export const HANDLE_RULE = 'Letters, numbers and hyphens, 3–24 characters.'
export const PASSWORD_RULE = 'At least 12 characters. A short sentence works well.'

/** One rule for every address field; only what an empty one is asked for differs. */
function emailSchema(whenEmpty: string) {
  return z
    .string()
    .trim()
    .min(1, whenEmpty)
    .max(254, 'That address is longer than 254 characters, so it cannot be a real mailbox.')
    .email('That does not look like an email address. Check for a missing @ or a typo in the domain.')
    .transform((v) => v.toLowerCase())
}

/** An address that already has an account: sign-in and reset. */
export const EmailSchema = emailSchema('Enter the email address you signed up with.')

/** The address a new account will sign in with. */
export const NewEmailSchema = emailSchema('Enter the email address you want to sign in with.')

export const HandleSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, '').toLowerCase())
  .pipe(
    z
      .string()
      .min(HANDLE_MIN, 'A handle needs at least 3 characters, because it is the address people share.')
      .max(HANDLE_MAX, 'A handle stops at 24 characters so it fits on a feed row.')
      .regex(HANDLE_RE, 'Use letters, numbers and hyphens only, starting and ending with a letter or number.'),
  )

export const DisplayNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter the name you want on your projects and feedback.')
  .max(60, 'Display names stop at 60 characters so they fit beside your avatar.')

export const NewPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, 'Use at least 12 characters. A short sentence is easier to remember than a scramble.')
  .max(PASSWORD_MAX, 'Passwords stop at 200 characters.')

export const CurrentPasswordSchema = z
  .string()
  .min(1, 'Enter your password.')
  .max(PASSWORD_MAX, 'Passwords stop at 200 characters.')

export const NextPathSchema = z.string().max(512).optional()

/* ------------------------------------------------------------------ forms -- */

export const SignInSchema = z.object({
  email: EmailSchema,
  password: CurrentPasswordSchema,
  stay: z.coerce.boolean().optional().default(false),
  next: NextPathSchema,
})

export const SignUpSchema = z.object({
  displayName: DisplayNameSchema,
  handle: HandleSchema,
  email: NewEmailSchema,
  password: NewPasswordSchema,
  next: NextPathSchema,
})

export const ForgotSchema = z.object({
  email: EmailSchema,
})

export const ResetSchema = z.object({
  token: z.string().min(RESET_TOKEN_MIN, 'This reset link is incomplete. Ask for a new one.').max(256),
  password: NewPasswordSchema,
})

export type SignInInput = z.infer<typeof SignInSchema>
export type SignUpInput = z.infer<typeof SignUpSchema>

/* ------------------------------------------------- per-field, for the UI --- */

/** The schema each field is checked against on blur, keyed by its Field id. */
export const FIELD_SCHEMAS = {
  'email': EmailSchema,
  'new-email': NewEmailSchema,
  'handle': HandleSchema,
  'display-name': DisplayNameSchema,
  'password': CurrentPasswordSchema,
  'new-password': NewPasswordSchema,
} as const

export type AuthFieldId = keyof typeof FIELD_SCHEMAS

/**
 * Runs one field's rule and returns the first message, or null. The client uses
 * this on blur after first touch; the server re-runs the whole object schema, so
 * this is convenience, never the authority.
 */
export function checkField(field: AuthFieldId, value: string): string | null {
  const result = FIELD_SCHEMAS[field].safeParse(value)
  if (result.success) return null
  return result.error.issues[0]?.message ?? 'Check this field.'
}

/* ------------------------------------------------------ password strength -- */

export type StrengthScore = 0 | 1 | 2 | 3 | 4

export interface PasswordStrength {
  readonly score: StrengthScore
  /** The word shown beside the meter. Meaning is never carried by the bar alone. */
  readonly word: string
  /** One sentence saying what would make it stronger, or that it is done. */
  readonly advice: string
}

/**
 * A deliberately honest estimate: length does most of the work, character
 * variety adds a little, and the obvious shapes (one repeated character, a
 * keyboard run, a bare year, a word from the short list below) are capped.
 * It is a guide for the writer, never a gate: the only hard rule is length.
 */
const WEAK_WORDS = [
  'password', 'passw0rd', 'letmein', 'qwerty', 'welcome', 'admin', 'iloveyou',
  'whetstone', 'monkey', 'dragon', 'football', 'baseball', 'sunshine', 'princess',
  'trustno1', 'starwars', 'superman', 'changeme', 'secret', 'abc123',
]

function hasRun(value: string): boolean {
  let ascending = 1
  let repeat = 1
  for (let i = 1; i < value.length; i++) {
    const prev = value.charCodeAt(i - 1)
    const here = value.charCodeAt(i)
    ascending = here === prev + 1 ? ascending + 1 : 1
    repeat = here === prev ? repeat + 1 : 1
    if (ascending >= 4 || repeat >= 4) return true
  }
  return false
}

export function passwordStrength(raw: string): PasswordStrength {
  const value = raw ?? ''
  if (value.length === 0) {
    return { score: 0, word: 'Not set yet', advice: PASSWORD_RULE }
  }
  if (value.length < PASSWORD_MIN) {
    const short = PASSWORD_MIN - value.length
    return {
      score: 0,
      word: 'Too short',
      advice: `${short} more character${short === 1 ? '' : 's'} to reach the 12 this account needs.`,
    }
  }

  let points = 1
  if (value.length >= 16) points += 1
  if (value.length >= 20) points += 1

  const classes =
    Number(/[a-z]/.test(value)) +
    Number(/[A-Z]/.test(value)) +
    Number(/[0-9]/.test(value)) +
    Number(/[^A-Za-z0-9]/.test(value))
  if (classes >= 3) points += 1

  const lower = value.toLowerCase()
  const weak = WEAK_WORDS.some((w) => lower.includes(w))
  const uniform = new Set(lower).size <= 4

  if (weak || uniform || hasRun(lower)) points = Math.min(points, 1)

  const score = Math.max(0, Math.min(4, points)) as StrengthScore

  const WORDS: Record<StrengthScore, string> = {
    0: 'Too short',
    1: 'Guessable',
    2: 'Fair',
    3: 'Strong',
    4: 'Very strong',
  }

  const ADVICE: Record<StrengthScore, string> = {
    0: PASSWORD_RULE,
    1: weak
      ? 'This contains a phrase that appears in every cracking list. Swap it for words nobody would pair.'
      : 'Long, but predictable. Four unrelated words beat a pattern of the same length.',
    2: 'Workable. Another few characters, or one symbol, would put it out of reach of a list attack.',
    3: 'Good. Nothing further is needed.',
    4: 'Good. Nothing further is needed.',
  }

  return { score, word: WORDS[score], advice: ADVICE[score] }
}

/* ---------------------------------------------------------- redirect safety */

/**
 * Only a same-origin, relative path survives. `//evil.example`, `/\evil`, a
 * scheme, a backslash, a control character and anything over 512 characters are
 * all rejected, so `?next=` can never become an open redirect.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/discover'): string {
  if (typeof raw !== 'string') return fallback
  const value = raw.trim()
  if (value.length === 0 || value.length > 512) return fallback
  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//')) return fallback
  if (value.includes('\\')) return fallback
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return fallback
  return value
}

/* ------------------------------------------------------------ retry phrasing */

/** “in 12 minutes”, “in 45 seconds”. A limit message must say when, not just no. */
export function retryPhrase(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds))
  if (s < 60) return `in ${s} second${s === 1 ? '' : 's'}`
  const minutes = Math.ceil(s / 60)
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.ceil(minutes / 60)
  return `in ${hours} hour${hours === 1 ? '' : 's'}`
}

/* ------------------------------------------------------------- form state -- */

/**
 * The `FormState` the primitives understand, plus the two extra fields the
 * forgot-password flow needs. Widening rather than replacing keeps `Form`,
 * `ErrorSummary` and `SubmitButton` usable unchanged.
 */
export interface AuthFormState extends FormState {
  /**
   * How a reset link left the server: emailed through the configured provider,
   * written to the outbox directory the operator chose (MAIL_TRANSPORT=outbox),
   * or, outside production with neither, written to the server log. The
   * confirmation only mentions a mailbox when there is one.
   */
  resetDelivery?: 'provider' | 'outbox' | 'log'
  /**
   * The link itself, handed back only when `resetDelivery` is `log`, so a reset
   * can be finished on a machine with no mailbox. Production never logs mail,
   * so it never populates this.
   */
  devResetPath?: string
}

export const idleAuthState: AuthFormState = { status: 'idle' }

/** Narrows the state the `Form` render callback hands back. No cast to `any`. */
export function asAuthState(state: FormState): AuthFormState {
  return state as AuthFormState
}

/* ------------------------------------------------------ handle availability */

/** The shape `checkHandleAction` answers with. Kept here so the Server Action
 *  module exports nothing but async functions. */
export type HandleCheck =
  | { status: 'available'; handle: string }
  | { status: 'taken'; handle: string; suggestions: readonly string[] }
  | { status: 'invalid'; message: string }
  | { status: 'limited'; message: string }

/* ------------------------------------------------------------ search params */

export type RawSearchParams = Record<string, string | string[] | undefined>

/** Next hands a repeated query key back as an array; take the first value. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

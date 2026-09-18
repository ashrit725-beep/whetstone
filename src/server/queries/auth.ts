/**
 * Queries the authentication surface needs and `src/server/repos/` does not
 * provide: the rate-limit bucket, the cookie↔session binding, the revocation
 * checks every other module authenticates through (`currentClaimsLive()`,
 * `currentUser()`), and handle suggestions.
 *
 * Repository functions are called wherever one exists. Nothing here writes SQL
 * that `repos/users.ts` already writes.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { all, get, run, tx } from '@/server/db/client'
import {
  createSession,
  getViewer,
  normalizeHandle,
  touchLastSeen,
} from '@/server/repos/users'
import { SESSION_COOKIE, readSession } from '@/lib/auth'
import type { SessionClaims } from '@/lib/auth'
import { env } from '@/lib/env'
import { clientIp } from '@/server/api/rate-limit'
import { now, uid } from '@/lib/utils'
import type { Millis, Viewer } from '@/lib/types'

/* ------------------------------------------------------------------------- *
 * Schema additions
 * ------------------------------------------------------------------------- *
 * `schema.sql` is owned by the data layer and is not edited from here, so the
 * two objects this surface needs are created idempotently on first use. Both
 * are additive: an index on an existing column, and a table no other module
 * reads. Recorded as a deviation in /design/direction.md.
 */

let ensured = false

function ensureAuthObjects(): void {
  if (ensured) return
  run(`CREATE TABLE IF NOT EXISTS rate_limit (
         bucket     TEXT PRIMARY KEY,
         tokens     REAL NOT NULL,
         updated_at INTEGER NOT NULL
       ) STRICT`)
  run(`CREATE INDEX IF NOT EXISTS ix_auth_sessions_token
         ON auth_sessions (token_hash) WHERE revoked_at IS NULL`)
  ensured = true
}

/* ------------------------------------------------------------------------- *
 * Hashing helpers
 * ------------------------------------------------------------------------- */

/** Only the digest of a secret is ever stored, for sessions and for reset links. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

/** Raw IPs are never persisted or logged; this is the only form that is kept. */
function hashSubject(value: string): string {
  return createHmac('sha256', env.authSecret).update(value).digest('hex').slice(0, 24)
}

/** A URL-safe single-use secret. 32 bytes, so guessing is not a strategy. */
export function newSecret(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * The caller's network identity, already hashed. Falls back to a constant when
 * the app runs without a proxy, which is correct: one local device is one
 * subject.
 */
export async function requestSubject(): Promise<string> {
  const h = await headers()
  return hashSubject(`ip:${clientIp(h)}`)
}

/**
 * The address a caller presents is only as honest as the caller (see
 * `clientIp`), so each address-keyed auth limit has a partner that ignores it.
 * Rotating a forged header buys a fresh per-address bucket and nothing else.
 */
export function accountSubject(email: string): string {
  return hashSubject(`account:${email.toLowerCase()}`)
}
export const SITE_SUBJECT = 'site'

/* ------------------------------------------------------------------------- *
 * Rate limiting: a lazily refilled token bucket in SQLite
 * ------------------------------------------------------------------------- *
 * Refill is computed on read, so there is no sweeper. Consumption runs inside
 * `tx()` (BEGIN IMMEDIATE), which is atomic under SQLite's writer lock, so two
 * concurrent sign-in attempts cannot both spend the last token.
 */

export interface RateResult {
  readonly allowed: boolean
  /** Whole seconds until one more attempt is available. Zero when allowed. */
  readonly retryAfterSeconds: number
  readonly remaining: number
}

export interface RatePolicy {
  readonly id: string
  readonly capacity: number
  readonly windowMs: number
}

export const RATE_POLICIES = {
  signIn: { id: 'auth.sign-in', capacity: 5, windowMs: 15 * 60_000 },
  signUp: { id: 'auth.sign-up', capacity: 3, windowMs: 60 * 60_000 },
  // Backstops that ignore the caller's address. Twenty failures on one account
  // in fifteen minutes is a guessing attack whatever address it comes from; two
  // hundred new accounts an hour is far above this community's real rate and
  // well below what a script rotating a forged header would manage.
  signInAccount: { id: 'auth.sign-in.account', capacity: 20, windowMs: 15 * 60_000 },
  signUpSite: { id: 'auth.sign-up.site', capacity: 200, windowMs: 60 * 60_000 },
  // Credential stuffing tries one password against many accounts, so every
  // address sees a single failure and neither limit above ever fills. This one
  // counts failures from one network whatever address they name. Thirty in
  // fifteen minutes is a lot of mistyping for one office behind one NAT.
  signInNetwork: { id: 'auth.sign-in.network', capacity: 30, windowMs: 15 * 60_000 },
  forgotAccount: { id: 'auth.password.forgot.account', capacity: 5, windowMs: 60 * 60_000 },
  forgot: { id: 'auth.password.forgot', capacity: 3, windowMs: 60 * 60_000 },
  // Each reset request can put an email in a stranger's inbox. The network limit
  // stops one network cycling through addresses; the site limit, charged only
  // for a message actually sent, keeps a forged-header script from turning the
  // provider account into a spam cannon and getting the sender blocklisted.
  forgotNetwork: { id: 'auth.password.forgot.network', capacity: 10, windowMs: 60 * 60_000 },
  forgotSite: { id: 'auth.password.forgot.site', capacity: 300, windowMs: 60 * 60_000 },
  reset: { id: 'auth.password.reset', capacity: 5, windowMs: 60 * 60_000 },
  handle: { id: 'auth.handle-available', capacity: 30, windowMs: 60_000 },
} as const satisfies Record<string, RatePolicy>

interface BucketRow {
  tokens: number
  updated_at: Millis
}

export function consumeRateLimit(policy: RatePolicy, subject: string, cost = 1): RateResult {
  ensureAuthObjects()
  const key = `${policy.id}:${subject}`
  const rate = policy.capacity / policy.windowMs // tokens per ms

  return tx(() => {
    const ts = now()
    const row = get<BucketRow>(`SELECT tokens, updated_at FROM rate_limit WHERE bucket = ?`, [key])

    const tokens = row
      ? Math.min(policy.capacity, row.tokens + Math.max(0, ts - row.updated_at) * rate)
      : policy.capacity

    if (tokens < cost) {
      const waitMs = (cost - tokens) / rate
      run(
        `INSERT INTO rate_limit (bucket, tokens, updated_at) VALUES (?, ?, ?)
           ON CONFLICT (bucket) DO UPDATE SET tokens = excluded.tokens, updated_at = excluded.updated_at`,
        [key, tokens, ts],
      )
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)), remaining: 0 }
    }

    const left = tokens - cost
    run(
      `INSERT INTO rate_limit (bucket, tokens, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (bucket) DO UPDATE SET tokens = excluded.tokens, updated_at = excluded.updated_at`,
      [key, left, ts],
    )
    return { allowed: true, retryAfterSeconds: 0, remaining: Math.floor(left) }
  })
}

/**
 * Reads a bucket without spending from it. For a limit that is charged later,
 * only when the thing it counts actually happens (a reset email leaving).
 */
export function peekRateLimit(policy: RatePolicy, subject: string): RateResult {
  ensureAuthObjects()
  const key = `${policy.id}:${subject}`
  const rate = policy.capacity / policy.windowMs
  const row = get<BucketRow>(`SELECT tokens, updated_at FROM rate_limit WHERE bucket = ?`, [key])
  const tokens = row
    ? Math.min(policy.capacity, row.tokens + Math.max(0, now() - row.updated_at) * rate)
    : policy.capacity
  if (tokens < 1) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((1 - tokens) / rate / 1000)), remaining: 0 }
  }
  return { allowed: true, retryAfterSeconds: 0, remaining: Math.floor(tokens) }
}

/** Empties a bucket, so a successful sign-in does not leave failures counted against the device. */
export function clearRateLimit(policy: RatePolicy, subject: string): void {
  ensureAuthObjects()
  run(`DELETE FROM rate_limit WHERE bucket = ?`, [`${policy.id}:${subject}`])
}

/**
 * Gives back the token one attempt spent. For a limit meant to count only
 * failures: it is charged up front, atomically, and refunded when the attempt
 * turns out to be a success. Charging only after a failure instead lets a burst
 * of concurrent attempts all pass the check before the first charge lands.
 */
export function refundRateLimit(policy: RatePolicy, subject: string): void {
  ensureAuthObjects()
  run(`UPDATE rate_limit SET tokens = MIN(?, tokens + 1) WHERE bucket = ?`, [
    policy.capacity,
    `${policy.id}:${subject}`,
  ])
}

/** Combines the address with the network subject, so one mailbox cannot be ground down from everywhere. */
export function credentialSubject(email: string, ipSubject: string): string {
  return hashSubject(`${email.toLowerCase()}|${ipSubject}`)
}

/* ------------------------------------------------------------------------- *
 * Sessions: the cookie is a JWT, this table is what makes it revocable
 * ------------------------------------------------------------------------- *
 * `SessionClaims` in `@/lib/auth` carries no `sid`, and that module is not
 * editable from this surface, so the binding is the digest of the cookie value
 * itself: `auth_sessions.token_hash = sha256(jwt)`. It gives the same property
 * a `jti` would give (one row per issued cookie, revocable independently) without
 * changing the claim set.
 */

export interface RecordSessionInput {
  readonly userId: string
  readonly token: string
  readonly expiresAt: Millis
}

export async function recordSession(input: RecordSessionInput): Promise<string> {
  ensureAuthObjects()
  const h = await headers()
  const id = uid()
  createSession({
    id,
    userId: input.userId,
    tokenHash: hashToken(input.token),
    expiresAt: input.expiresAt,
    userAgent: h.get('user-agent')?.slice(0, 400) ?? null,
    ipHash: await requestSubject(),
  })
  return id
}

interface SessionLookupRow {
  id: string
  user_id: string
  last_used_at: Millis
}

/** Five minutes of write coalescing: an authoritative check should not be a write per request. */
const TOUCH_INTERVAL_MS = 5 * 60_000

/**
 * The signed claims, but only while the session behind them is still live.
 *
 * Same shape as `currentClaims()` from `@/lib/auth`, so a call site adopts it
 * by changing its import and nothing else. It exists because that function
 * cannot do this itself: `@/lib/auth` is framework-free and has no database, by
 * design, since middleware imports the same session reader and runs where there
 * is no SQLite. This is the server-side pair of it.
 *
 * Use it in any Server Action that authorises a write from `claims.uid`.
 *
 * One query answers three questions: the cookie still has an unrevoked row, the
 * row belongs to the account the cookie names, and that account is active. A
 * cookie outlives the account it names, and moderation writes `users.status`,
 * so a suspended or deactivated account must stop here rather than keep write
 * access until its token expires.
 *
 * The handle is read from the row, never from the cookie. The cookie carries
 * the handle its owner had when they signed in, and after a rename in settings
 * every surface reading `claims.handle` (the profile link, the deactivation
 * confirmation that asks you to type it) would otherwise use the old one until
 * the token expired, up to thirty days later.
 */
async function loadClaimsLive(): Promise<SessionClaims | null> {
  ensureAuthObjects()
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  const claims = await readSession(token)
  if (!token || !claims) return null
  const row = get<{ handle: string }>(
    `SELECT u.handle FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
        AND s.user_id = ? AND u.deleted_at IS NULL AND u.status = 'active'`,
    [hashToken(token), now(), claims.uid],
  )
  return row ? { uid: claims.uid, handle: row.handle } : null
}

/**
 * Wrapped in React `cache()` for the same reason `currentUser()` is: a page
 * that asks twice during one render should cost one query, not two.
 */
export const currentClaimsLive: () => Promise<SessionClaims | null> = cache(loadClaimsLive)

/**
 * The authoritative identity check. Verifies the signature, then proves the
 * cookie still has a live, unrevoked row. A revoked session fails here even
 * though its JWT is still perfectly valid, which is the whole point of the
 * table.
 */
async function loadCurrentUser(): Promise<Viewer | null> {
  ensureAuthObjects()
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null

  const claims = await readSession(token)
  if (!claims) return null

  const ts = now()
  const row = get<SessionLookupRow>(
    `SELECT id, user_id, last_used_at FROM auth_sessions
      WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
    [hashToken(token), ts],
  )
  if (!row) return null

  // A cookie that verifies but names a different account than its row is a
  // forgery attempt or a rotated secret; either way it is not an identity.
  if (row.user_id !== claims.uid) return null

  const viewer = getViewer(claims.uid)
  if (!viewer) return null

  if (ts - row.last_used_at > TOUCH_INTERVAL_MS) {
    run(`UPDATE auth_sessions SET last_used_at = ? WHERE id = ? AND revoked_at IS NULL`, [ts, row.id])
    touchLastSeen(viewer.id)
  }

  return viewer
}

/**
 * Wrapped in React `cache()`, so ten components asking who is signed in during
 * one render cost one pair of queries, not ten.
 */
export const currentUser: () => Promise<Viewer | null> = cache(loadCurrentUser)

/** The current session's row id, for revoking exactly this device on sign-out. */
export async function currentSessionId(): Promise<string | null> {
  ensureAuthObjects()
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  const row = get<{ id: string }>(
    `SELECT id FROM auth_sessions WHERE token_hash = ? AND revoked_at IS NULL`,
    [hashToken(token)],
  )
  return row?.id ?? null
}

/* ------------------------------------------------------------------------- *
 * Reset tokens
 * ------------------------------------------------------------------------- */

/**
 * Burns every outstanding password-reset link for one account.
 *
 * Called after a successful reset and after a successful sign-in: in both cases
 * the person has proved they hold the account, so any link still sitting in a
 * mailbox is now a liability rather than a convenience.
 *
 * Returns how many links were burned, so a caller can say the real number.
 */
export function invalidateResetTokens(userId: string): number {
  const r = run(
    `UPDATE auth_tokens SET consumed_at = ?
      WHERE user_id = ? AND purpose = 'password_reset'
        AND consumed_at IS NULL AND expires_at > ?`,
    [now(), userId, now()],
  )
  return r.changes
}

/* ------------------------------------------------------------------------- *
 * Handles
 * ------------------------------------------------------------------------- */

interface HandleRow {
  handle_normalized: string
}

/**
 * Three free alternates, derived from what the person actually typed rather
 * than from a random number, so the suggestion is still their name.
 */
export function suggestHandles(desired: string): readonly string[] {
  const base = normalizeHandle(desired).replace(/-+$/, '').slice(0, 18) || 'maker'
  const candidates = [
    `${base}-dev`,
    `${base}-makes`,
    `${base}-hq`,
    `${base}2`,
    `the-${base}`.slice(0, 24),
  ].filter((h) => h.length >= 3 && h.length <= 24)

  const taken = new Set(
    all<HandleRow>(
      `SELECT handle_normalized FROM users WHERE handle_normalized IN (${candidates.map(() => '?').join(', ')})`,
      [...candidates],
    ).map((r) => r.handle_normalized),
  )

  return candidates.filter((h) => !taken.has(h)).slice(0, 3)
}

/* ------------------------------------------------------------------------- *
 * Constant-time comparison for the sign-out origin check
 * ------------------------------------------------------------------------- */

export function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

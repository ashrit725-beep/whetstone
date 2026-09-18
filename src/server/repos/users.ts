/**
 * Accounts, sessions and single-use tokens.
 *
 * `users` is deliberately thin. Anything a visitor sees lives in `profiles`, so
 * no public page ever selects a password hash by accident.
 */

import { all, get, run, tx } from '@/server/db/client'
import { now, uid } from '@/lib/utils'
import type {
  AuthSessionRow,
  Millis,
  SessionView,
  UserRow,
  UserStatus,
  Viewer,
} from '@/lib/types'
import { bool, num, str, strOrNull, type Row } from './_shared'

/* ------------------------------------------------------------------------- *
 * Reads
 * ------------------------------------------------------------------------- */

export function getUserById(id: string): UserRow | undefined {
  return get<UserRow>(
    `SELECT * FROM users WHERE id = ? AND deleted_at IS NULL`,
    [id],
  )
}

export function getUserByHandle(handle: string): UserRow | undefined {
  return get<UserRow>(
    `SELECT * FROM users WHERE handle_normalized = ? AND deleted_at IS NULL`,
    [normalizeHandle(handle)],
  )
}

/** Includes the password hash: only the sign-in path should call this. */
export function getUserByEmail(email: string): UserRow | undefined {
  return get<UserRow>(
    `SELECT * FROM users WHERE email_normalized = ? AND deleted_at IS NULL`,
    [normalizeEmail(email)],
  )
}

/**
 * The signed-in user as every repository wants to receive them. Returns null
 * for a suspended, banned or deleted account, so a revoked user cannot keep
 * acting on a still-valid cookie.
 */
export function getViewer(userId: string | null | undefined): Viewer | null {
  if (!userId) return null
  const row = get<Row>(
    `SELECT id, handle, is_expert, role, status FROM users
      WHERE id = ? AND deleted_at IS NULL`,
    [userId],
  )
  if (!row) return null
  const status = str(row, 'status') as UserStatus
  if (status !== 'active') return null
  const role = str(row, 'role')
  return {
    id: str(row, 'id'),
    handle: str(row, 'handle'),
    isExpert: bool(row, 'is_expert'),
    role: role === 'admin' || role === 'moderator' ? role : 'member',
  }
}

export function handleIsTaken(handle: string, exceptUserId?: string): boolean {
  const row = get<Row>(
    `SELECT id FROM users WHERE handle_normalized = ? AND (? IS NULL OR id <> ?)`,
    [normalizeHandle(handle), exceptUserId ?? null, exceptUserId ?? ''],
  )
  return row !== undefined
}

export function emailIsTaken(email: string): boolean {
  return get<Row>(`SELECT id FROM users WHERE email_normalized = ?`, [normalizeEmail(email)]) !== undefined
}

/* ------------------------------------------------------------------------- *
 * Writes
 * ------------------------------------------------------------------------- */

export interface NewUserInput {
  readonly email: string
  readonly handle: string
  readonly displayName: string
  readonly passwordHash?: string | null
  readonly primaryRole?: string | null
  readonly bio?: string | null
  readonly avatarUrl?: string | null
  readonly role?: 'member' | 'moderator' | 'admin'
  readonly emailVerifiedAt?: Millis | null
}

/**
 * Creates the account and the four rows that must exist beside it. Doing this
 * outside a transaction is how a user ends up with no profile and a blank
 * display name on every row they touch.
 */
export function createUser(input: NewUserInput): UserRow {
  const id = uid()
  const ts = now()
  return tx(() => {
    run(
      `INSERT INTO users
         (id, email, email_normalized, email_verified_at, password_hash,
          handle, handle_normalized, role, status, is_expert,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?)`,
      [
        id,
        input.email.trim(),
        normalizeEmail(input.email),
        input.emailVerifiedAt ?? null,
        input.passwordHash ?? null,
        input.handle.trim(),
        normalizeHandle(input.handle),
        input.role ?? 'member',
        ts,
        ts,
      ],
    )
    run(
      `INSERT INTO profiles (user_id, display_name, avatar_url, bio, primary_role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.displayName.trim(), input.avatarUrl ?? null, input.bio ?? null, input.primaryRole ?? null, ts, ts],
    )
    run(`INSERT INTO user_settings (user_id, updated_at) VALUES (?, ?)`, [id, ts])
    run(
      `INSERT INTO reputation_scores (user_id, computed_at) VALUES (?, ?)`,
      [id, ts],
    )
    const created = getUserById(id)
    if (!created) throw new Error('User row vanished inside its own transaction')
    return created
  })
}

export function touchLastSeen(userId: string): void {
  run(`UPDATE users SET last_seen_at = ? WHERE id = ?`, [now(), userId])
}

export function setPasswordHash(userId: string, passwordHash: string): void {
  run(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, [passwordHash, now(), userId])
}

export function markEmailVerified(userId: string): void {
  const ts = now()
  run(`UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ? AND email_verified_at IS NULL`, [ts, ts, userId])
}

export function setHandle(userId: string, handle: string): void {
  run(
    `UPDATE users SET handle = ?, handle_normalized = ?, updated_at = ? WHERE id = ?`,
    [handle.trim(), normalizeHandle(handle), now(), userId],
  )
}

export function setExpertFlag(userId: string, isExpert: boolean): void {
  run(`UPDATE users SET is_expert = ?, updated_at = ? WHERE id = ?`, [isExpert ? 1 : 0, now(), userId])
}

/* ------------------------------------------------------------------------- *
 * Sessions
 * ------------------------------------------------------------------------- *
 * The cookie is a stateless JWT. This table is what makes "sign out everywhere"
 * and the active-device list possible: a JWT alone cannot be revoked.
 */

export interface NewSessionInput {
  readonly id: string
  readonly userId: string
  readonly tokenHash: string
  readonly expiresAt: Millis
  readonly userAgent?: string | null
  readonly ipHash?: string | null
}

export function createSession(input: NewSessionInput): void {
  const ts = now()
  run(
    `INSERT INTO auth_sessions
       (id, user_id, token_hash, user_agent, ip_hash, created_at, last_used_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.id, input.userId, input.tokenHash, input.userAgent ?? null, input.ipHash ?? null, ts, ts, input.expiresAt],
  )
}

/** Live means not revoked and not expired. Anything else is not a session. */
export function getLiveSession(sessionId: string): AuthSessionRow | undefined {
  return get<AuthSessionRow>(
    `SELECT * FROM auth_sessions
      WHERE id = ? AND revoked_at IS NULL AND expires_at > ?`,
    [sessionId, now()],
  )
}

export function touchSession(sessionId: string): void {
  run(`UPDATE auth_sessions SET last_used_at = ? WHERE id = ? AND revoked_at IS NULL`, [now(), sessionId])
}

export function revokeSession(sessionId: string): void {
  run(`UPDATE auth_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`, [now(), sessionId])
}

/** Returns how many devices were signed out, so the UI can say the real number. */
export function revokeAllSessions(userId: string, exceptSessionId?: string): number {
  const r = run(
    `UPDATE auth_sessions SET revoked_at = ?
      WHERE user_id = ? AND revoked_at IS NULL AND id <> COALESCE(?, '')`,
    [now(), userId, exceptSessionId ?? null],
  )
  return r.changes
}

export function listSessions(userId: string, currentSessionId?: string): readonly SessionView[] {
  const rows = all<Row>(
    `SELECT id, user_agent, created_at, last_used_at, expires_at
       FROM auth_sessions
      WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
      ORDER BY last_used_at DESC`,
    [userId, now()],
  )
  return rows.map((r) => ({
    id: str(r, 'id'),
    userAgent: strOrNull(r, 'user_agent'),
    createdAt: num(r, 'created_at'),
    lastUsedAt: num(r, 'last_used_at'),
    expiresAt: num(r, 'expires_at'),
    isCurrent: str(r, 'id') === currentSessionId,
  }))
}

/* ------------------------------------------------------------------------- *
 * Single-use tokens
 * ------------------------------------------------------------------------- */

export type TokenPurpose = 'email_verify' | 'password_reset' | 'magic_link' | 'email_change'

export function createAuthToken(input: {
  readonly userId: string
  readonly purpose: TokenPurpose
  readonly tokenHash: string
  readonly expiresAt: Millis
  readonly payload?: Record<string, unknown> | null
}): string {
  const id = uid()
  run(
    `INSERT INTO auth_tokens (id, user_id, purpose, token_hash, payload, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.userId, input.purpose, input.tokenHash, input.payload ? JSON.stringify(input.payload) : null, now(), input.expiresAt],
  )
  return id
}

export interface AuthTokenState {
  readonly state: 'valid' | 'expired' | 'consumed' | 'unknown'
  readonly userId: string | null
  readonly purpose: TokenPurpose | null
  readonly payload: Record<string, unknown> | null
}

/**
 * Read the state before rendering a reset form: an expired link should never
 * show a form the user will fill out for nothing.
 */
export function getAuthTokenState(tokenHash: string): AuthTokenState {
  const row = get<Row>(
    `SELECT user_id, purpose, payload, expires_at, consumed_at FROM auth_tokens WHERE token_hash = ?`,
    [tokenHash],
  )
  if (!row) return { state: 'unknown', userId: null, purpose: null, payload: null }
  const payloadRaw = strOrNull(row, 'payload')
  let payload: Record<string, unknown> | null = null
  if (payloadRaw) {
    try {
      const parsed: unknown = JSON.parse(payloadRaw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>
    } catch {
      payload = null
    }
  }
  const base = { userId: str(row, 'user_id'), purpose: str(row, 'purpose') as TokenPurpose, payload }
  if (row['consumed_at'] !== null && row['consumed_at'] !== undefined) return { ...base, state: 'consumed' }
  if (num(row, 'expires_at') <= now()) return { ...base, state: 'expired' }
  return { ...base, state: 'valid' }
}

/** Consumes atomically: the UPDATE only matches an unconsumed, unexpired row. */
export function consumeAuthToken(tokenHash: string): boolean {
  const r = run(
    `UPDATE auth_tokens SET consumed_at = ?
      WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?`,
    [now(), tokenHash, now()],
  )
  return r.changes === 1
}

/* ------------------------------------------------------------------------- *
 * Normalisation
 * ------------------------------------------------------------------------- */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase().replace(/^@/, '')
}

import { scrypt as _scrypt, randomBytes, timingSafeEqual } from 'node:crypto'
import type { ScryptOptions } from 'node:crypto'
import { promisify } from 'node:util'
import { SignJWT, jwtVerify } from 'jose'
import { cookies, headers } from 'next/headers'
import { env, secureCookies } from '@/lib/env'

const scrypt = promisify(_scrypt) as (
  p: string | Buffer,
  s: Buffer,
  k: number,
  o: ScryptOptions,
) => Promise<Buffer>

const COOKIE = 'ws_session'
/** How long a session lasts when "Stay signed in" is ticked. */
export const LONG_SESSION_S = 60 * 60 * 24 * 30
/** And when it is not: the cookie dies with the browser, the token within a day. */
export const SHORT_SESSION_S = 60 * 60 * 24

/*
 * Password hashing.
 *
 * Current parameters follow OWASP's scrypt guidance (N=2^15, r=8, p=3). That
 * choice rather than N=2^17, p=1 is deliberate: both cost the same CPU, but
 * this one needs 32 MiB per hash instead of 128 MiB, and libuv runs four at
 * once, so a burst of sign-ins cannot push a small server into swap.
 *
 * The parameters are written into every stored hash, so they can be raised
 * later without locking anyone out. Hashes from before this change have the
 * short form `scrypt$<salt>$<hash>` and were made with Node's defaults
 * (N=2^14, r=8, p=1); they still verify, and `needsRehash` tells sign-in to
 * replace them while the plaintext is in hand.
 */
const KEYLEN = 64
type Params = { N: number; r: number; p: number }
const CURRENT: Params = { N: 2 ** 15, r: 8, p: 3 }
const LEGACY: Params = { N: 2 ** 14, r: 8, p: 1 }
const MAX_N = 2 ** 20

function options({ N, r, p }: Params): ScryptOptions {
  // Node refuses anything above maxmem (32 MiB by default), and 128*N*r lands
  // exactly on that line for the current parameters. Give it room.
  return { N, r, p, maxmem: 256 * N * r + 1024 * 1024 }
}

type Parsed = { params: Params; salt: Buffer; hash: Buffer }

function parseHash(stored: string): Parsed | null {
  const parts = stored.split('$')
  if (parts[0] !== 'scrypt') return null
  if (parts.length === 3) {
    return { params: LEGACY, salt: Buffer.from(parts[1]!, 'hex'), hash: Buffer.from(parts[2]!, 'hex') }
  }
  if (parts.length === 6) {
    const [N, r, p] = parts.slice(1, 4).map((v) => Number.parseInt(v, 10)) as [number, number, number]
    // Refuse parameters nobody here would have written. A tampered row must not
    // be able to make one sign-in allocate gigabytes.
    const sane =
      Number.isInteger(N) && N >= 2 ** 14 && N <= MAX_N && (N & (N - 1)) === 0 &&
      Number.isInteger(r) && r >= 8 && r <= 16 &&
      Number.isInteger(p) && p >= 1 && p <= 8
    if (!sane) return null
    return { params: { N, r, p }, salt: Buffer.from(parts[4]!, 'hex'), hash: Buffer.from(parts[5]!, 'hex') }
  }
  return null
}

/** scrypt with a per-password salt. Stored as `scrypt$N$r$p$<saltHex>$<hashHex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, KEYLEN, options(CURRENT))
  const { N, r, p } = CURRENT
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${hash.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseHash(stored)
  if (!parsed || parsed.hash.length === 0) return false
  const actual = await scrypt(password, parsed.salt, parsed.hash.length, options(parsed.params))
  // Constant-time compare so failures do not leak prefix length.
  return actual.length === parsed.hash.length && timingSafeEqual(actual, parsed.hash)
}

/** True when a stored hash was made with weaker parameters than today's. */
export function needsRehash(stored: string): boolean {
  const parsed = parseHash(stored)
  if (!parsed) return false
  const { N, r, p } = parsed.params
  return N * r * p < CURRENT.N * CURRENT.r * CURRENT.p || N < CURRENT.N
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.authSecret)
}

export type SessionClaims = { uid: string; handle: string }

const SESSION_ALG = 'HS256'

export async function signSession(
  claims: SessionClaims,
  ttlSeconds: number = LONG_SESSION_S,
): Promise<string> {
  return new SignJWT({ handle: claims.handle })
    .setProtectedHeader({ alg: SESSION_ALG })
    .setSubject(claims.uid)
    .setIssuedAt()
    .setIssuer('whetstone')
    .setAudience('whetstone-web')
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secretKey())
}

export async function readSession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      // Only the algorithm `signSession` uses. jose already refuses `none` and
      // asymmetric algorithms for a shared secret; naming the one that is
      // expected means no other HMAC variant is ever accepted either.
      algorithms: [SESSION_ALG],
      issuer: 'whetstone',
      audience: 'whetstone-web',
    })
    if (!payload.sub || typeof payload.handle !== 'string') return null
    return { uid: payload.sub, handle: payload.handle }
  } catch {
    return null
  }
}

/**
 * `persist: false` sets a browser-session cookie (no Max-Age), which is what
 * leaving "Stay signed in" unticked promises: close the browser and it is gone.
 * The token inside still expires on its own within a day, and the server-side
 * session row expires with it, so a browser that restores its tabs does not
 * keep the session alive forever.
 */
export async function setSessionCookie(token: string, persist = true): Promise<void> {
  const jar = await cookies()
  const secure = secureCookies((await headers()).get('x-forwarded-proto'))
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    ...(persist ? { maxAge: LONG_SESSION_S } : {}),
  })
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies()
  const secure = secureCookies((await headers()).get('x-forwarded-proto'))
  jar.set(COOKIE, '', { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 0 })
}

export async function currentClaims(): Promise<SessionClaims | null> {
  const jar = await cookies()
  return readSession(jar.get(COOKIE)?.value)
}

export const SESSION_COOKIE = COOKIE

import { createHmac } from 'node:crypto'
import { all, get, run, tx } from '@/server/db/client'
import { env } from '@/lib/env'

/**
 * The authoritative rate limiter (ROUTES §3, layer L2).
 *
 * A leaky token bucket held in SQLite, refilled lazily on read so there is no
 * sweeper process and no clock to keep. Consumption runs inside the existing
 * `tx()` helper, which opens `BEGIN IMMEDIATE`, so the read-modify-write is
 * atomic under SQLite's single writer lock and two simultaneous requests cannot
 * both see the last token.
 *
 * The table is created here rather than in `schema.sql` for the same reason the
 * AI layer creates its own four: it belongs to this layer, and the product
 * schema should not carry infrastructure. Every statement is `IF NOT EXISTS`
 * and runs once per process.
 *
 * If SQLite is unavailable (a read-only filesystem, a preview sandbox) the
 * limiter falls back to a per-process map. That is weaker, not absent: a
 * limiter that cannot persist is still a limiter for the instance it runs in.
 *
 * Subjects: `uid:<userId>` when signed in, otherwise `ip:<hmac>`. The HMAC is
 * keyed with `AUTH_SECRET` and truncated, so a raw address is never written to
 * disk or to a log line, and one abusive account cannot rate-limit a whole
 * NAT'd office.
 */

const DDL = `
CREATE TABLE IF NOT EXISTS rate_limit (
  bucket     TEXT PRIMARY KEY,
  tokens     REAL NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS ix_rate_limit_stale ON rate_limit (updated_at);
`

let ready: boolean | null = null

function storeReady(): boolean {
  if (ready !== null) return ready
  try {
    run('SELECT 1')
    tx(() => {
      for (const statement of DDL.split(';')) {
        const sql = statement.trim()
        if (sql.length > 0) run(sql)
      }
    })
    ready = true
  } catch {
    ready = false
  }
  return ready
}

/* -------------------------------------------------------------------------- *
 * Fallback store
 * -------------------------------------------------------------------------- */

type Cell = { tokens: number; updatedAt: number }
const memory = new Map<string, Cell>()

function readCell(bucket: string): Cell | undefined {
  if (storeReady()) {
    const row = get<{ tokens: number; updated_at: number }>(
      'SELECT tokens, updated_at FROM rate_limit WHERE bucket = ?',
      [bucket],
    )
    return row ? { tokens: row.tokens, updatedAt: row.updated_at } : undefined
  }
  return memory.get(bucket)
}

function writeCell(bucket: string, cell: Cell): void {
  if (storeReady()) {
    run(
      `INSERT INTO rate_limit (bucket, tokens, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (bucket) DO UPDATE SET tokens = excluded.tokens, updated_at = excluded.updated_at`,
      [bucket, cell.tokens, cell.updatedAt],
    )
    return
  }
  memory.set(bucket, cell)
  if (memory.size > 20_000) sweepMemory()
}

const DAY_MS = 86_400_000
const SWEEP_EVERY_MS = 3_600_000
let lastSweep = 0

function sweepMemory(): void {
  const cutoff = Date.now() - DAY_MS
  for (const [key, cell] of memory) if (cell.updatedAt < cutoff) memory.delete(key)
}

/** Drops buckets nobody has touched in a day. Runs at most hourly, inline. */
function maybeSweep(nowMs: number): void {
  if (nowMs - lastSweep < SWEEP_EVERY_MS) return
  lastSweep = nowMs
  if (storeReady()) {
    try {
      run('DELETE FROM rate_limit WHERE updated_at < ?', [nowMs - DAY_MS])
    } catch {
      /* a sweep that fails is a slightly larger table, not a failed request */
    }
    return
  }
  sweepMemory()
}

/* -------------------------------------------------------------------------- *
 * Subjects
 * -------------------------------------------------------------------------- */

export type RateSubject = string

/** Hashed, truncated, keyed with the app secret. Raw addresses are never stored. */
export function hashIp(ip: string): string {
  return createHmac('sha256', env.authSecret).update(ip).digest('hex').slice(0, 16)
}

/**
 * The client address, as well as this deployment can know it.
 *
 * `next start` fills `x-forwarded-for` from the socket when the request did not
 * bring one (base-server: `headers['x-forwarded-for'] ??= socket.remoteAddress`),
 * so an ordinary browser is keyed by its real address. A caller who sends the
 * header themselves keeps whatever they sent, which is why no limit here is
 * allowed to depend on the address alone: every sensitive policy also has a
 * cap that ignores it (per account for sign-in, site-wide for sign-up).
 *
 * An earlier version refused to read the header at all unless
 * `TRUST_PROXY_HEADERS` was set and put every signed-out caller in one bucket.
 * That traded a bypassable limit for a denial of service: three sign-ups an
 * hour, for the whole site. Behind a proxy that appends rather than overwrites
 * (nginx's `$proxy_add_x_forwarded_for`), set `TRUST_PROXY_HEADERS` and the
 * right-most entry, the one the proxy observed, is used instead.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  const entries = forwarded
    ? forwarded.split(',').map((e) => e.trim()).filter((e) => e.length > 0)
    : []
  if (entries.length > 0) {
    return env.trustProxyHeaders ? entries[entries.length - 1]! : entries[0]!
  }
  return headers.get('x-real-ip')?.trim() || 'local'
}

export function subjectFor(userId: string | null, headers: Headers): RateSubject {
  if (userId) return `uid:${userId}`
  return `ip:${hashIp(clientIp(headers))}`
}

/* -------------------------------------------------------------------------- *
 * Consumption
 * -------------------------------------------------------------------------- */

export interface LimitSpec {
  /** Stable route identifier, e.g. `feedback.vote`. Part of the bucket key. */
  readonly id: string
  readonly capacity: number
  readonly windowMs: number
  /**
   * Minimum spacing between two accepted requests, in ms. Implemented as a
   * second single-token bucket, which is what stops a double-submit without
   * spending the hourly allowance.
   */
  readonly floorMs?: number
  /**
   * How much this request costs. Defaults to 1. Byte-metered routes pass a
   * proportional cost so a 20 MB upload is not one token.
   */
  readonly cost?: number
}

export interface RateResult {
  readonly allowed: boolean
  readonly limit: number
  readonly remaining: number
  /**
   * Seconds, with two readings depending on the verdict, which is what the
   * `RateLimit-Reset` and `Retry-After` headers each want.
   *
   * Denied: how long until this request would be accepted. That value is also
   * sent as `Retry-After`, so a client that waits it out succeeds.
   *
   * Allowed: how long until the allowance is whole again. A leaky bucket has no
   * window to reset, so "full" is the honest reading of a header whose name
   * assumes one, and it grows as the bucket is spent.
   */
  readonly reset: number
}

function consumeBucket(
  bucket: string,
  capacity: number,
  windowMs: number,
  cost: number,
  nowMs: number,
): RateResult {
  const rate = capacity / windowMs // tokens per ms
  const apply = (): RateResult => {
    const cell = readCell(bucket)
    const available =
      cell === undefined
        ? capacity
        : Math.min(capacity, cell.tokens + (nowMs - cell.updatedAt) * rate)

    if (available < cost) {
      const deficit = cost - available
      return {
        allowed: false,
        limit: capacity,
        remaining: Math.floor(Math.max(0, available)),
        reset: Math.max(1, Math.ceil(deficit / rate / 1000)),
      }
    }

    const left = available - cost
    writeCell(bucket, { tokens: left, updatedAt: nowMs })
    return {
      allowed: true,
      limit: capacity,
      remaining: Math.floor(left),
      reset: Math.ceil((capacity - left) / rate / 1000),
    }
  }

  if (!storeReady()) return apply()
  try {
    return tx(apply)
  } catch {
    // A locked database must not become an open door: fail closed for one
    // second rather than letting the request through unmetered.
    return { allowed: false, limit: capacity, remaining: 0, reset: 1 }
  }
}

/**
 * Spend one request's worth of budget against every spec, hardest first.
 *
 * Specs are evaluated in order and the first denial short-circuits, so a
 * request that trips the 60-second floor does not also burn an hourly token.
 * The headers reported back describe the *tightest* remaining allowance, which
 * is the number a client should pace itself against.
 */
export function consume(
  specs: readonly LimitSpec[],
  subject: RateSubject,
  atMs: number = Date.now(),
): RateResult {
  maybeSweep(atMs)
  let tightest: RateResult | null = null

  for (const spec of specs) {
    const cost = spec.cost ?? 1
    if (spec.floorMs !== undefined && spec.floorMs > 0) {
      const floor = consumeBucket(`${spec.id}#floor:${subject}`, 1, spec.floorMs, 1, atMs)
      if (!floor.allowed) return floor
    }
    const result = consumeBucket(`${spec.id}:${subject}`, spec.capacity, spec.windowMs, cost, atMs)
    if (!result.allowed) return result
    if (tightest === null || result.remaining < tightest.remaining) tightest = result
  }

  return tightest ?? { allowed: true, limit: 0, remaining: 0, reset: 0 }
}

/** Reads a bucket without spending it. Used by the AI cost ceiling reporting. */
export function peek(specId: string, subject: RateSubject, capacity: number, windowMs: number): number {
  const cell = readCell(`${specId}:${subject}`)
  if (!cell) return capacity
  const rate = capacity / windowMs
  return Math.min(capacity, cell.tokens + (Date.now() - cell.updatedAt) * rate)
}

/** Diagnostics for `/api/health`. Never exposed to an unauthenticated caller. */
export function bucketCount(): number {
  if (!storeReady()) return memory.size
  try {
    return all<{ n: number }>('SELECT COUNT(*) AS n FROM rate_limit')[0]?.n ?? 0
  } catch {
    return 0
  }
}

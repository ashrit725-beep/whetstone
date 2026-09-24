import './guard'
import { all, get, run, db } from '@/server/db/client'
import { uid, now } from '@/lib/utils'
import type { FeatureKey, RunRecord } from './types'

/**
 * Persistence for the AI layer: an artifact cache keyed by input hash, an
 * append-only run ledger for cost control, a job queue for work that must never
 * block a request, and a settings table the operator page writes to.
 *
 * These four tables are owned by this layer, so they are created here rather
 * than in the product schema. Every statement is `IF NOT EXISTS` and runs once
 * per process.
 *
 * Every call is wrapped: if SQLite is unavailable (a read-only filesystem, a
 * preview sandbox, a worker without the data directory) the layer keeps working
 * against an in-process map. A cache that cannot persist is a slower cache, not
 * a broken feature.
 */

const DDL = `
CREATE TABLE IF NOT EXISTS ai_artifact (
  id             TEXT PRIMARY KEY,
  feature        TEXT NOT NULL,
  subject_type   TEXT NOT NULL,
  subject_id     TEXT NOT NULL,
  input_hash     TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  source         TEXT NOT NULL,
  model          TEXT,
  payload_json   TEXT NOT NULL,
  generated_at   INTEGER NOT NULL,
  UNIQUE (feature, subject_type, subject_id, input_hash, schema_version)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_ai_artifact_subject
  ON ai_artifact (feature, subject_type, subject_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS ai_run (
  id                    TEXT PRIMARY KEY,
  feature               TEXT NOT NULL,
  provider              TEXT NOT NULL,
  model                 TEXT NOT NULL,
  status                TEXT NOT NULL,
  user_id               TEXT,
  project_id            TEXT,
  input_tokens          INTEGER NOT NULL DEFAULT 0,
  output_tokens         INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens     INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  cost_micros           INTEGER NOT NULL DEFAULT 0,
  latency_ms            INTEGER NOT NULL DEFAULT 0,
  error_code            TEXT,
  created_at            INTEGER NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS ix_ai_run_spend    ON ai_run (created_at);
CREATE INDEX IF NOT EXISTS ix_ai_run_user     ON ai_run (user_id, created_at);
CREATE INDEX IF NOT EXISTS ix_ai_run_project  ON ai_run (project_id, created_at);
CREATE INDEX IF NOT EXISTS ix_ai_run_feature  ON ai_run (feature, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_job (
  id           TEXT PRIMARY KEY,
  feature      TEXT NOT NULL,
  subject_id   TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  run_after    INTEGER NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'pending',
  last_error   TEXT,
  created_at   INTEGER NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS ix_ai_job_drain ON ai_job (status, run_after);
CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_job_pending
  ON ai_job (feature, subject_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS ai_setting (
  setting_key TEXT PRIMARY KEY,
  value_json  TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
) STRICT;
`

let ready: boolean | null = null

/** True when the tables exist and SQLite accepted them. Checked once per process. */
export function storeReady(): boolean {
  if (ready !== null) return ready
  try {
    db().exec(DDL)
    ready = true
  } catch {
    ready = false
  }
  return ready
}

// --- in-process fallback ----------------------------------------------------

type MemArtifact = {
  feature: string
  subjectType: string
  subjectId: string
  inputHash: string
  schemaVersion: number
  source: 'ai' | 'heuristic'
  model: string | null
  payload: string
  generatedAt: number
}

const memArtifacts = new Map<string, MemArtifact>()
const memRuns: Array<{ createdAt: number; costMicros: number; userId?: string; projectId?: string }> = []
const memSettings = new Map<string, string>()

function memKey(a: Pick<MemArtifact, 'feature' | 'subjectType' | 'subjectId' | 'inputHash' | 'schemaVersion'>): string {
  return `${a.feature}|${a.subjectType}|${a.subjectId}|${a.inputHash}|${a.schemaVersion}`
}

// --- artifacts --------------------------------------------------------------

export type Artifact<T> = {
  payload: T
  source: 'ai' | 'heuristic'
  model?: string
  generatedAt: number
  inputHash: string
}

type ArtifactRow = {
  input_hash: string
  source: string
  model: string | null
  payload_json: string
  generated_at: number
}

export type ArtifactKey = {
  feature: FeatureKey
  subjectType: 'project' | 'feedback' | 'pair' | 'user' | 'draft'
  subjectId: string
  inputHash: string
  schemaVersion: number
}

/** Exact-hash lookup. A hit means the inputs are byte-identical to last time. */
export function readArtifact<T>(key: ArtifactKey): Artifact<T> | undefined {
  const row = storeReady()
    ? get<ArtifactRow>(
        `SELECT input_hash, source, model, payload_json, generated_at FROM ai_artifact
         WHERE feature = ? AND subject_type = ? AND subject_id = ? AND input_hash = ? AND schema_version = ?`,
        [key.feature, key.subjectType, key.subjectId, key.inputHash, key.schemaVersion],
      )
    : undefined
  if (row) return decode<T>(row)
  const mem = memArtifacts.get(memKey(key))
  if (!mem) return undefined
  return {
    payload: parse<T>(mem.payload),
    source: mem.source,
    model: mem.model ?? undefined,
    generatedAt: mem.generatedAt,
    inputHash: mem.inputHash,
  }
}

/**
 * The most recent artifact for a subject regardless of input hash. This is what
 * makes level L2 of the degradation ladder possible: a dashboard shows last
 * week's themes with an "as of" line rather than collapsing to keywords the
 * moment a provider blinks.
 *
 * `accept` skips artifacts the caller cannot use as a fallback, newest first,
 * so one bad answer does not hide the good one written before it.
 */
export function readLatestArtifact<T>(
  feature: FeatureKey,
  subjectType: ArtifactKey['subjectType'],
  subjectId: string,
  schemaVersion: number,
  accept: (payload: T) => boolean = () => true,
): Artifact<T> | undefined {
  if (storeReady()) {
    const rows = all<ArtifactRow>(
      `SELECT input_hash, source, model, payload_json, generated_at FROM ai_artifact
       WHERE feature = ? AND subject_type = ? AND subject_id = ? AND schema_version = ?
       ORDER BY generated_at DESC LIMIT 10`,
      [feature, subjectType, subjectId, schemaVersion],
    )
    for (const row of rows) {
      const artifact = decode<T>(row)
      if (accept(artifact.payload)) return artifact
    }
  }
  let best: MemArtifact | undefined
  for (const a of memArtifacts.values()) {
    if (a.feature !== feature || a.subjectType !== subjectType || a.subjectId !== subjectId) continue
    if (a.schemaVersion !== schemaVersion) continue
    if (!accept(parse<T>(a.payload))) continue
    if (!best || a.generatedAt > best.generatedAt) best = a
  }
  if (!best) return undefined
  return {
    payload: parse<T>(best.payload),
    source: best.source,
    model: best.model ?? undefined,
    generatedAt: best.generatedAt,
    inputHash: best.inputHash,
  }
}

export function writeArtifact<T>(
  key: ArtifactKey,
  payload: T,
  source: 'ai' | 'heuristic',
  model?: string,
): void {
  const generatedAt = now()
  const json = JSON.stringify(payload)
  if (storeReady()) {
    try {
      run(
        `INSERT INTO ai_artifact
           (id, feature, subject_type, subject_id, input_hash, schema_version, source, model, payload_json, generated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (feature, subject_type, subject_id, input_hash, schema_version)
         DO UPDATE SET source = excluded.source, model = excluded.model,
                       payload_json = excluded.payload_json, generated_at = excluded.generated_at`,
        [
          uid(),
          key.feature,
          key.subjectType,
          key.subjectId,
          key.inputHash,
          key.schemaVersion,
          source,
          model ?? null,
          json,
          generatedAt,
        ],
      )
      return
    } catch {
      // fall through to the in-process map
    }
  }
  memArtifacts.set(memKey(key), {
    feature: key.feature,
    subjectType: key.subjectType,
    subjectId: key.subjectId,
    inputHash: key.inputHash,
    schemaVersion: key.schemaVersion,
    source,
    model: model ?? null,
    payload: json,
    generatedAt,
  })
}

function decode<T>(row: ArtifactRow): Artifact<T> {
  return {
    payload: parse<T>(row.payload_json),
    source: row.source === 'ai' ? 'ai' : 'heuristic',
    model: row.model ?? undefined,
    generatedAt: Number(row.generated_at),
    inputHash: row.input_hash,
  }
}

function parse<T>(json: string): T {
  return JSON.parse(json) as T
}

// --- run ledger -------------------------------------------------------------

export function recordRun(record: RunRecord, scope: { userId?: string; projectId?: string } = {}): void {
  const createdAt = now()
  if (storeReady()) {
    try {
      run(
        `INSERT INTO ai_run
           (id, feature, provider, model, status, user_id, project_id,
            input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
            cost_micros, latency_ms, error_code, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uid(),
          record.feature,
          record.provider,
          record.model,
          record.status,
          scope.userId ?? null,
          scope.projectId ?? null,
          record.usage.inputTokens,
          record.usage.outputTokens,
          record.usage.cacheReadTokens,
          record.usage.cacheCreationTokens,
          record.usage.costMicros,
          record.latencyMs,
          record.errorCode ?? null,
          createdAt,
        ],
      )
      return
    } catch {
      // fall through
    }
  }
  memRuns.push({ createdAt, costMicros: record.usage.costMicros, ...scope })
  if (memRuns.length > 5000) memRuns.splice(0, memRuns.length - 5000)
}

/** Sum of measured spend, in micro-dollars, since `sinceMs`. */
export function spendSince(sinceMs: number, scope: { userId?: string; projectId?: string } = {}): number {
  if (storeReady()) {
    try {
      const clauses = ['created_at >= ?']
      const params: unknown[] = [sinceMs]
      if (scope.userId) {
        clauses.push('user_id = ?')
        params.push(scope.userId)
      }
      if (scope.projectId) {
        clauses.push('project_id = ?')
        params.push(scope.projectId)
      }
      const row = get<{ total: number | null }>(
        `SELECT SUM(cost_micros) AS total FROM ai_run WHERE ${clauses.join(' AND ')}`,
        params,
      )
      return Number(row?.total ?? 0)
    } catch {
      // fall through
    }
  }
  let total = 0
  for (const r of memRuns) {
    if (r.createdAt < sinceMs) continue
    if (scope.userId && r.userId !== scope.userId) continue
    if (scope.projectId && r.projectId !== scope.projectId) continue
    total += r.costMicros
  }
  return total
}

/**
 * Whether the most recent attempt at `feature` got an answer out of a model.
 * Null when the ledger holds no attempt for it at all.
 *
 * One `generate` walks the provider chain, so an attempt is a burst of rows
 * inside a few seconds: the window below reads that burst and asks whether any
 * row in it succeeded. Scoped to the feature rather than the project, because
 * what this answers is “is a model answering at all”, and a refused key refuses
 * every project equally.
 *
 * It exists because the in-process memory of the last background run dies with
 * the process, and a panel that invites a creator to reload for a model’s
 * version on the first render after a restart is promising exactly what the
 * last attempt was refused. The ledger is the only memory that survives.
 */
const ATTEMPT_WINDOW_MS = 60_000

export function lastRunAnswered(feature: FeatureKey): boolean | null {
  if (!storeReady()) return null
  try {
    const row = get<{ n: number; ok: number | null }>(
      `SELECT COUNT(*) AS n, SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS ok
         FROM ai_run
        WHERE feature = ?
          AND created_at >= (SELECT MAX(created_at) FROM ai_run WHERE feature = ?) - ?`,
      [feature, feature, ATTEMPT_WINDOW_MS],
    )
    if (!row || Number(row.n) === 0) return null
    return Number(row.ok ?? 0) > 0
  } catch {
    return null
  }
}

export type FeatureRunStats = {
  feature: FeatureKey
  ok: number
  errors: number
  invalid: number
  costMicros: number
}

/** Per-feature counts for the operator snapshot in `status.ts`. */
export function runStatsSince(sinceMs: number): FeatureRunStats[] {
  if (!storeReady()) return []
  try {
    const rows = all<{
      feature: string
      status: string
      n: number
      cost: number | null
    }>(
      `SELECT feature, status, COUNT(*) AS n, SUM(cost_micros) AS cost
       FROM ai_run WHERE created_at >= ? GROUP BY feature, status`,
      [sinceMs],
    )
    const byFeature = new Map<string, FeatureRunStats>()
    for (const row of rows) {
      const key = row.feature as FeatureKey
      const entry = byFeature.get(key) ?? { feature: key, ok: 0, errors: 0, invalid: 0, costMicros: 0 }
      if (row.status === 'ok') entry.ok += Number(row.n)
      else if (row.status === 'invalid') entry.invalid += Number(row.n)
      else if (row.status === 'error') entry.errors += Number(row.n)
      entry.costMicros += Number(row.cost ?? 0)
      byFeature.set(key, entry)
    }
    return [...byFeature.values()]
  } catch {
    return []
  }
}

/** Calls per feature in a window, for the per-user and per-draft rate caps. */
export function countRunsSince(
  feature: FeatureKey,
  sinceMs: number,
  scope: { userId?: string; projectId?: string } = {},
): number {
  if (!storeReady()) {
    let n = 0
    for (const r of memRuns) {
      if (r.createdAt < sinceMs) continue
      if (scope.userId && r.userId !== scope.userId) continue
      if (scope.projectId && r.projectId !== scope.projectId) continue
      n += 1
    }
    return n
  }
  try {
    const clauses = ['feature = ?', 'created_at >= ?']
    const params: unknown[] = [feature, sinceMs]
    if (scope.userId) {
      clauses.push('user_id = ?')
      params.push(scope.userId)
    }
    if (scope.projectId) {
      clauses.push('project_id = ?')
      params.push(scope.projectId)
    }
    const row = get<{ n: number }>(`SELECT COUNT(*) AS n FROM ai_run WHERE ${clauses.join(' AND ')}`, params)
    return Number(row?.n ?? 0)
  } catch {
    return 0
  }
}

/** Cache-hit health: a prefix cache that never reads is a misconfiguration. */
export function cacheReadRatioSince(sinceMs: number): number | undefined {
  if (!storeReady()) return undefined
  try {
    const row = get<{ reads: number | null; inputs: number | null }>(
      `SELECT SUM(cache_read_tokens) AS reads, SUM(input_tokens + cache_read_tokens) AS inputs
       FROM ai_run WHERE created_at >= ? AND status = 'ok'`,
      [sinceMs],
    )
    const inputs = Number(row?.inputs ?? 0)
    if (inputs <= 0) return undefined
    return Number(row?.reads ?? 0) / inputs
  } catch {
    return undefined
  }
}

// --- job queue --------------------------------------------------------------

export type Job = {
  id: string
  feature: FeatureKey
  subjectId: string
  payload: unknown
  attempts: number
}

type JobRow = {
  id: string
  feature: string
  subject_id: string
  payload_json: string
  attempts: number
}

/**
 * Enqueue background work. Unique on `(feature, subjectId)` while pending, so a
 * burst of twenty inserts on one project produces one job, not twenty.
 */
export function enqueueJob(feature: FeatureKey, subjectId: string, payload: unknown, delayMs = 0): void {
  if (!storeReady()) return
  try {
    run(
      `INSERT INTO ai_job (id, feature, subject_id, payload_json, run_after, attempts, status, created_at)
       VALUES (?, ?, ?, ?, ?, 0, 'pending', ?)
       ON CONFLICT (feature, subject_id) WHERE status = 'pending'
       DO UPDATE SET payload_json = excluded.payload_json, run_after = MIN(ai_job.run_after, excluded.run_after)`,
      [uid(), feature, subjectId, JSON.stringify(payload), now() + delayMs, now()],
    )
  } catch {
    // A queue that cannot persist degrades to synchronous heuristics, which is
    // exactly what the ladder already does on the next read.
  }
}

export function claimJobs(feature: FeatureKey, limit: number): Job[] {
  if (!storeReady()) return []
  try {
    const rows = all<JobRow>(
      `SELECT id, feature, subject_id, payload_json, attempts FROM ai_job
       WHERE feature = ? AND status = 'pending' AND run_after <= ?
       ORDER BY run_after LIMIT ?`,
      [feature, now(), limit],
    )
    for (const row of rows) {
      run(`UPDATE ai_job SET status = 'running', attempts = attempts + 1 WHERE id = ?`, [row.id])
    }
    return rows.map((row) => ({
      id: row.id,
      feature: row.feature as FeatureKey,
      subjectId: row.subject_id,
      payload: JSON.parse(row.payload_json) as unknown,
      // The row was just incremented, so report the count including this claim
      // rather than the value that was read a statement earlier.
      attempts: Number(row.attempts) + 1,
    }))
  } catch {
    return []
  }
}

/** Backoff ladder: one minute, five, thirty, then leave the heuristic row alone. */
const BACKOFF_MS = [60_000, 300_000, 1_800_000]

export function finishJob(id: string, outcome: 'done' | 'retry' | 'failed', error?: string): void {
  if (!storeReady()) return
  try {
    if (outcome === 'retry') {
      const row = get<{ attempts: number }>(`SELECT attempts FROM ai_job WHERE id = ?`, [id])
      const attempts = Number(row?.attempts ?? 1)
      const delay = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)] ?? 1_800_000
      if (attempts >= BACKOFF_MS.length + 1) {
        run(`UPDATE ai_job SET status = 'failed', last_error = ? WHERE id = ?`, [error ?? null, id])
        return
      }
      run(`UPDATE ai_job SET status = 'pending', run_after = ?, last_error = ? WHERE id = ?`, [
        now() + delay,
        error ?? null,
        id,
      ])
      return
    }
    run(`UPDATE ai_job SET status = ?, last_error = ? WHERE id = ?`, [outcome, error ?? null, id])
  } catch {
    // nothing actionable
  }
}

export function pendingJobCount(feature?: FeatureKey): number {
  if (!storeReady()) return 0
  try {
    const row = feature
      ? get<{ n: number }>(`SELECT COUNT(*) AS n FROM ai_job WHERE status = 'pending' AND feature = ?`, [feature])
      : get<{ n: number }>(`SELECT COUNT(*) AS n FROM ai_job WHERE status = 'pending'`)
    return Number(row?.n ?? 0)
  } catch {
    return 0
  }
}

// --- settings ---------------------------------------------------------------

export function readSetting<T>(key: string): T | undefined {
  if (storeReady()) {
    try {
      const row = get<{ value_json: string }>(`SELECT value_json FROM ai_setting WHERE setting_key = ?`, [key])
      if (row) return JSON.parse(row.value_json) as T
    } catch {
      // fall through
    }
  }
  const mem = memSettings.get(key)
  return mem === undefined ? undefined : (JSON.parse(mem) as T)
}

export function writeSetting(key: string, value: unknown): void {
  const json = JSON.stringify(value)
  if (storeReady()) {
    try {
      run(
        `INSERT INTO ai_setting (setting_key, value_json, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (setting_key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
        [key, json, now()],
      )
      return
    } catch {
      // fall through
    }
  }
  memSettings.set(key, json)
}

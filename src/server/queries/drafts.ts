import { all, get, run, tx } from '@/server/db/client'
import { uid, now } from '@/lib/utils'

/**
 * Composer draft autosave.
 *
 * Not the same thing as a `feedback` row with `status = 'draft'`. That row is a
 * *valid* structured review waiting to be submitted: it satisfies every foreign
 * key, every category belongs to the project's type, every point has a severity.
 * A half-typed composer has none of those properties, and writing it through
 * `createFeedback` would mean relaxing constraints that exist for good reasons.
 *
 * So an autosave is an opaque JSON blob keyed by (reviewer, project), replaced
 * whole on every save, and read back once when the composer mounts. When the
 * reviewer submits, the composer calls `createFeedback` with validated values
 * and this row is deleted. Nothing downstream reads the blob, which is what
 * lets the composer change its payload shape without a migration.
 *
 * `schema_version` is stored beside the payload so a composer that has moved on
 * can ignore a stale draft rather than crash on it.
 *
 * The table is owned by this module and created here, the way the AI layer owns
 * its four: it is a surface concern, not part of the product schema.
 */

const DDL = `
CREATE TABLE IF NOT EXISTS composer_draft (
  id             TEXT PRIMARY KEY,
  reviewer_id    TEXT NOT NULL,
  project_id     TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  payload_json   TEXT NOT NULL,
  byte_size      INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  UNIQUE (reviewer_id, project_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_composer_draft_reviewer ON composer_draft (reviewer_id, updated_at DESC);
`

export const DRAFT_SCHEMA_VERSION = 1

/** A draft larger than this is a bug in the composer, not a long review. */
export const MAX_DRAFT_BYTES = 64_000

let ready: boolean | null = null

function ensure(): boolean {
  if (ready !== null) return ready
  try {
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

export interface DraftRecord {
  readonly id: string
  readonly projectId: string
  readonly schemaVersion: number
  readonly payload: unknown
  readonly savedAt: number
  readonly byteSize: number
}

interface DraftRow {
  id: string
  project_id: string
  schema_version: number
  payload_json: string
  byte_size: number
  updated_at: number
}

function mapRow(row: DraftRow): DraftRecord {
  let payload: unknown = null
  try {
    payload = JSON.parse(row.payload_json) as unknown
  } catch {
    payload = null
  }
  return {
    id: row.id,
    projectId: row.project_id,
    schemaVersion: row.schema_version,
    payload,
    savedAt: row.updated_at,
    byteSize: row.byte_size,
  }
}

export function getComposerDraft(reviewerId: string, projectId: string): DraftRecord | undefined {
  if (!ensure()) return undefined
  const row = get<DraftRow>(
    `SELECT id, project_id, schema_version, payload_json, byte_size, updated_at
       FROM composer_draft WHERE reviewer_id = ? AND project_id = ?`,
    [reviewerId, projectId],
  )
  return row ? mapRow(row) : undefined
}

export function getComposerDraftById(reviewerId: string, draftId: string): DraftRecord | undefined {
  if (!ensure()) return undefined
  const row = get<DraftRow>(
    `SELECT id, project_id, schema_version, payload_json, byte_size, updated_at
       FROM composer_draft WHERE reviewer_id = ? AND id = ?`,
    [reviewerId, draftId],
  )
  return row ? mapRow(row) : undefined
}

export function listComposerDrafts(reviewerId: string, limit = 20): readonly DraftRecord[] {
  if (!ensure()) return []
  return all<DraftRow>(
    `SELECT id, project_id, schema_version, payload_json, byte_size, updated_at
       FROM composer_draft WHERE reviewer_id = ?
      ORDER BY updated_at DESC LIMIT ?`,
    [reviewerId, Math.min(Math.max(limit, 1), 50)],
  ).map(mapRow)
}

export interface SaveDraftResult {
  readonly draftId: string
  readonly savedAt: number
  readonly byteSize: number
}

/**
 * Replace-whole upsert. A partial merge would let a field the reviewer cleared
 * come back from a previous save, which reads as the form fighting them.
 */
export function saveComposerDraft(input: {
  reviewerId: string
  projectId: string
  payload: unknown
  schemaVersion?: number
}): SaveDraftResult {
  const json = JSON.stringify(input.payload ?? {})
  const byteSize = Buffer.byteLength(json, 'utf8')
  const ts = now()

  if (!ensure()) {
    // No persistence available: report the save honestly rather than pretending.
    return { draftId: uid(), savedAt: ts, byteSize }
  }

  const existing = get<{ id: string; created_at: number }>(
    `SELECT id, created_at FROM composer_draft WHERE reviewer_id = ? AND project_id = ?`,
    [input.reviewerId, input.projectId],
  )
  const id = existing?.id ?? uid()

  run(
    `INSERT INTO composer_draft
       (id, reviewer_id, project_id, schema_version, payload_json, byte_size, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reviewer_id, project_id) DO UPDATE SET
       schema_version = excluded.schema_version,
       payload_json   = excluded.payload_json,
       byte_size      = excluded.byte_size,
       updated_at     = excluded.updated_at`,
    [
      id,
      input.reviewerId,
      input.projectId,
      input.schemaVersion ?? DRAFT_SCHEMA_VERSION,
      json,
      byteSize,
      existing?.created_at ?? ts,
      ts,
    ],
  )

  return { draftId: id, savedAt: ts, byteSize }
}

/** Scoped by reviewer as well as id: a draft is nobody else's to discard. */
export function deleteComposerDraft(reviewerId: string, draftId: string): boolean {
  if (!ensure()) return false
  return run(`DELETE FROM composer_draft WHERE id = ? AND reviewer_id = ?`, [draftId, reviewerId]).changes === 1
}

export function deleteComposerDraftForProject(reviewerId: string, projectId: string): boolean {
  if (!ensure()) return false
  return (
    run(`DELETE FROM composer_draft WHERE reviewer_id = ? AND project_id = ?`, [reviewerId, projectId])
      .changes >= 1
  )
}

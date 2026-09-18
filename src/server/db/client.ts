import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { env } from '@/lib/env'

/**
 * One process-wide connection. SQLite in WAL mode handles the concurrency a
 * single Next.js node process produces; the repository layer below is written
 * so swapping in a Postgres driver touches only this file and the `sql` helpers.
 */
let _db: DatabaseSync | null = null

function schemaPath(): string {
  return path.join(process.cwd(), 'src', 'server', 'db', 'schema.sql')
}

export function db(): DatabaseSync {
  if (_db) return _db

  const file = path.resolve(process.cwd(), env.databasePath)
  fs.mkdirSync(path.dirname(file), { recursive: true })

  const conn = new DatabaseSync(file)
  // The wait comes first. Switching a file into WAL takes a lock, and a second
  // connection opening at the same moment (two server processes, or a script
  // beside a running server) failed with 'database is locked' instead of waiting.
  conn.exec('PRAGMA busy_timeout = 5000')
  // WAL lets readers proceed during writes. NORMAL sync is the right durability
  // trade for this workload: a lost transaction on power failure is acceptable,
  // corruption is not.
  conn.exec('PRAGMA journal_mode = WAL')
  conn.exec('PRAGMA synchronous = NORMAL')
  conn.exec('PRAGMA foreign_keys = ON')

  const sql = fs.readFileSync(schemaPath(), 'utf8')
  conn.exec(sql)

  _db = conn
  return conn
}

/** Rows come back as plain objects; the repositories cast to their row types. */
export function all<T>(sql: string, params: unknown[] = []): T[] {
  return db().prepare(sql).all(...(params as never[])) as T[]
}

export function get<T>(sql: string, params: unknown[] = []): T | undefined {
  return db().prepare(sql).get(...(params as never[])) as T | undefined
}

export function run(sql: string, params: unknown[] = []): { changes: number } {
  const r = db().prepare(sql).run(...(params as never[]))
  return { changes: Number(r.changes) }
}

/** Synchronous transaction. Rolls back and rethrows on any error. */
export function tx<T>(fn: () => T): T {
  const conn = db()
  conn.exec('BEGIN IMMEDIATE')
  try {
    const out = fn()
    conn.exec('COMMIT')
    return out
  } catch (e) {
    try { conn.exec('ROLLBACK') } catch { /* connection already unwound */ }
    throw e
  }
}

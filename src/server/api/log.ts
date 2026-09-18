/**
 * Server-side logging for the API layer.
 *
 * Writes straight to `process.stderr` rather than through `console`, because
 * CONTRACT §8.6 ban 53 and gate line 9.7.49 forbid `console` in committed code
 * and a route handler still has to record the fault it just swallowed.
 *
 * One line of JSON per event, so the request id a user quotes from an
 * `ErrorState` is greppable. Nothing user-identifying beyond the opaque user
 * id is written, and raw IPs never appear here at all.
 */

export type LogLevel = 'warn' | 'error'

export interface LogFields {
  readonly requestId: string
  readonly route: string
  readonly method: string
  readonly status?: number
  readonly code?: string
  readonly userId?: string | null
  readonly ms?: number
  readonly message?: string
}

function line(level: LogLevel, fields: LogFields, err?: unknown): string {
  const payload: Record<string, unknown> = {
    at: new Date().toISOString(),
    level,
    ...fields,
  }
  if (err instanceof Error) {
    payload['error'] = err.name
    payload['detail'] = err.message
    payload['stack'] = err.stack
    if (err.cause instanceof Error) payload['causedBy'] = err.cause.message
  } else if (err !== undefined) {
    payload['error'] = 'NonError'
    payload['detail'] = String(err)
  }
  return `${JSON.stringify(payload)}\n`
}

export function logError(fields: LogFields, err?: unknown): void {
  process.stderr.write(line('error', fields, err))
}

export function logWarn(fields: LogFields, err?: unknown): void {
  process.stderr.write(line('warn', fields, err))
}

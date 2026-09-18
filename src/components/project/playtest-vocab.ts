/**
 * The playtest outcome vocabulary.
 *
 * It lives in the component layer rather than beside the query that reads it,
 * because the tester's report form is a client island and must not pull the
 * SQLite driver into the browser bundle. The server module re-exports these.
 */

export type TaskOutcome = 'completed' | 'completed_with_help' | 'failed' | 'skipped' | 'blocked'

export const TASK_OUTCOMES: readonly {
  key: TaskOutcome
  label: string
  tone: 'positive' | 'neutral' | 'critical'
}[] = [
  { key: 'completed', label: 'Finished it unaided', tone: 'positive' },
  { key: 'completed_with_help', label: 'Finished it with help', tone: 'neutral' },
  { key: 'failed', label: 'Could not finish it', tone: 'critical' },
  { key: 'blocked', label: 'Blocked by a defect', tone: 'critical' },
  { key: 'skipped', label: 'Skipped it', tone: 'neutral' },
]

export function isTaskOutcome(value: string): value is TaskOutcome {
  return TASK_OUTCOMES.some((o) => o.key === value)
}

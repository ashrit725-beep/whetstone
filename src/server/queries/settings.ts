/**
 * The reads and writes that settings needs and the repository layer does not
 * carry.
 *
 * Deactivation is a status change, not a delete. `getViewer` already refuses a
 * non-active account, so the session stops working the moment this runs, and
 * every project, note and reputation row that other people depend on stays
 * where it is. A hard delete would silently rewrite other people’s histories:
 * a reviewer whose forty notes vanish loses the evidence behind their score.
 */

import { all, run, tx } from '@/server/db/client'
import { now } from '@/lib/utils'
import { revokeAllSessions } from '@/server/repos/users'

export interface AccountFootprint {
  /** Projects this account owns, including drafts. */
  readonly projects: number
  /** Notes other people wrote on those projects. */
  readonly feedbackReceived: number
  /** Notes this account wrote on other people’s work. */
  readonly feedbackWritten: number
  /** Suggestions on this account’s projects that reviewers are waiting on. */
  readonly openSuggestions: number
  readonly liveSessions: number
}

/**
 * What a deactivation would affect, counted rather than estimated, so the
 * warning above the confirm field states real numbers.
 */
export function accountFootprint(userId: string): AccountFootprint {
  const row = all<{
    projects: number
    received: number
    written: number
    open_suggestions: number
    sessions: number
  }>(
    `SELECT
       (SELECT COUNT(*) FROM projects WHERE owner_id = ? AND deleted_at IS NULL)          AS projects,
       (SELECT COUNT(*) FROM feedback f JOIN projects p ON p.id = f.project_id
         WHERE p.owner_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL)        AS received,
       (SELECT COUNT(*) FROM feedback
         WHERE reviewer_id = ? AND status = 'submitted' AND deleted_at IS NULL)           AS written,
       (SELECT COUNT(*) FROM suggestions s JOIN projects p ON p.id = s.project_id
         WHERE p.owner_id = ? AND s.status IN ('open', 'under_review', 'planned', 'in_progress'))
                                                                                          AS open_suggestions,
       (SELECT COUNT(*) FROM auth_sessions
         WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?)                     AS sessions`,
    [userId, userId, userId, userId, userId, now()],
  )[0]

  return {
    projects: row?.projects ?? 0,
    feedbackReceived: row?.received ?? 0,
    feedbackWritten: row?.written ?? 0,
    openSuggestions: row?.open_suggestions ?? 0,
    liveSessions: row?.sessions ?? 0,
  }
}

/** Closes every project to new feedback. Reversible from the project page. */
export function closeAllFeedback(userId: string): number {
  const result = run(
    `UPDATE projects SET feedback_state = 'closed', updated_at = ?
      WHERE owner_id = ? AND deleted_at IS NULL AND feedback_state <> 'closed'`,
    [now(), userId],
  )
  return result.changes
}

/**
 * Deactivates the account and signs out every device, in one transaction. The
 * rows other people rely on are untouched by design.
 *
 * The account's projects close to feedback and a published one is paused,
 * which takes it out of Discover, search and every public count. The danger
 * zone promised both, and nothing did either: a closed account's projects
 * kept taking notes that nobody would ever read.
 */
export function deactivateAccount(userId: string): void {
  const at = now()
  tx(() => {
    run(`UPDATE users SET status = 'deactivated', updated_at = ? WHERE id = ?`, [at, userId])
    run(
      `UPDATE projects
          SET feedback_state = 'closed',
              status = CASE WHEN status = 'published' THEN 'paused' ELSE status END,
              updated_at = ?
        WHERE owner_id = ? AND deleted_at IS NULL`,
      [at, userId],
    )
    revokeAllSessions(userId)
  })
}

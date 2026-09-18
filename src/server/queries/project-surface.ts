/**
 * Queries the project surfaces need that `src/server/repos/` does not expose.
 *
 * Owned by the project-detail / composer / wizard surface. Nothing here writes
 * product rules that a repository already owns: the playtest tables and the
 * version timeline simply have no repository yet, and the blind-impression
 * draft is a thin wrapper over the one-open-draft-per-build row the schema
 * already enforces.
 *
 * Synchronous, like every repository: `node:sqlite` has no async driver.
 */

import { all, get, run, tx } from '@/server/db/client'
import { uid } from '@/lib/utils'
import { TASK_OUTCOMES, isTaskOutcome, type TaskOutcome } from '@/components/project/playtest-vocab'

type Row = Record<string, unknown>
type Millis = number

function str(row: Row, key: string): string {
  const v = row[key]
  return typeof v === 'string' ? v : ''
}
function strOrNull(row: Row, key: string): string | null {
  const v = row[key]
  return typeof v === 'string' ? v : null
}
function num(row: Row, key: string): number {
  const v = row[key]
  return typeof v === 'number' ? v : Number(v ?? 0)
}
function numOrNull(row: Row, key: string): number | null {
  const v = row[key]
  return v === null || v === undefined ? null : Number(v)
}

/* ------------------------------------------------------------------ versions */

export interface VersionTimelineEntry {
  readonly id: string
  readonly label: string
  readonly changelogMd: string | null
  readonly buildUrl: string | null
  readonly embedUrl: string | null
  readonly platforms: readonly string[]
  readonly isCurrent: boolean
  readonly releasedAt: Millis | null
  readonly createdAt: Millis
  /** Submitted reviews attached to this build. */
  readonly feedbackCount: number
  /** Distinct reviewers on this build. */
  readonly reviewerCount: number
  readonly blockerCount: number
  /** Devlog entries the creator attached to this build. */
  readonly updates: readonly VersionUpdate[]
}

export interface VersionUpdate {
  readonly id: string
  readonly title: string
  readonly bodyMd: string
  readonly publishedAt: Millis | null
  readonly authorName: string
  readonly authorHandle: string
}

/** Every build, newest first, with its own counts and devlog entries. */
export function listVersionTimeline(projectId: string): readonly VersionTimelineEntry[] {
  const versions = all<Row>(
    `SELECT v.id, v.version_label, v.changelog_md, v.build_url, v.embed_url,
            v.platforms, v.is_current, v.released_at, v.created_at,
            COUNT(DISTINCT f.id)          AS feedback_count,
            COUNT(DISTINCT f.reviewer_id) AS reviewer_count,
            COALESCE(SUM(f.blocker_count), 0) AS blocker_count
       FROM project_versions v
       LEFT JOIN feedback f
              ON f.version_id = v.id
             AND f.status = 'submitted'
             AND f.deleted_at IS NULL
      WHERE v.project_id = ?
      GROUP BY v.id
      ORDER BY COALESCE(v.released_at, v.created_at) DESC`,
    [projectId],
  )

  const updates = all<Row>(
    `SELECT u.id, u.version_id, u.title, u.body_md, u.published_at,
            pr.display_name, us.handle
       FROM project_updates u
       JOIN users us ON us.id = u.author_id
       LEFT JOIN profiles pr ON pr.user_id = us.id
      WHERE u.project_id = ? AND u.deleted_at IS NULL
      ORDER BY COALESCE(u.published_at, u.created_at) DESC`,
    [projectId],
  )

  const byVersion = new Map<string, VersionUpdate[]>()
  for (const row of updates) {
    const key = strOrNull(row, 'version_id') ?? ''
    const entry: VersionUpdate = {
      id: str(row, 'id'),
      title: str(row, 'title'),
      bodyMd: str(row, 'body_md'),
      publishedAt: numOrNull(row, 'published_at'),
      authorName: str(row, 'display_name'),
      authorHandle: str(row, 'handle'),
    }
    const list = byVersion.get(key)
    if (list) list.push(entry)
    else byVersion.set(key, [entry])
  }

  return versions.map((row) => {
    const id = str(row, 'id')
    let platforms: string[] = []
    const raw = strOrNull(row, 'platforms')
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) platforms = parsed.filter((p): p is string => typeof p === 'string')
      } catch {
        platforms = []
      }
    }
    return {
      id,
      label: str(row, 'version_label'),
      changelogMd: strOrNull(row, 'changelog_md'),
      buildUrl: strOrNull(row, 'build_url'),
      embedUrl: strOrNull(row, 'embed_url'),
      platforms,
      isCurrent: num(row, 'is_current') === 1,
      releasedAt: numOrNull(row, 'released_at'),
      createdAt: num(row, 'created_at'),
      feedbackCount: num(row, 'feedback_count'),
      reviewerCount: num(row, 'reviewer_count'),
      blockerCount: num(row, 'blocker_count'),
      updates: byVersion.get(id) ?? [],
    }
  })
}

export interface ReviewStamp {
  readonly feedbackId: string
  readonly versionId: string | null
  readonly versionLabel: string | null
  readonly submittedAt: Millis | null
}

/**
 * The build this viewer last reviewed, which is what "what changed since your
 * review" is measured from. Undefined when they have never reviewed.
 */
export function viewerReviewStamp(projectId: string, viewerId: string | null): ReviewStamp | undefined {
  if (!viewerId) return undefined
  const row = get<Row>(
    `SELECT f.id, f.version_id, f.submitted_at, v.version_label
       FROM feedback f
       LEFT JOIN project_versions v ON v.id = f.version_id
      WHERE f.project_id = ? AND f.reviewer_id = ?
        AND f.status = 'submitted' AND f.deleted_at IS NULL
      ORDER BY f.submitted_at DESC
      LIMIT 1`,
    [projectId, viewerId],
  )
  if (!row) return undefined
  return {
    feedbackId: str(row, 'id'),
    versionId: strOrNull(row, 'version_id'),
    versionLabel: strOrNull(row, 'version_label'),
    submittedAt: numOrNull(row, 'submitted_at'),
  }
}

/* ------------------------------------------------------------------ playtest */

export { TASK_OUTCOMES, isTaskOutcome } from '@/components/project/playtest-vocab'
export type { TaskOutcome } from '@/components/project/playtest-vocab'

export interface PlaytestTask {
  readonly id: string
  readonly title: string
  readonly instructions: string | null
  readonly successHint: string | null
  readonly isRequired: boolean
  readonly sortOrder: number
  readonly results: Readonly<Record<TaskOutcome, number>>
  readonly reported: number
  readonly medianDurationMs: number | null
  readonly notes: readonly PlaytestNote[]
  /** This viewer's own report, when they are in the round. */
  readonly viewerOutcome: TaskOutcome | null
}

export interface PlaytestNote {
  readonly id: string
  readonly outcome: TaskOutcome
  readonly note: string
  readonly testerName: string
  readonly testerHandle: string
  readonly createdAt: Millis
}

export interface PlaytestRound {
  readonly id: string
  readonly projectId: string
  readonly title: string
  readonly briefMd: string | null
  readonly status: 'draft' | 'recruiting' | 'running' | 'closed' | 'cancelled'
  readonly versionLabel: string | null
  readonly seats: number | null
  readonly seatsTaken: number
  readonly rewardKind: string
  readonly startsAt: Millis | null
  readonly endsAt: Millis | null
  readonly createdAt: Millis
  readonly tasks: readonly PlaytestTask[]
  /** Testers who reported at least one task outcome. */
  readonly reportingTesters: number
  /** The viewer's invitation, when they have one. */
  readonly viewerInvitationId: string | null
  readonly viewerInvitationStatus: string | null
}

const EMPTY_OUTCOMES: Record<TaskOutcome, number> = {
  completed: 0,
  completed_with_help: 0,
  failed: 0,
  skipped: 0,
  blocked: 0,
}

/** Every round on a project, with its protocol and the outcomes reported so far. */
export function listPlaytestRounds(projectId: string, viewerId: string | null): readonly PlaytestRound[] {
  const rounds = all<Row>(
    `SELECT r.id, r.project_id, r.title, r.brief_md, r.status, r.seats, r.seats_taken,
            r.reward_kind, r.starts_at, r.ends_at, r.created_at, v.version_label
       FROM test_rounds r
       LEFT JOIN project_versions v ON v.id = r.version_id
      WHERE r.project_id = ?
      ORDER BY r.created_at DESC`,
    [projectId],
  )
  if (rounds.length === 0) return []

  const roundIds = rounds.map((r) => str(r, 'id'))
  const marks = roundIds.map(() => '?').join(', ')

  const tasks = all<Row>(
    `SELECT id, round_id, title, instructions, success_hint, is_required, sort_order
       FROM test_round_tasks
      WHERE round_id IN (${marks})
      ORDER BY round_id, sort_order`,
    roundIds,
  )

  const results = all<Row>(
    `SELECT tr.id, tr.task_id, tr.outcome, tr.duration_ms, tr.note, tr.created_at,
            ti.round_id, ti.user_id, pr.display_name, u.handle
       FROM test_task_results tr
       JOIN test_invitations ti ON ti.id = tr.invitation_id
       LEFT JOIN users u ON u.id = ti.user_id
       LEFT JOIN profiles pr ON pr.user_id = u.id
      WHERE ti.round_id IN (${marks})
      ORDER BY tr.created_at ASC`,
    roundIds,
  )

  const invitations = viewerId
    ? all<Row>(
        `SELECT id, round_id, status FROM test_invitations
          WHERE round_id IN (${marks}) AND user_id = ?`,
        [...roundIds, viewerId],
      )
    : []

  const tallies = new Map<string, Record<TaskOutcome, number>>()
  const durations = new Map<string, number[]>()
  const notes = new Map<string, PlaytestNote[]>()
  const viewerOutcomes = new Map<string, TaskOutcome>()
  const testersByRound = new Map<string, Set<string>>()

  for (const row of results) {
    const taskId = str(row, 'task_id')
    const outcome = str(row, 'outcome')
    if (!isTaskOutcome(outcome)) continue

    const tally = tallies.get(taskId) ?? { ...EMPTY_OUTCOMES }
    tally[outcome] += 1
    tallies.set(taskId, tally)

    const duration = numOrNull(row, 'duration_ms')
    if (duration !== null) {
      const list = durations.get(taskId)
      if (list) list.push(duration)
      else durations.set(taskId, [duration])
    }

    const note = strOrNull(row, 'note')
    if (note && note.trim().length > 0) {
      const entry: PlaytestNote = {
        id: str(row, 'id'),
        outcome,
        note: note.trim(),
        testerName: str(row, 'display_name') || 'A tester',
        testerHandle: str(row, 'handle'),
        createdAt: num(row, 'created_at'),
      }
      const list = notes.get(taskId)
      if (list) list.push(entry)
      else notes.set(taskId, [entry])
    }

    const userId = strOrNull(row, 'user_id')
    if (userId && viewerId && userId === viewerId) viewerOutcomes.set(taskId, outcome)

    const roundId = str(row, 'round_id')
    const set = testersByRound.get(roundId) ?? new Set<string>()
    set.add(userId ?? str(row, 'id'))
    testersByRound.set(roundId, set)
  }

  const tasksByRound = new Map<string, PlaytestTask[]>()
  for (const row of tasks) {
    const id = str(row, 'id')
    const tally = tallies.get(id) ?? { ...EMPTY_OUTCOMES }
    const reported = TASK_OUTCOMES.reduce((sum, o) => sum + tally[o.key], 0)
    const task: PlaytestTask = {
      id,
      title: str(row, 'title'),
      instructions: strOrNull(row, 'instructions'),
      successHint: strOrNull(row, 'success_hint'),
      isRequired: num(row, 'is_required') === 1,
      sortOrder: num(row, 'sort_order'),
      results: tally,
      reported,
      medianDurationMs: median(durations.get(id) ?? []),
      notes: notes.get(id) ?? [],
      viewerOutcome: viewerOutcomes.get(id) ?? null,
    }
    const roundId = str(row, 'round_id')
    const list = tasksByRound.get(roundId)
    if (list) list.push(task)
    else tasksByRound.set(roundId, [task])
  }

  const inviteByRound = new Map<string, { id: string; status: string }>()
  for (const row of invitations) {
    inviteByRound.set(str(row, 'round_id'), { id: str(row, 'id'), status: str(row, 'status') })
  }

  return rounds.map((row) => {
    const id = str(row, 'id')
    const invite = inviteByRound.get(id)
    const status = str(row, 'status')
    return {
      id,
      projectId: str(row, 'project_id'),
      title: str(row, 'title'),
      briefMd: strOrNull(row, 'brief_md'),
      status:
        status === 'draft' || status === 'recruiting' || status === 'running' || status === 'closed' || status === 'cancelled'
          ? status
          : 'draft',
      versionLabel: strOrNull(row, 'version_label'),
      seats: numOrNull(row, 'seats'),
      seatsTaken: num(row, 'seats_taken'),
      rewardKind: str(row, 'reward_kind'),
      startsAt: numOrNull(row, 'starts_at'),
      endsAt: numOrNull(row, 'ends_at'),
      createdAt: num(row, 'created_at'),
      tasks: tasksByRound.get(id) ?? [],
      reportingTesters: testersByRound.get(id)?.size ?? 0,
      viewerInvitationId: invite?.id ?? null,
      viewerInvitationStatus: invite?.status ?? null,
    }
  })
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? null
  const low = sorted[mid - 1]
  const high = sorted[mid]
  if (low === undefined || high === undefined) return null
  return Math.round((low + high) / 2)
}

export interface NewRoundInput {
  readonly projectId: string
  readonly createdBy: string
  readonly versionId: string | null
  readonly title: string
  readonly briefMd: string | null
  readonly seats: number | null
  readonly tasks: readonly { title: string; instructions: string | null; successHint: string | null; isRequired: boolean }[]
}

/** Creates a round and its ordered protocol in one transaction. */
export function createPlaytestRound(input: NewRoundInput): string {
  const id = uid()
  const ts = Date.now()
  return tx(() => {
    run(
      `INSERT INTO test_rounds
         (id, project_id, version_id, created_by, title, brief_md, status, seats,
          seats_taken, reward_kind, starts_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'recruiting', ?, 0, 'reputation', ?, ?, ?)`,
      [id, input.projectId, input.versionId, input.createdBy, input.title, input.briefMd, input.seats, ts, ts, ts],
    )
    input.tasks.forEach((task, index) => {
      run(
        `INSERT INTO test_round_tasks
           (id, round_id, title, instructions, success_hint, is_required, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uid(), id, task.title, task.instructions, task.successHint, task.isRequired ? 1 : 0, index],
      )
    })
    return id
  })
}

/** Joins a round, or returns the invitation the tester already holds. */
/**
 * Take a seat in an open round.
 *
 * Returns the existing invitation when there is one, so a second click is not a
 * second seat. Throws when the round is full: the UPDATE used to clamp
 * `seats_taken` to `seats` with a MIN while still writing the invitation, so a
 * full round accepted testers without end and the counter said nothing.
 */
export function joinRound(roundId: string, userId: string): string {
  const existing = get<Row>(`SELECT id FROM test_invitations WHERE round_id = ? AND user_id = ?`, [roundId, userId])
  if (existing) return str(existing, 'id')

  const round = get<{ seats: number | null; seats_taken: number; status: string }>(
    `SELECT seats, seats_taken, status FROM test_rounds WHERE id = ?`,
    [roundId],
  )
  if (!round) throw new Error('That round is no longer here.')
  if (round.status !== 'recruiting' && round.status !== 'running') {
    throw new Error('That round has closed.')
  }
  if (round.seats !== null && round.seats_taken >= round.seats) {
    throw new Error('That round is full.')
  }
  const id = uid()
  const ts = Date.now()
  return tx(() => {
    run(
      `INSERT INTO test_invitations
         (id, round_id, user_id, source, status, responded_at, started_at, created_at)
       VALUES (?, ?, ?, 'open_link', 'started', ?, ?, ?)`,
      [id, roundId, userId, ts, ts, ts],
    )
    // Counted from the invitations, and guarded so two people taking the last
    // seat at once cannot both get it.
    run(
      `UPDATE test_rounds
          SET seats_taken = (SELECT COUNT(*) FROM test_invitations WHERE round_id = ?),
              updated_at = ?
        WHERE id = ? AND (seats IS NULL OR seats_taken < seats)`,
      [roundId, ts, roundId],
    )
    return id
  })
}

export interface TaskReportInput {
  readonly invitationId: string
  readonly taskId: string
  readonly outcome: TaskOutcome
  readonly durationMs: number | null
  readonly difficulty: number | null
  readonly note: string | null
}

/** One tester's report on one task. Re-reporting replaces the earlier answer. */
export function recordTaskResult(input: TaskReportInput): void {
  const ts = Date.now()
  run(
    `INSERT INTO test_task_results
       (id, invitation_id, task_id, outcome, duration_ms, difficulty, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (invitation_id, task_id) DO UPDATE SET
       outcome = excluded.outcome,
       duration_ms = excluded.duration_ms,
       difficulty = excluded.difficulty,
       note = excluded.note`,
    [uid(), input.invitationId, input.taskId, input.outcome, input.durationMs, input.difficulty, input.note, ts],
  )
}

/* ------------------------------------------- the blind first impression draft */

export interface BlindDraft {
  readonly id: string
  readonly headline: string
  readonly dwellSeconds: number | null
  readonly createdAt: Millis
}

/**
 * The reviewer's unanchored first reaction, held on the one open draft row per
 * build that the schema already enforces. It exists before any other feedback
 * is visible to them, which is the whole point of capturing it.
 */
export function getBlindDraft(projectId: string, reviewerId: string): BlindDraft | undefined {
  const row = get<Row>(
    `SELECT id, headline, time_spent_minutes, created_at
       FROM feedback
      WHERE project_id = ? AND reviewer_id = ? AND status = 'draft' AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 1`,
    [projectId, reviewerId],
  )
  if (!row) return undefined
  const headline = strOrNull(row, 'headline')
  if (!headline) return undefined
  const minutes = numOrNull(row, 'time_spent_minutes')
  return {
    id: str(row, 'id'),
    headline,
    dwellSeconds: minutes === null ? null : minutes * 60,
    createdAt: num(row, 'created_at'),
  }
}

export interface SaveBlindInput {
  readonly projectId: string
  readonly projectTypeId: string
  readonly reviewerId: string
  readonly versionId: string | null
  readonly headline: string
  readonly dwellSeconds: number
}

export function saveBlindDraft(input: SaveBlindInput): string {
  const minutes = Math.max(0, Math.round(input.dwellSeconds / 60))
  const existing = get<Row>(
    `SELECT id FROM feedback
      WHERE project_id = ? AND reviewer_id = ? AND status = 'draft' AND deleted_at IS NULL`,
    [input.projectId, input.reviewerId],
  )
  const ts = Date.now()
  if (existing) {
    const id = str(existing, 'id')
    run(`UPDATE feedback SET headline = ?, time_spent_minutes = ?, updated_at = ? WHERE id = ?`, [
      input.headline,
      minutes,
      ts,
      id,
    ])
    return id
  }
  const id = uid()
  run(
    `INSERT INTO feedback
       (id, project_id, project_type_id, version_id, reviewer_id, origin, status,
        visibility, headline, time_spent_minutes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'organic', 'draft', 'public', ?, ?, ?, ?)`,
    [id, input.projectId, input.projectTypeId, input.versionId, input.reviewerId, input.headline, minutes, ts, ts],
  )
  return id
}

/** Clears the draft once the full review is posted. */
export function discardBlindDraft(projectId: string, reviewerId: string): void {
  run(`DELETE FROM feedback WHERE project_id = ? AND reviewer_id = ? AND status = 'draft'`, [projectId, reviewerId])
}

/* ----------------------------------------------- the disagreement plot data */

/**
 * Every individual verdict on every axis, with the name of the person who gave
 * it. The aggregate in `repos/ratings.ts` answers "what is the mean"; this
 * answers "who said what", which is the only question the disagreement plot
 * asks. A mean of a five-step scale is a number nobody chose, so the plot draws
 * the people instead and the mean never appears on this surface.
 *
 * One verdict per person per axis: someone who reviewed two builds is counted
 * where the latest review that rated that axis put it. Counting both drew one
 * reviewer twice and made "rated by 10 reviewers" a count of reviews.
 */
export interface AxisVerdict {
  readonly value: number
  readonly reviewerName: string
  readonly reviewerHandle: string
  readonly isExpert: boolean
}

export interface AxisVerdicts {
  readonly axisId: string
  readonly axisKey: string
  readonly label: string
  readonly scaleMax: number
  readonly lowLabel: string | null
  readonly highLabel: string | null
  readonly verdicts: readonly AxisVerdict[]
}

export function axisVerdictsForProject(projectId: string): readonly AxisVerdicts[] {
  const rows = all<Row>(
    `SELECT ra.id AS axis_id, ra.axis_key, ra.label, ra.scale_max,
            ra.low_label, ra.high_label, ra.sort_order,
            fr.rating_value AS value,
            COALESCE(pr.display_name, u.handle) AS reviewer_name,
            u.handle AS reviewer_handle,
            CASE WHEN EXISTS (
                   SELECT 1 FROM expert_profiles ep
                    WHERE ep.user_id = u.id AND ep.is_verified = 1
                 ) THEN 1 ELSE 0 END AS is_expert
       FROM feedback_ratings fr
       JOIN feedback f ON f.id = fr.feedback_id
       JOIN rating_axes ra ON ra.id = fr.axis_id
       JOIN users u ON u.id = f.reviewer_id
       LEFT JOIN profiles pr ON pr.user_id = u.id
      WHERE f.project_id = ?
        AND f.status = 'submitted' AND f.deleted_at IS NULL
        AND f.id = (SELECT latest.id FROM feedback latest
                      JOIN feedback_ratings lr ON lr.feedback_id = latest.id AND lr.axis_id = fr.axis_id
                     WHERE latest.project_id = f.project_id AND latest.reviewer_id = f.reviewer_id
                       AND latest.status = 'submitted' AND latest.deleted_at IS NULL
                     ORDER BY latest.submitted_at DESC, latest.id DESC
                     LIMIT 1)
      ORDER BY ra.sort_order, ra.label, fr.rating_value, reviewer_name`,
    [projectId],
  )

  const byAxis = new Map<string, { head: Omit<AxisVerdicts, 'verdicts'>; verdicts: AxisVerdict[] }>()
  for (const row of rows) {
    const axisId = str(row, 'axis_id')
    const entry =
      byAxis.get(axisId) ??
      {
        head: {
          axisId,
          axisKey: str(row, 'axis_key'),
          label: str(row, 'label'),
          scaleMax: num(row, 'scale_max'),
          lowLabel: strOrNull(row, 'low_label'),
          highLabel: strOrNull(row, 'high_label'),
        },
        verdicts: [],
      }
    entry.verdicts.push({
      value: num(row, 'value'),
      reviewerName: str(row, 'reviewer_name'),
      reviewerHandle: str(row, 'reviewer_handle'),
      isExpert: num(row, 'is_expert') === 1,
    })
    byAxis.set(axisId, entry)
  }

  return [...byAxis.values()].map((e) => ({ ...e.head, verdicts: e.verdicts }))
}

/* ------------------------------------------------------ the shipped marker */

/**
 * Which review notes turned into a change that actually went out, and in which
 * build. Read from `suggestion_sources`, so the marker on a note is a link to a
 * shipped row rather than a claim typed into the page.
 */
export interface ShippedMark {
  readonly pointId: string
  readonly suggestionId: string
  readonly title: string
  readonly versionLabel: string | null
  readonly shippedAt: Millis | null
}

export function shippedMarksForProject(projectId: string): ReadonlyMap<string, ShippedMark> {
  const rows = all<Row>(
    `SELECT ss.point_id, s.id AS suggestion_id, s.title, s.shipped_at, v.version_label
       FROM suggestion_sources ss
       JOIN suggestions s ON s.id = ss.suggestion_id
       LEFT JOIN project_versions v ON v.id = s.shipped_in_version_id
      WHERE s.project_id = ? AND s.status = 'shipped'
      ORDER BY s.shipped_at DESC`,
    [projectId],
  )
  const out = new Map<string, ShippedMark>()
  for (const row of rows) {
    const pointId = str(row, 'point_id')
    if (out.has(pointId)) continue
    out.set(pointId, {
      pointId,
      suggestionId: str(row, 'suggestion_id'),
      title: str(row, 'title'),
      versionLabel: strOrNull(row, 'version_label'),
      shippedAt: numOrNull(row, 'shipped_at'),
    })
  }
  return out
}

/* ------------------------------------------------------- the progress ladder */

/**
 * The close-the-loop counts, every one of them a COUNT(*) over real rows.
 *
 * "Answered by a change" has exactly one meaning on the project page: the
 * point is a source of a suggestion that shipped. `is_resolved` is a flag a
 * creator can set for any reason, so counting it here printed a bigger number
 * than every point behind a shipped change put together, beside a ladder rung
 * that said two changes had gone out.
 */
export interface LoopLedger {
  readonly notesReceived: number
  readonly reviewers: number
  readonly issuesRaised: number
  /** Issues (not praise) that are the source of a shipped change. */
  readonly issuesAnswered: number
  /** Notes with at least one point behind a shipped change. */
  readonly notesShipped: number
  readonly changesShipped: number
  readonly shippedBuilds: number
}

export function loopLedger(projectId: string): LoopLedger {
  const points = get<Row>(
    `SELECT SUM(CASE WHEN fp.severity <> 'praise' THEN 1 ELSE 0 END) AS issues
       FROM feedback_points fp
       JOIN feedback f ON f.id = fp.feedback_id
      WHERE f.project_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL`,
    [projectId],
  )
  const answered = get<Row>(
    `SELECT COUNT(DISTINCT CASE WHEN fp.severity <> 'praise' THEN fp.id END) AS issues,
            COUNT(DISTINCT fp.feedback_id) AS notes
       FROM suggestion_sources ss
       JOIN suggestions s ON s.id = ss.suggestion_id
       JOIN feedback_points fp ON fp.id = ss.point_id
       JOIN feedback f ON f.id = fp.feedback_id
      WHERE s.project_id = ? AND s.status = 'shipped'
        AND f.status = 'submitted' AND f.deleted_at IS NULL`,
    [projectId],
  )
  const thread = get<Row>(
    `SELECT COUNT(*) AS notes, COUNT(DISTINCT reviewer_id) AS reviewers
       FROM feedback
      WHERE project_id = ? AND status = 'submitted' AND deleted_at IS NULL`,
    [projectId],
  )
  const shipped = get<Row>(
    `SELECT COUNT(*) AS n, COUNT(DISTINCT shipped_in_version_id) AS builds
       FROM suggestions
      WHERE project_id = ? AND status = 'shipped'`,
    [projectId],
  )
  const empty: Row = {}
  return {
    notesReceived: num(thread ?? empty, 'notes'),
    reviewers: num(thread ?? empty, 'reviewers'),
    issuesRaised: num(points ?? empty, 'issues'),
    issuesAnswered: num(answered ?? empty, 'issues'),
    notesShipped: num(answered ?? empty, 'notes'),
    changesShipped: num(shipped ?? empty, 'n'),
    shippedBuilds: num(shipped ?? empty, 'builds'),
  }
}

/* --------------------------------------------------------------- anchors */

/**
 * Where in the work reviewers actually pointed: the timecodes, routes, screens
 * and levels their notes are pinned to, most-cited first. The stage draws these
 * because they are the one piece of real geometry a project without an uploaded
 * file still has.
 *
 * "Most-cited" is the number of notes that name the place, then how many other
 * reviewers said they hit the same thing. Sorting by timecode alone put every
 * non-timecode anchor at zero, so the four that survived the limit were simply
 * the first four alphabetically.
 */
export interface AnchorTally {
  readonly label: string
  readonly kindLabel: string
  readonly noteCount: number
}

/** How an anchor kind reads to a person. The stored key is an identifier. */
export const ANCHOR_WORDS: Readonly<Record<string, string>> = {
  timecode: 'Timecode',
  route: 'Route',
  screen: 'Screen',
  level: 'Level',
  selector: 'Element',
}

export function anchorsForProject(projectId: string, limit = 4): readonly AnchorTally[] {
  const rows = all<Row>(
    `SELECT fp.anchor_kind, fp.anchor_value,
            COUNT(DISTINCT fp.feedback_id) AS n,
            SUM(fp.upvote_count) AS up,
            MIN(COALESCE(fp.timecode_ms, 0)) AS at_ms
       FROM feedback_points fp
       JOIN feedback f ON f.id = fp.feedback_id
      WHERE f.project_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL
        AND fp.anchor_value IS NOT NULL
      GROUP BY fp.anchor_kind, fp.anchor_value
      ORDER BY n DESC, up DESC, at_ms, fp.anchor_value
      LIMIT ?`,
    [projectId, limit],
  )
  return rows.map((row) => ({
    label: str(row, 'anchor_value'),
    kindLabel: ANCHOR_WORDS[str(row, 'anchor_kind')] ?? 'In the work',
    noteCount: num(row, 'n'),
  }))
}

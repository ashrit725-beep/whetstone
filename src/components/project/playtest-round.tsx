/**
 * One playtest round: the protocol, and what happened when testers ran it.
 *
 * Server-safe. A round is a list of tasks, and each task carries the outcomes
 * reported against it. That is the difference between a playtest and a comment
 * thread: "four of seven could not finish task two" is a fact, and "the tutorial
 * felt confusing" is a mood.
 */

import { Meter, Timestamp } from '@/components/ui'
import { TASK_OUTCOMES } from './playtest-vocab'
import type { PlaytestRound, PlaytestTask } from '@/server/queries/project-surface'
import { cn } from '@/lib/utils'

const TONE: Record<string, 'positive' | 'neutral' | 'critical'> = {
  completed: 'positive',
  completed_with_help: 'neutral',
  failed: 'critical',
  blocked: 'critical',
  skipped: 'neutral',
}

const STATUS_WORDS: Record<PlaytestRound['status'], string> = {
  draft: 'Not open yet',
  recruiting: 'Taking testers',
  running: 'Running',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

export interface PlaytestRoundViewProps {
  round: PlaytestRound
  /** The join control, or whatever the round-level action is. */
  children?: React.ReactNode
  /** One report form per task id, rendered under that task's results. */
  taskForms?: Readonly<Record<string, React.ReactNode>>
}

export function PlaytestRoundView({ round, children, taskForms }: PlaytestRoundViewProps) {
  return (
    <section aria-labelledby={`round-${round.id}`} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 id={`round-${round.id}`} className="text-lg">
            {round.title}
          </h2>
          <span className="chip" data-solid={round.status === 'running' ? 'true' : undefined}>
            {STATUS_WORDS[round.status]}
          </span>
        </div>

        <dl className="m-0 flex flex-wrap gap-x-6 gap-y-1">
          {round.versionLabel ? (
            <div className="flex items-baseline gap-1">
              <dt className="text-2xs text-ink-3">Build</dt>
              <dd className="m-0 text-sm text-ink">{round.versionLabel}</dd>
            </div>
          ) : null}
          <div className="flex items-baseline gap-1">
            <dt className="text-2xs text-ink-3">Seats taken</dt>
            <dd className="tnum m-0 text-sm text-ink">
              {round.seats === null ? round.seatsTaken : `${round.seatsTaken} of ${round.seats}`}
            </dd>
          </div>
          <div className="flex items-baseline gap-1">
            <dt className="text-2xs text-ink-3">Testers reporting</dt>
            <dd className="tnum m-0 text-sm text-ink">{round.reportingTesters}</dd>
          </div>
          {round.endsAt ? (
            <div className="flex items-baseline gap-1">
              <dt className="text-2xs text-ink-3">Closes</dt>
              <dd className="m-0 text-sm text-ink">
                <Timestamp ts={round.endsAt} />
              </dd>
            </div>
          ) : null}
        </dl>

        {round.briefMd ? <p className="voice text-ink-2">{round.briefMd}</p> : null}
      </div>

      {children}

      <ol className="m-0 flex list-none flex-col p-0">
        {round.tasks.map((task, index) => (
          <li key={task.id} className={cn('flex flex-col gap-3 py-4', index > 0 && 'border-t border-rule')}>
            <TaskResults task={task} index={index} />
            {taskForms?.[task.id] ?? null}
          </li>
        ))}
      </ol>
    </section>
  )
}

function TaskResults({ task, index }: { task: PlaytestTask; index: number }) {
  const segments = TASK_OUTCOMES.filter((outcome) => task.results[outcome.key] > 0).map((outcome) => ({
    label: outcome.label,
    value: task.results[outcome.key],
    tone: TONE[outcome.key] ?? 'neutral',
  }))

  const finished = task.results.completed
  const stuck = task.results.failed + task.results.blocked
  const duration = formatDuration(task.medianDurationMs)

  return (
    <>
      <div className="flex flex-col gap-1">
        <h3 className="text-md">{task.title}</h3>
        {task.instructions ? <p className="measure-ui text-sm text-ink-2">{task.instructions}</p> : null}
        {task.successHint ? (
          <p className="measure-ui text-xs text-ink-3">Done when: {task.successHint}</p>
        ) : null}
      </div>

      {task.reported === 0 ? (
        <p className="text-xs text-ink-3">
          No tester has reported on this task yet, so there is nothing to read into it.
        </p>
      ) : (
        <>
          <p className="measure-ui text-sm text-ink-2">
            <span className="tnum">{finished}</span>
            {' of '}
            <span className="tnum">{task.reported}</span>
            {task.reported === 1 ? ' tester finished this unaided.' : ' testers finished this unaided.'}
            {stuck > 0 ? (
              <>
                {' '}
                <span className="tnum">{stuck}</span>
                {stuck === 1 ? ' could not finish it at all.' : ' could not finish it at all.'}
              </>
            ) : null}
            {duration ? ` Median ${duration}.` : ''}
          </p>

          <Meter
            label={`Outcomes on task ${String(index + 1)}, ${task.title}`}
            segments={segments}
            valueText={`${String(finished)} of ${String(task.reported)} finished unaided`}
          />
        </>
      )}

      {task.notes.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-3 border-l-2 border-rule p-0 pl-3">
          {task.notes.map((note) => (
            <li key={note.id} className="flex flex-col gap-1">
              <p className="text-xs text-ink-3">
                {note.testerName}
                {', '}
                {TASK_OUTCOMES.find((o) => o.key === note.outcome)?.label.toLowerCase() ?? note.outcome}
              </p>
              <p className="voice text-ink-2">{note.note}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}

/** Seconds under a minute and a half; minutes above it. Never a rounded-down zero. */
function formatDuration(ms: number | null): string | null {
  if (ms === null || ms <= 0) return null
  if (ms < 90_000) return `${String(Math.round(ms / 1000))}\u00a0seconds`
  return `${String(Math.round(ms / 60_000))}\u00a0minutes`
}

export default PlaytestRoundView

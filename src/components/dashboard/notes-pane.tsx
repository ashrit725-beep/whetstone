/**
 * The inbox rows, grouped.
 *
 * This is the half of the inbox that waits on the clustering, so it is its own
 * async component inside a `<Suspense>`: the heading, the filters and the counts
 * paint straight away and the table arrives into a box the skeleton already
 * reserved. Streaming the table rather than the page is what keeps a cold
 * clustering run from holding up a creator’s own filter chips.
 *
 * The grouping is the same `themeBoard` the rollup draws, cached per request, so
 * the inbox and the bars can never disagree about what a theme is.
 */

import { listInboxFeedback } from '@/server/repos/feedback'
import { groupByTheme, themeBoard } from '@/server/queries/dashboard'
import type { FeedbackView, InboxState, SeverityKey } from '@/lib/types'
import { InboxTable } from './inbox-table'
import { Provenance } from './provenance'
import type { InboxFilterState, InboxRow, InboxRowGroup } from './inbox-types'

const SEVERITY_LABEL: Record<SeverityKey, string> = {
  blocker: 'Blocker',
  major: 'Major',
  minor: 'Minor',
  nit: 'Nit',
  praise: 'Praise',
}

const STATE_LABEL: Record<InboxState, string> = {
  new: 'New',
  read: 'Read',
  triaged: 'Triaged',
  actioned: 'Actioned',
  archived: 'Archived',
}

const SEVERITY_ORDER: readonly SeverityKey[] = ['blocker', 'major', 'minor', 'nit', 'praise']

function worstSeverity(row: FeedbackView): SeverityKey {
  for (const severity of SEVERITY_ORDER) {
    if (row.points.some((point) => point.severity === severity)) return severity
  }
  return 'praise'
}

function toRow(row: FeedbackView): InboxRow {
  const first = row.points[0]
  const severity = worstSeverity(row)
  return {
    id: row.id,
    reviewerId: row.reviewer.id,
    reviewerName: row.reviewer.displayName,
    reviewerHandle: row.reviewer.handle,
    reviewerAvatar: row.reviewer.avatarUrl,
    reviewerIsExpert: row.reviewer.isExpert,
    headline: row.headline ?? first?.bodyMd.slice(0, 90) ?? 'A note with no headline',
    excerpt: row.summaryMd ?? first?.bodyMd ?? '',
    severity,
    severityLabel: SEVERITY_LABEL[severity],
    pointCount: row.counts.points,
    state: row.inboxState,
    stateLabel: STATE_LABEL[row.inboxState],
    submittedAt: row.submittedAt ?? 0,
    unanswered: row.responseState === 'unanswered',
    projectTitle: row.projectTitle,
    helpfulMarked: row.creatorMarkedHelpful,
  }
}

export interface NotesPaneProps {
  userId: string
  projectId: string | null
  filters: InboxFilterState
  openNoteId: string | null
}

export async function NotesPane({ userId, projectId, filters, openNoteId }: NotesPaneProps) {
  const page = listInboxFeedback(userId, {
    ...(projectId ? { projectId } : {}),
    ...(filters.state ? { state: filters.state } : {}),
    unansweredOnly: filters.unansweredOnly,
    sort: filters.sort,
    limit: 50,
  })
  const rows = page.items

  let groups: InboxRowGroup[]
  let provenance = null

  if (filters.grouped && projectId) {
    const board = await themeBoard(projectId, userId)
    provenance = board.provenance
    groups = groupByTheme(rows, board).map((group) => ({
      id: group.id,
      label: group.label,
      reviewers: group.reviewers,
      impact: group.impact,
      rows: group.rows.map(toRow),
    }))
  } else {
    groups =
      rows.length === 0
        ? []
        : [
            {
              id: 'all',
              label: 'Every note',
              reviewers: new Set(rows.map((row) => row.reviewer.id)).size,
              impact: null,
              rows: rows.map(toRow),
            },
          ]
  }

  return (
    <div className="flex flex-col gap-md">
      {provenance ? <Provenance value={provenance} /> : null}
      <InboxTable
        groups={groups}
        filters={filters}
        total={rows.length}
        grouped={filters.grouped}
        openNoteId={openNoteId}
        caption={
          filters.grouped
            ? 'Feedback on your projects, grouped by theme, with the triage state of each note'
            : 'Feedback on your projects, with the triage state of each note'
        }
      />
    </div>
  )
}

export default NotesPane

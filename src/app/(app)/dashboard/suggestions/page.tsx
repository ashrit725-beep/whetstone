/**
 * The suggestion tracker.
 *
 * Five columns, drag and a “Move to…” menu on every card, and a dialog on the
 * two moves that owe somebody an explanation. Shipping one notifies every
 * reviewer whose note fed it and credits their reputation, in the same
 * transaction as the status change, which is the single mechanic that makes
 * reviewing worth anything here.
 *
 * The board is server-rendered and the island is optimistic, so a move paints
 * instantly and a refusal snaps the card back with the reason spoken.
 */

import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { EmptyState } from '@/components/ui'
import { effort as effortLevel } from '@/lib/taxonomy'
import {
  TRACKER_COLUMNS,
  columnOf,
  creatorScope,
  projectVersions,
  trackerBoard,
} from '@/server/queries/dashboard'
import { PageHeader, Section } from '@/components/dashboard/section'
import { SuggestionBoard } from '@/components/dashboard/suggestion-board'
import type { SuggestionCard, TrackerColumn } from '@/components/dashboard/suggestion-types'
import { ProjectPicker } from '@/components/dashboard/project-picker'

export const metadata: Metadata = {
  title: 'Suggestion tracker',
  description: 'What you promised to change, and who is waiting to hear about it.',
}

const COLUMN_COPY: Record<string, string> = {
  open: 'Nothing waiting. Promote a theme from Insights to start one here.',
  planned: 'Nothing planned. Cards land here once you have decided to do them.',
  in_progress: 'Nothing in progress.',
  shipped: 'Nothing shipped yet. Shipping one tells every reviewer behind it.',
  declined: 'Nothing declined. A decline owes a reason, and the reviewers read it.',
}

export default async function SuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const claims = await currentClaimsLive()
  if (!claims) redirect('/sign-in?next=%2Fdashboard%2Fsuggestions')

  const params = await searchParams
  const projectParam = typeof params['project'] === 'string' ? params['project'] : undefined
  const scope = creatorScope(claims.uid, projectParam)

  if (scope.projects.length === 0) {
    return (
      <>
        <PageHeader
          title="Suggestion tracker"
          lede="A tracker is a promise to the people who wrote the notes."
        />
        <EmptyState
          title="No projects yet"
          body="Suggestions come out of feedback, so this fills up once a build is live and people have written about it."
          primaryAction={{ label: 'Post your first project', href: '/new' }}
        />
      </>
    )
  }

  const board = trackerBoard(claims.uid, scope.project?.id ?? null)
  const picker = (
    <ProjectPicker
      projects={scope.projects}
      selected={scope.project?.id ?? 'all'}
      href={(id) => `/dashboard/suggestions?project=${encodeURIComponent(id)}`}
      allowAll
    />
  )
  const where = scope.project ? ` on ${scope.project.title}` : ' across your projects'
  const versions = scope.project ? projectVersions(scope.project.id) : []

  const columns: TrackerColumn[] = TRACKER_COLUMNS.map((column) => ({
    id: column.id,
    label: column.label,
    description: COLUMN_COPY[column.id] ?? 'Nothing here.',
    cards: board.items
      .filter((item) => columnOf(item.status) === column.id)
      .map(
        (item): SuggestionCard => ({
          id: item.id,
          title: item.title,
          column: column.id,
          statusLabel: item.statusLabel,
          statusNote: item.statusNote,
          projectTitle: item.projectTitle,
          themeLabel: item.themeLabel,
          voteCount: item.voteCount,
          sourceCount: item.sourceCount,
          effortLabel: item.effort ? (effortLevel(item.effort)?.label ?? null) : null,
          contributors: item.contributors.map((person) => ({
            id: person.id,
            name: person.displayName,
            handle: person.handle,
            avatarUrl: person.avatarUrl,
          })),
          shippedInVersion: item.shippedInVersion,
          statusChangedAt: item.statusChangedAt,
        }),
      ),
  }))

  // People, not contributions: a reviewer behind two open cards is one person
  // waiting, and the card lines say the same thing per card.
  const waiting = new Set(
    board.items
      .filter((item) => columnOf(item.status) !== 'shipped' && columnOf(item.status) !== 'declined')
      .flatMap((item) => item.contributors.map((person) => person.id)),
  ).size

  if (board.counts.total === 0) {
    return (
      <>
        <PageHeader
          title="Suggestion tracker"
          lede="A tracker is a promise to the people who wrote the notes."
        />
        {picker}
        <EmptyState
          title="Nothing tracked yet"
          body="Suggestions come from feedback: promote a theme and the notes behind it come with it, so shipping it later tells those reviewers by name."
          primaryAction={{
            label: 'See what to fix first',
            href: scope.project
              ? `/dashboard/insights?project=${encodeURIComponent(scope.project.id)}`
              : '/dashboard/insights',
          }}
          secondaryAction={{
            label: 'Read the inbox',
            href: scope.project
              ? `/dashboard/inbox?project=${encodeURIComponent(scope.project.id)}`
              : '/dashboard/inbox',
          }}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Suggestion tracker"
        lede={
          waiting > 0
            ? `${String(board.counts.total)} tracked${where}. ${String(waiting)} ${waiting === 1 ? 'reviewer is' : 'reviewers are'} waiting to hear what happened to theirs.`
            : `${String(board.counts.total)} tracked${where}, and nobody is waiting on an answer.`
        }
      />
      {picker}

      <Section
        id="board"
        title="Board"
        lede="Drag a card by its handle, or use the move menu. Shipped and Declined ask for a line the reviewers will read."
      >
        <SuggestionBoard
          columns={columns}
          versions={versions}
          // The picker above names the project; a card repeats it only when
          // every project is on the board at once.
          showProject={scope.allProjects}
        />
      </Section>
    </>
  )
}

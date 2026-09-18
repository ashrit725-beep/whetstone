/**
 * The feedback inbox.
 *
 * Filters are URL search params read here, in a Server Component: every filter
 * is a link, every view is shareable, and the back button means what it says.
 * The table is a client island only because selection and the announced count
 * need state; the rows, the sorting and the open note are all server work. The
 * open note renders above the rows, so it is in view however it was opened.
 *
 * The rows stream. Grouping runs the same clustering as the insights rollup,
 * cached per request, and a cold run must not hold up the filter chips, so the
 * table sits inside a `<Suspense>` with a skeleton matched to its geometry.
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { Banner, EmptyState, Skeleton } from '@/components/ui'
import { getFeedback, getInboxCounts } from '@/server/repos/feedback'
import { THEME_FLOOR, creatorScope } from '@/server/queries/dashboard'
import type { InboxState } from '@/lib/types'
import { PageHeader, Section } from '@/components/dashboard/section'
import { InboxFilters } from '@/components/dashboard/inbox-filters'
import { NotesPane } from '@/components/dashboard/notes-pane'
import { NoteDetail } from '@/components/dashboard/note-detail'
import { InboxRowsSkeleton } from '@/components/dashboard/skeletons'
import type { InboxFilterState, InboxSort } from '@/components/dashboard/inbox-types'

export const metadata: Metadata = {
  title: 'Feedback inbox',
  description: 'Every note on your projects, grouped by what it is about.',
}

const BASE = '/dashboard/inbox'
const STATES: readonly InboxState[] = ['new', 'read', 'triaged', 'actioned', 'archived']
// Only the two orders the table actually draws a sortable head for, so a URL
// can never put the list in an order no column is marked as carrying.
const SORTS: readonly InboxSort[] = ['most_severe', 'newest']

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const claims = await currentClaimsLive()
  if (!claims) redirect('/sign-in?next=%2Fdashboard%2Finbox')

  const params = await searchParams
  const read = (key: string): string | undefined =>
    typeof params[key] === 'string' ? params[key] : undefined

  const noteParam = read('note')
  const requested = noteParam ? getFeedback(noteParam, claims.uid) : undefined
  const openNote = requested?.viewer.isCreator ? requested : undefined
  // A note opened from the bell or the overview names no project. The list
  // under it should be the note's own project, so its row is there to mark,
  // and the address should say so, so the rail counts that project too.
  if (openNote && read('project') === undefined) {
    redirect(`${BASE}?project=${encodeURIComponent(openNote.projectId)}&note=${encodeURIComponent(openNote.id)}#open-note`)
  }
  const scope = creatorScope(claims.uid, read('project'))

  if (scope.projects.length === 0) {
    return (
      <>
        <PageHeader title="Feedback inbox" lede="Notes arrive here once a project is live." />
        <EmptyState
          title="No projects yet"
          body="An inbox needs something to review. Post a build with one specific ask, and the first notes usually land within a day."
          primaryAction={{ label: 'Post your first project', href: '/new' }}
        />
      </>
    )
  }

  const counts = getInboxCounts(claims.uid, scope.project?.id ?? null)
  // Grouping is per project, and only from the floor Insights draws themes at:
  // below it there is no board, so every note would sit under "Not yet grouped".
  const groupable = scope.project !== null && counts.total >= THEME_FLOOR

  const stateParam = read('state')
  const sortParam = read('sort')
  const filters: InboxFilterState = {
    project: scope.allProjects ? 'all' : (scope.project?.id ?? 'all'),
    state: STATES.find((entry) => entry === stateParam) ?? null,
    sort: SORTS.find((entry) => entry === sortParam) ?? 'most_severe',
    unansweredOnly: read('unanswered') === 'only',
    grouped: groupable && read('grouped') !== 'off',
    note: noteParam ?? null,
  }

  const current: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') current[key] = value
  }

  const closeSearch = new URLSearchParams(current)
  closeSearch.delete('note')
  const closeHref = closeSearch.toString().length > 0 ? `${BASE}?${closeSearch.toString()}` : BASE
  const archiveSearch = new URLSearchParams(closeSearch)
  archiveSearch.set('state', 'archived')

  const everythingTriaged =
    counts.total > 0 &&
    counts.byState.new === 0 &&
    filters.state === null &&
    !filters.unansweredOnly

  return (
    <>
      <PageHeader
        title="Feedback inbox"
        lede={
          scope.project
            ? `${String(counts.total)} ${counts.total === 1 ? 'note' : 'notes'} on ${scope.project.title}${filters.grouped ? ', grouped by what they are about' : ''}.`
            : `${String(counts.total)} ${counts.total === 1 ? 'note' : 'notes'} across every project you own.`
        }
      />

      <InboxFilters
        filters={filters}
        counts={counts}
        projects={scope.projects.map((project) => ({
          id: project.id,
          title: project.title,
          unread: project.counts.unread,
        }))}
        current={current}
        basePath={BASE}
        groupable={groupable}
      />

      {openNote ? <NoteDetail note={openNote} closeHref={closeHref} /> : null}

      {scope.allProjects ? (
        <Banner variant="info" title="Themes are worked out per project">
          Grouping compares notes against each other inside one project, so it is switched off
          while every project is in view. Pick a project to see the groups.
        </Banner>
      ) : null}

      {counts.total === 0 ? (
        <EmptyState
          variant="success"
          title="No feedback yet"
          body="Nothing is wrong here. Projects that name one specific thing to look at get their first note faster than projects asking for general thoughts."
          // Scoped to one project, this opens it. Scoped to everything there is
          // no single project to open, and the href was `/p/`, which is a 404.
          primaryAction={
            scope.project
              ? { label: 'Open the project', href: `/p/${scope.project.slug}` }
              : { label: 'See what reviewers are reading', href: '/discover' }
          }
        />
      ) : (
        <>
          {everythingTriaged ? (
            <EmptyState
              variant="success"
              title="Everything is triaged"
              body="Every note on this project has been read and filed. The archive keeps them, and anything new lands at the top of this list."
              primaryAction={{
                label: 'Read the archive',
                href: `${BASE}?${archiveSearch.toString()}`,
              }}
              secondaryAction={{
                label: 'See what to fix first',
                href: scope.project
                  ? `/dashboard/insights?project=${encodeURIComponent(scope.project.id)}`
                  : '/dashboard/insights',
              }}
            />
          ) : null}

          <Section
            id="notes"
            title={filters.grouped ? 'Grouped by theme' : 'Every note'}
            lede={
              filters.grouped
                ? 'A group is one thing several people ran into. Each note sits under the theme most of its points belong to.'
                : scope.project && !groupable
                  ? `One note per row. Grouping by theme starts at ${String(THEME_FLOOR)} notes.`
                  : 'One note per row, in the order you chose.'
            }
          >
            <Suspense fallback={<NotesSkeleton />}>
              <NotesPane
                userId={claims.uid}
                projectId={scope.project?.id ?? null}
                filters={filters}
                openNoteId={openNote?.id ?? null}
              />
            </Suspense>
          </Section>
        </>
      )}
    </>
  )
}

/** Matches `NotesPane`: the bulk row, then the rows in the shape they will take. */
function NotesSkeleton() {
  return (
    <div className="flex flex-col gap-md">
      <div aria-hidden="true" className="flex flex-wrap items-center justify-between gap-md">
        <Skeleton w="18ch" h="0.875rem" />
        <div className="flex gap-xs">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} w="9rem" h="2.75rem" radius="sm" />
          ))}
        </div>
      </div>
      <InboxRowsSkeleton label="Grouping the notes" />
    </div>
  )
}

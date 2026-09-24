'use client'

/**
 * The feedback inbox: a dense, real `<table>` (§4.4 surface 5a) where there is
 * room for one, and a register of stacked rows where there is not.
 *
 * Grouped by theme, because nine people hitting one thing is one fact, not nine
 * rows to read. Each group is its own `<tbody>` headed by a
 * `<th scope="rowgroup">` that states how many notes it holds *and from how
 * many reviewers*: “one person said it six times” and “six people said it” must
 * never render the same way.
 *
 * Keyboard contract:
 *   Tab           reaches, in visual order: the select-all box, then per row the
 *                 row checkbox and the note link, then the bulk actions.
 *   Space         toggles the focused checkbox; Shift+Space is not overloaded.
 *   Enter         follows the focused note link, which opens it above the list.
 *   Arrow keys    scroll the table’s own region when it is focused; there is no
 *                 grid navigation, because this is a table of content and a grid
 *                 contract would cost every row link its tab stop.
 * The selected count is announced politely on change, so a keyboard user who
 * ticks four boxes hears “4 of 24 notes selected” without leaving the row. The
 * bulk actions are unavailable until something is ticked, and point at that
 * same sentence to say why.
 *
 * Contract notes: 0px cell radius, surface-1/surface-2 zebra, `tabular-nums` on
 * every figure, `aria-sort` on the sorted column, and a row hover that moves the
 * background exactly one surface step with no lift, shadow or scale (§5.4).
 * The open note is the one element in this view carrying the accent grind-mark.
 *
 * Width. The shape follows the width of the inbox itself, through a container
 * query, not the viewport: the dashboard rail takes 17rem beside it from 60rem
 * up, so a viewport number says little about the room the rows actually get.
 *   64rem and up  all seven columns.
 *   52rem to 64   the point count drops, and the note column keeps 16rem.
 *   below 52rem   one stacked row per note: who and when, then the note at full
 *                 width, then severity and triage. Seven columns at 1024px used
 *                 to leave the note about 110px, two or three words a line, and
 *                 hid Received behind a sideways scroll.
 * Both shapes are rendered and one is hidden with `display: none`, so exactly
 * one is ever in the accessibility tree. Only the table's checkboxes carry the
 * `ids` name; the stacked ones share the same selection state, so the form
 * posts each ticked note once whichever shape is showing.
 *
 * Two width rules inside the table earn their keep, because it used to drag
 * the whole document sideways:
 *   1. The note cell *wraps* and clamps to two lines. It used to be
 *      `truncate max-w-prose`, which is `white-space: nowrap`, so the column's
 *      minimum width was 40rem of unbreakable text and the table could not
 *      compress. Wrapping lets auto table layout shrink the column instead.
 *   2. `position: relative` on the table. Every `sr-only` string is absolutely
 *      positioned; with no positioned ancestor its containing block was the
 *      viewport, so the hidden text at column seven sat 1089px out and the
 *      *page* scrolled even though the table itself was clipped correctly.
 */

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Archive, ArchiveRestore, Check, Eye } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  Form,
  SubmitButton,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableEmpty,
  Timestamp,
  VisuallyHidden,
  type BadgeTone,
  type FormState,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { moveInboxState } from '@/server/actions/dashboard'
import { SeverityChip } from './severity-chip'
import type { InboxFilterState, InboxRow, InboxRowGroup, InboxSort } from './inbox-types'

const COLUMNS = 7

const STATE_TONE: Record<InboxRow['state'], BadgeTone> = {
  new: 'accent',
  read: 'neutral',
  triaged: 'neutral',
  actioned: 'positive',
  archived: 'neutral',
}

const EMPTY = {
  title: 'No notes match these filters',
  detail: 'Nothing here is wrong. The filters are just narrower than the inbox.',
}

const points = (n: number): string => `${n.toLocaleString('en')} ${n === 1 ? 'point' : 'points'}`

export interface InboxTableProps {
  groups: readonly InboxRowGroup[]
  filters: InboxFilterState
  /** Total rows on this page, for the selection announcement. */
  total: number
  /** True when the rows are grouped by theme rather than listed flat. */
  grouped: boolean
  /** The note open in the detail panel above the list. */
  openNoteId: string | null
  caption: string
}

export function InboxTable({
  groups,
  filters,
  total,
  grouped,
  openNoteId,
  caption,
}: InboxTableProps) {
  const pathname = usePathname()
  const params = useSearchParams()
  const countId = useId()
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

  const allIds = useMemo(() => groups.flatMap((group) => group.rows.map((row) => row.id)), [groups])
  // Counted against the rows on the page, so a note that left the view after
  // a move is not still reported as selected.
  const selectedCount = allIds.filter((id) => selected.has(id)).length
  const allSelected = allIds.length > 0 && selectedCount === allIds.length
  const someSelected = selectedCount > 0 && !allSelected
  const nothingSelected = selectedCount === 0

  function href(next: Record<string, string | null>): string {
    const search = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value === null) search.delete(key)
      else search.set(key, value)
    }
    const query = search.toString()
    return query.length > 0 ? `${pathname}?${query}` : pathname
  }

  function sortHref(sort: InboxSort): string {
    return href({ sort })
  }

  function noteHref(id: string): string {
    return `${href({ note: id })}#open-note`
  }

  function toggle(id: string, on: boolean): void {
    setSelected((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAll(on: boolean): void {
    setSelected(on ? new Set(allIds) : new Set())
  }

  const clearSelection = useCallback(() => {
    setSelected(new Set())
  }, [])

  const countLine = nothingSelected
    ? 'No notes selected. Tick one to mark it read, triaged or archived.'
    : `${String(selectedCount)} of ${String(total)} ${total === 1 ? 'note' : 'notes'} selected.`

  // The same reason for all of them, stated once in the sentence beside them.
  const bulk = { disabled: nothingSelected, 'aria-describedby': countId } as const

  const clearFilters = (
    <Button as="a" href={href({ state: null, unanswered: null })} variant="primary">
      Clear the filters
    </Button>
  )

  return (
    <Form action={moveInboxState} summaryTitle="Those notes did not move.">
      {({ state }) => (
        <>
          <ClearOnSuccess state={state} clear={clearSelection} />
          <div className="flex flex-wrap items-center justify-between gap-md">
            <p
              id={countId}
              aria-live="polite"
              className="measure-ui text-sm text-text-2"
              style={{ minHeight: '1lh' }}
            >
              {state.status === 'success' && state.message && nothingSelected ? (
                <span className="text-positive">{state.message}</span>
              ) : (
                countLine
              )}
            </p>
            <div className="flex flex-wrap items-center gap-xs">
              <SubmitButton
                name="state"
                value="read"
                pendingLabel="Marking them read…"
                iconLeading={<Eye size={20} strokeWidth={1.5} />}
                {...bulk}
              >
                Mark read
              </SubmitButton>
              <SubmitButton
                name="state"
                value="triaged"
                pendingLabel="Marking them triaged…"
                iconLeading={<Check size={20} strokeWidth={1.5} />}
                {...bulk}
              >
                Mark triaged
              </SubmitButton>
              <SubmitButton
                name="state"
                value="archived"
                pendingLabel="Archiving them…"
                iconLeading={<Archive size={20} strokeWidth={1.5} />}
                {...bulk}
              >
                Archive
              </SubmitButton>
              {filters.state === 'archived' ? (
                <SubmitButton
                  name="state"
                  value="triaged"
                  pendingLabel="Restoring them…"
                  iconLeading={<ArchiveRestore size={20} strokeWidth={1.5} />}
                  {...bulk}
                >
                  Restore
                </SubmitButton>
              ) : null}
            </div>
          </div>

          <div className="@container">
            <div className="hidden @min-[52rem]:block">
              <Table caption={caption} className="relative">
                <THead>
                  <TR>
                    <TH scope="col" className="w-3xl py-2xs">
                      <Checkbox
                        id="inbox-select-all"
                        label={<VisuallyHidden>Select every note on this page</VisuallyHidden>}
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={(event) => {
                          toggleAll(event.currentTarget.checked)
                        }}
                      />
                    </TH>
                    <TH scope="col">Reviewer</TH>
                    <TH scope="col">Note</TH>
                    <TH
                      scope="col"
                      sort={filters.sort === 'most_severe' ? 'descending' : 'none'}
                      sortHref={sortHref('most_severe')}
                    >
                      Severity
                    </TH>
                    <TH scope="col" numeric className="hidden @min-[64rem]:table-cell">
                      Points
                    </TH>
                    <TH scope="col">Triage</TH>
                    <TH
                      scope="col"
                      numeric
                      sort={filters.sort === 'newest' ? 'descending' : 'none'}
                      sortHref={sortHref('newest')}
                    >
                      Received
                    </TH>
                  </TR>
                </THead>

                {groups.length === 0 ? (
                  <TableEmpty colSpan={COLUMNS} {...EMPTY} action={clearFilters} />
                ) : (
                  groups.map((group) => (
                    <TBody key={group.id}>
                      {grouped ? (
                        <tr className="relative bg-surface-0">
                          <th
                            scope="rowgroup"
                            colSpan={COLUMNS}
                            className="rounded-none border-b border-border-hair px-md py-sm text-left"
                          >
                            <GroupHeading group={group} />
                          </th>
                        </tr>
                      ) : null}

                      {group.rows.map((row) => (
                        <TR key={row.id} interactive selected={row.id === openNoteId}>
                          {/* Every cell in a row is topped out rather than
                              centred: the note block is two lines and the rest
                              are one, so middle-alignment centred each cell in
                              its own box and no two first lines met. */}
                          <TD className="align-top py-sm">
                            <Checkbox
                              id={`select-${row.id}`}
                              name="ids"
                              value={row.id}
                              checked={selected.has(row.id)}
                              onChange={(event) => {
                                toggle(row.id, event.currentTarget.checked)
                              }}
                              label={
                                <VisuallyHidden>{`Select the note from ${row.reviewerName}`}</VisuallyHidden>
                              }
                            />
                          </TD>

                          <TD className="align-top">
                            <Reviewer row={row} />
                          </TD>

                          <TD className="min-w-[16rem] align-top">
                            <NoteLink row={row} href={noteHref(row.id)} open={row.id === openNoteId} />
                          </TD>

                          <TD className="align-top">
                            <SeverityChip severity={row.severity} label={row.severityLabel} />
                          </TD>

                          <TD numeric className="hidden align-top @min-[64rem]:table-cell">
                            {row.pointCount.toLocaleString('en')}
                          </TD>

                          <TD className="align-top">
                            <Triage row={row} />
                          </TD>

                          <TD numeric className="align-top whitespace-nowrap">
                            <Timestamp ts={row.submittedAt} />
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  ))
                )}
              </Table>
            </div>

            <div className="rounded-md border border-border-hair @min-[52rem]:hidden [&>section:last-child>ul>li:last-child]:border-b-0">
              {groups.length === 0 ? (
                <div className="measure-ui flex flex-col items-start gap-xs px-md py-xl">
                  <p className="text-md text-text-1">{EMPTY.title}</p>
                  <p className="text-sm text-text-2">{EMPTY.detail}</p>
                  {clearFilters}
                </div>
              ) : (
                <>
                  <div className="border-b border-border-hair bg-surface-2 px-md">
                    {/* The empty helper line every checkbox reserves is
                        dropped here: this box can never carry an error, and
                        the reserved line left the bar lopsided. */}
                    <Checkbox
                      id="inbox-pick-all"
                      wrapperClassName="[&>[aria-live]]:hidden"
                      label={<span className="text-sm text-text-2">Select every note on this page</span>}
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={(event) => {
                        toggleAll(event.currentTarget.checked)
                      }}
                    />
                  </div>
                  {groups.map((group) => (
                    <StackedGroup key={group.id} group={group} grouped={grouped}>
                      {group.rows.map((row) => (
                        <li
                          key={row.id}
                          aria-current={row.id === openNoteId ? 'true' : undefined}
                          className={cn(
                            'flex items-start gap-sm border-b border-border-hair px-md py-sm odd:bg-surface-1 even:bg-surface-2',
                            'transition-[background-color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-surface-3',
                            row.id === openNoteId && 'grind-mark-on',
                          )}
                        >
                          {/* No `name`: the table's boxes post the selection,
                              and these would post every note a second time. */}
                          <Checkbox
                            id={`pick-${row.id}`}
                            checked={selected.has(row.id)}
                            onChange={(event) => {
                              toggle(row.id, event.currentTarget.checked)
                            }}
                            label={
                              <VisuallyHidden>{`Select the note from ${row.reviewerName}`}</VisuallyHidden>
                            }
                          />
                          <div className="flex min-w-0 flex-1 flex-col gap-xs py-2xs">
                            <div className="flex flex-wrap items-center justify-between gap-x-sm gap-y-2xs">
                              <Reviewer row={row} />
                              <Timestamp ts={row.submittedAt} className="text-xs text-text-3" />
                            </div>
                            <NoteLink row={row} href={noteHref(row.id)} open={row.id === openNoteId} />
                            <div className="flex flex-wrap items-center gap-xs">
                              <SeverityChip severity={row.severity} label={row.severityLabel} />
                              <Triage row={row} />
                              <span className="tnum text-xs text-text-3">{points(row.pointCount)}</span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </StackedGroup>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </Form>
  )
}

/**
 * Empties the selection once a move lands, so the sentence beside the actions
 * can say what moved instead of still counting boxes that no longer need it.
 */
function ClearOnSuccess({ state, clear }: { state: FormState; clear: () => void }) {
  useEffect(() => {
    if (state.status === 'success') clear()
  }, [state, clear])
  return null
}

/**
 * What a group is and what is filed under it: how many notes, from how many
 * people. It counts the rows below it, not the theme: a note sits under the
 * theme most of its points belong to, so a theme's full reach is on Insights,
 * and a header claiming it here would disagree with the rows it heads.
 */
function GroupHeading({ group }: { group: InboxRowGroup }) {
  const notes = group.rows.length
  return (
    <span className="flex flex-wrap items-baseline gap-x-sm gap-y-2xs">
      <span className="text-sm text-text-1">{group.label}</span>
      <span className="tnum text-xs text-text-3">
        {`${notes.toLocaleString('en')} ${notes === 1 ? 'note' : 'notes'} from ${group.reviewers.toLocaleString('en')} ${group.reviewers === 1 ? 'reviewer' : 'reviewers'}`}
      </span>
      {group.impact !== null ? (
        <span className="text-xs text-text-3">
          <span>Impact </span>
          <span className="tnum">{group.impact}</span>
          <span> of 100</span>
        </span>
      ) : null}
    </span>
  )
}

/** One group in the stacked shape: a heading when grouped, then its rows. */
function StackedGroup({
  group,
  grouped,
  children,
}: {
  group: InboxRowGroup
  grouped: boolean
  children: ReactNode
}) {
  const headingId = `inbox-group-${group.id}`
  return (
    <section aria-labelledby={grouped ? headingId : undefined}>
      {grouped ? (
        // At body weight, like the table's rowgroup header it stands in for,
        // not at the 700 every h3 gets.
        <h3
          id={headingId}
          className="border-b border-border-hair bg-surface-0 px-md py-sm text-sm"
          style={{ fontVariationSettings: 'normal' }}
        >
          <GroupHeading group={group} />
        </h3>
      ) : null}
      <ul className="m-0 list-none p-0">{children}</ul>
    </section>
  )
}

function Reviewer({ row }: { row: InboxRow }) {
  return (
    <span className="flex min-w-0 items-center gap-xs">
      <Avatar userId={row.reviewerId} name={row.reviewerName} src={row.reviewerAvatar} size="sm" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm text-text-1">{row.reviewerName}</span>
        {row.reviewerIsExpert ? <span className="text-xs text-text-3">Expert</span> : null}
      </span>
    </span>
  )
}

function NoteLink({ row, href, open }: { row: InboxRow; href: string; open: boolean }) {
  return (
    <Link
      href={href}
      className={
        open ? 'text-sm text-text-1 no-underline' : 'text-sm text-text-2 no-underline hover:text-text-1'
      }
    >
      {/* `line-clamp` sets its own display, so no `block` here: the two would
          fight over the same property. */}
      <span className="line-clamp-2 max-w-prose">{row.headline}</span>
      <span className="font-prose line-clamp-2 max-w-prose text-xs text-text-3">{row.excerpt}</span>
    </Link>
  )
}

function Triage({ row }: { row: InboxRow }) {
  return (
    <span className="flex flex-wrap items-center gap-2xs">
      <Badge tone={STATE_TONE[row.state]}>{row.stateLabel}</Badge>
      {row.unanswered ? (
        <span className="text-xs whitespace-nowrap text-text-3">No reply yet</span>
      ) : null}
    </span>
  )
}

export default InboxTable

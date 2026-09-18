'use client'

/**
 * The suggestion tracker (§4.4 surface 5c).
 *
 * Five columns, and three ways to move a card, because WCAG 2.5.7 requires a
 * single-pointer path for every dragging action and a menu is a better path
 * than a drag anyway when the columns do not all fit on one row:
 *
 *   Pointer   grab the handle and drag. The card tracks the pointer 1:1 with
 *             no transition, and the column under it takes a dashed outline.
 *   Keyboard  focus the handle, Space lifts, Left and Right pick a column,
 *             Space drops, Escape cancels. Nothing is committed until the drop.
 *   Menu      “Move to…” on every card, with the same five destinations and the
 *             current one disabled with the reason stated.
 *
 * Every outcome is announced politely, naming the card, the column and where it
 * landed: “Rename Ballast to Jettison moved to Planned, position 2 of 6.”
 * Position is real: the tracker orders by votes, so the sentence says where the
 * card actually is now, not where it was dropped.
 *
 * Shipped and Declined do not move on a drag alone. Both owe the reviewers who
 * wrote the underlying notes something in writing, so both open a dialog that
 * shows the creator exactly who is about to hear from them.
 *
 * Optimism: `useOptimistic` moves the card immediately and the server’s answer
 * replaces it. A refusal snaps the card back and says why in the same region
 * that announced the move, so the correction is spoken, not silent.
 */

import { useId, useOptimistic, useRef, useState, useTransition } from 'react'
import { GripVertical, MoveRight } from 'lucide-react'
import {
  AvatarGroup,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuItem,
  MIN_TAP,
  idleFormState,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { moveSuggestion } from '@/server/actions/suggestions'
import type { TrackerColumnId } from '@/server/queries/dashboard'
import { StatusDialog } from './status-dialog'
import { COLUMN_STATUS, type SuggestionCard, type TrackerColumn } from './suggestion-types'

interface Move {
  readonly id: string
  readonly to: TrackerColumnId
}

/** Cards inside a column are ordered by votes, then by title, on both sides. */
function order(cards: readonly SuggestionCard[]): SuggestionCard[] {
  return [...cards].sort((a, b) => b.voteCount - a.voteCount || a.title.localeCompare(b.title))
}

function applyMove(columns: readonly TrackerColumn[], move: Move): TrackerColumn[] {
  let moved: SuggestionCard | undefined
  const stripped = columns.map((column) => {
    const found = column.cards.find((card) => card.id === move.id)
    if (found) moved = { ...found, column: move.to }
    return { ...column, cards: column.cards.filter((card) => card.id !== move.id) }
  })
  if (!moved) return stripped
  const target = moved
  return stripped.map((column) =>
    column.id === move.to ? { ...column, cards: order([...column.cards, target]) } : column,
  )
}

function placeOf(
  columns: readonly TrackerColumn[],
  move: Move,
): { position: number; total: number } {
  const next = applyMove(columns, move)
  const column = next.find((entry) => entry.id === move.to)
  if (!column) return { position: 0, total: 0 }
  const index = column.cards.findIndex((card) => card.id === move.id)
  return { position: index + 1, total: column.cards.length }
}

/**
 * Who is behind a card, in the tense its column is in. Every status change
 * notifies them, so a card that has left for Shipped or Declined has told its
 * reviewers; only the others still owe them an answer.
 */
function contributorLine(card: SuggestionCard): string {
  const count = card.contributors.length
  const people = count === 1 ? '1 reviewer' : `${String(count)} reviewers`
  if (card.column === 'shipped' || card.column === 'declined') return `Told ${people}`
  return `${people} waiting to hear`
}

export interface SuggestionBoardProps {
  columns: readonly TrackerColumn[]
  versions: readonly { readonly id: string; readonly label: string }[]
  /** Shown under the project title on each card when more than one is in view. */
  showProject: boolean
}

export function SuggestionBoard({ columns, versions, showProject }: SuggestionBoardProps) {
  const [board, setOptimistic] = useOptimistic(columns, applyMove)
  const [, startTransition] = useTransition()
  const instructionsId = useId()

  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [lifted, setLifted] = useState<{ id: string; to: TrackerColumnId } | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<TrackerColumnId | null>(null)
  const [dialog, setDialog] = useState<{ card: SuggestionCard; to: 'shipped' | 'declined' } | null>(
    null,
  )

  const origin = useRef<{ x: number; y: number } | null>(null)
  const cardRefs = useRef(new Map<string, HTMLLIElement | null>())

  const columnIds = board.map((column) => column.id)
  const labelOf = (id: TrackerColumnId): string =>
    board.find((column) => column.id === id)?.label ?? id

  function commit(card: SuggestionCard, to: TrackerColumnId): void {
    if (to === card.column) return
    if (to === 'shipped' || to === 'declined') {
      setDialog({ card, to })
      return
    }
    const place = placeOf(board, { id: card.id, to })
    startTransition(async () => {
      setOptimistic({ id: card.id, to })
      const data = new FormData()
      data.set('suggestionId', card.id)
      data.set('status', COLUMN_STATUS[to])
      data.set('position', String(place.position))
      data.set('total', String(place.total))
      const result = await moveSuggestion(idleFormState, data)
      setFailed(result.status === 'error')
      setMessage(result.message ?? '')
    })
  }

  /* ----------------------------------------------------------- pointer -- */

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>, card: SuggestionCard): void {
    if (event.button !== 0 || dragging !== null) return
    event.currentTarget.setPointerCapture(event.pointerId)
    origin.current = { x: event.clientX, y: event.clientY }
    setDragging(card.id)
    setDragOver(card.column)
    setLifted(null)
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>, card: SuggestionCard): void {
    const start = origin.current
    if (dragging !== card.id || !start) return
    const node = cardRefs.current.get(card.id)
    if (node) {
      // 1:1 tracking. A transition here is the cheapest-feeling bug there is.
      node.style.transition = 'none'
      node.style.transform = `translate(${String(event.clientX - start.x)}px, ${String(
        event.clientY - start.y,
      )}px)`
    }
    const under = document.elementFromPoint(event.clientX, event.clientY)
    const column = under?.closest<HTMLElement>('[data-column]')?.dataset['column']
    if (column && (columnIds as readonly string[]).includes(column)) {
      setDragOver(column as TrackerColumnId)
    }
  }

  function endPointer(card: SuggestionCard, drop: boolean): void {
    const node = cardRefs.current.get(card.id)
    if (node) {
      node.style.transition = ''
      node.style.transform = ''
    }
    const target = dragOver
    origin.current = null
    setDragging(null)
    setDragOver(null)
    if (drop && target) commit(card, target)
  }

  /* ---------------------------------------------------------- keyboard -- */

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, card: SuggestionCard): void {
    const active = lifted?.id === card.id ? lifted : null

    if (event.key === 'Escape' && active) {
      event.preventDefault()
      setLifted(null)
      setFailed(false)
      setMessage(`${card.title} stayed in ${labelOf(card.column)}.`)
      return
    }

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      if (!active) {
        setLifted({ id: card.id, to: card.column })
        setFailed(false)
        setMessage(
          `${card.title} lifted from ${labelOf(card.column)}. Left and right arrows pick a column, space drops it, escape cancels.`,
        )
        return
      }
      setLifted(null)
      commit(card, active.to)
      return
    }

    if (!active) return
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const index = columnIds.indexOf(active.to)
    const next = columnIds[Math.min(Math.max(index + (event.key === 'ArrowRight' ? 1 : -1), 0), columnIds.length - 1)]
    if (!next || next === active.to) return
    setLifted({ id: card.id, to: next })
    const place = placeOf(board, { id: card.id, to: next })
    setMessage(
      `${labelOf(next)}, position ${String(place.position)} of ${String(place.total)} if you drop it here.`,
    )
  }

  /* -------------------------------------------------------------- view -- */

  return (
    <div className="flex flex-col gap-md">
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn('measure-ui text-sm', failed ? 'text-critical' : 'text-text-2')}
        style={{ minHeight: '1lh' }}
      >
        {message}
      </p>

      <p id={instructionsId} className="sr-only">
        Press space to lift a card. Use the left and right arrow keys to pick a column, space to
        drop it, escape to cancel. Every card also has a move menu.
      </p>

      {/* Columns wrap rather than scroll. Five fixed 13rem columns needed
          1,104px and the content column at 1440 is 1,040px, so Declined was cut
          mid-word at the widest layout and two and a half columns showed at
          1024, with nothing to say the rest were off to the side. At 12rem all
          five sit on one row at 1440; narrower, the later columns start a new
          row, and on a phone they stack. `relative` keeps the absolutely
          positioned sr-only strings inside the board. */}
      <div
        className="relative grid gap-md"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 12rem), 1fr))' }}
      >
        {board.map((column) => {
          const isTarget =
            (dragging !== null && dragOver === column.id) || lifted?.to === column.id
          return (
            <section
              key={column.id}
              data-column={column.id}
              aria-labelledby={`column-${column.id}`}
              className="flex flex-col gap-sm rounded-md p-2xs"
              style={
                isTarget
                  ? { outline: '2px dashed var(--color-border-strong)', outlineOffset: '2px' }
                  : undefined
              }
            >
              <div className="flex items-baseline justify-between gap-xs border-b border-border-hair pb-xs">
                <h3 id={`column-${column.id}`} className="text-md text-text-1">
                  {column.label}
                </h3>
                <span className="tnum text-xs text-text-3">
                  {column.cards.length.toLocaleString('en')}
                </span>
              </div>

              {column.cards.length === 0 ? (
                <p className="measure-ui rounded-md border border-dashed border-border-hair p-md text-xs text-text-3">
                  {column.description}
                </p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-sm p-0">
                  {column.cards.map((card) => (
                    <li
                      key={card.id}
                      ref={(node) => {
                        cardRefs.current.set(card.id, node)
                      }}
                      className={cn(
                        'flex flex-col gap-xs rounded-md border border-border-hair bg-surface-3 p-sm',
                        dragging === card.id && 'pointer-events-none',
                        lifted?.id === card.id && 'border-border-strong',
                      )}
                    >
                      <p className="text-sm text-text-1">{card.title}</p>

                      {showProject ? (
                        <p className="text-xs text-text-3">{card.projectTitle}</p>
                      ) : null}

                      <dl className="m-0 flex flex-wrap items-baseline gap-sm">
                        <div className="flex items-baseline gap-2xs">
                          <dt className="text-xs text-text-3">Votes</dt>
                          <dd className="tnum m-0 text-xs text-text-1">
                            {card.voteCount.toLocaleString('en')}
                          </dd>
                        </div>
                        <div className="flex items-baseline gap-2xs">
                          <dt className="text-xs text-text-3">Points behind it</dt>
                          <dd className="tnum m-0 text-xs text-text-1">
                            {card.sourceCount.toLocaleString('en')}
                          </dd>
                        </div>
                        {card.effortLabel ? (
                          <div className="flex items-baseline gap-2xs">
                            <dt className="text-xs text-text-3">Effort</dt>
                            <dd className="m-0 text-xs text-text-1">{card.effortLabel}</dd>
                          </div>
                        ) : null}
                      </dl>

                      {card.contributors.length > 0 ? (
                        // The sentence keeps to one line and drops under the
                        // faces when the column is too narrow for both, rather
                        // than wrapping a word per line beside them.
                        <div className="flex flex-wrap items-center gap-x-xs gap-y-2xs">
                          <AvatarGroup
                            people={card.contributors.map((person) => ({
                              id: person.id,
                              name: person.name,
                              src: person.avatarUrl,
                            }))}
                            max={3}
                            label={`Reviewers whose notes fed ${card.title}`}
                          />
                          <span className="text-xs whitespace-nowrap text-text-3">
                            {contributorLine(card)}
                          </span>
                        </div>
                      ) : null}

                      {card.shippedInVersion ? (
                        <span className="self-start">
                          <Badge tone="positive">{`Shipped in ${card.shippedInVersion}`}</Badge>
                        </span>
                      ) : null}

                      {card.statusNote ? (
                        <p className="prose-human text-xs">{card.statusNote}</p>
                      ) : null}

                      <div className="flex items-center gap-xs">
                        <button
                          type="button"
                          aria-pressed={lifted?.id === card.id}
                          aria-describedby={instructionsId}
                          aria-label={`Move ${card.title}. Currently in ${labelOf(card.column)}.`}
                          style={{ ...MIN_TAP, minInlineSize: 'var(--tap-min)', touchAction: 'none' }}
                          className={cn(
                            'flex cursor-grab items-center justify-center rounded-sm border text-text-2',
                            'transition-[background-color,border-color,color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
                            'hover:border-border-strong hover:bg-surface-4 hover:text-text-1',
                            lifted?.id === card.id
                              ? 'border-border-strong bg-surface-4 text-text-1'
                              : 'border-border-control',
                          )}
                          onPointerDown={(event) => {
                            onPointerDown(event, card)
                          }}
                          onPointerMove={(event) => {
                            onPointerMove(event, card)
                          }}
                          onPointerUp={() => {
                            endPointer(card, true)
                          }}
                          onPointerCancel={() => {
                            endPointer(card, false)
                          }}
                          onKeyDown={(event) => {
                            onKeyDown(event, card)
                          }}
                        >
                          <GripVertical size={20} strokeWidth={1.5} aria-hidden="true" />
                        </button>

                        <DropdownMenu
                          label={`Move ${card.title} to another column`}
                          trigger={
                            <Button
                              variant="ghost"
                              iconLeading={<MoveRight size={20} strokeWidth={1.5} />}
                            >
                              Move to…
                            </Button>
                          }
                        >
                          {board.map((destination) => (
                            <DropdownMenuItem
                              key={destination.id}
                              disabled={destination.id === card.column}
                              disabledReason={
                                destination.id === card.column
                                  ? 'This card is already here.'
                                  : undefined
                              }
                              onSelect={() => {
                                commit(card, destination.id)
                              }}
                            >
                              {destination.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenu>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      <StatusDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        card={dialog?.card ?? null}
        target={dialog?.to ?? 'shipped'}
        versions={versions}
      />
    </div>
  )
}

export default SuggestionBoard

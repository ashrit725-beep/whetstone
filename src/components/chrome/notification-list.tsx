'use client'

/**
 * The full register behind the bell, for `/notifications`.
 *
 * Keyboard contract: a list of links and one button. Tab moves through the
 * rows in reading order and Enter follows one. "Mark all read" is a real
 * button, so Enter and Space both press it. A row whose destination no longer
 * exists is text, not a link, and takes no tab stop.
 *
 * Opening a row marks it read the way the bell does: the row settles at once,
 * then `router.refresh()` brings the server's counts back, so the bell badge
 * and the filter counts agree with the list on the next frame.
 *
 * Shipped rows carry the bell's treatment: a 2px positive rule on the leading
 * edge, a Check glyph and the word "Shipped", so the state never rests on hue
 * (contract §2.4.8). Unread is a word too, never a dot.
 */

import { startTransition, useOptimistic, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { Check } from 'lucide-react'
import { Button, Timestamp } from '@/components/ui'
import { cn } from '@/lib/utils'
import { markAllNotificationsRead, markNotificationRead } from './actions'
import type { NotificationListItem } from './types'

const LABEL_AXES = { fontVariationSettings: '"wdth" 100, "wght" 600' } as const

const ROW = cn(
  'relative -mx-sm flex flex-col gap-2xs px-sm py-md',
  'transition-[background-color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
)

export interface NotificationListProps {
  /** One page of rows, newest first. */
  items: readonly NotificationListItem[]
  /** Names the list for assistive technology, e.g. "Unread notifications". */
  label: string
}

export function NotificationList({ items, label }: NotificationListProps) {
  const router = useRouter()
  const [rows, markOptimistic] = useOptimistic(
    items,
    (state: readonly NotificationListItem[], id: string) =>
      state.map((row) => (row.id === id ? { ...row, isRead: true } : row)),
  )

  function readOne(id: string) {
    startTransition(async () => {
      markOptimistic(id)
      await markNotificationRead(id)
      router.refresh()
    })
  }

  return (
    <ol aria-label={label} className="m-0 list-none p-0">
      {rows.map((row) => {
        const shipped = row.kind === 'suggestion_shipped'
        const body = (
          <>
            <span className="flex items-start gap-xs">
              {shipped ? (
                <Check
                  size={20}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="mt-3xs shrink-0 text-positive"
                />
              ) : null}
              <span
                className={cn('text-base', row.isRead ? 'text-text-2' : 'text-text-1')}
                style={row.isRead ? undefined : LABEL_AXES}
              >
                {row.title}
              </span>
            </span>
            {row.body ? (
              <span className="measure-ui line-clamp-2 text-sm text-text-2">{row.body}</span>
            ) : null}
            <span className="flex flex-wrap items-center gap-x-sm gap-y-3xs text-xs text-text-3">
              {row.isRead ? null : (
                <span className="text-accent" style={LABEL_AXES}>
                  Unread
                </span>
              )}
              {shipped ? (
                <span className="text-positive" style={LABEL_AXES}>
                  Shipped
                </span>
              ) : null}
              <Timestamp ts={row.createdAt} />
              {row.url === null ? <span>Its page no longer exists</span> : null}
            </span>
          </>
        )

        return (
          <li key={row.id} className="border-t border-border-hair first:border-t-0">
            {row.url === null ? (
              <div className={cn(ROW, shipped ? 'ws-notif-shipped' : undefined)}>{body}</div>
            ) : (
              <NextLink
                href={row.url}
                data-notif-row=""
                onClick={() => {
                  if (!row.isRead) readOne(row.id)
                }}
                className={cn(
                  ROW,
                  'rounded-sm hover:bg-surface-2',
                  shipped ? 'ws-notif-shipped' : undefined,
                )}
              >
                {body}
              </NextLink>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Marks every notification read, then refreshes so every count follows.
 *
 * The button is its own gate rather than the page's: pressing it takes the
 * unread count to zero, which removes the button, and focus fell to `<body>`
 * with nothing announced. It hands focus to the first row before the
 * transition starts — the way the bell's own version does — and keeps a live
 * region that outlives the control, which is the only reason the outcome can
 * still be read out after the button has gone.
 */
export function MarkAllReadButton({ unread, landingId }: MarkAllReadButtonProps) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [said, setSaid] = useState('')

  function readAll() {
    // Scoped to the page's own list: the bell renders the same rows, and its
    // panel is a portal outside `<main>`.
    const landing =
      document.querySelector<HTMLElement>('#main a[data-notif-row]') ??
      document.getElementById(landingId)
    landing?.focus({ preventScroll: true })
    start(async () => {
      await markAllNotificationsRead()
      router.refresh()
      setSaid('Every notification is marked read.')
    })
  }

  return (
    <>
      {unread > 0 ? (
        <Button
          variant="secondary"
          loading={pending}
          loadingLabel="Marking every notification read"
          onClick={readAll}
        >
          Mark all read
        </Button>
      ) : null}
      <span role="status" aria-live="polite" className="sr-only">
        {said}
      </span>
    </>
  )
}

export interface MarkAllReadButtonProps {
  /** How many are unread. At zero the control is not offered. */
  unread: number
  /** Where focus lands when there is no row to land on, e.g. the page heading. */
  landingId: string
}

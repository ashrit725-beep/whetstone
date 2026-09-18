'use client'

/**
 * NotificationBell: the unread count, and a popover of what is behind it.
 *
 * Keyboard contract
 *   Enter / Space   on the bell open and close the popover. Focus moves to the
 *                   first control inside.
 *   ArrowDown / Up  move between the rows, wrapping at both ends.
 *   Home / End      jump to the first or last row.
 *   Escape          closes it and returns focus to the bell, from anywhere inside.
 *   Mark all read   hands focus to the first row before the button gives way to
 *                   the words "All read", so the keyboard is never left on <body>.
 *   Tab             moves through the rows and then out, which also closes it.
 *                   Focus is never trapped: this is a panel, not a decision.
 *
 * Rows are grouped by what the notification is about, and the group that comes
 * first is the one the whole product exists for: a suggestion the reader wrote
 * has shipped. That run carries a 2px positive rule on its leading edge, a
 * Check glyph and the word "Shipped", so it survives greyscale and does not
 * depend on hue (contract §2.4.8).
 *
 * Marking read is optimistic: the row and the count settle before the round
 * trip, then `router.refresh()` reconciles the server's own count.
 *
 * Icons: `Bell` is the conventional affordance for pending messages;
 * `Check` is the product's single completion glyph.
 */

import {
  startTransition,
  useOptimistic,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { Bell, Check } from 'lucide-react'
import { Link, Popover, Timestamp } from '@/components/ui'
import { cn } from '@/lib/utils'
import { markAllNotificationsRead, markNotificationRead } from './actions'
import { ChromeStyles } from './chrome-styles'
import type { NotificationGroup, NotificationItem } from './types'
import type { NotificationKind } from '@/lib/types'

const LABEL_AXES = { fontVariationSettings: '"wdth" 100, "wght" 600' } as const

const GROUP_OF: Record<NotificationKind, NotificationGroup> = {
  suggestion_shipped: 'shipped',
  feedback_received: 'feedback',
  feedback_reply: 'feedback',
  feedback_helpful: 'feedback',
  suggestion_status: 'feedback',
  project_update: 'feedback',
  new_version: 'feedback',
  test_invite: 'feedback',
  test_reminder: 'feedback',
  bounty_application: 'market',
  bounty_awarded: 'market',
  bounty_delivered: 'market',
  bounty_paid: 'market',
  thread_reply: 'community',
  answer_accepted: 'community',
  mention: 'community',
  new_follower: 'community',
  badge_awarded: 'account',
  verification_decision: 'account',
  moderation_notice: 'account',
  system: 'account',
}

const GROUP_ORDER: readonly NotificationGroup[] = [
  'shipped',
  'feedback',
  'market',
  'community',
  'account',
]

const GROUP_LABEL: Record<NotificationGroup, string> = {
  shipped: 'Your feedback shipped',
  feedback: 'Feedback on your projects',
  market: 'Bounties and requests',
  community: 'Community',
  account: 'Account',
}

export interface NotificationBellProps {
  /** The most recent notifications, newest first. Every `url` is a route that
   *  exists: the caller resolves them and drops what it cannot land. */
  items: readonly NotificationItem[]
  /** The full unread count, which can exceed what `items` carries. */
  unreadCount: number
  /** Every notification the reader has; `/notifications` lists them all. */
  total: number
}

/** Arrow keys, Home and End move focus between the row links, wrapping. */
function onRowsKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
  const links = Array.from(
    event.currentTarget.querySelectorAll<HTMLAnchorElement>('a[data-notif-row]'),
  )
  if (links.length === 0) return
  const at = links.findIndex((link) => link === event.target)
  let next: number
  switch (event.key) {
    case 'ArrowDown':
      next = at === -1 || at === links.length - 1 ? 0 : at + 1
      break
    case 'ArrowUp':
      next = at <= 0 ? links.length - 1 : at - 1
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = links.length - 1
      break
    default:
      return
  }
  event.preventDefault()
  links[next]?.focus()
}

export function NotificationBell({ items, unreadCount, total }: NotificationBellProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement | null>(null)

  const [rows, markOptimistic] = useOptimistic(
    items,
    (state: readonly NotificationItem[], id: string) =>
      state.map((row) => (id === 'all' || row.id === id ? { ...row, isRead: true } : row)),
  )

  /* The bell counts everything, the popover holds only the newest run. Subtract
     what this session has read from the server's total so the two never disagree. */
  const readHere = items.filter((r) => !r.isRead).length - rows.filter((r) => !r.isRead).length
  const unread = Math.max(0, unreadCount - readHere)

  function readOne(id: string) {
    startTransition(async () => {
      markOptimistic(id)
      await markNotificationRead(id)
      router.refresh()
    })
  }

  function readAll() {
    const landing =
      panel.current?.querySelector<HTMLElement>('a[data-notif-row]') ??
      panel.current?.closest<HTMLElement>('[role="dialog"]')
    landing?.focus({ preventScroll: true })
    startTransition(async () => {
      markOptimistic('all')
      await markAllNotificationsRead()
      router.refresh()
    })
  }

  const groups = GROUP_ORDER.map((key) => ({
    key,
    label: GROUP_LABEL[key],
    rows: rows.filter((row) => GROUP_OF[row.kind] === key),
  })).filter((group) => group.rows.length > 0)

  return (
    <Popover
      label="Notifications"
      placement="bottom-end"
      open={open}
      onOpenChange={setOpen}
      className="p-0"
      trigger={
        <button
          type="button"
          aria-label={
            unread > 0
              ? `Notifications, ${String(unread)} unread`
              : 'Notifications, none unread'
          }
          className={cn(
            'relative inline-flex h-11 w-11 items-center justify-center rounded-sm border border-transparent text-text-2',
            'transition-[color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
            'hover:border-border-control hover:bg-surface-3 hover:text-text-1 active:translate-y-px',
          )}
        >
          <Bell size={20} strokeWidth={1.5} aria-hidden="true" />
          {unread > 0 ? (
            <span
              aria-hidden="true"
              className="tnum absolute end-3xs top-3xs inline-flex min-w-md items-center justify-center rounded-xs border border-accent bg-surface-1 px-3xs text-2xs text-accent"
              style={LABEL_AXES}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      }
    >
      <ChromeStyles />

      {/* Arrow keys work from anywhere in the panel, including the header
          button, so the reader never has to Tab through to reach the rows. */}
      <div
        ref={panel}
        className="flex flex-col"
        style={{ inlineSize: '22rem', maxInlineSize: '100%' }}
        onKeyDown={onRowsKeyDown}
      >
        <div className="flex items-center justify-between gap-sm border-b border-border-hair px-md py-xs">
          <h2 className="text-sm text-text-1" style={LABEL_AXES}>
            Notifications
          </h2>
          {unread > 0 ? (
            <button
              type="button"
              onClick={readAll}
              className="inline-flex h-11 items-center rounded-sm px-2xs text-xs text-accent transition-[color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-text-1"
            >
              Mark all read
            </button>
          ) : (
            <span className="text-xs text-text-3">All read</span>
          )}
        </div>

        <div
          className="min-h-0 grow overflow-y-auto"
          data-scroll-region
          style={{ maxBlockSize: 'min(60dvh, 26rem)' }}
        >
          {groups.length === 0 ? (
            <p className="measure-ui px-md py-md text-sm text-text-2">
              Nothing yet. Reviews, replies and shipped suggestions land here as soon as someone
              acts on your work.
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.key} aria-labelledby={`notif-${group.key}`}>
                <h3
                  id={`notif-${group.key}`}
                  className={cn(
                    'border-b border-border-hair bg-surface-2 px-md py-2xs text-xs',
                    /* One hue step, no fill: the run the product exists for
                       names itself before the reader reads a single row. */
                    group.key === 'shipped' ? 'text-positive' : 'text-text-3',
                  )}
                  style={LABEL_AXES}
                >
                  {group.label}
                </h3>
                <ul className="m-0 list-none p-0">
                  {group.rows.map((row) => (
                    <li key={row.id}>
                      <NextLink
                        href={row.url}
                        data-notif-row=""
                        onClick={() => {
                          setOpen(false)
                          if (!row.isRead) readOne(row.id)
                        }}
                        className={cn(
                          'relative flex flex-col gap-3xs border-b border-border-hair px-md py-sm',
                          'transition-[color,background-color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
                          'hover:bg-surface-2',
                          group.key === 'shipped' ? 'ws-notif-shipped' : undefined,
                        )}
                      >
                        {row.isRead ? null : <span className="sr-only">Unread. </span>}
                        <span className="flex items-start gap-xs">
                          {group.key === 'shipped' ? (
                            <Check
                              size={16}
                              strokeWidth={1.5}
                              aria-hidden="true"
                              className="mt-3xs shrink-0 text-positive"
                            />
                          ) : null}
                          <span
                            className={cn('text-sm', row.isRead ? 'text-text-2' : 'text-text-1')}
                            style={row.isRead ? undefined : LABEL_AXES}
                          >
                            {row.title}
                          </span>
                        </span>
                        {row.body ? (
                          <span className="measure-ui line-clamp-2 text-xs text-text-3">
                            {row.body}
                          </span>
                        ) : null}
                        <Timestamp ts={row.createdAt} />
                      </NextLink>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-md gap-y-2xs border-t border-border-hair px-md py-xs">
          {total > 0 ? (
            <Link
              href="/notifications"
              variant="standalone"
              className="text-xs"
              onClick={() => setOpen(false)}
            >
              {total > rows.length ? `See all ${total.toLocaleString('en')}` : 'Open the full list'}
            </Link>
          ) : (
            <p className="text-xs text-text-3">Nothing is waiting.</p>
          )}
          <Link
            href="/settings/notifications"
            variant="quiet"
            className="text-xs"
            onClick={() => setOpen(false)}
          >
            Choose what lands here
          </Link>
        </div>
      </div>
    </Popover>
  )
}

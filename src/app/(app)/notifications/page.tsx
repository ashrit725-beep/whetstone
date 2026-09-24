/**
 * Every notification, newest first: the page the bell's "See all" opens.
 *
 * The bell holds the newest eight. This holds the rest, twenty to a page,
 * walked with a cursor so a notification that arrives while the reader is
 * paging cannot shift a row onto two pages. The filter is URL state read here,
 * so both views are links that can be copied and the back button means what it
 * says; the counts on the two chips are counted rows, the same numbers the
 * bell's badge and footer print.
 *
 * Destinations go through the chrome's `resolveChromeHref`, like the bell's.
 * A row whose page no longer exists stays in the list without a link, because
 * dropping it would make the list disagree with its own count.
 */

import type { Metadata } from 'next'
import { requireUser } from '@/server/auth/session'
import {
  countNotifications,
  getUnreadCount,
  listNotifications,
} from '@/server/repos/notifications'
import { channelLookup } from '@/components/chrome/app-nav'
import { ChromeStyles } from '@/components/chrome/chrome-styles'
import { resolveChromeHref } from '@/components/chrome/links'
import { MarkAllReadButton, NotificationList } from '@/components/chrome/notification-list'
import type { NotificationListItem } from '@/components/chrome/types'
import { EmptyState, FilterChipLink, Link } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Notifications',
  robots: { index: false, follow: false },
}

const BASE = '/notifications'
const PAGE_SIZE = 20

type SearchParams = Record<string, string | string[] | undefined>

function single(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.length > 0) return value
  if (Array.isArray(value)) return value[0] ?? null
  return null
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await requireUser()
  const sp = await searchParams
  const unreadOnly = single(sp['filter']) === 'unread'
  const cursor = single(sp['cursor'])

  const total = countNotifications(user.id)
  const unread = getUnreadCount(user.id)
  const page = listNotifications(user.id, {
    limit: PAGE_SIZE,
    cursor,
    filter: unreadOnly ? 'unread' : 'all',
  })

  const channelFor = channelLookup()
  const items = page.items.map(
    (row): NotificationListItem => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      url: row.url ? resolveChromeHref(row.url, channelFor) : null,
      actorName: row.actor?.displayName ?? null,
      createdAt: row.createdAt,
      isRead: row.isRead,
    }),
  )

  const olderHref =
    page.hasMore && page.nextCursor
      ? `${BASE}?${new URLSearchParams({
          ...(unreadOnly ? { filter: 'unread' } : {}),
          cursor: page.nextCursor,
        }).toString()}`
      : null
  const newestHref = unreadOnly ? `${BASE}?filter=unread` : BASE
  const label = unreadOnly ? 'Unread notifications' : 'All notifications'

  return (
    <div
      className="pad-inline mx-auto flex w-full flex-col gap-xl py-xl"
      style={{ maxInlineSize: 'var(--container-feed)' }}
    >
      <ChromeStyles />

      <header className="flex flex-col gap-sm">
        {/* The landing target for "Mark all read" when the list is about to be
            replaced by an empty state and there is no row left to focus. */}
        <h1 id="notifications-heading" tabIndex={-1} className="text-2xl">
          Notifications
        </h1>
        <p className="measure-ui text-sm text-text-2">
          Reviews of your projects, replies to your notes, shipped suggestions and bounty news,
          newest first. Opening one marks it read.{' '}
          <Link href="/settings/notifications">Choose what lands here</Link>.
        </p>
      </header>

      {/* The filter bar and the rows are one register: the bar's lower rule is
          the first row's upper one, so the list starts where the bar ends. */}
      <div className="flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-md border-y border-border-hair py-md">
          <nav aria-label="Notification filters">
            <ul className="m-0 flex list-none flex-wrap gap-xs p-0">
              <li>
                <FilterChipLink href={BASE} selected={!unreadOnly} count={total}>
                  Everything
                </FilterChipLink>
              </li>
              <li>
                <FilterChipLink href={`${BASE}?filter=unread`} selected={unreadOnly} count={unread}>
                  Unread
                </FilterChipLink>
              </li>
            </ul>
          </nav>
          <MarkAllReadButton unread={unread} landingId="notifications-heading" />
        </div>

        {items.length > 0 ? (
          <NotificationList items={items} label={label} />
        ) : cursor ? (
          <EmptyState
            className="mt-xl"
            title="Nothing older than this"
            body="Every notification on this list has already been shown on an earlier page."
            primaryAction={{ label: 'Back to the newest', href: newestHref, primary: true }}
          />
        ) : unreadOnly ? (
          <EmptyState
            className="mt-xl"
            variant="success"
            title="Everything is read"
            body="Every notification you have received has been opened or marked read. The full list keeps them all."
            primaryAction={{ label: 'Show everything', href: BASE, primary: true }}
          />
        ) : (
          <EmptyState
            className="mt-xl"
            title="No notifications yet"
            body="Reviews of your projects, replies to your notes and suggestions that ship land here the moment someone acts on your work."
            primaryAction={{ label: 'Post a project', href: '/new', primary: true }}
            secondaryAction={{ label: 'Find something to review', href: '/discover' }}
          />
        )}
      </div>

      {olderHref || cursor ? (
        <nav aria-label="More notifications" className="flex flex-wrap items-center gap-x-lg gap-y-xs">
          {olderHref ? (
            <Link href={olderHref} variant="standalone">
              Older notifications
            </Link>
          ) : null}
          {cursor ? (
            <Link href={newestHref} variant="quiet">
              Back to the newest
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  )
}

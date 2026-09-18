/**
 * AppNav: the one sticky element on any page.
 *
 * Structure, left to right: the menu button (below 60rem only), the wordmark,
 * the three primary destinations, then the utility cluster: search, the
 * notification bell, the theme control, and the account. A hairline under the
 * bar and one surface step above the page ground carry the elevation; there is
 * no shadow, because the bar is attached to the page (contract §5.3).
 *
 * The bar's contents sit in the same `max-w-detail` column the pages use, so
 * the wordmark shares a leading edge with the page title beneath it and the
 * account cluster shares a trailing edge with the page's own right column.
 * `pad-inline` stays on the `<header>`, so the hairline and the surface step
 * still run the full width of the window. This is the treatment the marketing
 * nav already uses; the two shells now measure the same.
 *
 * Everything that needs the reader's identity is loaded here, once, through
 * the request-cached `currentUser()`, and nothing below awaits: the theme
 * control is the client primitive, handed the cookie value read here, and the
 * palette is told from the user agent whether its key cap says ⌘ or Ctrl, so
 * neither corrects itself after the first paint. Being
 * async makes this component a flight row of its own; `HydrationGate` in the
 * root layout explains why that can no longer fail hydration.
 *
 * The links are a client island only so `aria-current` survives client-side
 * navigation: a layout does not re-render when the page beneath it changes.
 *
 * Notification destinations are translated through `resolveChromeHref` before
 * they are handed to the bell, and a row that cannot be landed on a real page
 * is dropped rather than drawn (ban 32).
 */

import { headers } from 'next/headers'
import {
  countNotifications,
  getUnreadCount,
  listNotifications,
} from '@/server/repos/notifications'
import { getDiscussion } from '@/server/repos/discussions'
import { currentUser } from '@/server/auth/session'
import { Separator, ThemeToggle } from '@/components/ui'
import { AuthButton } from './auth-button'
import { ChromeStyles } from './chrome-styles'
import { CommandPalette } from './command-palette'
import { resolveChromeHref, type ChannelLookup } from './links'
import { MobileNav } from './mobile-nav'
import { NavLinks } from './nav-links'
import { NotificationBell } from './notification-bell'
import { APPLE_UA } from './platform'
import { readThemeSetting } from './theme-setting'
import { UserMenu } from './user-menu'
import { Wordmark } from './wordmark'
import type { NotificationItem } from './types'

/** How many rows the bell's popover holds. */
const BELL_ROWS = 8

/** One lookup per distinct thread id in the popover, memoised for the request. */
export function channelLookup(): ChannelLookup {
  const seen = new Map<string, string | null>()
  return (threadId) => {
    const hit = seen.get(threadId)
    if (hit !== undefined) return hit
    const slug = getDiscussion(threadId)?.channel.slug ?? null
    seen.set(threadId, slug)
    return slug
  }
}

/** The bell's rows, newest first, each with a destination that exists. */
function bellRows(userId: string): readonly NotificationItem[] {
  const channelFor = channelLookup()
  return listNotifications(userId, { limit: BELL_ROWS })
    .items.map((row) => ({ row, href: row.url ? resolveChromeHref(row.url, channelFor) : null }))
    // A notification with nowhere true to go is not a row a reader can act on.
    .filter((entry): entry is { row: (typeof entry)['row']; href: string } => entry.href !== null)
    .map(
      ({ row, href }): NotificationItem => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        body: row.body,
        url: href,
        actorName: row.actor?.displayName ?? null,
        createdAt: row.createdAt,
        isRead: row.isRead,
      }),
    )
}

export async function AppNav() {
  const [user, theme, request] = await Promise.all([currentUser(), readThemeSetting(), headers()])
  const apple = APPLE_UA.test(request.get('user-agent') ?? '')

  return (
    <header
      className="pad-inline sticky top-0 border-b border-border-hair bg-surface-2"
      style={{ zIndex: 'var(--z-sticky-nav)' }}
    >
      <ChromeStyles />

      <div
        className="mx-auto flex w-full max-w-detail items-center gap-xs"
        style={{ blockSize: 'var(--nav-h)' }}
      >
        <MobileNav
          theme={theme}
          account={user ? { handle: user.handle } : null}
        />

        <div className="me-sm flex shrink-0 items-center">
          <Wordmark size="lg" href="/discover" />
        </div>

        <nav aria-label="Primary" className="hidden h-full md:block">
          <NavLinks variant="bar" />
        </nav>

        <div className="ms-auto flex items-center gap-xs">
          <CommandPalette apple={apple} />

          {user ? (
            <>
              <NotificationBell
                items={bellRows(user.id)}
                unreadCount={getUnreadCount(user.id)}
                total={countNotifications(user.id)}
              />
              <Separator orientation="vertical" className="hidden h-lg md:block" />
              <div className="hidden md:block">
                <ThemeToggle initial={theme} />
              </div>
              <UserMenu
                userId={user.id}
                handle={user.handle}
                displayName={user.displayName}
                avatarUrl={user.avatarUrl}
                reputation={user.reputation}
              />
            </>
          ) : (
            <>
              <div className="hidden md:block">
                <ThemeToggle initial={theme} />
              </div>
              <AuthButton to="/sign-in" variant="secondary">
                Sign in
              </AuthButton>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

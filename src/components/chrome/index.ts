/**
 * Barrel for the app chrome. Surface code imports from '@/components/chrome'.
 *
 * Icon relevance notes (contract §5.6), recorded here because `design/` is not
 * this surface's to edit:
 *   Search  : the standard affordance for a search field. Jakob's Law applies
 *              to search above almost anything else.
 *   Bell    : the conventional glyph for pending messages. A dot would carry
 *              the state by shape alone, which §5.1 forbids.
 *   Menu    : the conventional glyph for a collapsed navigation list.
 *   Check   : the product's single completion glyph, used for "shipped".
 *   CircleAlert: carries validation and failure; it still reads at 16px where
 *              a triangle does not.
 *   User, LayoutDashboard, Settings, LogOut: the four account destinations,
 *              each the conventional glyph for its own route.
 */

export { AppNav } from './app-nav'
export { AuthButton, type AuthButtonProps } from './auth-button'
export { ChromeStyles } from './chrome-styles'
export { CommandPalette, type CommandPaletteProps } from './command-palette'
export { Footer } from './footer'
export { MobileNav, type MobileNavProps } from './mobile-nav'
export { resolveChromeHref, type ChannelLookup } from './links'
export { NavLinks, NAV_ITEMS, SECONDARY_ITEMS, type NavItem, type NavLinksProps } from './nav-links'
export { NotificationBell, type NotificationBellProps } from './notification-bell'
export {
  MarkAllReadButton,
  NotificationList,
  type NotificationListProps,
} from './notification-list'
export { readThemeSetting } from './theme-setting'
export { UserMenu, type UserMenuProps } from './user-menu'
export { Wordmark, type WordmarkProps } from './wordmark'
export type {
  CommandGroup,
  CommandGroupKey,
  CommandHit,
  CommandResults,
  NotificationGroup,
  NotificationItem,
  NotificationListItem,
  RecentHit,
} from './types'

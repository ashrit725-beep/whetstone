'use client'

/**
 * MobileNav: the primary links below 60rem, in a real modal `<dialog>`.
 *
 * Keyboard contract is the `Drawer` primitive's:
 *   Escape          closes and returns focus to the menu button.
 *   Tab / Shift+Tab cycle inside the sheet; everything behind it is inert.
 *   Enter           follows the focused link, and the sheet closes itself so
 *                   the reader is not left looking at a menu over the page
 *                   they just asked for.
 *
 * This is a `<dialog>` opened with `showModal()`, not a fixed div revealed by a
 * hamburger: the focus trap, the backdrop and the inert background are the
 * platform's, so they cannot drift out of sync with the rest of the product.
 *
 * The sheet carries two runs of links, not one. The bar holds three primary
 * destinations at every width; `/bounties` fits in neither the bar nor the
 * account menu, so without the second run it is unreachable from the chrome
 * altogether. Appearance is pinned to the sheet's own footer rather than left
 * floating in the middle of the column: the sheet is full height, and a menu
 * that stops a third of the way down with nothing under it reads as unfinished.
 *
 * Icon: `Menu` is the conventional glyph for a collapsed navigation list.
 */

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Drawer, ThemeToggle, type ThemeSetting } from '@/components/ui'
import { AuthButton } from './auth-button'
import { ChromeStyles } from './chrome-styles'
import { NavLinks, NAV_ITEMS, SECONDARY_ITEMS, type NavItem } from './nav-links'

export interface MobileNavProps {
  theme: ThemeSetting
  /** Null for a signed-out reader, who gets the two account calls instead. */
  account: { handle: string } | null
}

const HEADING = 'text-xs text-text-3'
const HEADING_AXES = { fontVariationSettings: '"wdth" 100, "wght" 600' } as const

export function MobileNav({ theme, account }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  const secondary: readonly NavItem[] = account
    ? [
        ...SECONDARY_ITEMS,
        { href: '/dashboard', label: 'Your dashboard' },
        { href: `/u/${account.handle}`, label: 'Your profile' },
        // The list the Save button on a project page writes to. The account
        // menu it lives in on a wide screen is not rendered at this width.
        { href: '/saved', label: 'Saved projects' },
      ]
    : SECONDARY_ITEMS

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open the main menu"
        className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-transparent text-text-2 transition-[color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border-control hover:bg-surface-3 hover:text-text-1 active:translate-y-px md:hidden"
      >
        <Menu size={20} strokeWidth={1.5} aria-hidden="true" />
      </button>

      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="Menu"
        side="left"
        size="sm"
        footer={
          <div className="flex w-full items-center justify-between gap-sm">
            <span className={HEADING} style={HEADING_AXES}>
              Appearance
            </span>
            <ThemeToggle initial={theme} showLabel className="ws-theme-word" />
          </div>
        }
      >
        <ChromeStyles />

        <nav aria-label="Main" className="-mx-md -mt-md">
          <NavLinks variant="stack" items={NAV_ITEMS} onNavigate={close} />
        </nav>

        <h3 className={`${HEADING} mt-lg mb-2xs`} style={HEADING_AXES}>
          Also here
        </h3>
        <nav aria-label="More destinations" className="-mx-md">
          <NavLinks variant="stack" items={secondary} onNavigate={close} />
        </nav>

        {account ? null : (
          <div className="mt-lg flex flex-col gap-xs">
            <h3 className={HEADING} style={HEADING_AXES}>
              Your account
            </h3>
            <AuthButton to="/sign-in" variant="secondary" fullWidth>
              Sign in
            </AuthButton>
            <AuthButton to="/sign-up" variant="primary" fullWidth>
              Create an account
            </AuthButton>
          </div>
        )}
      </Drawer>
    </>
  )
}

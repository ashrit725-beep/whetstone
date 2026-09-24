'use client'

/**
 * UserMenu: the account menu behind the avatar.
 *
 * Keyboard contract is the `DropdownMenu` primitive's (APG menu button):
 *   Enter / Space / ArrowDown open at the first item, ArrowUp at the last,
 *   arrows move and wrap, Home / End jump, a–z types ahead, Escape closes and
 *   returns focus to the avatar, Tab closes and moves on.
 *
 * The trigger's accessible name carries the whole identity, because the
 * menu's own heading is decorative to assistive technology: a reader who
 * cannot see the avatar still hears whose account this is before opening it.
 *
 * Icons: `User` for the person's own page, `Bookmark` for the saved shelf,
 * `LayoutDashboard` for the creator workspace, `Settings` for preferences,
 * `LogOut` for ending the session. Each is the conventional glyph for its
 * destination; none is decorative.
 */

import { useRouter } from 'next/navigation'
import { Bookmark, LayoutDashboard, LogOut, Settings, User } from 'lucide-react'
import {
  Avatar,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui'
import { signOut } from './actions'

export interface UserMenuProps {
  userId: string
  handle: string
  displayName: string
  avatarUrl: string | null
  /** Global credibility, 0–1000. Shown as a plain number, never a badge wall. */
  reputation: number
}

export function UserMenu({ userId, handle, displayName, avatarUrl, reputation }: UserMenuProps) {
  const router = useRouter()

  return (
    <DropdownMenu
      label="Your account"
      placement="bottom-end"
      trigger={
        <button
          type="button"
          aria-label={`Account menu for ${displayName}, @${handle}, ${String(reputation)} reputation`}
          className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-transparent transition-[background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border-control hover:bg-surface-3 active:translate-y-px"
        >
          <Avatar userId={userId} name={displayName} src={avatarUrl} size="md" />
        </button>
      }
    >
      <DropdownMenuLabel>
        <span className="flex flex-col gap-3xs py-2xs">
          <span className="text-sm text-text-1" style={{ fontVariationSettings: '"wdth" 100, "wght" 600' }}>
            {displayName}
          </span>
          <span className="text-xs text-text-3">
            @{handle}, <span className="tnum">{reputation.toLocaleString('en')}</span> reputation
          </span>
        </span>
      </DropdownMenuLabel>

      <DropdownMenuSeparator />

      <DropdownMenuItem icon={User} onSelect={() => router.push(`/u/${handle}`)}>
        View your profile
      </DropdownMenuItem>
      {/* The Save button on a project page says "Saved to your list"; this is
          the way to that list. */}
      <DropdownMenuItem icon={Bookmark} onSelect={() => router.push('/saved')}>
        Saved projects
      </DropdownMenuItem>
      <DropdownMenuItem icon={LayoutDashboard} onSelect={() => router.push('/dashboard')}>
        Open your dashboard
      </DropdownMenuItem>
      <DropdownMenuItem icon={Settings} onSelect={() => router.push('/settings/profile')}>
        Edit your settings
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuItem icon={LogOut} destructive onSelect={() => signOut()}>
        Sign out
      </DropdownMenuItem>
    </DropdownMenu>
  )
}

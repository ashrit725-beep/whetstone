'use client'

/**
 * The profile's tab strip.
 *
 * The tabs are real routes, so this uses `Tabs mode="links"`: anchors with
 * `aria-current="page"`, not ARIA tab roles. It is a Client Component for one
 * reason only, which is that the active tab is the current pathname, and that
 * keeps the header itself in the layout so it never re-renders on a tab change.
 *
 * Keyboard contract: a row of links. Tab moves, Enter follows. No roving
 * tabindex, because activating one of these navigates.
 */

import { usePathname } from 'next/navigation'
import { Tabs } from '@/components/ui'

export interface ProfileTabsProps {
  base: string
  counts: { projects: number; reviews: number }
}

export function ProfileTabs({ base, counts }: ProfileTabsProps) {
  const pathname = usePathname()
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : ''
  const section = rest.startsWith('/projects')
    ? 'projects'
    : rest.startsWith('/reviews')
      ? 'reviews'
      : rest.startsWith('/reputation')
        ? 'reputation'
        : 'overview'

  return (
    <Tabs
      mode="links"
      label="Profile sections"
      value={section}
      tabs={[
        { value: 'overview', label: 'Overview', href: base },
        { value: 'projects', label: 'Projects', href: `${base}/projects`, count: counts.projects },
        { value: 'reviews', label: 'Reviews', href: `${base}/reviews`, count: counts.reviews },
        { value: 'reputation', label: 'Reputation', href: `${base}/reputation` },
      ]}
    />
  )
}

export default ProfileTabs

/**
 * Settings: the same 16rem rail as the dashboard, with the same current-item
 * treatment, because a reader crossing between them should not have to learn a
 * second navigation.
 *
 * Auth is checked here and again inside every action: a layout redirect is a
 * convenience, never the authorisation.
 */

import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { DashboardRail, type RailItem } from '@/components/dashboard/dashboard-rail'

const SECTIONS: readonly RailItem[] = [
  { href: '/settings/profile', label: 'Profile', icon: 'profile' },
  { href: '/settings/account', label: 'Account', icon: 'settings' },
  { href: '/settings/notifications', label: 'Notifications', icon: 'bell' },
  { href: '/settings/appearance', label: 'Appearance', icon: 'appearance' },
]

const DANGER: readonly RailItem[] = [
  { href: '/settings/danger', label: 'Danger zone', icon: 'danger' },
]

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const claims = await currentClaimsLive()
  if (!claims) redirect('/sign-in?next=%2Fsettings%2Fprofile')

  return (
    // At least one screen tall beside the nav, so the rail's ground runs to the
    // footer on a short page. `h-full` did nothing here: <main> grows as a flex
    // item with no definite height, so the percentage resolved to auto and the
    // rail stopped a band short of the footer.
    <div
      className="md:grid md:min-h-[calc(100dvh-var(--nav-h))]"
      style={{ gridTemplateColumns: 'var(--container-rail) minmax(0, 1fr)' }}
    >
      <DashboardRail label="Settings" primary={SECTIONS} secondary={DANGER} />
      <div className="pad-inline flex min-w-0 flex-col gap-xl py-xl">{children}</div>
    </div>
  )
}

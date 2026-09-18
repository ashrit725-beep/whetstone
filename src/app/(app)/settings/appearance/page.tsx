/**
 * Appearance. One setting, stated plainly, plus an honest note about the one
 * people expect to find here and will not.
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { PageHeader } from '@/components/dashboard/section'
import { AppearanceForm } from '@/components/dashboard/settings-forms'

export const metadata: Metadata = { title: 'Appearance settings' }

export default async function AppearanceSettingsPage() {
  const claims = await currentClaimsLive()
  if (!claims) redirect('/sign-in?next=%2Fsettings%2Fappearance')

  // The cookie is the only thing the page renders from, so it is the only
  // thing the form reads. Falling back to the stored row checked "Dark" on a
  // browser rendering light, because the row was saved on another one.
  const jar = await cookies()
  const cookieTheme = jar.get('ws_theme')?.value
  const theme = cookieTheme === 'light' || cookieTheme === 'dark' ? cookieTheme : 'system'

  return (
    <>
      <PageHeader title="Appearance" lede="Follow your system, or pin Whetstone light or dark." />
      <div className="max-w-prose">
        <AppearanceForm theme={theme} />
      </div>
    </>
  )
}

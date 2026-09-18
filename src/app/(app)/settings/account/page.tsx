/**
 * Account settings: the handle your URL is built from, and the address you sign
 * in with.
 *
 * Email is displayed and not editable, and the field says so rather than
 * looking editable. Three preferences used to sit here (language, who can
 * message you, adult projects in Discover) that were saved and never read by
 * anything, so choosing one changed nothing. They are gone until something
 * reads them.
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { getUserById } from '@/server/repos/users'
import { PageHeader } from '@/components/dashboard/section'
import { AccountForm } from '@/components/dashboard/settings-forms'

export const metadata: Metadata = { title: 'Account settings' }

export default async function AccountSettingsPage() {
  const claims = await currentClaimsLive()
  if (!claims) redirect('/sign-in?next=%2Fsettings%2Faccount')

  const user = getUserById(claims.uid)

  return (
    <>
      <PageHeader
        title="Account"
        lede="Your handle and address on Whetstone."
      />
      <div className="max-w-prose">
        <AccountForm
          handle={user?.handle ?? claims.handle}
          email={user?.email ?? ''}
          emailVerified={Boolean(user?.email_verified_at)}
        />
      </div>
    </>
  )
}

/**
 * Profile settings: what other people see.
 *
 * Values come from the stored row, so the form is populated rather than empty,
 * and nothing in it is a placeholder pretending to be a label.
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { Link as UiLink } from '@/components/ui'
import { getProfileRow } from '@/server/repos/profiles'
import { PageHeader } from '@/components/dashboard/section'
import { ProfileForm } from '@/components/dashboard/settings-forms'

export const metadata: Metadata = { title: 'Profile settings' }

export default async function ProfileSettingsPage() {
  const claims = await currentClaimsLive()
  if (!claims) redirect('/sign-in?next=%2Fsettings%2Fprofile')

  const profile = getProfileRow(claims.uid)

  return (
    <>
      <PageHeader
        title="Profile"
        lede="What a reviewer reads before they decide whether to spend an hour on your build."
        aside={
          <UiLink href={`/u/${claims.handle}`} variant="standalone">
            See your public profile
          </UiLink>
        }
      />
      <div className="max-w-prose">
        <ProfileForm
          displayName={profile?.display_name ?? claims.handle}
          bio={profile?.bio ?? ''}
          pronouns={profile?.pronouns ?? ''}
          location={profile?.location ?? ''}
          availability={profile?.availability ?? 'open'}
          searchable={profile ? profile.is_searchable === 1 : true}
        />
      </div>
    </>
  )
}

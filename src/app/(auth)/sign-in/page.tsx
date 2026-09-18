/**
 * Sign in. Surface 9: one column, left-aligned, on `surface-1`, no card.
 * Boldness spent here: none, by design.
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Banner, Link } from '@/components/ui'
import { currentUser } from '@/server/queries/auth'
import { firstParam, safeNextPath, type RawSearchParams } from '../schema'
import { SignInForm } from '../_components/sign-in-form'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Whetstone to post a project, answer an ask, or work through your feedback inbox.',
  robots: { index: false, follow: true },
}

type Reason = 'session-expired' | 'password-changed' | 'signed-out-everywhere'

const REASONS: Record<Reason, { title: string; body: string }> = {
  'session-expired': {
    title: 'That session ended',
    body: 'Sessions last 30 days, and this one is past it. Signing in again picks up exactly where you were.',
  },
  'password-changed': {
    title: 'Your password was changed',
    body: 'Every other device was signed out at the same time. Sign in with the new password.',
  },
  'signed-out-everywhere': {
    title: 'Signed out everywhere',
    body: 'Every session on the account has ended, this one included, so a lost or shared device can no longer act as you. Sign in again to carry on.',
  },
}

function reasonOf(sp: RawSearchParams): Reason | null {
  const value = firstParam(sp['reason'])
  if (value === 'session-expired' || value === 'password-changed') return value
  // "Sign out everywhere" in settings lands here with the number of sessions it
  // ended. The number is not repeated: a query string is not a record of it.
  if (firstParam(sp['signed-out']) !== undefined) return 'signed-out-everywhere'
  return null
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const sp = await searchParams
  const next = safeNextPath(firstParam(sp['next']))
  const reason = reasonOf(sp)

  // Already signed in: go where they were headed rather than showing a form
  // that would sign them in as themselves.
  const viewer = await currentUser()
  if (viewer) redirect(next)

  const notice = reason ? REASONS[reason] : null

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-col gap-sm">
        <h1 className="text-2xl">Sign in</h1>
        <p className="measure-ui text-sm text-text-2">
          Your projects, your feedback inbox, and anything you were part way through reviewing.
        </p>
      </div>

      {notice ? (
        <Banner variant="info" title={notice.title} announce>
          {notice.body}
        </Banner>
      ) : null}

      <SignInForm next={next} />

      <p className="measure-ui text-sm text-text-2">
        No account yet?{' '}
        <Link href={`/sign-up?next=${encodeURIComponent(next)}`}>Create one</Link>.
      </p>
    </div>
  )
}

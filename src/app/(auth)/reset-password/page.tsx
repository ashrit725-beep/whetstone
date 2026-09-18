/**
 * Set a new password from a single-use link.
 *
 * The token is checked on the server before anything renders, so a dead link
 * never shows a form somebody fills in for nothing. A link that no longer works
 * is an expected state, not an error boundary: it gets an `EmptyState` saying
 * which of the four ways it failed, with the one action that fixes it.
 */

import type { Metadata } from 'next'
import { EmptyState } from '@/components/ui'
import { getAuthTokenState } from '@/server/repos/users'
import { hashToken } from '@/server/queries/auth'
import { RESET_TOKEN_MIN, firstParam, type RawSearchParams } from '../schema'
import { ResetForm } from '../_components/reset-form'

export const metadata: Metadata = {
  title: 'Set a new password',
  description: 'Finish resetting your Whetstone password.',
  robots: { index: false, follow: false },
  // The token is in this page's address, so no request to another site may
  // carry it in a Referer header. `same-origin` and not `no-referrer`: under
  // `no-referrer` a browser sends `Origin: null` with every POST, including this
  // page's own form, and Next refuses a Server Action whose Origin it cannot
  // parse, so setting the new password failed with a server error every time.
  referrer: 'same-origin',
}

type Dead = 'missing' | 'unknown' | 'expired' | 'retired'

const DEAD: Record<Dead, { title: string; body: string }> = {
  missing: {
    title: 'That link is incomplete',
    body: 'The address you arrived on has no token on it, which usually means the link was cut short when it was copied. Request a fresh one and open it directly from the email.',
  },
  unknown: {
    title: 'This link is not one we sent',
    body: 'The token on this address does not match any reset link. Open the link straight from the email, or request a new one.',
  },
  expired: {
    title: 'This reset link has expired',
    body: 'Reset links last 30 minutes, so this one can no longer open the form. Requesting another takes a moment.',
  },
  retired: {
    title: 'This reset link no longer works',
    body: 'Each link works once, and it is retired when a newer one is requested or when the account signs in with its password. Requesting another takes a moment.',
  },
}

/** Why this token cannot open the form, or null when it can. */
function whyDead(token: string): Dead | null {
  if (token.length === 0) return 'missing'
  if (token.length < RESET_TOKEN_MIN) return 'unknown'
  const state = getAuthTokenState(hashToken(token))
  // A token issued for another purpose is, as far as this page is concerned,
  // not a reset link at all.
  if (state.state === 'unknown' || state.purpose !== 'password_reset') return 'unknown'
  if (state.state === 'expired') return 'expired'
  if (state.state === 'consumed') return 'retired'
  return null
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const sp = await searchParams
  const token = firstParam(sp['token'])?.trim() ?? ''
  const dead = whyDead(token)

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-col gap-sm">
        <h1 className="text-2xl">Set a new password</h1>
        {dead === null ? (
          <p className="measure-ui text-sm text-text-2">
            Pick something you have not used elsewhere. Setting it signs out every other device on
            the account.
          </p>
        ) : null}
      </div>

      {dead === null ? (
        <ResetForm token={token} />
      ) : (
        <EmptyState
          headingLevel={2}
          title={DEAD[dead].title}
          body={DEAD[dead].body}
          primaryAction={{ label: 'Request a new link', href: '/forgot-password', primary: true }}
          secondaryAction={{ label: 'Back to sign in', href: '/sign-in' }}
        />
      )}
    </div>
  )
}

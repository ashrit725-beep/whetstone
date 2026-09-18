/**
 * Request a reset link. The response is identical whether or not the address
 * has an account, so this page cannot be used to enumerate members.
 *
 * A link can only be requested when it can be delivered. In production with no
 * mail provider and no outbox the form is not offered at all: a form that
 * answers "a link is on its way" when nothing will ever arrive is worse than no
 * form.
 */

import type { Metadata } from 'next'
import { connection } from 'next/server'
import { EmptyState } from '@/components/ui'
import { mailDelivery, type MailDelivery } from '@/server/mail'
import { ForgotForm } from '../_components/forgot-form'

export const metadata: Metadata = {
  title: 'Reset your password',
  description: 'Ask Whetstone for a single-use link that lets you set a new password.',
  robots: { index: false, follow: false },
}

/** What happens to the link, said before anyone types, for each way it can leave. */
const INTRO: Record<MailDelivery, string> = {
  provider: 'Give us the address on the account and we will email a link that sets a new password.',
  outbox:
    'Give us the address on the account and we will issue a link that sets a new password. This server keeps outgoing mail in an outbox instead of emailing it, so whoever runs it passes the link on.',
  log: 'Give us the address on the account and we will issue a link that sets a new password.',
}

export default async function ForgotPasswordPage() {
  // Mail configuration is read when the page is requested, never baked in at
  // build time, so setting a provider key takes effect on the next restart.
  await connection()
  const delivery = mailDelivery()

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-col gap-sm">
        <h1 className="text-2xl">Reset your password</h1>
        {delivery ? (
          <p className="measure-ui text-sm text-text-2">
            {INTRO[delivery]} The link works once and expires after 30 minutes.
          </p>
        ) : null}
      </div>

      {delivery ? (
        <ForgotForm />
      ) : (
        <EmptyState
          headingLevel={2}
          title="Reset links cannot be sent right now"
          body="A reset link has to arrive by email, and outgoing email is not set up on this server, so no link can be sent. Nothing about your account has changed. If you still know your password, sign in as usual."
          primaryAction={{ label: 'Back to sign in', href: '/sign-in', primary: true }}
        />
      )}
    </div>
  )
}

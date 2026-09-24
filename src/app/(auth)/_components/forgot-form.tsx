'use client'

/**
 * Request a password reset link.
 *
 * The answer is the same sentence whether or not the address has an account, so
 * this page cannot be used to find out who is registered. Only validation and
 * rate-limit failures are distinguishable, and neither depends on the account.
 * The one exception is development with no mail provider, where the link is
 * shown when there is one; production never returns it.
 *
 * Keyboard contract
 *   Tab reaches the field, then Send the link, then the escape hatch back to
 *   sign-in. On success the form is replaced by the confirmation, which is a
 *   polite live region, so the result is announced without moving focus.
 */

import { useState } from 'react'
import { Banner, Field, Form, Input, Link, SubmitButton } from '@/components/ui'
import { forgotPasswordAction } from '@/server/actions/auth'
import { asAuthState, idleAuthState, withNext } from '../schema'
import { useKeepFieldValues } from './keep-field-values'
import { useAuthFields } from './use-auth-fields'

export interface ForgotFormProps {
  /**
   * Where the reader was headed when they were sent to sign in, already
   * validated as a same-origin relative path by the page, or '' for nowhere in
   * particular. It rides the emailed link so that setting a new password ends
   * on the page they asked for, the way signing in does.
   */
  next: string
}

export function ForgotForm({ next }: ForgotFormProps) {
  return (
    <Form
      action={forgotPasswordAction}
      initialState={idleAuthState}
      summaryTitle="No link was sent."
    >
      {({ state }) => {
        const auth = asAuthState(state)
        if (auth.status === 'success') {
          return (
            <SentPanel
              message={auth.message ?? ''}
              mailed={auth.resetDelivery === 'provider'}
              devResetPath={auth.devResetPath}
              next={next}
            />
          )
        }
        return <ForgotFields serverErrors={auth.fieldErrors} next={next} />
      }}
    </Form>
  )
}

interface ForgotFieldsProps {
  serverErrors: Readonly<Record<string, string>> | undefined
  next: string
}

function ForgotFields({ serverErrors, next }: ForgotFieldsProps) {
  const [email, setEmail] = useState('')
  const fields = useAuthFields(serverErrors)
  useKeepFieldValues({ email })

  return (
    <>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field
        id="email"
        label="Email"
        hint="The address on the account. We answer the same way either way, so nothing here says whether an account exists."
        error={fields.errorFor('email')}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              fields.handleChange('email', event.target.value)
            }}
            onBlur={(event) => fields.handleBlur('email', event.target.value)}
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <div className="flex flex-wrap items-center gap-lg">
        <SubmitButton variant="primary" pendingLabel="Sending the link…">
          Send the reset link
        </SubmitButton>
        <Link href={withNext('/sign-in', next)} variant="standalone">
          Back to sign in
        </Link>
      </div>
    </>
  )
}

interface SentPanelProps {
  message: string
  /** True when a provider sent the link, so there is a mailbox to go and check. */
  mailed: boolean
  devResetPath?: string
  next: string
}

function SentPanel({ message, mailed, devResetPath, next }: SentPanelProps) {
  return (
    <div aria-live="polite" className="flex flex-col items-start gap-lg">
      <p className="measure-ui text-base text-text-1">{message}</p>
      {mailed ? (
        <p className="measure-ui text-sm text-text-2">
          Nothing arrived after a few minutes? Check the spam folder before asking for another:
          each new link retires the one before it.
        </p>
      ) : null}

      {devResetPath ? (
        <Banner
          variant="info"
          title="Reset link"
          action={{ label: 'Open the reset link', href: devResetPath, primary: true }}
          className="self-stretch"
        >
          Outside production the link is shown here as well, so a reset can be finished without
          a mailbox.
        </Banner>
      ) : null}

      <Link href={withNext('/sign-in', next)} variant="standalone">
        Back to sign in
      </Link>
    </div>
  )
}

export default ForgotForm

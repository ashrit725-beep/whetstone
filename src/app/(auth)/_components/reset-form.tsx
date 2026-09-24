'use client'

/**
 * Choose a new password.
 *
 * The page has already proved the token is live before rendering this, so a
 * dead link never shows a form somebody fills in for nothing. The token rides
 * in a hidden input rather than being re-typed (SC 3.3.7), and there is no
 * confirm-password field: the reveal toggle is the alternative (SC 3.3.8).
 *
 * Keyboard contract
 *   Tab reaches the password, then the reveal toggle, then Set the password,
 *   then Request a new link. A failed submit moves focus to the error summary
 *   above the field.
 */

import { useState } from 'react'
import { Form, Link, SubmitButton } from '@/components/ui'
import { resetPasswordAction } from '@/server/actions/auth'
import { idleAuthState, withNext } from '../schema'
import { useKeepFieldValues } from './keep-field-values'
import { PasswordField } from './password-field'
import { useAuthFields } from './use-auth-fields'

export interface ResetFormProps {
  token: string
  /**
   * Where to go once the password is set: the page the reader was headed for
   * when they were sent to sign in, carried this far by the emailed link, or
   * '' for nowhere in particular. The action validates it again before it
   * redirects anywhere.
   */
  next: string
}

export function ResetForm({ token, next }: ResetFormProps) {
  return (
    <Form
      action={resetPasswordAction}
      initialState={idleAuthState}
      summaryTitle="Your password was not changed."
    >
      {({ state }) => <ResetFields serverErrors={state.fieldErrors} token={token} next={next} />}
    </Form>
  )
}

interface ResetFieldsProps {
  serverErrors: Readonly<Record<string, string>> | undefined
  token: string
  next: string
}

function ResetFields({ serverErrors, token, next }: ResetFieldsProps) {
  const [password, setPassword] = useState('')
  const fields = useAuthFields(serverErrors)
  useKeepFieldValues({ 'new-password': password })

  return (
    <>
      <input type="hidden" name="token" value={token} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <PasswordField
        id="new-password"
        name="password"
        label="New password"
        autoComplete="new-password"
        error={fields.errorFor('new-password')}
        value={password}
        onValueChange={(value) => {
          setPassword(value)
          fields.handleChange('new-password', value)
        }}
        onBlur={() => fields.handleBlur('new-password', password)}
        showStrength
      />

      <div className="flex flex-wrap items-center gap-lg">
        <SubmitButton variant="primary" pendingLabel="Setting the password…">
          Set the password
        </SubmitButton>
        {/* The link can die between the page render and the submit, so the way
            to ask for another one stays on screen throughout. */}
        <Link href={withNext('/forgot-password', next)} variant="standalone">
          Request a new link
        </Link>
      </div>

      <p className="measure-ui text-xs text-text-3">
        Setting a new password signs out every other device on the account, and signs this one in.
      </p>
    </>
  )
}

export default ResetForm

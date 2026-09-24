'use client'

/**
 * Sign in.
 *
 * A real <form> posting to `signInAction`, so it works with JavaScript off; the
 * client adds blur validation and the reveal toggle on top.
 *
 * Keyboard contract
 *   Tab order is email → password → reveal → stay signed in → Sign in →
 *   Reset your password. Enter submits from either text field. A failed submit
 *   moves focus to the error summary above the fields, and each entry in it is
 *   a link to the field it names.
 */

import { useState } from 'react'
import { Checkbox, Field, Form, Input, Link, SubmitButton } from '@/components/ui'
import { signInAction } from '@/server/actions/auth'
import { idleAuthState, withNext } from '../schema'
import { useKeepFieldValues } from './keep-field-values'
import { PasswordField } from './password-field'
import { useAuthFields } from './use-auth-fields'

export interface SignInFormProps {
  /** Already validated as a same-origin relative path by the page. */
  next: string
}

export function SignInForm({ next }: SignInFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <Form action={signInAction} initialState={idleAuthState} summaryTitle="You were not signed in.">
      {({ state }) => (
        <SignInFields
          serverErrors={state.fieldErrors}
          email={email}
          password={password}
          setEmail={setEmail}
          setPassword={setPassword}
          next={next}
        />
      )}
    </Form>
  )
}

interface SignInFieldsProps {
  serverErrors: Readonly<Record<string, string>> | undefined
  email: string
  password: string
  setEmail: (value: string) => void
  setPassword: (value: string) => void
  next: string
}

/**
 * A component rather than inline JSX, so the validation hook is called
 * unconditionally instead of inside `Form`'s render callback.
 */
function SignInFields({
  serverErrors,
  email,
  password,
  setEmail,
  setPassword,
  next,
}: SignInFieldsProps) {
  const fields = useAuthFields(serverErrors)
  useKeepFieldValues({ email, password })

  return (
    <>
      <input type="hidden" name="next" value={next} />

      <Field id="email" label="Email" error={fields.errorFor('email')}>
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

      <PasswordField
        id="password"
        name="password"
        label="Password"
        autoComplete="current-password"
        error={fields.errorFor('password')}
        value={password}
        onValueChange={(value) => {
          setPassword(value)
          fields.handleChange('password', value)
        }}
        onBlur={() => fields.handleBlur('password', password)}
      />

      <Checkbox
        id="stay"
        name="stay"
        label="Stay signed in on this device"
        description="Leave this off and you are signed out when the browser closes, or after 24 hours at most."
      />

      <div className="flex flex-wrap items-center gap-lg">
        <SubmitButton variant="primary" pendingLabel="Signing you in…">
          Sign in
        </SubmitButton>
        {/* The reset path carries the destination too, so somebody who was sent
            here from a page they wanted lands on it after setting a password
            rather than on Discover. "Create one" under this form does the same,
            and `withNext` is the one place that decides when to attach it. */}
        <Link href={withNext('/forgot-password', next)} variant="standalone">
          Reset your password
        </Link>
      </div>
    </>
  )
}

export default SignInForm

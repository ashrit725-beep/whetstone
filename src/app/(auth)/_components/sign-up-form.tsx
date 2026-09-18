'use client'

/**
 * Create an account.
 *
 * A real <form> posting to `signUpAction`. With JavaScript off it still posts
 * and still validates, because the Server Action runs the same Zod module the
 * client uses; availability is re-checked there too, since it is racy.
 *
 * Keyboard contract
 *   Tab order is display name → handle → email → password → reveal → Create
 *   account. The handle's live result is announced politely, never by moving
 *   focus, so it cannot interrupt typing.
 */

import { useEffect, useState } from 'react'
import { Field, Form, Input, Link, SubmitButton } from '@/components/ui'
import { checkHandleAction, signUpAction } from '@/server/actions/auth'
import { HANDLE_MAX, HANDLE_RULE, checkField, idleAuthState } from '../schema'
import { useKeepFieldValues } from './keep-field-values'
import { PasswordField } from './password-field'
import { useAuthFields } from './use-auth-fields'

export interface SignUpFormProps {
  next: string
}

export function SignUpForm({ next }: SignUpFormProps) {
  return (
    <Form
      action={signUpAction}
      initialState={idleAuthState}
      summaryTitle="This account was not created."
    >
      {({ state }) => <SignUpFields serverErrors={state.fieldErrors} next={next} />}
    </Form>
  )
}

interface SignUpFieldsProps {
  serverErrors: Readonly<Record<string, string>> | undefined
  next: string
}

type HandleStatus =
  | { kind: 'idle' }
  | { kind: 'checking'; handle: string }
  | { kind: 'free'; handle: string }
  | { kind: 'taken'; handle: string }
  | { kind: 'note'; message: string }

function SignUpFields({ serverErrors, next }: SignUpFieldsProps) {
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [handleStatus, setHandleStatus] = useState<HandleStatus>({ kind: 'idle' })

  const fields = useAuthFields(serverErrors)
  const { setError } = fields
  useKeepFieldValues({
    'display-name': displayName,
    handle,
    'new-email': email,
    'new-password': password,
  })

  /**
   * Debounced availability. The timer is cleared on every change and on
   * unmount, and a late answer for an abandoned handle is dropped, so the
   * status line can never describe a handle that is no longer in the field.
   */
  useEffect(() => {
    const typed = handle.trim().replace(/^@/, '').toLowerCase()
    if (typed.length === 0 || checkField('handle', typed) !== null) {
      setHandleStatus({ kind: 'idle' })
      return
    }

    setHandleStatus({ kind: 'checking', handle: typed })
    let cancelled = false

    const timer = window.setTimeout(() => {
      void checkHandleAction(typed).then((result) => {
        if (cancelled) return
        if (result.status === 'available') {
          setHandleStatus({ kind: 'free', handle: result.handle })
          setError('handle', null)
          return
        }
        if (result.status === 'taken') {
          const tail =
            result.suggestions.length > 0 ? ` Free right now: ${result.suggestions.join(', ')}.` : ''
          setHandleStatus({ kind: 'taken', handle: result.handle })
          setError('handle', `The handle ${result.handle} is taken.${tail}`)
          return
        }
        setHandleStatus({ kind: 'note', message: result.message })
      })
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [handle, setError])

  return (
    <>
      <input type="hidden" name="next" value={next} />

      <Field id="display-name" label="Display name" error={fields.errorFor('display-name')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="displayName"
            type="text"
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value)
              fields.handleChange('display-name', event.target.value)
            }}
            onBlur={(event) => fields.handleBlur('display-name', event.target.value)}
            autoComplete="name"
            maxLength={60}
            required
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field
        id="handle"
        label="Handle"
        hint={<HandleHint status={handleStatus} />}
        error={fields.errorFor('handle')}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="handle"
            type="text"
            value={handle}
            onChange={(event) => {
              setHandle(event.target.value)
              fields.handleChange('handle', event.target.value)
            }}
            onBlur={(event) => fields.handleBlur('handle', event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={HANDLE_MAX}
            required
            aria-describedby={describedBy}
            invalid={invalid}
            success={handleStatus.kind === 'free'}
          />
        )}
      </Field>

      <Field id="new-email" label="Email" error={fields.errorFor('new-email')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              fields.handleChange('new-email', event.target.value)
            }}
            onBlur={(event) => fields.handleBlur('new-email', event.target.value)}
            autoComplete="email"
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
        id="new-password"
        name="password"
        label="Password"
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

      {/* The wrapper is what keeps the button at its own width. As a direct
          child of the form's flex column it would stretch to the full 24rem,
          which is both a different shape from the sign-in button on the same
          surface and a size the loading skeleton cannot honestly stand in for. */}
      <div className="flex flex-wrap items-center gap-lg">
        <SubmitButton variant="primary" pendingLabel="Creating your account…">
          Create account
        </SubmitButton>
      </div>

      <p className="measure-ui text-xs text-text-3">
        Creating an account accepts the{' '}
        <Link href="/legal/terms">terms</Link> and the{' '}
        <Link href="/legal/privacy">privacy notice</Link>.
      </p>
    </>
  )
}

/**
 * The handle's guidance block: the naming rule, then one reserved line that
 * carries the profile address and the availability verdict.
 *
 * It sits in the hint slot, above the control, for a geometric reason. `Field`
 * already reserves 1lh below every control for the error slot; a second
 * reserved region below the handle would have made the distance from this
 * control to the next label half again the distance everywhere else, and that
 * broken rhythm is the first thing the eye reads in a column of four fields.
 * Above the control the reservation costs nothing: the label-to-control
 * distance already varies with whether a field has a rule to state.
 *
 * Exactly one line box is reserved, and every reachable message is written to
 * fit it at 320px, so the verdict lands without moving anything. The positive
 * confirmation is carried by the word “free” and by the check glyph `Input`
 * draws in its own trailing slot, never by colour alone.
 */
function HandleHint({ status }: { status: HandleStatus }) {
  return (
    <>
      <span className="block">{HANDLE_RULE}</span>
      <span aria-live="polite" style={{ minHeight: '1lh' }} className="block text-text-3">
        {status.kind === 'idle' ? (
          'Your profile address appears here as you type.'
        ) : status.kind === 'checking' ? (
          <>Checking /u/{status.handle}…</>
        ) : status.kind === 'free' ? (
          <span className="text-positive">/u/{status.handle} is free.</span>
        ) : status.kind === 'taken' ? (
          <>/u/{status.handle}</>
        ) : (
          status.message
        )}
      </span>
    </>
  )
}

export default SignUpForm

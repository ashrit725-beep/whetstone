'use client'

/**
 * The password field, with the reveal toggle in the permanently reserved
 * right-edge slot and, on sign-up and reset, a real `<meter>` beside it.
 *
 * Keyboard contract
 *   Tab reaches the field, then the reveal toggle, then whatever follows. The
 *   toggle is a real <button>, so Space and Enter both flip it, and its
 *   accessible name states the action it will perform next.
 *   Paste is never intercepted (SC 3.3.8). There is no confirm-password field
 *   anywhere in Whetstone (SC 3.3.7); the reveal toggle is the alternative.
 *
 * Geometry
 *   The strength block is drawn whether or not anything is typed, so the meter
 *   appearing costs zero layout shift, and the rule is legible before the first
 *   keystroke rather than after the first rejection.
 *
 * One statement of the rule at a time
 *   The length rule lives in the strength note, not in a hint above the control:
 *   before typing the note states it, while typing it counts down to it, and
 *   once a validation error states it the note keeps only its verdict word. A
 *   hint, an error and the note used to say "12 characters" three times at
 *   once, and hiding a hint above the control would have moved the control.
 */

import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Field, Input, Meter } from '@/components/ui'
import { PASSWORD_MIN, passwordStrength } from '../schema'

export interface PasswordFieldProps {
  /** Also the Field id the error summary links to. */
  id: 'password' | 'new-password'
  name: string
  label: string
  autoComplete: 'current-password' | 'new-password'
  error?: string | null
  value: string
  onValueChange: (value: string) => void
  onBlur?: () => void
  /** Draws the strength meter. Sign-up and reset only; sign-in never grades. */
  showStrength?: boolean
}

export function PasswordField({
  id,
  name,
  label,
  autoComplete,
  error,
  value,
  onValueChange,
  onBlur,
  showStrength = false,
}: PasswordFieldProps) {
  const [revealed, setRevealed] = useState(false)
  const noteId = useId()
  const strength = passwordStrength(value)

  const toggle = (
    <button
      type="button"
      onClick={() => setRevealed((r) => !r)}
      aria-label={revealed ? 'Hide the password' : 'Show the password'}
      className="tap-44 inline-flex items-center justify-center rounded-sm text-text-3 transition-[color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-text-1"
    >
      {revealed ? (
        <EyeOff size={20} strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <Eye size={20} strokeWidth={1.5} aria-hidden="true" />
      )}
    </button>
  )

  return (
    <div className="flex flex-col gap-xs">
      <Field id={id} label={label} error={error}>
        {({ id: fieldId, describedBy, invalid }) => (
          <Input
            id={fieldId}
            name={name}
            type={revealed ? 'text' : 'password'}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onBlur={onBlur}
            autoComplete={autoComplete}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            minLength={autoComplete === 'new-password' ? PASSWORD_MIN : undefined}
            required
            invalid={invalid}
            aria-describedby={
              showStrength ? [describedBy, noteId].filter(Boolean).join(' ') : describedBy
            }
            trailingSlot={toggle}
          />
        )}
      </Field>

      {showStrength ? (
        <div className="flex flex-col gap-2xs">
          <Meter
            label="Password strength"
            value={strength.score}
            min={0}
            max={4}
            optimum={3}
            valueText={`Password strength: ${strength.word}, ${strength.score} of 4.`}
          />
          <p id={noteId} className="measure-ui text-xs text-text-2" style={{ minHeight: '2lh' }}>
            <span className="text-text-1">{strength.word}.</span>
            {error ? null : ` ${strength.advice}`}
          </p>
        </div>
      ) : null}
    </div>
  )
}

export default PasswordField

'use client'

/**
 * Field
 *
 * The wrapper every labelled control in Whetstone uses. It owns the id, the
 * visible label, the optional hint, and the helper slot.
 *
 * Keyboard contract
 *   Field adds no key handling of its own. Clicking the label moves focus to the
 *   control it names (native label association through htmlFor).
 *   The helper slot reserves 1lh at all times, so an error appearing after blur
 *   never shifts the control, the page, or the focus ring under the pointer.
 *
 * Accessibility
 *   Visible <label> above the control, always. Placeholder as label is banned.
 *   aria-describedby is composed from the hint, the error, and the disabled
 *   reason, in reading order. aria-invalid is set from `error`.
 *   The helper slot is aria-live="polite" so a late validation result is spoken
 *   without stealing focus.
 */

import { useId, type ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FieldRenderArgs {
  /** Put this on the control. The error summary links to it. */
  id: string
  /** Space separated id list, or undefined when there is nothing to describe. */
  describedBy: string | undefined
  invalid: boolean
  required: boolean
  disabled: boolean
}

export interface FieldProps {
  /** Always rendered, always visible. */
  label: ReactNode
  /** Sits between the label and the control. Use it for input rules, not for errors. */
  hint?: ReactNode
  /** Present means invalid. Replaces the hint slot content and colours the control. */
  error?: string | null
  required?: boolean
  /** Marks the field with the word "optional". Mutually exclusive with `required`. */
  optional?: boolean
  disabled?: boolean
  /** Visible sentence saying why the control is unavailable. */
  disabledReason?: string
  /** Stable id. Pass one when a server action returns field errors keyed by name. */
  id?: string
  className?: string
  children: (args: FieldRenderArgs) => ReactNode
}

export function Field({
  label,
  hint,
  error,
  required = false,
  optional = false,
  disabled = false,
  disabledReason,
  id,
  className,
  children,
}: FieldProps) {
  const reactId = useId()
  const fieldId = id ?? `${reactId}-field`
  const hintId = hint ? `${fieldId}-hint` : undefined
  const errorId = error ? `${fieldId}-error` : undefined
  const reasonId = disabled && disabledReason ? `${fieldId}-reason` : undefined

  const describedBy =
    [hintId, errorId, reasonId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-2xs', className)}>
      <label
        htmlFor={fieldId}
        className="inline-flex flex-wrap items-baseline gap-xs font-ui text-base text-text-1"
      >
        {label}
        {required ? (
          <span className="text-xs text-text-3">required</span>
        ) : optional ? (
          <span className="text-xs text-text-3">optional</span>
        ) : null}
      </label>

      {hint ? (
        <p id={hintId} className="measure-ui text-xs text-text-2">
          {hint}
        </p>
      ) : null}

      {children({ id: fieldId, describedBy, invalid: Boolean(error), required, disabled })}

      <FieldHelper
        errorId={errorId}
        error={error}
        reasonId={reasonId}
        reason={reasonId ? disabledReason : undefined}
      />
    </div>
  )
}

export interface FieldHelperProps {
  errorId?: string
  error?: string | null
  reasonId?: string
  reason?: string
  className?: string
}

/**
 * The permanently reserved helper slot. It keeps 1lh of height whether or not it
 * has content, so nothing below it moves when validation lands.
 */
export function FieldHelper({
  errorId,
  error,
  reasonId,
  reason,
  className,
}: FieldHelperProps) {
  return (
    <div
      aria-live="polite"
      style={{ minHeight: '1lh' }}
      className={cn('measure-ui text-xs', className)}
    >
      {error ? (
        <p id={errorId} className="flex items-start gap-2xs text-critical">
          <CircleAlert
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
            className="mt-3xs shrink-0"
          />
          <span>{error}</span>
        </p>
      ) : reason ? (
        <p id={reasonId} className="text-text-3">
          {reason}
        </p>
      ) : null}
    </div>
  )
}

export default Field

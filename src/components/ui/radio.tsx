'use client'

/**
 * Radio and RadioGroup
 *
 * Real <input type="radio"> elements inside a <fieldset> with a visible <legend>,
 * so the group name is announced before the first option.
 *
 * Keyboard contract
 *   Tab           moves into the group, landing on the checked radio, or on the
 *                 first one when nothing is checked. A second Tab leaves the group.
 *   Arrow keys    move between options and select as they go. This is the native
 *                 radio behaviour; no roving tabindex is hand built here.
 *   Space         selects the focused option.
 *
 * The visual dot is 20px; `tap-44` grows the hit area to 44x44.
 *
 * The control is drawn from the tokens rather than left to the platform. A
 * native radio under `color-scheme: dark` is Chrome's neutral grey disc, the
 * only cold object on the warm paper, and beside a filled checked radio it
 * read as disabled. Checked is an ink disc with a paper ring, the same ink
 * that marks every other selection. Forced-colours mode gets the system
 * control back, because a drawn control loses its edges there.
 */

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import { FieldHelper } from './field'

export interface RadioProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label: ReactNode
  description?: ReactNode
  wrapperClassName?: string
}

const RADIO = cn(
  'tap-44 size-5 shrink-0 appearance-none rounded-full border-[1.5px] border-border-control bg-surface-2',
  'transition-[border-color,background-color,box-shadow] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
  'checked:border-ink checked:bg-ink checked:shadow-[inset_0_0_0_4px_var(--color-surface-2)]',
  'disabled:border-border-hair disabled:bg-surface-0',
  'disabled:checked:bg-text-disabled disabled:checked:shadow-[inset_0_0_0_4px_var(--color-surface-0)]',
  'forced-colors:appearance-auto',
)

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, description, disabled, className, wrapperClassName, ...rest },
  ref,
) {
  return (
    <label
      className={cn(
        'flex min-h-11 items-start gap-sm py-2xs',
        disabled ? 'cursor-not-allowed text-text-disabled' : 'cursor-pointer text-text-1',
        wrapperClassName,
      )}
    >
      <span className="flex h-6 shrink-0 items-center">
        <input
          {...rest}
          type="radio"
          ref={ref}
          disabled={disabled}
          className={cn(
            RADIO,
            disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:border-border-strong',
            className,
          )}
        />
      </span>
      <span className="flex flex-col gap-3xs">
        <span className="font-ui text-base leading-6">{label}</span>
        {description ? (
          <span className={cn('measure-ui text-xs', disabled ? 'text-text-disabled' : 'text-text-2')}>
            {description}
          </span>
        ) : null}
      </span>
    </label>
  )
})

export interface RadioOption {
  value: string
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}

export interface RadioGroupProps {
  /** Visible legend. The group is never labelled by a floating heading. */
  legend: ReactNode
  name: string
  options: readonly RadioOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  hint?: ReactNode
  error?: string | null
  required?: boolean
  disabled?: boolean
  disabledReason?: string
  className?: string
}

export function RadioGroup({
  legend,
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  hint,
  error,
  required = false,
  disabled = false,
  disabledReason,
  className,
}: RadioGroupProps) {
  const reactId = useId()
  const hintId = hint ? `${reactId}-hint` : undefined
  const errorId = error ? `${reactId}-error` : undefined
  const reasonId = disabled && disabledReason ? `${reactId}-reason` : undefined
  const describedBy = [hintId, errorId, reasonId].filter(Boolean).join(' ') || undefined

  return (
    <fieldset
      className={cn('m-0 flex flex-col gap-2xs border-0 p-0', className)}
      aria-describedby={describedBy}
      aria-invalid={Boolean(error) || undefined}
      aria-required={required || undefined}
      disabled={disabled}
    >
      <legend className="inline-flex flex-wrap items-baseline gap-xs p-0 font-ui text-base text-text-1">
        {legend}
        {required ? <span className="text-xs text-text-3">required</span> : null}
      </legend>

      {hint ? (
        <p id={hintId} className="measure-ui text-xs text-text-2">
          {hint}
        </p>
      ) : null}

      <div className="flex flex-col gap-xs">
        {options.map((option) => (
          <Radio
            key={option.value}
            name={name}
            value={option.value}
            label={option.label}
            description={option.description}
            disabled={disabled || option.disabled}
            checked={value === undefined ? undefined : value === option.value}
            defaultChecked={value === undefined ? defaultValue === option.value : undefined}
            onChange={(event) => {
              if (event.target.checked) onValueChange?.(option.value)
            }}
          />
        ))}
      </div>

      <FieldHelper
        errorId={errorId}
        error={error}
        reasonId={reasonId}
        reason={reasonId ? disabledReason : undefined}
      />
    </fieldset>
  )
}

export default Radio

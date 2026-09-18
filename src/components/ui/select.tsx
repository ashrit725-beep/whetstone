/**
 * Select
 *
 * A real <select>. There is no div listbox in Whetstone: the platform control
 * already gives us the typeahead, the mobile wheel, and the screen reader
 * announcement, and every hand-built replacement loses at least one of them.
 *
 * Keyboard contract
 *   Tab / Shift+Tab   move focus.
 *   Up / Down         change the selected option (collapsed, on every platform).
 *   Alt+Down / Space  open the native popup where the platform supports it.
 *   Home / End        first and last option.
 *   Typing            jumps to the first option starting with those characters.
 *   Escape            closes the popup without committing.
 *
 * Geometry matches Input exactly: 44px tall, 1px border, and the same reserved
 * trailing slot, here holding the chevron.
 */

import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { controlClasses } from './input'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  invalid?: boolean
  success?: boolean
  /** Options as data. Pass `children` instead when you need optgroups. */
  options?: readonly SelectOption[]
  /**
   * First entry, rendered disabled and selected when the field is empty. This is
   * a prompt, not a label: the visible <label> above the control is mandatory.
   */
  placeholderOption?: string
  wrapperClassName?: string
  children?: ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    invalid,
    success,
    options,
    placeholderOption,
    wrapperClassName,
    className,
    disabled,
    children,
    ...rest
  },
  ref,
) {
  return (
    <span className={cn('relative block', wrapperClassName)}>
      <select
        {...rest}
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          controlClasses({ invalid, disabled, success }),
          'h-11 appearance-none px-sm pr-2xl',
          className,
        )}
      >
        {placeholderOption ? (
          <option value="" disabled>
            {placeholderOption}
          </option>
        ) : null}
        {options?.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-sm inline-flex w-6 items-center justify-center">
        <ChevronDown
          size={20}
          strokeWidth={1.5}
          aria-hidden="true"
          className={disabled ? 'text-text-disabled' : 'text-text-2'}
        />
      </span>
    </span>
  )
})

export default Select

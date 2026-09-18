/**
 * Input
 *
 * Keyboard contract
 *   Tab / Shift+Tab move focus. All native text editing keys apply. Paste is
 *   never intercepted (SC 3.3.8).
 *   Focus ring is the global 2px straw outline at 1px offset for fields, and the
 *   resting `outline: 2px solid transparent` in globals.css means focusing never
 *   changes the field's geometry.
 *
 * Geometry
 *   44px tall, >=1rem text so iOS Safari does not zoom on focus, 1px border in
 *   every state (only its colour changes), and a permanently reserved 24px slot
 *   on the trailing edge for a validation icon or a show/hide toggle.
 */

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { Check, CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ControlToneArgs {
  invalid?: boolean
  disabled?: boolean
  readOnly?: boolean
  success?: boolean
}

const CONTROL_BASE = cn(
  'w-full rounded-sm border bg-surface-0 font-ui text-base text-text-1',
  'transition-[color,background-color,border-color] duration-[80ms] ease-[cubic-bezier(0.4,0,1,1)]',
  'hover:duration-[120ms] hover:ease-[cubic-bezier(0.16,1,0.3,1)]',
)

/** Shared border and fill logic for input, textarea, and select. */
export function controlClasses({
  invalid,
  disabled,
  readOnly,
  success,
}: ControlToneArgs): string {
  if (disabled) {
    return cn(CONTROL_BASE, 'cursor-not-allowed border-border-control bg-surface-2 text-text-disabled')
  }
  if (invalid) return cn(CONTROL_BASE, 'border-critical')
  if (readOnly) return cn(CONTROL_BASE, 'border-border-control bg-surface-2 text-text-2')
  if (success) return cn(CONTROL_BASE, 'border-positive hover:border-border-strong')
  return cn(CONTROL_BASE, 'border-border-control hover:border-border-strong')
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  invalid?: boolean
  /** Confirmed valid after an async check. Draws a positive border and a check glyph. */
  success?: boolean
  /** Interactive content for the reserved trailing slot, such as a show/hide toggle. */
  trailingSlot?: ReactNode
  /** Applies to the wrapper, not the field. */
  wrapperClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, success, trailingSlot, wrapperClassName, className, disabled, readOnly, ...rest },
  ref,
) {
  const statusIcon = invalid ? (
    <CircleAlert size={20} strokeWidth={1.5} aria-hidden="true" className="text-critical" />
  ) : success ? (
    <Check size={20} strokeWidth={1.5} aria-hidden="true" className="text-positive" />
  ) : null

  return (
    <span className={cn('relative block', wrapperClassName)}>
      <input
        {...rest}
        ref={ref}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={invalid || undefined}
        className={cn(
          controlClasses({ invalid, disabled, readOnly, success }),
          'h-11 px-sm pr-2xl',
          className,
        )}
      />
      <span
        className={cn(
          'absolute inset-y-0 right-sm inline-flex w-6 items-center justify-center',
          trailingSlot ? null : 'pointer-events-none',
        )}
      >
        {trailingSlot ?? statusIcon}
      </span>
    </span>
  )
})

export default Input

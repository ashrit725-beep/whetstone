'use client'

/**
 * Switch
 *
 * A real checkbox carrying role="switch", visually hidden, with the track and
 * thumb drawn as its siblings. Keeping the native input means the label
 * association, the form value, and the toggle key all come from the platform.
 *
 * Keyboard contract
 *   Tab / Shift+Tab   move focus. The ring is drawn on the track through
 *                     peer-focus-visible, because the input itself is hidden.
 *   Space             toggles.
 *   Clicking anywhere in the row toggles, because the row is the <label>.
 *
 * Copy rule: the label names what the switch does ("Email me when feedback
 * arrives"), never "on" or "off". A switch applies instantly, so it is never
 * paired with a save button, and no screen carries more than three of them.
 *
 * The 44x24 track with an 8px gap to its neighbour clears SC 2.5.8 on its own;
 * the row is 44px tall so the whole line is the target.
 */

import {
  forwardRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import { FieldHelper } from './field'

export interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'onChange'> {
  /** What the switch does. Never "on" or "off". */
  label: ReactNode
  description?: ReactNode
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  error?: string | null
  disabledReason?: string
  /** Applies to the row. */
  wrapperClassName?: string
}

const TRACK = cn(
  'pointer-events-none absolute inset-0 rounded-xs border',
  'border-border-control bg-surface-0',
  'transition-[background-color,border-color] duration-[80ms] ease-[cubic-bezier(0.4,0,1,1)]',
  'peer-hover:border-border-strong peer-hover:duration-[120ms] peer-hover:ease-[cubic-bezier(0.16,1,0.3,1)]',
  'peer-checked:border-ink peer-checked:bg-ink',
  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
  'peer-disabled:border-border-control peer-disabled:bg-surface-2',
)

const THUMB = cn(
  'pointer-events-none absolute left-3xs top-3xs size-5 rounded-xs bg-border-strong',
  'transition-transform duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
  'peer-checked:translate-x-5 peer-checked:bg-btn-ink',
  'peer-disabled:bg-text-disabled',
)

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  {
    label,
    description,
    checked,
    defaultChecked = false,
    onCheckedChange,
    error,
    disabled,
    disabledReason,
    id,
    className,
    wrapperClassName,
    ...rest
  },
  ref,
) {
  const controlled = checked !== undefined
  const [internal, setInternal] = useState(defaultChecked)
  const isOn = checked ?? internal

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!controlled) setInternal(event.target.checked)
    onCheckedChange?.(event.target.checked)
  }

  const errorId = error && id ? `${id}-error` : undefined
  const reasonId = disabled && disabledReason && id ? `${id}-reason` : undefined
  const describedBy = [errorId, reasonId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col', wrapperClassName)}>
      <label
        className={cn(
          'flex min-h-11 items-center justify-between gap-md py-2xs',
          disabled ? 'cursor-not-allowed text-text-disabled' : 'cursor-pointer text-text-1',
        )}
      >
        <span className="flex flex-col gap-3xs">
          <span className="font-ui text-base">{label}</span>
          {description ? (
            <span
              className={cn(
                'measure-ui text-xs',
                disabled ? 'text-text-disabled' : 'text-text-2',
              )}
            >
              {description}
            </span>
          ) : null}
        </span>

        <span className="relative inline-block h-6 w-11 shrink-0">
          <input
            {...rest}
            type="checkbox"
            role="switch"
            id={id}
            ref={ref}
            checked={isOn}
            disabled={disabled}
            aria-checked={isOn}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy}
            onChange={handleChange}
            className={cn('peer sr-only', className)}
          />
          <span aria-hidden="true" className={TRACK} />
          <span aria-hidden="true" className={THUMB} />
        </span>
      </label>

      <FieldHelper
        errorId={errorId}
        error={error}
        reasonId={reasonId}
        reason={reasonId ? disabledReason : undefined}
      />
    </div>
  )
})

export default Switch

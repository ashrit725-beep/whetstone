'use client'

/**
 * Checkbox
 *
 * A real <input type="checkbox">, drawn from the tokens. Contract 5.5 left it
 * to the platform with `accent-color`, but under `color-scheme: dark` Chrome
 * paints an unchecked box as a neutral grey tile, the one cold object on the
 * warm paper, and it read as disabled. The box is the input itself, so focus,
 * the checked and indeterminate states, and form posting are all still the
 * platform's; only the tick and the dash are drawn over it. Checked is ink,
 * as every selection is; the mark stays the ask's. Forced-colours mode gets
 * the system control back, because a drawn box loses its edges there.
 *
 * Keyboard contract
 *   Tab / Shift+Tab   move focus to and from the box.
 *   Space             toggles. Indeterminate resolves to checked on the first press.
 *   Clicking anywhere in the label row toggles, because the row is the <label>.
 *
 * The visual box is 20px; `tap-44` grows the hit area to 44x44 without changing
 * the drawn size. Stack rows with at least `gap-xs` so neighbouring targets keep
 * their 8px separation.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FieldHelper } from './field'

const BOX = cn(
  'peer tap-44 size-5 shrink-0 appearance-none rounded-xs border-[1.5px] border-border-control bg-surface-2',
  'transition-[border-color,background-color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
  'checked:border-ink checked:bg-ink indeterminate:border-ink indeterminate:bg-ink',
  'disabled:border-border-hair disabled:bg-surface-0',
  'disabled:checked:border-text-disabled disabled:checked:bg-text-disabled',
  'disabled:indeterminate:border-text-disabled disabled:indeterminate:bg-text-disabled',
  'forced-colors:appearance-auto',
)

/* The glyphs sit over the box and ignore the pointer, so a click lands on the input. */
const GLYPH = 'pointer-events-none absolute left-[3px] hidden text-btn-ink forced-colors:hidden'

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** Always visible, always associated. Never a placeholder. */
  label: ReactNode
  /** Secondary line under the label. */
  description?: ReactNode
  /** Mixed state. Resolves to checked on the next press. */
  indeterminate?: boolean
  error?: string | null
  /** Visible sentence saying why the box is unavailable. */
  disabledReason?: string
  className?: string
  /** Applies to the row, not the input. */
  wrapperClassName?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    label,
    description,
    indeterminate = false,
    error,
    disabledReason,
    disabled,
    id,
    className,
    wrapperClassName,
    ...rest
  },
  ref,
) {
  const innerRef = useRef<HTMLInputElement | null>(null)

  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      innerRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )

  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate
  }, [indeterminate])

  const errorId = error && id ? `${id}-error` : undefined
  const reasonId = disabled && disabledReason && id ? `${id}-reason` : undefined
  const describedBy = [errorId, reasonId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col', wrapperClassName)}>
      <label
        className={cn(
          'flex min-h-11 items-start gap-sm py-2xs',
          disabled ? 'cursor-not-allowed text-text-disabled' : 'cursor-pointer text-text-1',
        )}
      >
        <span className="relative flex h-6 shrink-0 items-center">
          <input
            {...rest}
            type="checkbox"
            id={id}
            ref={setRefs}
            disabled={disabled}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy}
            className={cn(
              BOX,
              disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:border-border-strong',
              className,
            )}
          />
          <Check
            size={14}
            strokeWidth={2.5}
            aria-hidden="true"
            className={cn(GLYPH, 'peer-checked:block peer-indeterminate:hidden')}
          />
          <Minus
            size={14}
            strokeWidth={2.5}
            aria-hidden="true"
            className={cn(GLYPH, 'peer-indeterminate:block')}
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

      <FieldHelper
        errorId={errorId}
        error={error}
        reasonId={reasonId}
        reason={reasonId ? disabledReason : undefined}
      />
    </div>
  )
})

export default Checkbox

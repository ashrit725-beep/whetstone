'use client'

/**
 * SearchInput
 *
 * Keyboard contract
 *   Tab / Shift+Tab   move through the field and, when there is a value, the
 *                     clear button that follows it.
 *   Escape            clears the field and keeps focus in it, the native
 *                     type="search" behaviour, extended here so the debounced
 *                     callback fires immediately rather than 250ms later.
 *   Enter             submits the surrounding form, if there is one.
 *   Activating Clear returns focus to the field, so the tab position never jumps
 *   to the top of the page when the button disappears.
 *
 * Two callbacks, on purpose: `onValueChange` fires on every keystroke for local
 * state, and `onDebouncedChange` fires 250ms after typing stops, for the query.
 * Both are cancelled on unmount.
 *
 * The visible label is mandatory, like every other field. A magnifier glyph is
 * not a label.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Field } from './field'
import { controlClasses } from './input'

export interface SearchInputProps {
  /** Visible, above the field. */
  label: string
  hint?: ReactNode
  placeholder?: string
  value?: string
  defaultValue?: string
  /** Every keystroke. */
  onValueChange?: (value: string) => void
  /** `debounceMs` after typing stops, and immediately on clear. */
  onDebouncedChange?: (value: string) => void
  debounceMs?: number
  name?: string
  id?: string
  error?: string | null
  disabled?: boolean
  disabledReason?: string
  /** Marks the field aria-busy while the caller resolves the query. */
  loading?: boolean
  /** Polite summary of the result set, for example "14 projects match." */
  resultsLabel?: string
  className?: string
  clearLabel?: string
}

export function SearchInput({
  label,
  hint,
  placeholder,
  value,
  defaultValue = '',
  onValueChange,
  onDebouncedChange,
  debounceMs = 250,
  name,
  id,
  error,
  disabled = false,
  disabledReason,
  loading = false,
  resultsLabel,
  className,
  clearLabel = 'Clear the search',
}: SearchInputProps) {
  const reactId = useId()
  const fieldId = id ?? `${reactId}-search`
  const controlled = value !== undefined
  const [internal, setInternal] = useState(defaultValue)
  const current = value ?? internal

  const inputRef = useRef<HTMLInputElement | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  useEffect(() => cancel, [cancel])

  const commit = useCallback(
    (next: string, immediate: boolean) => {
      if (!controlled) setInternal(next)
      onValueChange?.(next)
      cancel()
      if (!onDebouncedChange) return
      if (immediate) {
        onDebouncedChange(next)
        return
      }
      timer.current = setTimeout(() => {
        timer.current = null
        onDebouncedChange(next)
      }, debounceMs)
    },
    [cancel, controlled, debounceMs, onDebouncedChange, onValueChange],
  )

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    commit(event.target.value, false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && current.length > 0) {
      event.preventDefault()
      commit('', true)
    }
  }

  const clear = () => {
    commit('', true)
    inputRef.current?.focus()
  }

  const showClear = current.length > 0 && !disabled

  return (
    <Field
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      disabled={disabled}
      disabledReason={disabledReason}
      className={className}
    >
      {({ id: controlId, describedBy, invalid }) => (
        <>
          <span className="relative block">
            <span className="pointer-events-none absolute inset-y-0 left-sm inline-flex items-center">
              <Search
                size={16}
                strokeWidth={1.5}
                aria-hidden="true"
                className={disabled ? 'text-text-disabled' : 'text-text-3'}
              />
            </span>

            <input
              ref={inputRef}
              id={controlId}
              name={name}
              type="search"
              value={current}
              placeholder={placeholder}
              disabled={disabled}
              autoComplete="off"
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              aria-busy={loading || undefined}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              className={cn(
                controlClasses({ invalid, disabled }),
                // appearance-none also removes the WebKit cancel button, so there
                // is exactly one clear affordance and it is keyboard reachable.
                'h-11 appearance-none pl-xl pr-2xl',
              )}
            />

            {showClear ? (
              <button
                type="button"
                onClick={clear}
                className={cn(
                  'tap-44 absolute inset-y-0 right-xs my-auto inline-flex size-6 items-center justify-center rounded-xs',
                  'text-text-2 transition-[color,background-color] duration-[80ms] ease-[cubic-bezier(0.4,0,1,1)]',
                  'hover:bg-surface-2 hover:text-text-1 hover:duration-[120ms] hover:ease-[cubic-bezier(0.16,1,0.3,1)]',
                )}
              >
                <X size={16} strokeWidth={1.5} aria-hidden="true" />
                <span className="sr-only">{clearLabel}</span>
              </button>
            ) : null}
          </span>

          {resultsLabel ? (
            <p aria-live="polite" className="sr-only">
              {resultsLabel}
            </p>
          ) : null}
        </>
      )}
    </Field>
  )
}

export default SearchInput

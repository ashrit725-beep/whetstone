'use client'

/**
 * Textarea
 *
 * Keyboard contract
 *   Tab / Shift+Tab   move focus. Tab inserts no character, so the field is
 *                     never a keyboard trap (SC 2.1.2).
 *   Enter             inserts a newline; the form is submitted from its submit
 *                     button, never from Enter inside the textarea.
 *   All native text editing and selection keys apply, and paste is not intercepted.
 *
 * The counter is deliberately quiet. Sighted users see the running count at all
 * times; the polite live region stays empty until the remaining count reaches
 * `announceWithin`, so a screen reader is not interrupted on every keystroke.
 *
 * `prose` switches the field to the voice face (`.prose-human`), which is the
 * register for anything a human writes: the ask, feedback bodies, discussion
 * posts. The field keeps its own width rather than the 66ch prose measure.
 *
 * An uncontrolled field's count follows the field back to its default when
 * its form is reset, as it is after a successful post. A reset fires no input
 * event, so the counter kept the length of the note that had just been sent.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'
import { controlClasses } from './input'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  success?: boolean
  /** Turns on the counter. The field is not hard clipped: going over is an error, not a block. */
  maxChars?: number
  /** Remaining characters at which the polite live region starts announcing. */
  announceWithin?: number
  /** The voice face, for human prose. */
  prose?: boolean
  wrapperClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    invalid,
    success,
    maxChars,
    announceWithin = 20,
    prose = false,
    wrapperClassName,
    className,
    disabled,
    readOnly,
    onChange,
    ...rest
  },
  ref,
) {
  const controlled = rest.value !== undefined
  const [uncontrolledCount, setUncontrolledCount] = useState(
    () => String(rest.defaultValue ?? '').length,
  )
  const count = controlled ? String(rest.value ?? '').length : uncontrolledCount

  const innerRef = useRef<HTMLTextAreaElement | null>(null)
  const setRefs = useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )

  useEffect(() => {
    const node = innerRef.current
    const form = node?.form
    if (controlled || !node || !form) return
    // `reset` fires before the values change, so read the default, not the value.
    const onReset = () => setUncontrolledCount(node.defaultValue.length)
    form.addEventListener('reset', onReset)
    return () => form.removeEventListener('reset', onReset)
  }, [controlled])

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    if (!controlled) setUncontrolledCount(event.target.value.length)
    onChange?.(event)
  }

  const over = maxChars !== undefined && count > maxChars
  const remaining = maxChars === undefined ? undefined : maxChars - count
  const near = remaining !== undefined && remaining <= announceWithin

  return (
    <div className={cn('flex flex-col gap-2xs', wrapperClassName)}>
      <textarea
        {...rest}
        ref={setRefs}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={invalid || over || undefined}
        onChange={handleChange}
        className={cn(
          controlClasses({ invalid: invalid || over, disabled, readOnly, success }),
          'min-h-24 resize-y p-sm',
          prose && 'prose-human max-w-none text-text-1',
          className,
        )}
      />

      {maxChars !== undefined ? (
        <>
          <p
            aria-hidden="true"
            className={cn(
              'tnum self-end text-xs',
              over ? 'text-critical' : near ? 'text-text-2' : 'text-text-3',
            )}
          >
            {count}&nbsp;/&nbsp;{maxChars}
          </p>
          {/* Empty until the count matters, so typing is not narrated character by character. */}
          <p aria-live="polite" className="sr-only">
            {over
              ? `Over the limit by ${count - maxChars} characters. Trim the note before posting.`
              : near
                ? `${remaining} characters left.`
                : ''}
          </p>
        </>
      ) : null}
    </div>
  )
})

export default Textarea

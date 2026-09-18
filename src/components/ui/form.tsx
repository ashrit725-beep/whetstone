'use client'

/**
 * Form, ErrorSummary, SubmitButton, FormStatus
 *
 * A real <form> posting to a Server Action through useActionState, so it works
 * with JavaScript disabled and progressively gains the pending state.
 *
 * Keyboard contract
 *   Tab / Shift+Tab   walk the fields in DOM order, which is visual order.
 *   Enter             submits from any single line field, and from the submit
 *                     button. It inserts a newline inside a textarea instead.
 *   On a failed submit, focus moves to the error summary, which is a tabindex -1
 *   container with role="alert". Each entry is a real fragment link: Enter on one
 *   moves focus to that field and scrolls it clear of the sticky nav.
 *   While a submit is in flight the form is aria-busy and a second submit is
 *   dropped, so double posting is impossible on keyboard or pointer.
 *
 * A rejected submit keeps everything that was typed (SC 3.3.7). React resets a
 * form once an action passed to `<form action>` settles, whatever the action
 * returned, so a failed post used to empty every field and leave controlled
 * ones showing a value their state no longer held. With JavaScript running,
 * the submit handler dispatches the action inside a transition instead, which
 * React does not follow with a reset, and the form is reset only after a
 * success. React still reports the pending submission to `useFormStatus` when
 * a submit is prevented and a transition starts in the same event. Without
 * JavaScript, `action` posts the form natively as before.
 */

import {
  startTransition,
  useActionState,
  useEffect,
  useLayoutEffect,
  useRef,
  type FormHTMLAttributes,
  type ReactNode,
  type SubmitEvent,
} from 'react'
import { useFormStatus } from 'react-dom'
import { CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, type ButtonProps } from './button'

export interface FormState {
  status: 'idle' | 'success' | 'error'
  /** One sentence naming what happened. Errors say what broke, why, what to do next. */
  message?: string
  /** Field id to message. The keys must match the `id` passed to each Field. */
  fieldErrors?: Readonly<Record<string, string>>
}

export const idleFormState: FormState = { status: 'idle' }

export type FormAction = (
  state: FormState,
  formData: FormData,
) => FormState | Promise<FormState>

export interface FormRenderArgs {
  state: FormState
  pending: boolean
}

export interface FormProps
  extends Omit<FormHTMLAttributes<HTMLFormElement>, 'action' | 'children'> {
  action: FormAction
  initialState?: FormState
  /** Heading on the error summary. */
  summaryTitle?: string
  /** Set false when the form renders its own summary somewhere else. */
  showSummary?: boolean
  children: (args: FormRenderArgs) => ReactNode
}

export function Form({
  action,
  initialState = idleFormState,
  summaryTitle = 'This form was not posted.',
  showSummary = true,
  className,
  onSubmit,
  children,
  ...rest
}: FormProps) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const formRef = useRef<HTMLFormElement | null>(null)

  // Clear the fields after a success only, as React did after every result.
  // `state` is a fresh object per result, so this runs once for each.
  useLayoutEffect(() => {
    if (state.status === 'success') formRef.current?.reset()
  }, [state])

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    if (pending) {
      event.preventDefault()
      return
    }
    onSubmit?.(event)
    if (event.defaultPrevented) return
    // A submit button that names its own `formAction` is React's to route.
    const { submitter } = event.nativeEvent
    if (submitter?.hasAttribute('formaction')) return
    event.preventDefault()
    const formData = new FormData(event.currentTarget, submitter)
    startTransition(() => formAction(formData))
  }

  return (
    <form
      {...rest}
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      aria-busy={pending || undefined}
      noValidate
      className={cn('flex flex-col gap-lg', className)}
    >
      {showSummary ? (
        <ErrorSummary state={state} pending={pending} title={summaryTitle} />
      ) : null}
      {children({ state, pending })}
    </form>
  )
}

export interface ErrorSummaryProps {
  state: FormState
  pending: boolean
  title?: string
  className?: string
}

/**
 * Focuses itself once per failed submit. `state` is a fresh object on every
 * action result, so identity comparison is enough to tell a new failure from a
 * re-render, with no effect syncing derived state.
 */
export function ErrorSummary({ state, pending, title, className }: ErrorSummaryProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const announced = useRef<FormState | null>(null)

  const entries = Object.entries(state.fieldErrors ?? {})
  const failed = state.status === 'error'

  useEffect(() => {
    if (!failed || pending) return
    if (announced.current === state) return
    announced.current = state
    ref.current?.focus()
  }, [failed, pending, state])

  if (!failed) return null

  // Field errors are keyed by the input's name, which is usually not its id
  // (ids come from useId). Looking the key up as an id alone found nothing, so
  // the links in this list went nowhere. Try the id, then the named control in
  // this form, then anything on the page with that name.
  const focusField = (fieldId: string) => {
    const form = ref.current?.closest('form') ?? null
    const byName = (root: ParentNode) =>
      root.querySelector<HTMLElement>(`[name="${CSS.escape(fieldId)}"]:not([type="hidden"])`)
    const node =
      document.getElementById(fieldId) ?? (form ? byName(form) : null) ?? byName(document)
    if (!node) return
    node.scrollIntoView({ block: 'center' })
    node.focus()
  }

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className={cn(
        'measure-ui flex flex-col gap-xs rounded-md border border-critical bg-surface-2 p-md text-text-1',
        className,
      )}
    >
      <p className="flex items-start gap-xs">
        <CircleAlert
          size={20}
          strokeWidth={1.5}
          aria-hidden="true"
          className="mt-3xs shrink-0 text-critical"
        />
        <span>{state.message ?? title}</span>
      </p>

      {entries.length > 0 ? (
        <ul className="flex list-none flex-col gap-2xs p-0">
          {entries.map(([fieldId, message]) => (
            <li key={fieldId}>
              <a
                href={`#${fieldId}`}
                onClick={(event) => {
                  event.preventDefault()
                  focusField(fieldId)
                }}
                className="tap-44 inline-flex min-h-11 items-center text-sm text-critical underline"
              >
                {message}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export type SubmitButtonProps = Omit<
  Extract<ButtonProps, { as?: 'button' }>,
  'as' | 'type' | 'loading'
> & {
  /** Announced while the action is in flight. A verb phrase, matching the button label. */
  pendingLabel?: string
}

/**
 * Reads the surrounding form's pending state, so it must be rendered inside the
 * <form>, not beside it. It is never disabled at idle: a disabled submit button
 * is not a validation strategy.
 */
export function SubmitButton({
  pendingLabel = 'Posting…',
  children,
  ...rest
}: SubmitButtonProps) {
  const { pending } = useFormStatus()
  return (
    <Button {...rest} as="button" type="submit" loading={pending} loadingLabel={pendingLabel}>
      {children}
    </Button>
  )
}

export interface FormStatusProps {
  state: FormState
  className?: string
}

/**
 * Polite result region. Success is silent when the effect is visible on screen,
 * so render this only when the outcome happens somewhere the user is not looking.
 */
export function FormStatus({ state, className }: FormStatusProps) {
  return (
    <p
      aria-live="polite"
      style={{ minHeight: '1lh' }}
      className={cn('measure-ui text-xs', className)}
    >
      {state.status === 'success' && state.message ? (
        <span className="text-positive">{state.message}</span>
      ) : null}
    </p>
  )
}

export default Form

'use client'

/**
 * ErrorState: the whole-region failure. Every `error.tsx` renders this.
 *
 * The copy carries three parts and no apology: what broke, why it matters here,
 * what to do next. No “Oops”, no “Something went wrong”, no exclamation mark
 * (contract §7.1 rule 4).
 *
 * `requestId` is the one piece of machinery worth showing a reader: it is what
 * makes a support message answerable, so it is selectable text in the mono
 * face, not a toast that disappears.
 *
 * Keyboard contract:
 *   Tab            reaches Retry, then the back link.
 *   Enter / Space  activate the focused control.
 * The region announces itself once via `role="alert"`. Focus is not moved: the
 * reader is already here, and stealing focus on an error is disorienting.
 */

import { CircleAlert, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { MessageAction } from './banner'
import { useDelayedLoading } from './spinner'

export interface ErrorStateProps {
  /** What broke, in the reader’s terms. Sentence case. */
  title: string
  /** Why it matters here and what to do next. */
  body: string
  /** The id to quote in a support message. Rendered as selectable mono text. */
  requestId?: string
  /** Runs the work again. Shows a labelled spinner while `retrying` is true. */
  onRetry?: () => void
  retrying?: boolean
  /** Where “back” goes. Never `#`; pass a real route. */
  backHref?: string
  backLabel?: string
  headingLevel?: 1 | 2 | 3
  className?: string
}

export function ErrorState({
  title,
  body,
  requestId,
  onRetry,
  retrying = false,
  backHref,
  backLabel = 'Back to Discover',
  headingLevel = 1,
  className,
}: ErrorStateProps) {
  const Heading = `h${headingLevel}` as const
  const busy = useDelayedLoading(retrying)

  return (
    <section
      role="alert"
      className={cn(
        'flex flex-col items-start gap-sm rounded-md border border-critical bg-surface-2 p-xl',
        className,
      )}
    >
      <CircleAlert size={24} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-critical" />

      <div className="flex flex-col gap-2xs">
        <Heading className="text-md text-text-1" style={{ fontVariationSettings: '"wdth" 100, "wght" 600' }}>
          {title}
        </Heading>
        <p className="measure-ui text-sm text-text-2">{body}</p>
      </div>

      {requestId ? (
        <dl className="m-0 flex flex-wrap items-baseline gap-2xs">
          <dt className="text-xs text-text-3">Request</dt>
          <dd className="m-0">
            <code className="select-all rounded-xs border border-border-hair bg-surface-0 px-2xs py-3xs text-xs text-text-2">
              {requestId}
            </code>
          </dd>
        </dl>
      ) : null}

      {onRetry || backHref ? (
        <div className="mt-2xs flex flex-wrap items-center gap-md">
          {onRetry ? (
            <Button
              variant="primary"
              onClick={onRetry}
              loading={busy}
              loadingLabel="Retrying…"
              iconLeading={<RotateCcw size={20} strokeWidth={1.5} />}
            >
              Try again
            </Button>
          ) : null}
          {backHref ? <MessageAction action={{ label: backLabel, href: backHref }} /> : null}
        </div>
      ) : null}
    </section>
  )
}

export default ErrorState

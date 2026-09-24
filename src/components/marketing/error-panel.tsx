'use client'

/**
 * The marketing error boundary's body.
 *
 * It names what broke, says what to do about it, and keeps the one action that
 * still works when a database read failed. The description is tied to the
 * heading with `aria-describedby`, and the retry button is the first thing in
 * the tab order after the heading.
 */

import NextLink from 'next/link'

export interface ErrorPanelProps {
  title: string
  body: string
  /** Shown only when Next gives us one; it is what support would ask for. */
  digest?: string | undefined
  onRetry: () => void
  headingId?: string
}

export function ErrorPanel({
  title,
  body,
  digest,
  onRetry,
  headingId = 'error-heading',
}: ErrorPanelProps) {
  const bodyId = `${headingId}-body`

  return (
    <div className="marked ps-6">
      <h1
        id={headingId}
        aria-describedby={bodyId}
        className="text-xl text-ink"
        style={{ fontVariationSettings: '"wght" 800' }}
      >
        {title}
      </h1>

      <p id={bodyId} className="voice mt-4 text-voice">
        {body}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
        <NextLink href="/discover?open=1" className="btn btn-secondary">
          Browse open projects
        </NextLink>
      </div>

      {digest !== undefined && digest.length > 0 ? (
        <p className="mt-6 text-xs text-ink-3">
          Reference <span className="tnum">{digest}</span>
        </p>
      ) : null}
    </div>
  )
}

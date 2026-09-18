'use client'

/**
 * Timestamp: a time, relative once the client is running.
 *
 * Keyboard contract: none. It is a <time> element, not a control. The absolute
 * date is in `title`, which is a hover and focus tooltip on the containing
 * control, and is also the visible text until hydration, so the information is
 * never behind a hover alone.
 *
 * Hydration: the server has no idea what timezone the reader is in, so the
 * first paint renders an absolute date in UTC (identical on both sides) and
 * the component upgrades to the reader's local relative time after mount. That
 * is why this is a client component and why there is no `suppressHydrationWarning`
 * anywhere near it: the two renders genuinely match.
 */

import { useEffect, useState } from 'react'
import { cn, relativeTime } from '@/lib/utils'

const ABSOLUTE_UTC = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeZone: 'UTC',
})

export interface TimestampProps {
  /** Unix epoch milliseconds, as stored. */
  ts: number
  /** Leading word, e.g. "Posted". Rendered outside the <time>. */
  prefix?: string
  className?: string
}

export function Timestamp({ ts, prefix, className }: TimestampProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const iso = new Date(ts).toISOString()
  const utc = ABSOLUTE_UTC.format(new Date(ts))
  const local = mounted
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(ts),
      )
    : utc

  return (
    <span className={cn('text-xs text-text-3', className)}>
      {prefix ? <span>{prefix} </span> : null}
      <time dateTime={iso} title={local} className="tnum">
        {mounted ? relativeTime(ts) : utc}
      </time>
    </span>
  )
}

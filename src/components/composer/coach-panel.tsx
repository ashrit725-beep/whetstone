'use client'

/**
 * The quality coach, beside one note.
 *
 * Keyboard contract: nothing here takes focus and nothing here handles a key.
 * The suggestion chips are real buttons in document order; activating one
 * appends its scaffold to the note and returns the caret to the textarea.
 *
 * Three rules it keeps: it is `aria-live="polite"`, so it never interrupts; it
 * is never modal and never covers the writing; and it can never prevent a
 * submit. The footer names what produced the reading, "Writing tips" or "AI
 * writing tips", and says nothing about how the server is set up: a reviewer
 * cannot act on that, and it read as an unfinished product.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { Check, CircleDashed } from 'lucide-react'
import { coachNote, type CoachReading } from '@/server/actions/feedback'
import { cn } from '@/lib/utils'
import { NOTE_CHARS } from './types'

const IDLE_MS = 1200

const CHECK_WORDS: Record<string, string> = {
  specific: 'Names a specific moment',
  reproducible: 'Someone could repeat it',
  contrastive: 'Says what you expected instead',
  scoped: 'Stays on one thing',
  onAsk: 'Answers what the creator asked',
}

export interface CoachPanelProps {
  draftId: string
  projectId: string
  axisKey: string
  ask: string
  value: string
  /** Appends a scaffold to the note and hands focus back. */
  onAppend: (scaffold: string) => void
  className?: string
}

export function CoachPanel({
  draftId,
  projectId,
  axisKey,
  ask,
  value,
  onAppend,
  className,
}: CoachPanelProps) {
  const [reading, setReading] = useState<CoachReading | null>(null)
  // Asked, and the coach had nothing to say: over its hourly allowance, or a
  // note longer than it reads. Without this the panel said "Reading the note…"
  // for as long as the page stayed open.
  const [quiet, setQuiet] = useState(false)
  const [, startTransition] = useTransition()
  const timer = useRef<number | undefined>(undefined)
  // A note brought back from an earlier visit is not read again until it is
  // changed. Every area's panel is mounted, the dialog's too, so reading them
  // on arrival would spend a coach request per kept note on every page view.
  const [initial] = useState(() => value.trim())
  const lastAsked = useRef(initial.length >= NOTE_CHARS.min ? initial : '')

  useEffect(() => {
    const trimmed = value.trim()
    if (trimmed.length < NOTE_CHARS.min) {
      // Forget the last note asked about too, or typing the same words back
      // would skip the request and leave the panel waiting on nothing.
      lastAsked.current = ''
      setReading(null)
      setQuiet(false)
      return
    }
    if (trimmed === lastAsked.current) return

    timer.current = window.setTimeout(() => {
      lastAsked.current = trimmed
      startTransition(async () => {
        // Advisory only: a failed request (a dropped connection, a server
        // restart) must never reach the error boundary and take the
        // half-written review down with it.
        let next: CoachReading | null = null
        try {
          next = await coachNote({ draftId, draft: trimmed, projectId, axisKey, ask })
        } catch {
          next = null
        }
        // A reply about words that have since changed is not about this note.
        if (lastAsked.current !== trimmed) return
        setReading(next)
        setQuiet(next === null)
      })
    }, IDLE_MS)

    return () => {
      window.clearTimeout(timer.current)
    }
  }, [value, draftId, projectId, axisKey, ask])

  const passed = reading ? Object.values(reading.checks).filter(Boolean).length : 0
  const total = reading ? Object.keys(reading.checks).length : 0

  return (
    <div
      aria-live="polite"
      className={cn('flex min-h-11 flex-col gap-xs text-xs', className)}
    >
      {reading === null ? (
        <p className="text-text-3">
          {value.trim().length < NOTE_CHARS.min
            ? 'Write about forty characters and this panel will tell you what a creator can act on.'
            : quiet
              ? 'No tips on this note right now.'
              : value.trim() === initial
                ? 'Change the note and this panel will read it.'
                : 'Reading the note…'}
        </p>
      ) : (
        <>
          <p className="text-text-2">
            <span className="tnum">{passed}</span> of <span className="tnum">{total}</span> things a creator can act
            on are in this note.
          </p>
          <ul className="flex list-none flex-col gap-3xs p-0">
            {Object.entries(reading.checks).map(([key, ok]) => (
              <li key={key} className="flex items-center gap-2xs">
                {ok ? (
                  <Check size={16} strokeWidth={1.5} aria-hidden="true" className="text-positive" />
                ) : (
                  <CircleDashed size={16} strokeWidth={1.5} aria-hidden="true" className="text-text-3" />
                )}
                <span className={ok ? 'text-text-2' : 'text-text-3'}>
                  {CHECK_WORDS[key] ?? key}
                  {ok ? '' : ', not yet'}
                </span>
              </li>
            ))}
          </ul>

          {reading.suggestions.length > 0 ? (
            <ul className="flex list-none flex-col gap-xs p-0">
              {reading.suggestions.map((suggestion) => (
                <li key={suggestion.prompt} className="flex flex-col gap-2xs">
                  <p className="measure-ui text-text-2">{suggestion.prompt}</p>
                  <button
                    type="button"
                    onClick={() => {
                      onAppend(suggestion.scaffold)
                    }}
                    className="ws-scaffold text-xs"
                  >
                    Add “{suggestion.scaffold}”
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="text-2xs text-text-3">{reading.label}</p>
        </>
      )}
    </div>
  )
}

export default CoachPanel

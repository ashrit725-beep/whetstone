'use client'

/**
 * Brings the open note into view and puts focus on it when it arrives.
 *
 * A note is opened from three places: a row in the inbox table, the bell, and
 * the dashboard's “Lately” register. Only the table's links carried the
 * `#open-note` fragment, and the notification URLs already stored carry none,
 * so a note opened from the bell was rendered and left out of sight with focus
 * on the body. Doing it here covers every way in, including links written
 * before this existed.
 *
 * It runs once per note: a triage action inside the open note re-renders the
 * page without moving the reader. The jump is instant, never smooth, so there
 * is no motion to reduce.
 */

import { useEffect } from 'react'

export function RevealNote({
  targetId,
  focusId,
  noteId,
}: {
  /** The region scrolled to the top of the view. */
  targetId: string
  /** The heading focus lands on: it names the note, and its ring is one line, not the whole panel. */
  focusId: string
  noteId: string
}) {
  useEffect(() => {
    document.getElementById(targetId)?.scrollIntoView({ block: 'start' })
    document.getElementById(focusId)?.focus({ preventScroll: true })
  }, [targetId, focusId, noteId])
  return null
}

export default RevealNote

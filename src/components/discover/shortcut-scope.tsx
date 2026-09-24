'use client'

/**
 * The `/` accelerator.
 *
 * The hint above the feed says `/` searches, so it has to work from the moment
 * the page loads, when focus is still on `<body>`. A listener on a wrapper
 * element never sees that key: the event's path runs from `<body>` up, and the
 * wrapper is not on it. So the listener sits on `document` and is silenced
 * where a single character means something else — any input, textarea, select
 * or editable region, and anything inside an open dialog — which is the
 * mitigation SC 2.1.4 asks for when a shortcut is not scoped to a component.
 * It is also mounted only by Discover and Search, so it is not live anywhere
 * else in the product, and the hint that it exists is rendered visibly above
 * the feed rather than hidden in a tooltip.
 *
 * Keyboard contract:
 *   /   focuses the project search field and selects what is in it
 * Everything else passes through, modifiers included, as does a `/` another
 * handler has already acted on.
 *
 * This renders its children and no markup of its own: the accelerator is not a
 * region, and an empty `<div>` around the page only confused the layout it sat
 * in.
 */

import { useEffect, type ReactNode } from 'react'

export const SEARCH_FIELD_ID = 'discover-q'

/** True where a bare character key is text, or belongs to something in front. */
export function typingSomewhere(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return (
    target.closest('input, textarea, select, [contenteditable]') !== null ||
    target.closest('[role="dialog"], [aria-modal="true"]') !== null
  )
}

export function ShortcutScope({ children }: { children: ReactNode }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (typingSomewhere(event.target)) return
      const field = document.getElementById(SEARCH_FIELD_ID)
      if (!(field instanceof HTMLInputElement)) return
      event.preventDefault()
      field.focus()
      field.select()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return children
}

export default ShortcutScope

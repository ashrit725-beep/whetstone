'use client'

/**
 * The `/` accelerator, scoped.
 *
 * SC 2.1.4 (Character Key Shortcuts) allows a single-character shortcut when it
 * is active only while the component it belongs to has focus. So the listener
 * sits on the wrapper around the whole Discover surface rather than on
 * `document`: it fires while focus is on a row, a filter link or the search
 * field, and it is silent everywhere else in the product, including every
 * textarea in the composer.
 *
 * Keyboard contract:
 *   /   focuses the project search field (unless focus is already in a field)
 * Everything else passes through, modifiers included. The hint that this exists
 * is rendered visibly above the feed, not hidden in a tooltip.
 *
 * The handler is attached with `addEventListener` rather than a JSX prop so the
 * wrapper stays a plain container with no interactive semantics of its own, and
 * the listener is removed on unmount.
 */

import { useEffect, useRef, type ReactNode } from 'react'

export const SEARCH_FIELD_ID = 'discover-q'

function inAField(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest('input, textarea, select, [contenteditable]') !== null
}

export function ShortcutScope({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/') return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (inAField(event.target)) return
      const field = document.getElementById(SEARCH_FIELD_ID)
      if (!(field instanceof HTMLInputElement)) return
      event.preventDefault()
      field.focus()
      field.select()
    }
    node.addEventListener('keydown', onKeyDown)
    return () => node.removeEventListener('keydown', onKeyDown)
  }, [])

  return <div ref={ref}>{children}</div>
}

export default ShortcutScope

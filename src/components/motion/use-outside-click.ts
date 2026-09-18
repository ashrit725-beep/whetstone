'use client'

import { useEffect, type RefObject } from 'react'

/**
 * Calls back when a pointer goes down outside `ref`.
 *
 * Two deliberate differences from the version this is modelled on:
 *  - `pointerdown` rather than `mousedown` + `touchstart`, so a single listener
 *    covers mouse, touch and pen, and a touch cannot fire the callback twice.
 *  - The listener is capturing and checks `composedPath()`, so a click that
 *    starts inside a portalled child or an open shadow root still counts as
 *    inside. The original `ref.current.contains(event.target)` misses both.
 *
 * Escape is NOT handled here: dismissal by key belongs with the component that
 * owns focus, because it also has to decide where focus returns to.
 */
export function useOutsideClick(
  ref: RefObject<HTMLElement | null>,
  callback: (event: PointerEvent) => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return

    const onPointerDown = (event: PointerEvent) => {
      const el = ref.current
      if (!el) return
      const path = event.composedPath()
      if (path.includes(el)) return
      callback(event)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [ref, callback, enabled])
}

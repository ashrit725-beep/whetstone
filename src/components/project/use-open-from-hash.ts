'use client'

/**
 * Opens a `<details>` when the address names it, so a link to a form ("Post a
 * build", "Open a round") lands on the form open rather than on a closed toggle.
 *
 * It listens for `hashchange` as well as reading the address on mount, because
 * the empty state's link sits on the same page as the form and changes only the
 * fragment. Closing the form takes the fragment back off the address: left
 * there, the next click on the same link would change nothing, fire nothing and
 * leave the form shut.
 */

import { useEffect, type RefObject } from 'react'

export function useOpenFromHash(ref: RefObject<HTMLDetailsElement | null>, id: string): void {
  useEffect(() => {
    const details = ref.current
    if (!details) return
    const hash = `#${id}`

    const openFromHash = (): void => {
      if (window.location.hash === hash) details.open = true
    }
    const clearOnClose = (): void => {
      if (details.open || window.location.hash !== hash) return
      // The router keeps its own entry in history.state, so it is passed back
      // unchanged and only the fragment goes.
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    }

    openFromHash()
    window.addEventListener('hashchange', openFromHash)
    details.addEventListener('toggle', clearOnClose)
    return () => {
      window.removeEventListener('hashchange', openFromHash)
      details.removeEventListener('toggle', clearOnClose)
    }
  }, [ref, id])
}

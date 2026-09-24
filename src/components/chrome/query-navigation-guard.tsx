'use client'

/**
 * QueryNavigationGuard: makes a link that changes only the query string land.
 * Renders nothing.
 *
 * The defect it covers. For a signed-in reader, a client navigation that keeps
 * the current pathname — every filter, sort and grit step on `/discover`, every
 * facet on `/experts` and `/bounties`, every state chip on the dashboard —
 * renders and then never commits. Measured on the production build, one click
 * per fresh tab: 4 of 8 clicks on /discover's sort never moved the address, and
 * they stay dead, not slow. On a dead click the RSC response for the new address
 * is requested and returns 200 with a complete body in tens of milliseconds, the
 * console is clean, nothing is left in flight, and the document takes no
 * mutations at all.
 *
 * React's own root says what it is doing:
 * `pendingLanes === suspendedLanes === warmLanes === 0x3800`, `pingedLanes === 0`
 * and no callback scheduled — three transitions suspended on a thenable whose
 * ping never arrives, with the retry already warmed. The render did happen:
 * React's stylesheet map gains the `loading.tsx` skeleton's own hoistable style
 * with a count of zero, which is a fallback that was rendered and never
 * mounted. `router.push` fails at the same rate as `<Link>` and
 * `history.pushState` never fails, so it is not the Link components; a link that
 * changes the pathname never fails, and signed out the same markup never fails
 * at all.
 *
 * So the stall is inside the framework's navigation, below anything this app
 * renders, and it cannot be allowed to reach a reader as a control that does
 * nothing. This listens for the one click that can stall, gives the router a
 * window from the moment its data lands, and, if the address still has not
 * changed, asks the browser for the same address for real. The reader gets the
 * page they asked for either way, Back still steps through the filters they
 * picked, and when the navigation lands on its own, nothing here happens at all.
 *
 * Two details decide whether it works at all.
 *
 * The listener is on the capture phase. `next/link` calls `preventDefault()`
 * in its own click handler, which React delivers from a listener on `document`
 * that was attached at hydration — before this one, so it runs first. Measured
 * against the production build, eight signed-in clicks from eight fresh tabs:
 * with a bubble-phase listener that skips an already-defaulted event the rescue
 * fired twice and six clicks stayed dead; from the capture phase every stalled
 * click landed. Nothing else on this page calls `preventDefault()` on an
 * anchor, so there is no handler here to defer to.
 *
 * And a rescued click keeps its focus. The reader who pressed Enter on "Most
 * needed" would otherwise land on a fresh document with focus back on `<body>`;
 * the option they chose carries the address they are now at, so it is the one
 * to return to.
 *
 * Remove it once Next's client router commits these navigations;
 * `/tmp/ws-fix/discover/guard-test.mjs` is the check.
 */

import { useEffect } from 'react'

/**
 * How long the router is given before the address is set for real.
 *
 * A flat second, deliberately, because there is nothing better to wait on: the
 * router fetches the new address with `fetch`, and on a stalled navigation the
 * browser files no resource timing entry for that request at all — the response
 * arrives (the network log shows the 200) but its stream is never finished, and
 * an entry is only recorded when it is. So "has the data landed yet" cannot be
 * asked, and the choice is between a reader holding a dead control and a
 * navigation that is merely slow being taken over. A second is long enough that
 * nearly every healthy navigation commits inside it and short enough that the
 * dead one does not read as a broken page; when it is taken over, the reader
 * gets the same address, drawn by the server, with the route's own skeleton
 * while it comes.
 */
const STALL_MS = 1000

/** Carries the rescued address across the load, so focus can be put back. */
const FOCUS_KEY = 'ws:query-nav-focus'

/** Where the browser currently is, in the form an href is compared against. */
function addressNow(): string {
  return window.location.pathname + window.location.search
}

/** How long to keep looking for that option before letting the matter drop. */
const FOCUS_WINDOW_MS = 3000

/** The link that now points at the address we are on: the option just chosen. */
function optionFor(address: string): HTMLAnchorElement | null {
  for (const anchor of document.querySelectorAll('a[href]')) {
    if (anchor instanceof HTMLAnchorElement && anchor.getAttribute('href') === address) return anchor
  }
  return null
}

export function QueryNavigationGuard() {
  useEffect(() => {
    // A load this guard asked for: return focus to the control that asked.
    // Session storage can be unavailable, and then there is simply no rescue
    // to finish.
    try {
      const rescued = window.sessionStorage.getItem(FOCUS_KEY)
      if (rescued !== null) {
        window.sessionStorage.removeItem(FOCUS_KEY)
        if (rescued === addressNow()) optionFor(rescued)?.focus()
      }
    } catch {
      /* no session storage, no focus to restore */
    }

    let timer: number | undefined
    let wanted: string | null = null

    const stand = () => {
      window.clearTimeout(timer)
      wanted = null
    }

    const onClick = (event: MouseEvent) => {
      // A modified click opening a new tab, or anything but the primary
      // button, is not this one's business. `defaultPrevented` is deliberately
      // not consulted: see the note above.
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return

      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.hasAttribute('download')) return
      if (anchor.target !== '' && anchor.target !== '_self') return

      let url: URL
      try {
        url = new URL(anchor.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      // Only the navigation that can stall: same page, different query string.
      if (url.pathname !== window.location.pathname) return
      if (url.search === window.location.search) return

      wanted = url.pathname + url.search
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const address = wanted
        wanted = null
        if (address === null || addressNow() === address) return
        // The reader has gone somewhere else entirely in the meantime — those
        // navigations commit, and pulling them back to a filter they left would
        // be far worse than the stall this covers.
        if (window.location.pathname !== url.pathname) return
        try {
          window.sessionStorage.setItem(FOCUS_KEY, address)
        } catch {
          /* the address still lands; only the focus is lost */
        }
        window.location.assign(address)
      }, STALL_MS)
    }

    // Back, Forward, or a navigation that landed on its own: nothing to rescue.
    document.addEventListener('click', onClick, true)
    window.addEventListener('popstate', stand)
    window.addEventListener('pagehide', stand)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', stand)
      window.removeEventListener('pagehide', stand)
    }
  }, [])

  return null
}

export default QueryNavigationGuard

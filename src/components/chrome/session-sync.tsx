'use client'

/**
 * Keeps the masthead honest about who is signed in.
 *
 * `AppNav` lives in the persistent shell, and a layout is not re-rendered when
 * the page beneath it changes, so the identity it read at first paint survived
 * every client-side navigation afterwards. Sign out everywhere in one browser
 * and the other one kept the bell, the avatar and the account menu through as
 * many soft navigations as you liked — writes were refused, the page bodies
 * rendered signed out, and only a full reload corrected the chrome. Middleware
 * cannot notice either: the session JWT is still signature-valid, and only the
 * revocation-aware database check knows it was ended.
 *
 * So the chrome asks. `/api/auth/session` is that check, uncached, and it
 * answers with a handle or null. On a navigation, and on the window coming back
 * to the front, this compares the answer with the handle the shell was rendered
 * with and calls `router.refresh()` when the two disagree — which re-renders
 * the layout and resolves the disagreement, so a corrected shell cannot ask
 * again in a loop.
 *
 * It renders nothing, costs one small request per navigation, and skips the
 * request on mount: the server had just rendered the shell it is checking.
 */

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export interface SessionSyncProps {
  /** The handle the shell was rendered for, or null when it rendered signed out. */
  handle: string | null
}

/** A window that has been away this long is worth one request when it returns. */
const REFOCUS_INTERVAL_MS = 30_000

export function SessionSync({ handle }: SessionSyncProps) {
  const router = useRouter()
  const pathname = usePathname()
  const rendered = useRef(handle)
  const checkedAt = useRef(Date.now())
  const asked = useRef(pathname)

  // Kept in a ref so the listeners below never close over a stale prop and
  // never need to be torn down and rebound when it changes.
  rendered.current = handle

  useEffect(() => {
    let live = true

    async function check(): Promise<void> {
      checkedAt.current = Date.now()
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' })
        if (!response.ok || !live) return
        const body: unknown = await response.json()
        const found =
          typeof body === 'object' && body !== null && typeof (body as { handle?: unknown }).handle === 'string'
            ? (body as { handle: string }).handle
            : null
        if (live && found !== rendered.current) router.refresh()
      } catch {
        // Offline, or the navigation was abandoned mid-flight. The chrome that
        // is already drawn is the best answer available either way.
      }
    }

    function onReturn(): void {
      if (document.visibilityState === 'hidden') return
      if (Date.now() - checkedAt.current < REFOCUS_INTERVAL_MS) return
      void check()
    }

    // One check per address arrived at, and none for the address the shell was
    // rendered on: that response *is* the answer. Comparing the path rather
    // than counting mounts also keeps development's double-invoked effects
    // from asking a question nobody navigated to.
    if (asked.current !== pathname) {
      asked.current = pathname
      void check()
    }

    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onReturn)
    return () => {
      live = false
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onReturn)
    }
  }, [pathname, router])

  return null
}

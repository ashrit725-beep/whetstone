'use client'

/**
 * Who is reading, on a page the server rendered for everybody.
 *
 * The marketing tree is cached and revalidated on a timer, so the server cannot
 * say who is asking without rebuilding these pages for every sign-in — which is
 * exactly the cost that made the front page slow. The reader is resolved in the
 * browser instead, once per page, and shared: the nav and every call to action
 * read the same promise, so three components cost one request.
 *
 * Signed out is the rendered state, not a loading state. Everything the hook
 * feeds swaps a destination, never a layout, so a reader who is signed in sees
 * the same page with two hrefs changed and nothing moves.
 */

import { startTransition, useEffect, useState } from 'react'

export interface Viewer {
  readonly handle: string
}

function isViewer(value: unknown): value is Viewer {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { handle?: unknown }).handle === 'string'
  )
}

/** One request per document. A second component subscribes to the first's answer. */
let pending: Promise<Viewer | null> | null = null

function session(): Promise<Viewer | null> {
  pending ??= fetch('/api/auth/session', { cache: 'no-store' })
    .then((response) => (response.ok ? (response.json() as Promise<unknown>) : null))
    .then((body) => (isViewer(body) ? body : null))
    .catch(() => {
      // Offline, or navigated away mid-flight. The signed-out links are right
      // for anybody without an account and still work for anybody with one.
      return null
    })
  return pending
}

export function useViewer(): Viewer | null {
  const [viewer, setViewer] = useState<Viewer | null>(null)

  useEffect(() => {
    let live = true
    void session().then((found) => {
      // In a transition, because this answer arrives while the rest of the page
      // may still be hydrating: the front page streams its content behind the
      // shell, so hydration runs in more than one pass, and an urgent update in
      // the middle of one makes React discard the server document and rebuild
      // the page (#418, measured on 2 of 3 cold signed-in loads of `/`; holding
      // this response past hydration removed it on 3 of 3). Nothing here is
      // urgent: it swaps two hrefs after paint.
      if (live) startTransition(() => setViewer(found))
    })
    return () => {
      live = false
    }
  }, [])

  return viewer
}

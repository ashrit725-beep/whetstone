'use client'

/**
 * HydrationGate: holds hydration of everything inside it until the document
 * has been parsed. Renders its children and no markup of its own.
 *
 * Why it exists. React 19.2 has a hydration bug (react/react#37584): when a
 * host element (a `<div>`, a `<section>`) finds a lazy node among its children
 * and that node is still pending, React suspends on the element, then replays
 * it once the node arrives, but the replay starts with the hydration cursor
 * already inside the element. The element fails to match its own server HTML
 * and React throws the server document away (error #418; outside a Suspense
 * boundary, the whole page). A development build shows the signature: the
 * client expects the shell's `<div>` and finds the `<header>` that is that
 * div's own first child, with `replaySuspendedUnitOfWork` on the stack. The
 * two renders match; nothing this app draws differs between the two sides.
 *
 * In this app those lazy nodes are the server's flight rows. React's server
 * cuts any row at 3,200 bytes and sends the remainder as later rows (a project
 * page's charts arrive some sixty inline scripts after the sections that hold
 * them), and an async Server Component such as AppNav is a row of its own. Next
 * starts hydrating as soon as its script loads, which under load is before the
 * last inline flight script has been parsed, so on a few percent of loads a
 * large page reached one of those elements before its row did.
 *
 * Every flight row is an inline script in the document, so once the parser is
 * done (DOMContentLoaded) none is pending and nothing can suspend on a host
 * element. Hydration inside the gate therefore waits for that one event, then
 * runs in a single pass. Next hydrates inside a transition, so waiting at the
 * root commits nothing and shows no fallback: the reader keeps the server HTML,
 * and streamed Suspense content still reveals itself as it arrives. The cost is
 * that the page becomes interactive when the document finishes, not while it
 * streams. On a load where the document is already parsed the gate is a no-op,
 * and it never waits after the first render.
 *
 * Remove it once Next bundles a React with the fix. Next renders the App Router
 * with its own copy (Next 15.5.25 carries 19.2.0-canary-0bdb9206-20250818,
 * whose `replayBeginWork` does not rewind the cursor), not the `react-dom` in
 * package.json; react-dom 19.3.0 rewinds it for a replayed host component.
 */

import { use, type ReactNode } from 'react'

let documentParsed: Promise<void> | null = null

/** One promise for the page's lifetime, so a replayed render reads the same one. */
function whenDocumentParsed(): Promise<void> {
  documentParsed ??= new Promise((resolve) => {
    document.addEventListener('DOMContentLoaded', () => resolve(), { once: true })
  })
  return documentParsed
}

export function HydrationGate({ children }: { children: ReactNode }) {
  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    use(whenDocumentParsed())
  }
  return children
}

'use client'

/**
 * HydrationGate: React does not start hydrating until the document it is about
 * to hydrate has stopped changing. Renders its children and no markup of its
 * own.
 *
 * The defect. React 19.2 cannot replay a host fiber that suspended mid
 * hydration (react/react#37584). `replayBeginWork` sends a `HostComponent`
 * through `resetHooksOnUnwind` straight into `beginWork` again, and `beginWork`
 * claims the *next* hydratable instance — but the first attempt already claimed
 * this element and left the cursor inside it. The element fails to match its own
 * server HTML, and outside a Suspense boundary React throws the whole server
 * document away (error #418). Nothing this app draws differs between the two
 * sides, so the error carries no diff and names no element, and a development
 * build — where a real difference would be printed node by node — reported none
 * over any load taken here. The signature is the stack: `throwOnHydrationMismatch`
 * under `beginWork` under `replaySuspendedUnitOfWork`.
 *
 * So the whole job is to make sure no fiber can suspend while hydration is
 * walking the tree. Two things can suspend one, and this waits for both.
 *
 * One: a flight row that has not arrived. A host element whose children include
 * an RSC reference the client has not resolved yet suspends on that reference,
 * and that is the fiber React then fails to replay. The initial payload is a
 * `ReadableStream` fed by the `self.__next_f.push` calls the document carries as
 * inline scripts, and `next/dist/client/app-index.js` closes that stream in its
 * own `DOMContentLoaded` listener — or, when the document was *already* parsed
 * by the time it ran, in a bare `setTimeout`, which its own comment describes as
 * "Delayed in marco task to ensure it's executed later than hydration". In that
 * second case hydration is expected to run against a stream that is still open,
 * with every row the server flushed late still pending.
 *
 * So waiting for the parser is not enough on either path. Closing the stream
 * does not decode what is in it: the flight client reads the enqueued chunks
 * through a promise chain, which drains in the microtasks between one task and
 * the next, so a gate that resolves *on* `DOMContentLoaded` hands the tree back
 * to React in the same turn Next closed the stream in, with the last rows still
 * undecoded. Measured on the production build, five of thirty-eight cold
 * signed-in loads of `/` threw #418, each of them 60-80ms after
 * `DOMContentLoaded` and none of them before it.
 * Yielding the task queue twice puts this behind Next's own close — a timer
 * registered while `app-index` was evaluating is due before one registered
 * during hydration — and behind the turn that decodes what the close released.
 *
 * Two: a boundary React has completed but parked. `$RC` marks the boundary
 * comment `$~`, pushes the pair onto `$RB`, and schedules the reveal (`$RV`) for
 * a later frame, up to 300 ms after the first paint, so a boundary that resolves
 * a moment after the page appears does not snatch the skeleton away mid-blink.
 * Hydration reaching a `$~` boundary suspends on it and replays through
 * `_reactRetry`, which is the same replay with the same result. Applying the
 * queue here is a DOM write during render, which is exactly what it has to be:
 * it must happen before React walks into the boundary, and this is the first
 * thing React renders inside `<body>`. `$RV` empties the queue it is given, so
 * this is idempotent — a second render, including StrictMode's, finds nothing to
 * do — and on a load with nothing parked it costs one array read.
 *
 * What it costs. Next hydrates inside a transition, so waiting here commits
 * nothing and shows no fallback: the reader keeps the server HTML, streamed
 * content still reveals itself as it arrives, and the page becomes interactive
 * two task turns after the document finishes rather than during it.
 *
 * Remove it once Next bundles a React whose replayed host component rewinds the
 * hydration cursor. Next renders the App Router with its own copy (Next 15.5.25
 * carries 19.2.0-canary-0bdb9206-20250818, whose `replayBeginWork` does not
 * rewind it), not the `react-dom` in package.json; react-dom 19.3.0 does.
 * `scripts/hydration-probe.mjs` is the proof either way: it loads the pages that
 * stream and then, with `requestAnimationFrame` dead so the parked reveal has no
 * other way home, checks that every boundary was revealed before hydration
 * reached it.
 */

import { use, type ReactNode } from 'react'

/**
 * React's streaming reveal queue, written into the page by the server's own
 * inline scripts: `$RB` holds boundary/content pairs that `$RC` has completed
 * and `$RV` applies them. Both are absent on a document that streamed nothing.
 */
interface RevealGlobals {
  /** Boundary comment and content node, in pairs, awaiting their reveal. */
  $RB?: readonly unknown[]
  /** Applies the queue and empties it. */
  $RV?: (queue: readonly unknown[]) => void
}

/** Applies every boundary the server has completed but React has parked for a
 *  later frame, so hydration walks a DOM that cannot change underneath it. */
function revealStreamedBoundaries(): void {
  const { $RB: queue, $RV: reveal } = window as unknown as RevealGlobals
  if (typeof reveal !== 'function' || !Array.isArray(queue) || queue.length === 0) return
  reveal(queue)
}

let settled: Promise<void> | null = null

/** One promise for the page's lifetime, so a replayed render reads the same one. */
function whenDocumentSettled(): Promise<void> {
  settled ??= new Promise<void>((resolve) => {
    // Two turns, not none and not one. Resolving on the event itself hands the
    // tree back in the turn Next closed the stream in, with the last rows still
    // undecoded; that is the load that threw. A turn later they are decoded,
    // because the flight client's reads drain in the microtasks between turns.
    // The second turn is for the other branch: when the parser had already
    // finished, Next closes the stream from its own `setTimeout`, registered
    // while `app-index` was evaluating and so due before anything queued here.
    const yieldTwice = () => {
      setTimeout(() => setTimeout(resolve))
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', yieldTwice, { once: true })
      return
    }
    yieldTwice()
  })
  return settled
}

export function HydrationGate({ children }: { children: ReactNode }) {
  if (typeof document !== 'undefined') {
    // Unconditional, because `readyState` answers a different question. A
    // parsed document is not a decoded one, and on the branch where Next
    // defers its own close to a timer it is not even a closed one.
    use(whenDocumentSettled())
    revealStreamedBoundaries()
  }
  return children
}

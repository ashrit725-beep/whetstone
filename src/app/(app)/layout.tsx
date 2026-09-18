/**
 * The product shell.
 *
 * Public and signed-in readers get the same chrome: `/discover`,
 * `/p/[slug]`, `/u/[handle]`, `/c`, `/experts` and `/bounties`
 * must render identically to a crawler, so nothing here is gated. The account
 * cluster is the only part that changes shape.
 *
 * `<main id="main" tabIndex={-1}>` is the target of the skip link that the root
 * layout renders as the first focusable element on the page.
 *
 * `AppNav` is async, so it reaches the browser as a flight row of its own. The
 * root layout's `HydrationGate` holds hydration until every row has arrived,
 * which is what keeps that row from failing the whole document (error #418);
 * nothing here has to be arranged around it.
 */

import type { ReactNode } from 'react'
import { AppNav } from '@/components/chrome/app-nav'
import { Footer } from '@/components/chrome/footer'
import { Toaster } from '@/components/ui'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-1 text-text-1">
      <AppNav />
      <main id="main" tabIndex={-1} className="grow">
        {children}
      </main>
      <Footer />
      <Toaster />
    </div>
  )
}

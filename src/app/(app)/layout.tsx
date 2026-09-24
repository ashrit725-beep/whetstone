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
 * Routes under here carry `loading.tsx` skeletons, so a cold response streams
 * the shell first and the page after it. The root layout's `HydrationGate`
 * holds hydration until that stream has arrived, been decoded and been revealed,
 * which is what keeps a streamed page from taking the document down (error
 * #418); nothing here has to be arranged around it.
 */

import type { ReactNode } from 'react'
import { AppNav } from '@/components/chrome/app-nav'
import { Footer } from '@/components/chrome/footer'
import { homeHref } from '@/components/chrome/links'
import { QueryNavigationGuard } from '@/components/chrome/query-navigation-guard'
import { currentUser } from '@/server/auth/session'
import { Toaster } from '@/components/ui'

export default async function AppLayout({ children }: { children: ReactNode }) {
  // The nav's wordmark and the footer's wordmark are both links called
  // "Whetstone, home", so this shell decides once where home is and hands the
  // same answer to both. `currentUser()` is request-cached, so asking here costs
  // nothing on top of the nav's own read.
  const user = await currentUser()

  return (
    <div className="flex min-h-dvh flex-col bg-surface-1 text-text-1">
      <AppNav />
      <main id="main" tabIndex={-1} className="grow">
        {children}
      </main>
      <Footer home={homeHref(user !== null)} />
      <Toaster />
      {/* Every filter, sort and facet under this shell is a link that changes
          only the query string, and the client router stalls on exactly those
          for a signed-in reader. The file says what was measured. */}
      <QueryNavigationGuard />
    </div>
  )
}

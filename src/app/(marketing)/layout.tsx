/**
 * The marketing shell: nav, content, footer. No sidebar, nothing sticky.
 *
 * The "Ask for help" link sits in the footer here and in the same place on
 * every other surface (SC 3.2.6), and `<main id="main">` is the target of the
 * skip link declared once in the root layout.
 */

import type { ReactNode } from 'react'
import { MarketingFooter } from '@/components/marketing/marketing-footer'
import { MarketingNav } from '@/components/marketing/marketing-nav'

export const revalidate = 3600

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingNav />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <MarketingFooter />
    </>
  )
}

/**
 * The catch-all 404.
 *
 * It reads nothing from the request, so it stays static and cannot itself fail.
 * The copy names what happened, says why a link goes stale here in particular,
 * and offers the routes that actually resolve the situation: the feed, the
 * search scopes that exist — projects, discussions and listed reviewers, not
 * people in general — and the community for anything that moved.
 *
 * A missing page is an expected state, not a failure (ROUTES, error-state
 * contract), so it is set as a page with a heading rather than inside the red
 * `ErrorState` panel the error boundaries use.
 *
 * The header, the content and the footer hang off one left edge: each pads the
 * full-width band and centres a `max-w-detail` column inside it, the way the
 * product chrome does. Padding the centred box itself would move the content
 * in by the gutter while the wordmark and the footer stayed put.
 */

import type { Metadata } from 'next'
import { Button, Link } from '@/components/ui'
import { Footer } from '@/components/chrome/footer'
import { Wordmark } from '@/components/chrome/wordmark'

/* No `robots` entry: Next already marks every not-found view noindex, and a
   second copy printed the meta twice. */
export const metadata: Metadata = {
  title: 'Page not found',
}

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-1 text-text-1">
      {/* A <header>, not a div: this is the only banner on the page, and the 404
          was the one surface in the product that had none for a screen reader
          to jump to. */}
      <header className="pad-inline border-b border-border-hair bg-surface-2">
        <div
          className="mx-auto flex w-full max-w-detail items-center"
          style={{ blockSize: 'var(--nav-h)' }}
        >
          <Wordmark size="lg" href="/" />
        </div>
      </header>

      <main id="main" tabIndex={-1} className="pad-inline grow py-2xl">
        <div className="mx-auto flex w-full max-w-detail flex-col items-start gap-lg">
          <h1 className="text-2xl">That page is not here</h1>
          <p className="measure-ui text-base text-text-2">
            A project can be unpublished, a thread can be removed, and handles change when people
            rename themselves, so links into Whetstone do go stale. Discover lists every public
            project, and search covers projects, discussions and listed reviewers.
          </p>

          <div className="flex flex-wrap items-center gap-lg">
            <Button as="a" href="/discover" variant="primary">
              Open Discover
            </Button>
            <Link href="/search" variant="standalone">
              Search projects, discussions and reviewers
            </Link>
          </div>

          <p className="measure-ui text-sm text-text-2">
            If what you want has moved,{' '}
            <Link href="/c" variant="inline">
              ask the community
            </Link>
            .
          </p>
        </div>
      </main>

      {/* This surface renders its own header rather than the product nav, so
          the footer carries the theme control it would otherwise inherit. */}
      <Footer showTheme />
    </div>
  )
}

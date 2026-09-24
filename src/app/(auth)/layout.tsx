/**
 * Surface 9, auth. CONTRACT §4.4: one column, 24rem, left-aligned, sitting
 * directly on `surface-1`. No card, no shadow, no centred logo lockup over a
 * white box. Control edges are the only structure on the page, which is where
 * this surface's restraint is spent (§1: "Auth: nothing").
 *
 * The column hangs off one left edge, shared by the wordmark, the form and the
 * footer, so the page reads as deliberate rather than as a form that failed to
 * centre.
 */

import type { ReactNode } from 'react'
import { Link, ThemeToggle } from '@/components/ui'
// The one reader of the theme cookie, shared with the app bar, so the control's
// first-frame label cannot mean one thing in this shell and another in that one.
import { readThemeSetting } from '@/components/chrome/theme-setting'

const COLUMN = 'w-full max-w-96 md:ms-xl'

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const theme = await readThemeSetting()
  const year = new Date().getUTCFullYear()

  return (
    /* min-block-size pins the footer to the bottom of a short page. This is not
       a hero, so ban 28 does not apply. */
    <div className="flex min-h-dvh flex-col bg-surface-1 text-text-1">
      <header className="pad-inline pt-xl">
        <div className={COLUMN}>
          {/* The same two-tone wordmark the marketing nav and footer set: "Whet"
              at full ink, "stone" a step lighter, which is the ink-density
              device the whole identity is built on. */}
          <Link
            href="/"
            variant="quiet"
            className="text-md text-text-1"
            style={{ fontVariationSettings: '"wght" 800', letterSpacing: '-0.03em' }}
          >
            Whet
            <span aria-hidden="true" className="text-text-3">
              stone
            </span>
          </Link>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="pad-inline flex-1 py-2xl">
        <div className={COLUMN}>{children}</div>
      </main>

      {/* SC 3.2.6: the help affordance sits in this same slot on all nine surfaces. */}
      <footer className="pad-inline pb-xl pt-2xl">
        <div className={`${COLUMN} flex flex-wrap items-center gap-x-lg gap-y-xs text-xs text-text-3`}>
          <Link href="/how-it-works" variant="quiet">
            How Whetstone works
          </Link>
          <Link href="/c" variant="quiet">
            Ask for help
          </Link>
          <Link href="/legal/terms" variant="quiet">
            Terms
          </Link>
          <Link href="/legal/privacy" variant="quiet">
            Privacy
          </Link>
          <ThemeToggle initial={theme} />
          {/* Computed, and on the same UTC basis as the product footer, so the
              two can never disagree across a timezone boundary. It was the one
              hardcoded year in a rendered string anywhere in the app. */}
          <span className="tnum">© {year} Whetstone</span>
        </div>
      </footer>
    </div>
  )
}

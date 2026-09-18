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
import { cookies } from 'next/headers'
import { Link, ThemeToggle, type ThemeSetting } from '@/components/ui'

const COLUMN = 'w-full max-w-96 md:ms-xl'

function readTheme(value: string | undefined): ThemeSetting {
  return value === 'light' || value === 'dark' ? value : 'system'
}

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const jar = await cookies()
  const theme = readTheme(jar.get('ws_theme')?.value)

  return (
    /* min-block-size pins the footer to the bottom of a short page. This is not
       a hero, so ban 28 does not apply. */
    <div className="flex min-h-dvh flex-col bg-surface-1 text-text-1">
      <header className="pad-inline pt-xl">
        <div className={COLUMN}>
          <Link
            href="/"
            variant="quiet"
            className="text-md text-text-1"
            style={{ fontVariationSettings: '"wdth" 108, "wght" 650' }}
          >
            Whetstone
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
          <span>© 2026 Whetstone</span>
        </div>
      </footer>
    </div>
  )
}

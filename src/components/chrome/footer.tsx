/**
 * Footer: one inline line, on every surface, in the same order every time.
 *
 * There is no four-column Product / Company / Resources / Legal block in this
 * product. A handful of real links, each to a route that exists, and the help
 * affordance sits in the same slot on every page, which is what SC 3.2.6
 * (Consistent Help) asks for.
 *
 * Every href is checked against `src/app` by `scripts/check-links.mjs`: a
 * footer link to a route that does not exist is banned outright (contract
 * ban 32). Terms and privacy close the line because a public service owes
 * them to everyone who signs up.
 *
 * The line sits in the same `max-w-detail` column the pages use, so the
 * wordmark shares its leading edge with the page title above it at every
 * width. Below 40rem the line wraps into a stack; nothing is hidden and
 * nothing collapses behind a control.
 */

import { Link, ThemeToggle } from '@/components/ui'
import { Wordmark } from './wordmark'

interface FooterLink {
  readonly href: string
  readonly label: string
}

export interface FooterProps {
  /**
   * Home for this reader, from `homeHref()` in `./links`. The shell that renders
   * this line knows who is reading; the line itself cannot ask, because the
   * root error boundary is a client component and imports it. Both wordmarks on
   * a page are links called "Whetstone, home", so they must resolve home to the
   * same place (SC 3.2.4); the front page is the right answer wherever no
   * reader is known, which is what the 404 and the error page pass.
   */
  readonly home?: string
  /**
   * Adds the theme control to this line. The product shell already carries one
   * in its nav, so it stays off there; the 404 and the root error boundary
   * render their own minimal header instead and inherit neither, which left
   * those two surfaces with no way to change the theme and, on the 404, no
   * focusable control of any kind.
   */
  readonly showTheme?: boolean
}

/** The help affordance is second, always, on every surface. */
const LINKS: readonly FooterLink[] = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/c', label: 'Ask for help' },
  { href: '/for-reviewers', label: 'For reviewers' },
  { href: '/legal/terms', label: 'Terms' },
  { href: '/legal/privacy', label: 'Privacy' },
]

export function Footer({ home = '/', showTheme = false }: FooterProps) {
  const year = new Date().getUTCFullYear()

  return (
    <footer className="pad-inline border-t border-border-hair bg-surface-2 text-text-3">
      <div className="mx-auto flex w-full max-w-detail flex-wrap items-center gap-x-md gap-y-xs py-md">
        <Wordmark size="sm" href={home} />

        <nav aria-label="Footer">
          <ul className="m-0 flex list-none flex-wrap items-center gap-x-md gap-y-3xs p-0">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} variant="quiet" className="text-xs">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-wrap items-center gap-md sm:ms-auto">
          {showTheme ? <ThemeToggle /> : null}
          <p className="tnum text-xs">© {year} Whetstone</p>
        </div>
      </div>
    </footer>
  )
}

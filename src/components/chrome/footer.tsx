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

import { Link } from '@/components/ui'
import { Wordmark } from './wordmark'

interface FooterLink {
  readonly href: string
  readonly label: string
}

/** The help affordance is second, always, on every surface. */
const LINKS: readonly FooterLink[] = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/c', label: 'Ask for help' },
  { href: '/for-reviewers', label: 'For reviewers' },
  { href: '/legal/terms', label: 'Terms' },
  { href: '/legal/privacy', label: 'Privacy' },
]

export function Footer() {
  const year = new Date().getUTCFullYear()

  return (
    <footer className="pad-inline border-t border-border-hair bg-surface-2 text-text-3">
      <div className="mx-auto flex w-full max-w-detail flex-wrap items-center gap-x-md gap-y-xs py-md">
        <Wordmark size="sm" as="text" />

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

        <p className="tnum text-xs sm:ms-auto">© {year} Whetstone</p>
      </div>
    </footer>
  )
}

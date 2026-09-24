/**
 * Marketing footer: one line.
 *
 * Five real destinations, the theme control and the year. There is no
 * four-column Product / Company / Resources / Legal block anywhere in
 * Whetstone, and every href here is a route that exists.
 *
 * "Ask for help" is the second link here, with the same words and the same
 * destination as in the product's footer and the sign-in pages' footer, which
 * is the consistent help mechanism WCAG 2.2 SC 3.2.6 asks for.
 */

import { HomeLink } from '@/components/chrome/home-link'
import NextLink from 'next/link'
import { ThemeToggle } from '@/components/ui'
import styles from './paper.module.css'

interface FooterLink {
  readonly href: string
  readonly label: string
}

const LINKS: readonly FooterLink[] = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/c', label: 'Ask for help' },
  { href: '/for-reviewers', label: 'For reviewers' },
  { href: '/legal/terms', label: 'Terms' },
  { href: '/legal/privacy', label: 'Privacy' },
]

export function MarketingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="pad-inline">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-8 gap-y-3 border-t border-rule py-6">
        <HomeLink href="/" className="tap-44 inline-flex items-center text-sm text-ink" style={{ fontVariationSettings: '"wght" 700' }}>
          Whetstone
        </HomeLink>

        <ul className="flex basis-full flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:basis-auto sm:gap-x-8">
          {LINKS.map((link) => (
            <li key={link.href}>
              <NextLink href={link.href} className={`${styles.navLink} tap-44`}>
                {link.label}
              </NextLink>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-4 sm:ms-auto">
          <ThemeToggle />
          <span className="tnum text-xs text-ink-3">© {year} Whetstone</span>
        </div>
      </div>
    </footer>
  )
}

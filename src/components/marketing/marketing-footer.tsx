/**
 * Marketing footer: one line.
 *
 * Seven real destinations, the theme control and the year. There is no
 * four-column Product / Company / Resources / Legal block anywhere in
 * Whetstone, and every href here is a route that exists.
 *
 * "Ask for help" is the second link here, with the same words and the same
 * destination as in the product's footer and the sign-in pages' footer, which
 * is the consistent help mechanism WCAG 2.2 SC 3.2.6 asks for.
 *
 * The line carries one rule, on its own top edge. The closing band above it
 * already ends the page, and a second rule between the two drew a 2px seam.
 */

import { HomeLink } from '@/components/chrome/home-link'
import NextLink from 'next/link'
import styles from './paper.module.css'
import { ThemeChoice } from './theme-choice'

interface FooterLink {
  readonly href: string
  readonly label: string
}

const LINKS: readonly FooterLink[] = [
  { href: '/discover?open=1', label: 'Open projects' },
  { href: '/c', label: 'Ask for help' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/for-reviewers', label: 'For reviewers' },
  { href: '/experts', label: 'Experts' },
  { href: '/legal/terms', label: 'Terms' },
  { href: '/legal/privacy', label: 'Privacy' },
]

export function MarketingFooter() {
  const year = new Date().getUTCFullYear()

  return (
    <footer className="pad-inline">
      <div className={styles.foot}>
        <HomeLink
          href="/"
          className="tap-44 inline-flex items-center text-sm text-ink"
          style={{ fontVariationSettings: '"wght" 800', letterSpacing: '-0.02em' }}
        >
          Whet
          <span aria-hidden="true" className="text-ink-3">
            stone
          </span>
        </HomeLink>

        <ul className={styles.footLinks}>
          {LINKS.map((link) => (
            <li key={link.href}>
              <NextLink href={link.href} className={`${styles.navLink} tap-44`}>
                {link.label}
              </NextLink>
            </li>
          ))}
        </ul>

        <div className={styles.footEnd}>
          <ThemeChoice />
          <span className="tnum text-xs text-ink-3">© {year} Whetstone</span>
        </div>
      </div>
    </footer>
  )
}

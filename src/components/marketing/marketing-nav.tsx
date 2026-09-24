'use client'

/**
 * Marketing navigation.
 *
 * A wordmark, three real destinations, and the one action the page is for. It
 * does not stick: a marketing bar that follows the reader down the page is a
 * sticky call-to-action bar by another name.
 *
 * The wordmark is the identity in miniature. "Whet" is full ink and "stone" is
 * a lighter one, which is the same ink-density device as the honing word and
 * the grit cells, at 22px instead of 136. It is a fill rather than an outline:
 * a 1px stroke at this size closed the counter of the final "e" into a blob
 * that read as a copyright sign.
 *
 * Two rows on a phone, not three. The wordmark and the two actions share the
 * first row, and the three links run along the second on one line, scrolling
 * sideways if a narrower phone needs them to. The old shape took 156px — about
 * an eighth of the first screen — to say three words.
 *
 * The marketing pages are cached, so the server cannot say who is reading. The
 * reader is resolved once per document in the browser and shared with the page's
 * own actions; a signed-in member gets a way into the product instead of a
 * sign-in link, and the signed-out pair is the server markup, so a visitor
 * without an account sees no change at all.
 *
 * Keyboard contract: a plain list of links in visual order. The link for the
 * current page carries `aria-current="page"` and takes an underline, so the
 * state is not colour alone.
 */

import { HomeLink } from '@/components/chrome/home-link'
import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './paper.module.css'
import { useViewer } from './use-viewer'

interface NavItem {
  readonly href: string
  readonly label: string
}

const ITEMS: readonly NavItem[] = [
  { href: '/discover?open=1', label: 'Open projects' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/for-reviewers', label: 'For reviewers' },
]

export function MarketingNav() {
  const pathname = usePathname()
  const viewer = useViewer()

  return (
    <header className="pad-inline">
      <nav aria-label="Whetstone" className={styles.nav}>
        <HomeLink
          href="/"
          className="tap-44 inline-flex items-center text-md text-ink"
          style={{ fontVariationSettings: '"wght" 800', letterSpacing: '-0.03em' }}
        >
          Whet
          <span aria-hidden="true" className="text-ink-3">
            stone
          </span>
        </HomeLink>

        <div className={styles.navActions}>
          {viewer ? (
            <>
              <NextLink href="/discover" className="link tap-44 inline-flex text-sm text-ink-2">
                Open Whetstone
              </NextLink>
              <NextLink href="/new" className={`btn ${styles.btnSm}`}>
                Post a project
              </NextLink>
            </>
          ) : (
            <>
              <NextLink href="/sign-in" className="link tap-44 inline-flex text-sm text-ink-2">
                Sign in
              </NextLink>
              <NextLink href="/sign-up?next=%2Fnew" className={`btn ${styles.btnSm}`}>
                Post a project
              </NextLink>
            </>
          )}
        </div>

        <ul className={styles.navLinks}>
          {ITEMS.map((item) => {
            const current = pathname === item.href
            return (
              <li key={item.href}>
                <NextLink
                  href={item.href}
                  aria-current={current ? 'page' : undefined}
                  className={`${styles.navLink} tap-44`}
                >
                  {item.label}
                </NextLink>
              </li>
            )
          })}
        </ul>
      </nav>
    </header>
  )
}

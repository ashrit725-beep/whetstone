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
 * The marketing pages are static, so the server cannot say who is reading.
 * The right-hand slot asks once, after paint, and a signed-in member gets a way
 * into the product instead of a sign-in link. The signed-out pair is also the
 * server markup, so a visitor without an account sees no change at all.
 *
 * Keyboard contract: a plain list of links in visual order. The link for the
 * current page carries `aria-current="page"` and takes an underline, so the
 * state is not colour alone.
 */

import { HomeLink } from '@/components/chrome/home-link'
import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import styles from './paper.module.css'

interface NavItem {
  readonly href: string
  readonly label: string
}

const ITEMS: readonly NavItem[] = [
  { href: '/discover?open=1', label: 'Open asks' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/for-reviewers', label: 'For reviewers' },
]

interface Viewer {
  readonly handle: string
}

function isViewer(value: unknown): value is Viewer {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { handle?: unknown }).handle === 'string'
  )
}

export function MarketingNav() {
  const pathname = usePathname()
  const [viewer, setViewer] = useState<Viewer | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/auth/session', { cache: 'no-store', signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: unknown) => {
        if (isViewer(body)) setViewer(body)
      })
      .catch(() => {
        // Aborted on unmount, or offline: the signed-out links are still right
        // for anybody who is not signed in, and still work for anybody who is.
      })
    return () => {
      controller.abort()
    }
  }, [])

  return (
    <header className="pad-inline">
      <nav
        aria-label="Whetstone"
        className="mx-auto flex max-w-page flex-wrap items-center gap-x-8 gap-y-3 border-b border-rule py-4"
      >
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

        <ul className="flex basis-full flex-wrap items-center gap-x-6 gap-y-2 text-sm sm:basis-auto sm:gap-x-8">
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

        <div className="flex items-center gap-4 sm:ms-auto">
          {viewer ? (
            <>
              <NextLink href="/discover" className="link tap-44 inline-flex text-sm text-ink-2">
                Open Whetstone
              </NextLink>
              <NextLink href="/new" className="btn text-xs">
                Post a project
              </NextLink>
            </>
          ) : (
            <>
              <NextLink href="/sign-in" className="link tap-44 inline-flex text-sm text-ink-2">
                Sign in
              </NextLink>
              <NextLink href="/sign-up?next=%2Fnew" className="btn text-xs">
                Post a project
              </NextLink>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}

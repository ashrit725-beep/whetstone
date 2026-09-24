'use client'

/**
 * The two ranked actions, pointed at where the reader can actually go.
 *
 * Signed out, the primary action is an account: posting a project needs one.
 * Signed in, both actions go straight into the product, because sending a
 * member to `/sign-up?next=/new` and bouncing them through a redirect is a
 * round trip that exists only because the page was rendered for a stranger.
 *
 * The signed-out pair is the server markup, so a crawler and a first-time
 * visitor see the finished thing and nothing swaps for them.
 *
 * Below 30rem the two take the column rather than hugging their labels: at that
 * width they cannot share a row, and hugging put a 236px secondary under a
 * 172px primary, which is the ranking backwards.
 *
 * Keyboard contract: two links, in ranked order, at the site's own hit size.
 */

import NextLink from 'next/link'
import styles from './paper.module.css'
import { useViewer } from './use-viewer'

export interface CtaPairProps {
  /** Adds 8px of height and a wider gutter: the hero and the closing band. */
  large?: boolean
  /** The secondary action, when the page wants something other than Discover. */
  secondary?: { readonly href: string; readonly label: string }
}

export function CtaPair({ large = false, secondary }: CtaPairProps) {
  const viewer = useViewer()
  const size = large ? styles.btnLg : ''

  return (
    <div className={styles.ctaPair}>
      <NextLink href={viewer ? '/new' : '/sign-up?next=%2Fnew'} className={`btn ${size}`}>
        Post a project
      </NextLink>
      {viewer && !secondary ? (
        <NextLink href="/dashboard" className={`btn btn-secondary ${size}`}>
          Go to your dashboard
        </NextLink>
      ) : (
        <NextLink
          href={secondary?.href ?? '/discover?open=1'}
          className={`btn btn-secondary ${size}`}
        >
          {secondary?.label ?? 'Browse open projects'}
        </NextLink>
      )}
    </div>
  )
}

/**
 * Link
 *
 * Keyboard contract
 *   Tab / Shift+Tab move focus. Enter activates. Space does not, which is the
 *   native anchor behaviour and the reason a link is never used as a button.
 *   Focus ring is the global 2px ink outline at 3px offset.
 *
 * External destinations get rel="noopener noreferrer", target="_blank", and a
 * visually hidden "(opens in a new tab)" so the change of context is announced.
 * A Link without a real destination is a bug; there is no empty fragment escape hatch.
 */

import NextLink from 'next/link'
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type LinkVariant = 'inline' | 'standalone' | 'quiet'

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string
  /**
   * inline     sits inside a sentence, underlined at rest.
   * standalone sits on its own line, 44px hit area, underlines on hover.
   * quiet      standalone in text-2, for footer and metadata rows.
   */
  variant?: LinkVariant
  /** Defaults to true for absolute http destinations. */
  external?: boolean
  /** Shows the outbound arrow on a standalone external link. Default true. */
  showExternalIcon?: boolean
  /** Passed to next/link, except into the marketing pages, which are never prefetched. */
  prefetch?: boolean | null
  children: ReactNode
}

/**
 * The landing, how-it-works, for-reviewers and legal pages carry their own
 * stylesheet. Prefetching one of them from anywhere else brings a preload hint
 * for that sheet into a page that never applies it, and Chrome reports the
 * unused preload a few seconds after load. They are a footer link away from
 * every surface, so they load on the click instead.
 */
const MARKETING_ROUTE = /^\/(?:(?:how-it-works|for-reviewers|legal)(?:[/?#]|$)|[?#]|$)/

const VARIANT: Record<LinkVariant, string> = {
  inline: 'text-accent underline hover:text-text-1',
  standalone:
    'tap-44 inline-flex items-center gap-2xs text-accent no-underline hover:underline',
  quiet:
    'tap-44 inline-flex items-center gap-2xs text-text-2 no-underline hover:text-text-1 hover:underline',
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  {
    href,
    variant = 'inline',
    external,
    showExternalIcon = true,
    prefetch,
    className,
    children,
    ...rest
  },
  ref,
) {
  const isExternal = external ?? /^https?:\/\//i.test(href)

  const classes = cn(
    'font-ui rounded-sm transition-[color] duration-[80ms] ease-[cubic-bezier(0.4,0,1,1)] hover:duration-[120ms] hover:ease-[cubic-bezier(0.16,1,0.3,1)]',
    VARIANT[variant],
    className,
  )

  const body = (
    <>
      {children}
      {isExternal ? (
        <>
          {variant !== 'inline' && showExternalIcon ? (
            <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
          ) : null}
          <span className="sr-only">(opens in a new tab)</span>
        </>
      ) : null}
    </>
  )

  if (isExternal) {
    return (
      <a
        {...rest}
        ref={ref}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
      >
        {body}
      </a>
    )
  }

  return (
    <NextLink
      {...rest}
      ref={ref}
      href={href}
      prefetch={MARKETING_ROUTE.test(href) ? false : prefetch}
      className={classes}
    >
      {body}
    </NextLink>
  )
})

export default Link

/**
 * The wordmark. Type, not artwork: Archivo ground to `wdth` 112, the same
 * width the page `h1` is set at, so the product's name and its headlines are
 * visibly the same tool. There is no lockup, no glyph, and no image.
 */

import { HomeLink } from './home-link'
import { cn } from '@/lib/utils'

const WORDMARK_AXES = { fontVariationSettings: '"wdth" 112, "wght" 700' } as const

export interface WordmarkProps {
  /** `lg` in the nav, `sm` in the footer. */
  size?: 'sm' | 'lg'
  /** Renders as plain text rather than a link. Nothing uses it today: the
   *  wordmark is the way home on every surface, footers included. */
  as?: 'link' | 'text'
  /** Home for this reader: Discover when signed in, the front page when not. */
  href?: string
  className?: string
}

export function Wordmark({ size = 'lg', as = 'link', href = '/', className }: WordmarkProps) {
  const shell = cn(
    'inline-flex items-center whitespace-nowrap text-text-1',
    size === 'lg' ? 'text-md' : 'text-sm',
    className,
  )

  if (as === 'text') {
    return (
      <span className={shell} style={{ ...WORDMARK_AXES, letterSpacing: '-0.02em' }}>
        Whetstone
      </span>
    )
  }

  return (
    <HomeLink
      href={href}
      className={cn(
        shell,
        'tap-44 rounded-sm px-2xs transition-[color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-accent',
      )}
      style={{ ...WORDMARK_AXES, letterSpacing: '-0.02em' }}
    >
      Whetstone
    </HomeLink>
  )
}

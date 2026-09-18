/**
 * The wordmark. Type, not artwork: Archivo ground to `wdth` 112, the same
 * width the page `h1` is set at, so the product's name and its headlines are
 * visibly the same tool. There is no lockup, no glyph, and no image.
 */

import NextLink from 'next/link'
import { cn } from '@/lib/utils'

const WORDMARK_AXES = { fontVariationSettings: '"wdth" 112, "wght" 700' } as const

export interface WordmarkProps {
  /** `lg` in the nav, `sm` in the footer. */
  size?: 'sm' | 'lg'
  /** Renders as plain text rather than a link, for the page a link would
   *  point back at. */
  as?: 'link' | 'text'
  href?: string
  className?: string
}

export function Wordmark({ size = 'lg', as = 'link', href = '/discover', className }: WordmarkProps) {
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
    <NextLink
      href={href}
      className={cn(
        shell,
        'rounded-sm px-2xs transition-[color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-accent',
      )}
      style={{ ...WORDMARK_AXES, letterSpacing: '-0.02em' }}
    >
      Whetstone
    </NextLink>
  )
}

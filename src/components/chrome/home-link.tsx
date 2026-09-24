'use client'

/**
 * The link behind the wordmark, which is the way home everywhere.
 *
 * On the page it points at, following it would change nothing, and a wordmark
 * that does nothing when pressed reads as broken. There it returns to the top
 * of the page instead (at once under reduced motion), which is what the same
 * gesture does in most products.
 */

import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'

export interface HomeLinkProps {
  href: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export function HomeLink({ href, className, style, children }: HomeLinkProps) {
  const pathname = usePathname()

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (pathname !== href) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' })
  }

  return (
    <NextLink href={href} aria-label="Whetstone, home" className={className} style={style} onClick={onClick}>
      {children}
    </NextLink>
  )
}

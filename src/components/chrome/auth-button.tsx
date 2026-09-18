'use client'

/**
 * AuthButton: "Sign in" and "Create an account" for a signed-out reader, with
 * the way back.
 *
 * The href carries `?next=` set to the page the reader is on, so signing in
 * from the header of a thread lands on that thread rather than on the feed.
 * The auth pages pass the value through `safeNextPath`, which refuses anything
 * that is not a same-site path, so nothing here needs to vet it.
 *
 * It is a client island for the same reason `NavLinks` is: the shell layout
 * does not re-render when the page beneath it changes, so a path read on the
 * server would go stale on the first in-app link the reader follows.
 *
 * The query string is read through `useSearchParams` inside its own Suspense
 * boundary. A dynamic render resolves it at once and the server HTML already
 * holds the full address; a static render would stop at the boundary, whose
 * fallback still returns the reader to the right page, only without the query.
 */

import { Suspense, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui'

export interface AuthButtonProps {
  to: '/sign-in' | '/sign-up'
  variant: 'primary' | 'secondary'
  fullWidth?: boolean
  children: ReactNode
}

export function AuthButton(props: AuthButtonProps) {
  return (
    <Suspense fallback={<AuthAnchor {...props} search="" />}>
      <AuthAnchorWithQuery {...props} />
    </Suspense>
  )
}

function AuthAnchorWithQuery(props: AuthButtonProps) {
  const query = useSearchParams().toString()
  return <AuthAnchor {...props} search={query ? `?${query}` : ''} />
}

function AuthAnchor({ to, variant, fullWidth, children, search }: AuthButtonProps & { search: string }) {
  const pathname = usePathname()
  const href = `${to}?${new URLSearchParams({ next: `${pathname}${search}` }).toString()}`
  return (
    <Button as="a" href={href} variant={variant} fullWidth={fullWidth}>
      {children}
    </Button>
  )
}

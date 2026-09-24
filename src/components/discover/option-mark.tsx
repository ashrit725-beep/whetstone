'use client'

/**
 * The reserved glyph slot in front of a filter option, in both rails: the Check
 * that says this option is on, or, while the page that option asks for is on
 * its way, the spinner that says the click was heard.
 *
 * Why it exists. A filter is a link to a Server Component, and a transition to a
 * page that is already on screen shows no `loading.tsx` fallback — React keeps
 * the current screen until the new one is ready. So a navigation that takes a
 * moment said nothing at all, and a reader who clicked "Most needed" had no way
 * to tell a slow answer from a dead control.
 *
 * Why not `useLinkStatus`. Next's own pending flag is set inside the same
 * transition as the navigation, so it only paints when that transition commits:
 * measured against a navigation that took ninety seconds, the flag never
 * reached the screen. The state here is set from the click itself, outside any
 * transition, so it commits immediately and is honest about what is happening
 * even when the router is not moving.
 *
 * `useDelayedLoading` holds the spinner back 350ms and then keeps it up for
 * 300ms, so a navigation that lands quickly — nearly all of them — draws
 * nothing, and nothing ever strobes. The slot is the same 16px whatever it
 * holds, so the row does not move.
 */

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Spinner, useDelayedLoading } from '@/components/ui'

export interface OptionMarkProps {
  selected: boolean
  /** This option is the one the reader picked and is still waiting on. */
  pending?: boolean
}

export function OptionMark({ selected, pending = false }: OptionMarkProps) {
  const waiting = useDelayedLoading(pending, { delayMs: 350 })
  if (waiting) return <Spinner size={16} />
  return selected ? <Check size={16} strokeWidth={1.5} /> : null
}

/**
 * The option the reader has chosen, until the page it asks for arrives.
 *
 * `address` is the filter state the server drew this rail from. When the new
 * page lands it is a different string, which is the signal — and the only
 * honest one — that the wait is over.
 */
export function usePicked(address: string): [string | null, (href: string) => void] {
  const [picked, setPicked] = useState<string | null>(null)
  useEffect(() => setPicked(null), [address])
  return [picked, setPicked]
}

export default OptionMark

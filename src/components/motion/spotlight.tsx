'use client'

/**
 * Spotlight — the cursor uncovers a second image through a soft radial mask.
 *
 * In Whetstone this earns its place on a project's media stage: the base layer
 * is the build as it ships, the revealed layer is the same frame with the thing
 * the creator is asking about marked on it. Moving the cursor is how you look
 * at what they are pointing at, which is the page's whole job.
 *
 * Touch gets the same treatment through touchmove, and a keyboard or
 * reduced-motion visitor gets the revealed layer shown outright rather than a
 * feature they cannot reach.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface SpotlightProps {
  /** Rendered underneath, always visible. */
  base: React.ReactNode
  /** Rendered on top, uncovered by the pointer. */
  reveal: React.ReactNode
  /** Says what the second layer shows, for people who never see the effect. */
  revealLabel: string
  className?: string
}

function radiusFor(width: number): number {
  if (width < 480) return 120
  if (width < 720) return 160
  return 260
}

export function Spotlight({ base, reveal, revealLabel, className }: SpotlightProps) {
  const frame = useRef<HTMLDivElement | null>(null)
  const layer = useRef<HTMLDivElement | null>(null)
  const [always, setAlways] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse = window.matchMedia('(hover: none)').matches
    // Nobody should have to chase a spotlight to see the thing being asked
    // about. Without a hover-capable pointer, or with motion turned down, the
    // second layer is simply shown.
    if (reduced || coarse) setAlways(true)
  }, [])

  const move = useCallback((clientX: number, clientY: number) => {
    const el = layer.current
    const box = frame.current
    if (!el || !box) return
    const r = box.getBoundingClientRect()
    const x = clientX - r.left
    const y = clientY - r.top
    // #fff in a mask is an alpha channel, not a colour: it means "fully
    // revealed". There is no token for it and there should not be.
    const g = `radial-gradient(circle ${String(radiusFor(window.innerWidth))}px at ${String(x)}px ${String(y)}px, #fff 0%, #fff 40%, rgba(255,255,255,0.75) 60%, rgba(255,255,255,0.4) 75%, rgba(255,255,255,0.12) 88%, transparent 100%)`
    el.style.webkitMaskImage = g
    el.style.maskImage = g
  }, [])

  const clear = useCallback(() => {
    const el = layer.current
    if (!el) return
    const g = 'radial-gradient(circle 0px at -999px -999px, #fff, transparent)'
    el.style.webkitMaskImage = g
    el.style.maskImage = g
  }, [])

  return (
    <div
      ref={frame}
      className={cn('relative overflow-hidden', className)}
      onPointerMove={always ? undefined : (e) => { move(e.clientX, e.clientY) }}
      onPointerLeave={always ? undefined : clear}
      onTouchMove={always ? undefined : (e) => {
        const t = e.touches[0]
        if (t) move(t.clientX, t.clientY)
      }}
    >
      {base}
      <div
        ref={layer}
        aria-hidden={always ? undefined : 'true'}
        className="absolute inset-0"
        style={
          always
            ? undefined
            : {
                maskImage: 'radial-gradient(circle 0px at -999px -999px, #fff, transparent)',
                WebkitMaskImage: 'radial-gradient(circle 0px at -999px -999px, #fff, transparent)',
              }
        }
      >
        {reveal}
      </div>
      <span className="sr-only">{revealLabel}</span>
    </div>
  )
}

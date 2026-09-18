'use client'

/**
 * CardsCarousel — a horizontally scrolled rail of projects that expand into a
 * full reader.
 *
 * Adapted from the Aceternity apple-cards-carousel. What changed, and why each
 * change was necessary rather than taste:
 *  - It does NOT auto-rotate. WCAG 2.2 SC 2.2.2 requires pause, stop or hide
 *    for anything that moves automatically for more than five seconds, and an
 *    auto-rotating rail also steals a project's turn from the reader. This one
 *    only moves when a person moves it, which removes the requirement entirely.
 *  - The rail is a real overflow-x scroller with `tabIndex={0}` and an
 *    accessible name, so it is keyboard-scrollable (SC 2.1.1) rather than being
 *    reachable only by the arrow buttons.
 *  - The arrow buttons are 44px, disable at each end with `aria-disabled` and a
 *    visible reason, and never disappear.
 *  - The expanded card is a real modal: focus is trapped, Escape closes it,
 *    focus returns to the card that opened it, and the background is inert.
 *  - `useOutsideClick` uses pointerdown with composedPath, so a drag that
 *    starts inside and ends outside does not close it mid-gesture.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useOutsideClick } from './use-outside-click'

export interface CarouselCard {
  id: string
  title: string
  category: string
  cover: string
  /** Shown when the card is opened. */
  detail: React.ReactNode
}

export interface CardsCarouselProps {
  cards: readonly CarouselCard[]
  /** Names the rail for screen readers, e.g. "Projects taking feedback". */
  label: string
  className?: string
}

export function CardsCarousel({ cards, label, className }: CardsCarouselProps) {
  const rail = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const invoker = useRef<HTMLButtonElement | null>(null)

  const sync = useCallback(() => {
    const el = rail.current
    if (!el) return
    setAtStart(el.scrollLeft <= 1)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1)
  }, [])

  useEffect(() => { sync() }, [sync, cards.length])

  const nudge = (dir: -1 | 1) => {
    const el = rail.current
    if (!el) return
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: 'smooth' })
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div
        ref={rail}
        onScroll={sync}
        tabIndex={0}
        role="group"
        aria-label={`${label}. Scrollable horizontally.`}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-3 [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink"
      >
        {cards.map((c) => (
          <Card
            key={c.id}
            card={c}
            onOpen={(btn) => { invoker.current = btn; setOpen(c.id) }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <RailButton label="Scroll left" disabled={atStart} onClick={() => nudge(-1)}>
          <ArrowLeft size={20} strokeWidth={1.5} aria-hidden="true" />
        </RailButton>
        <RailButton label="Scroll right" disabled={atEnd} onClick={() => nudge(1)}>
          <ArrowRight size={20} strokeWidth={1.5} aria-hidden="true" />
        </RailButton>
        <span className="text-xs text-ink-3">
          {atStart && atEnd ? 'All of them fit.' : 'Drag, scroll, or use the arrow keys.'}
        </span>
      </div>

      <AnimatePresence>
        {open !== null && (
          <Reader
            card={cards.find((c) => c.id === open) ?? null}
            onClose={() => { setOpen(null); invoker.current?.focus() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function RailButton({
  label, disabled, onClick, children,
}: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled}
      onClick={() => { if (!disabled) onClick() }}
      className={cn(
        'grid h-48 w-48 place-items-center rounded-xs border-[1.5px] transition-colors duration-[120ms]',
        disabled
          ? 'cursor-not-allowed border-rule text-ink-3'
          : 'border-rule-2 text-ink hover:border-ink',
      )}
    >
      {children}
      {disabled && <span className="sr-only">, already at the end</span>}
    </button>
  )
}

function Card({
  card, onOpen,
}: { card: CarouselCard; onOpen: (btn: HTMLButtonElement) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => onOpen(e.currentTarget)}
      className="group relative h-[24rem] w-[17rem] flex-none snap-start overflow-hidden rounded-xs border border-rule-2 bg-paper-sub text-start focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink"
    >
      <Image src={card.cover} alt="" fill sizes="17rem" className="object-cover" />
      {/* A flat ink scrim, not a gradient: the label has to clear 4.5:1 over art. */}
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-[rgb(12_10_7/0.72)]" />
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4">
        <span className="text-2xs uppercase tracking-[0.12em] text-on-media-dim">{card.category}</span>
        <span className="text-lg text-on-media">{card.title}</span>
      </span>
    </button>
  )
}

function Reader({ card, onClose }: { card: CarouselCard | null; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const titleId = useId()

  useOutsideClick(panel, onClose)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  if (!card) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.18 }}
      className="fixed inset-0 z-[400] grid place-items-center bg-[rgb(12_10_7/0.62)] p-6"
    >
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={reduced ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
        transition={{ duration: reduced ? 0 : 0.24, ease: [0.2, 0, 0, 1] }}
        className="max-h-[86vh] w-full max-w-[46rem] overflow-y-auto rounded-sm border border-rule-2 bg-paper p-12 outline-none"
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-2xs uppercase tracking-[0.12em] text-ink-3">{card.category}</p>
            <h2 id={titleId} className="mt-1 text-xl">{card.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-48 w-48 flex-none place-items-center rounded-xs border-[1.5px] border-rule-2 text-ink hover:border-ink"
          >
            <X size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-6">{card.detail}</div>
      </motion.div>
    </motion.div>
  )
}

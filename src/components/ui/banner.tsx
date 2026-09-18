'use client'

/**
 * Banner: an in-flow message that belongs to the content it sits in.
 *
 * A banner never floats. Use it for something the reader must see while doing
 * the task in front of them: a failed save above a form footer, a note about
 * how a filter is narrowing results. If the result is off-screen, use a Toast
 * instead.
 *
 * Keyboard contract:
 *   Tab            reaches the action, then the dismiss button, in visual order.
 *   Enter / Space  activate whichever is focused.
 *   Escape         does nothing. A banner is in flow, not an overlay.
 * A dismissed banner with a `persistKey` stays dismissed for that browser.
 *
 * This file also owns `MessageAction`, the one action button shared by Banner,
 * EmptyState, ErrorState, Toast and the Dialog error slot, so the five message
 * surfaces cannot drift apart.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

/* ---------------------------------------------------------------- actions -- */

export interface MessageActionSpec {
  /** A verb phrase. Never wraps to two lines. */
  label: string
  onClick?: () => void
  href?: string
  /** Marks the one action that continues the flow. At most one per message. */
  primary?: boolean
  /** In flight. The control stays focusable and says why it cannot be pressed again. */
  busy?: boolean
}

/** 44px minimum hit area, stated once, in real units, per contract §5.5. Used by
 *  the controls that cannot be a `Button`, such as menu items carrying
 *  `role="menuitem"`. */
export const MIN_TAP: { minBlockSize: string } = { minBlockSize: '2.75rem' }

export interface MessageActionProps {
  action: MessageActionSpec
  className?: string
}

/**
 * The action control for every message surface. It delegates to `Button`, so
 * Banner, EmptyState, ErrorState and Toast cannot drift away from the rest of
 * the product’s controls.
 */
export function MessageAction({ action, className }: MessageActionProps) {
  const variant = action.primary ? 'primary' : 'secondary'

  if (action.href) {
    return (
      <Button as="a" href={action.href} variant={variant} className={className}>
        {action.label}
      </Button>
    )
  }

  return (
    <Button
      variant={variant}
      loading={action.busy ?? false}
      loadingLabel={`${action.label}…`}
      onClick={action.onClick}
      className={className}
    >
      {action.label}
    </Button>
  )
}

/* ---------------------------------------------------------------- banner --- */

export type BannerVariant = 'info' | 'success' | 'warning' | 'danger'

const VARIANT: Record<BannerVariant, { icon: LucideIcon; shell: string; ink: string }> = {
  /* Info is the only non-interactive use of the accent (contract §0.17). */
  info: { icon: Info, shell: 'border-border-hair bg-surface-wash', ink: 'text-info' },
  success: { icon: CircleCheck, shell: 'border-positive bg-surface-2', ink: 'text-positive' },
  /* Warn is straw as icon + border + label. Straw never fills outside the marketplace. */
  warning: { icon: TriangleAlert, shell: 'border-warn bg-surface-2', ink: 'text-warn' },
  danger: { icon: CircleAlert, shell: 'border-critical bg-surface-2', ink: 'text-critical' },
}

const PERSIST_PREFIX = 'whetstone:banner:'

export interface BannerProps {
  variant?: BannerVariant
  /** One line, sentence case, no exclamation mark. */
  title: string
  /** What it means and what to do next. */
  children?: ReactNode
  action?: MessageActionSpec
  /** Adds a dismiss button. */
  dismissible?: boolean
  /** With `dismissible`, remembers the dismissal in this browser under this key. */
  persistKey?: string
  onDismiss?: () => void
  /** Announce on appearance. Danger always announces. */
  announce?: boolean
  className?: string
  id?: string
}

export function Banner({
  variant = 'info',
  title,
  children,
  action,
  dismissible = false,
  persistKey,
  onDismiss,
  announce = false,
  className,
  id,
}: BannerProps) {
  const persisted = dismissible && typeof persistKey === 'string' && persistKey.length > 0
  const [phase, setPhase] = useState<'checking' | 'shown' | 'dismissed'>(persisted ? 'checking' : 'shown')

  useEffect(() => {
    if (!persisted || !persistKey) return
    let stored: string | null = null
    try {
      stored = window.localStorage.getItem(PERSIST_PREFIX + persistKey)
    } catch {
      stored = null
    }
    setPhase(stored === 'dismissed' ? 'dismissed' : 'shown')
  }, [persisted, persistKey])

  function dismiss() {
    if (persisted && persistKey) {
      try {
        window.localStorage.setItem(PERSIST_PREFIX + persistKey, 'dismissed')
      } catch {
        /* A browser that refuses storage still gets the dismissal for this view. */
      }
    }
    setPhase('dismissed')
    onDismiss?.()
  }

  if (phase !== 'shown') return null

  const { icon: Icon, shell, ink } = VARIANT[variant]
  const live = variant === 'danger' ? 'alert' : announce ? 'status' : undefined

  return (
    <div
      id={id}
      role={live}
      className={cn('flex items-start gap-sm rounded-md border p-sm', shell, className)}
    >
      <Icon size={20} strokeWidth={1.5} aria-hidden="true" className={cn('mt-3xs shrink-0', ink)} />

      <div className="track-safe flex min-w-0 grow flex-col gap-2xs">
        <p className="text-sm text-text-1" style={{ fontVariationSettings: '"wdth" 100, "wght" 600' }}>
          {title}
        </p>
        {children ? <div className="measure-ui text-xs text-text-2">{children}</div> : null}
        {action ? (
          <div className="mt-2xs">
            <MessageAction action={action} />
          </div>
        ) : null}
      </div>

      {dismissible ? (
        <button
          type="button"
          onClick={dismiss}
          className="tap-44 -m-3xs shrink-0 rounded-sm p-3xs text-text-3 transition-colors duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-text-1"
          aria-label={`Dismiss the message “${title}”`}
        >
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

export default Banner

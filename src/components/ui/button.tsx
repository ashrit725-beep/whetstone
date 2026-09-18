'use client'

/**
 * Button
 *
 * Keyboard contract
 *   Tab / Shift+Tab   move focus onto and off the control.
 *   Enter / Space     activate it (native <button>).
 *   as="a"            Enter activates; Space scrolls, which is native anchor behaviour.
 *   Disabled and loading buttons keep their tab stop so the reason text stays
 *   reachable; activation is blocked in the handler rather than by removing the
 *   element from the focus order.
 *   Focus ring is the global 2px ink outline at 3px offset, painted instantly,
 *   never transitioned (declared once in globals.css).
 *
 * All eight states ship here: default, hover, focus-visible, active, disabled,
 * loading, error (the caller passes `variant="danger"` plus a reason), success.
 */

import {
  forwardRef,
  useId,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'straw'
export type ButtonSize = 'sm' | 'md' | 'lg'

/** Bricolage carries button labels at wght 600. The body sets font-variation-settings,
 *  and that property inherits, so a font-weight utility alone would be ignored. */
const LABEL_AXES = { fontVariationSettings: '"wdth" 100, "wght" 600' } as const

interface ButtonOwnProps {
  /** Visual role. `straw` is the marketplace fill and is legal on surface 7 only. */
  variant?: ButtonVariant
  /** sm 36px, md 44px, lg 52px. Under 44 the control gains a tap-44 hit area. */
  size?: ButtonSize
  /** Locks the width, sets aria-busy, blocks activation. */
  loading?: boolean
  /** Announced while loading. Keep it a verb phrase. */
  loadingLabel?: string
  /** Marks the control aria-disabled and blocks activation. Never opacity alone. */
  disabled?: boolean
  /** Visible sentence saying why the control is unavailable. Required with `disabled`. */
  disabledReason?: string
  /** Pass a lucide icon at size 16 (sm) or 20 (md, lg), strokeWidth 1.5. */
  iconLeading?: ReactNode
  iconTrailing?: ReactNode
  fullWidth?: boolean
}

type ButtonAsButton = ButtonOwnProps & {
  as?: 'button'
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'color'>

type ButtonAsAnchor = ButtonOwnProps & {
  as: 'a'
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'color'>

export type ButtonProps = ButtonAsButton | ButtonAsAnchor

/** The flattened shape the implementation reads, after the union has been resolved. */
type ResolvedButtonProps = ButtonOwnProps & {
  as?: 'button' | 'a'
  className?: string
  children?: ReactNode
  href?: string
  type?: 'button' | 'submit' | 'reset'
  onClick?: (event: MouseEvent<HTMLElement>) => void
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type' | 'disabled'> &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'onClick' | 'type' | 'href'>

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-9 px-sm text-sm tap-44',
  md: 'h-11 px-md text-sm',
  lg: 'h-13 px-lg text-base',
}

const GAP: Record<ButtonSize, string> = { sm: 'gap-2xs', md: 'gap-xs', lg: 'gap-xs' }

/* Primary is inked, exactly as `.btn` is. The mark stays the ask's alone: a
   red primary one click after an ink one made the composer's "Post feedback"
   the colour of the validation errors beside it. */
const VARIANT: Record<ButtonVariant, string> = {
  primary: 'border-ink bg-ink text-btn-ink',
  secondary:
    'border-border-control bg-surface-2 text-text-1 hover:border-border-strong hover:bg-surface-3',
  ghost:
    'border-transparent bg-transparent text-text-2 hover:border-border-control hover:bg-surface-2 hover:text-text-1',
  danger: 'border-critical bg-critical text-critical-ink',
  straw: 'border-straw-fill bg-straw-fill text-straw-ink',
}

const INERT_LOOK =
  'cursor-not-allowed border-border-control bg-surface-2 text-text-disabled'

const BASE = cn(
  'relative inline-flex select-none items-center justify-center whitespace-nowrap',
  'rounded-sm border font-ui',
  // Exits are 80ms; the hover and active rules below raise the duration on the way in.
  // `translate` is listed because Tailwind v4 lifts translate out of `transform`.
  'transition-[color,background-color,border-color,transform,translate] duration-[80ms] ease-[cubic-bezier(0.4,0,1,1)]',
)

const MOTION = cn(
  'hover:duration-[120ms] hover:ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px',
  'active:translate-y-px active:duration-[90ms]',
)

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(props, ref) {
    const {
      variant = 'secondary',
      size = 'md',
      loading = false,
      loadingLabel = 'Working…',
      disabled = false,
      disabledReason,
      iconLeading,
      iconTrailing,
      fullWidth = false,
      href,
      as = 'button',
      className,
      children,
      style,
      onClick,
      'aria-describedby': describedBy,
      ...rest
    } = props as ResolvedButtonProps

    const reactId = useId()
    const reasonId = disabledReason ? `${reactId}-reason` : undefined
    const inert = disabled || loading
    const iconSize = size === 'sm' ? 16 : 20

    const classes = cn(
      BASE,
      SIZE[size],
      inert ? INERT_LOOK : cn(VARIANT[variant], MOTION),
      fullWidth && 'w-full',
      className,
    )

    const body = (
      <>
        <span
          className={cn('inline-flex items-center', GAP[size], loading && 'invisible')}
        >
          {iconLeading ? (
            <span className="shrink-0" aria-hidden="true">
              {iconLeading}
            </span>
          ) : null}
          {children}
          {iconTrailing ? (
            <span className="shrink-0" aria-hidden="true">
              {iconTrailing}
            </span>
          ) : null}
        </span>
        {loading ? (
          <span className="absolute inset-0 inline-flex items-center justify-center">
            {/* The one sanctioned looping animation: a genuine loading indicator,
                guarded by motion-safe so reduced motion renders a static arc. */}
            <LoaderCircle
              size={iconSize}
              strokeWidth={1.5}
              aria-hidden="true"
              className="motion-safe:animate-spin"
            />
            <span className="sr-only">{loadingLabel}</span>
          </span>
        ) : null}
      </>
    )

    const guard = (event: MouseEvent<HTMLElement>) => {
      if (inert) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      onClick?.(event)
    }

    const shared = {
      className: classes,
      style: { ...style, ...LABEL_AXES },
      'aria-busy': loading || undefined,
      'aria-disabled': inert || undefined,
      'aria-describedby': [describedBy, reasonId].filter(Boolean).join(' ') || undefined,
      onClick: guard,
    }

    const control =
      as === 'a' ? (
        <a
          {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
          {...shared}
          ref={ref as Ref<HTMLAnchorElement>}
          // A disabled anchor is not a thing in HTML; drop the destination instead.
          href={inert ? undefined : href}
        >
          {body}
        </a>
      ) : (
        <button
          type="button"
          {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
          {...shared}
          ref={ref as Ref<HTMLButtonElement>}
        >
          {body}
        </button>
      )

    if (!disabledReason) return control

    return (
      <span className={cn('inline-flex flex-col gap-2xs', fullWidth && 'w-full')}>
        {control}
        <span id={reasonId} className="measure-ui text-xs text-text-3">
          {disabledReason}
        </span>
      </span>
    )
  },
)

export default Button

/**
 * Avatar and AvatarGroup.
 *
 * Keyboard contract:
 *   Avatar        not focusable. It is an image, or a generated tile standing
 *                 in for one.
 *   AvatarGroup   the overflow control ("+7") is a real <button> using the
 *                 platform Popover API. Enter or Space opens the list, Escape
 *                 closes it, and the browser returns focus to the button. The
 *                 list itself is a <ul> of names, so the group never hides a
 *                 participant behind a picture.
 *
 * Contract notes:
 *   §5.1   `rounded-full` is legal on an <img> avatar and nowhere else in the
 *          product, so a real portrait is a circle and the generated tile is a
 *          2px square. That difference is deliberate and readable: a circle is
 *          a photograph of a person, a square is a mark standing in for one.
 *   §8.1.13  a per-user hue is not available to us: every colour in this
 *          product comes from the token set, and the token set has five hues,
 *          all of which already mean something. Identity variance is carried
 *          instead by the surface step and by the angle of the hatch band:
 *          four fills crossed with two angles, eight stable variants, all of
 *          which survive greyscale and all of which keep the initials above
 *          9.9:1 because the band never crosses the letters.
 *
 *          The band used to pick one of the five grit densities by hash as
 *          well. Those spacings run 16 down to 1 user units and are meant for
 *          a full hatch field; inside a 6px band on a 24px tile the coarse end
 *          drew one or two strokes that read as scratches and the fine end
 *          filled solid, so four tiles in one column showed three unrelated
 *          treatments. One density renders identically at every tile size, and
 *          an avatar has no maturity for a grit step to mean anything about.
 */

import Link from 'next/link'
import { cn, hashCode } from '@/lib/utils'
import { GritHatch } from './grit'

export type AvatarSize = 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<AvatarSize, string> = {
  sm: 'h-lg w-lg text-2xs',
  md: 'h-xl w-xl text-xs',
  lg: 'h-2xl w-2xl text-sm',
}

const SIZE_PX: Record<AvatarSize, number> = { sm: 24, md: 32, lg: 48 }

const TILE_FILL = ['bg-surface-0', 'bg-surface-2', 'bg-surface-3', 'bg-surface-4'] as const

/** The one hatch density the identity band is drawn at, whatever the tile size. */
const BAND_GRIT = 1000

export function initialsFor(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export interface AvatarProps {
  /** Stable identity key. Same id, same tile, forever. */
  userId: string
  name: string
  src?: string | null
  size?: AvatarSize
  /**
   * True when no adjacent text names this person, which makes the avatar the
   * only place the name appears and therefore real content. Default false:
   * the name is beside it, so the image is decorative and `alt=""` (§9.4.34).
   */
  standalone?: boolean
  className?: string
}

export function Avatar({
  userId,
  name,
  src,
  size = 'md',
  standalone = false,
  className,
}: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={standalone ? name : ''}
        width={SIZE_PX[size]}
        height={SIZE_PX[size]}
        loading="lazy"
        decoding="async"
        className={cn(
          'shrink-0 rounded-full border border-border-hair object-cover',
          SIZE_CLASS[size],
          className,
        )}
      />
    )
  }

  const variant = hashCode(userId)
  const fill = TILE_FILL[variant % TILE_FILL.length] ?? TILE_FILL[0]
  const orientation = Math.floor(variant / TILE_FILL.length) % 2 === 0 ? 'horizontal' : 'vertical'

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xs border border-border-hair text-text-1',
        fill,
        SIZE_CLASS[size],
        className,
      )}
    >
      {standalone ? <span className="sr-only">{name}</span> : null}
      <span aria-hidden="true" style={{ fontVariationSettings: '"wdth" 87, "wght" 600' }}>
        {initialsFor(name)}
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 block"
        style={{ blockSize: '25%' }}
      >
        {/* One density, the mid step: spacing 4 and a 1.25 stroke read as a
            hatch at 24px and at 48px alike. */}
        <GritHatch value={BAND_GRIT} orientation={orientation} />
      </span>
    </span>
  )
}

/* -------------------------------------------------------------- the group -- */

export interface AvatarGroupPerson {
  id: string
  name: string
  src?: string | null
  /** Optional profile route. Names in the overflow list link to it. */
  href?: string
}

export interface AvatarGroupProps {
  people: readonly AvatarGroupPerson[]
  /** How many faces to show before collapsing. Default 4. */
  max?: number
  size?: AvatarSize
  /** Describes the set, e.g. "Reviewers on this project". */
  label: string
  className?: string
}

export function AvatarGroup({
  people,
  max = 4,
  size = 'sm',
  label,
  className,
}: AvatarGroupProps) {
  const shown = people.slice(0, max)
  const hidden = people.slice(max)
  const popoverId = `ws-avatars-${String(hashCode(people.map((p) => p.id).join(',')))}`

  return (
    <div className={cn('flex items-center', className)}>
      <ul className="flex items-center" aria-label={label}>
        {shown.map((person) => (
          // `flex`, not the default list-item: an inline-flex 24px tile
          // inside a list-item line box was pushed down 1.9px by the inherited
          // line height, so the faces and the "+N" control beside them sat on
          // two different top edges.
          <li key={person.id} className="-ml-2xs flex first:ml-0">
            <Avatar userId={person.id} name={person.name} src={person.src} size={size} standalone />
          </li>
        ))}
      </ul>

      {hidden.length > 0 ? (
        <>
          <button
            type="button"
            popoverTarget={popoverId}
            className={cn(
              'tap-44 -ml-2xs inline-flex items-center justify-center rounded-xs border border-border-hair bg-surface-2 px-2xs text-text-2 transition-[background-color,border-color,color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border-strong hover:bg-surface-3 hover:text-text-1 active:translate-y-px',
              SIZE_CLASS[size],
            )}
            style={{ fontVariationSettings: '"wdth" 87, "wght" 600' }}
          >
            <span aria-hidden="true" className="tnum">
              +{hidden.length}
            </span>
            <span className="sr-only">
              Show {hidden.length} more {hidden.length === 1 ? 'person' : 'people'} in {label}
            </span>
          </button>

          <div
            id={popoverId}
            popover="auto"
            className="max-w-rail rounded-lg border border-border-control bg-surface-4 p-md text-text-1 shadow-overlay"
          >
            <p className="text-xs text-text-3">{label}</p>
            <ul className="mt-xs space-y-2xs">
              {hidden.map((person) => (
                <li key={person.id} className="flex items-center gap-xs">
                  <Avatar userId={person.id} name={person.name} src={person.src} size="sm" />
                  {person.href ? (
                    <Link href={person.href} className="text-sm text-accent">
                      {person.name}
                    </Link>
                  ) : (
                    <span className="text-sm">{person.name}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  )
}

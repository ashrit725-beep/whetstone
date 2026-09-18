/**
 * Loading geometry for the dashboard.
 *
 * Every skeleton here is measured against the component it stands in for, in
 * the same units, so nothing moves when the data lands (§5.4 loading, PLAYBOOK
 * MOVE 1). They are shared by each route’s `loading.tsx` and by the `<Suspense>`
 * boundaries inside the pages, which is what keeps the two from drifting.
 *
 * Nothing here pulses on its own account: the pulse lives in the `Skeleton`
 * primitive, which already carries its reduced-motion path.
 */

import type { ReactNode } from 'react'
import { Skeleton, TableSkeleton } from '@/components/ui'
import { cn } from '@/lib/utils'

/**
 * Matches `WeekMetrics`: a <dl> of label, figure and the change in words, at the
 * same column counts the real strip steps through. Line boxes, not glyph
 * heights: the label and the delta are `text-xs` (1.1875rem) and the figure is
 * `text-lg` (2.03125rem), so the strip reserves its real height.
 */
export function MetricStripSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div
      aria-hidden="true"
      className="grid gap-lg sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3xs">
          <Skeleton w="9ch" h="1.1875rem" />
          <Skeleton w="4ch" h="2.03125rem" />
          <Skeleton w="20ch" h="1.1875rem" />
        </div>
      ))}
    </div>
  )
}

/**
 * Matches `FixFirst`: the two-line summary, a ranked list capped at the same
 * 72ch measure, and the closing lines that follow it.
 *
 * The list is capped here for the same reason it is capped there: an uncapped
 * row at 1440 leaves the action 500px clear of its sentence. The first row
 * drops its top rule and top padding, exactly as `first:border-t-0 first:pt-0`
 * does on the real one, and the wins, next-step and provenance lines are held
 * too, so the section below does not step down when the ranking lands.
 */
export function FixFirstSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-md">
      <div className="flex flex-col gap-2xs">
        <Skeleton w="34ch" h="1.75rem" />
        <Skeleton lines={2} w="52ch" h="1.3125rem" />
      </div>

      <div className="measure-cap flex flex-col">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className={cn(
              'flex flex-wrap items-start gap-md pb-md',
              i > 0 && 'border-t border-border-hair pt-md',
            )}
          >
            <Skeleton w="2ch" h="2.03125rem" />
            <div className="flex min-w-0 flex-1 basis-60 flex-col gap-2xs">
              <Skeleton w="28ch" h="1.75rem" />
              <Skeleton lines={2} h="1.3125rem" />
              <Skeleton w="24ch" h="1.3125rem" />
            </div>
            <Skeleton w="8.5rem" h="2.75rem" radius="sm" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2xs border-t border-border-hair pt-md">
        <Skeleton w="17ch" h="1.75rem" />
        <Skeleton w="44ch" h="1.3125rem" />
        <Skeleton w="40ch" h="1.3125rem" />
      </div>

      <div className="border-t border-border-hair pt-md">
        <Skeleton w="52ch" h="1.3125rem" />
      </div>

      <div className="flex flex-col gap-2xs">
        <div className="flex flex-wrap items-center gap-xs">
          <Skeleton w="11rem" h="1.5rem" radius="xs" />
          <Skeleton w="9ch" h="1.1875rem" />
        </div>
        <Skeleton lines={2} w="50ch" h="1.1875rem" />
      </div>
    </div>
  )
}

/**
 * Matches `RollupPane`: the provenance line, then one block per theme.
 *
 * A theme block is a title over its summary with the track control opposite,
 * then the bar itself (its own label line, the 24px bar, the legend), then the
 * four facts, then the pulled quote. The earlier version held only the bar, so
 * roughly two thirds of the block's height arrived after the skeleton left.
 */
export function RollupSkeleton({ bars = 3 }: { bars?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-lg">
      <div className="flex flex-col gap-2xs">
        <div className="flex flex-wrap items-center gap-xs">
          <Skeleton w="12rem" h="1.5rem" radius="xs" />
          <Skeleton w="9ch" h="1.1875rem" />
        </div>
        <Skeleton w="48ch" h="1.1875rem" />
      </div>

      <div className="flex flex-col">
        {Array.from({ length: bars }, (_, i) => (
          <div
            key={i}
            className={cn(
              'flex flex-col gap-sm pb-lg',
              i > 0 && 'border-t border-border-hair pt-lg',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-sm">
              <div className="flex min-w-0 flex-col gap-2xs">
                <Skeleton w="12ch" h="1.75rem" />
                <Skeleton w="42ch" h="1.1875rem" />
              </div>
              <Skeleton w="8.5rem" h="2.75rem" radius="sm" />
            </div>

            <div className="flex flex-col gap-2xs">
              <div className="flex items-baseline justify-between gap-sm">
                <Skeleton w="14ch" h="1.3125rem" />
                <Skeleton w="7ch" h="1.1875rem" />
              </div>
              <Skeleton h="1.5rem" radius="xs" />
              <Skeleton w="30ch" h="1.1875rem" />
            </div>

            <Skeleton w="56ch" h="1.3125rem" />

            <div className="flex flex-col gap-2xs border-s-2 border-border-hair ps-md">
              <Skeleton w="1rem" h="1rem" radius="xs" />
              <Skeleton lines={2} h="1.3125rem" />
              <Skeleton w="14ch" h="1.1875rem" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Matches the tracker: the reserved announcement line, then five columns, each a
 * heading over hairline-separated cards. The column itself draws no border, so
 * the card can: one containment level, never two (§5.2).
 *
 * Geometry tracks `SuggestionBoard` exactly: the same `gap-md` between columns,
 * the same wrapping 12rem track floor, the same `p-2xs` column inset, and the
 * same card stack of title, meta line and a 44px control row. The announcement
 * line above the board is reserved at 1lh in both, so the board does not step
 * upward when the real one arrives.
 */
export function BoardSkeleton({ columns = 5, cards = 3 }: { columns?: number; cards?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-md">
      <div className="text-sm" style={{ minBlockSize: '1lh' }} />
      <div
        className="relative grid gap-md"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 12rem), 1fr))' }}
      >
        {Array.from({ length: columns }, (_, c) => (
          <div key={c} className="flex flex-col gap-sm p-2xs">
            <div className="flex items-baseline justify-between gap-xs border-b border-border-hair pb-xs">
              <Skeleton w="10ch" h="1.25rem" />
              <Skeleton w="2ch" h="0.8125rem" />
            </div>
            {Array.from({ length: cards }, (_, i) => (
              <div
                key={i}
                className="flex flex-col gap-xs rounded-md border border-border-hair bg-surface-3 p-sm"
              >
                <Skeleton w="100%" h="0.875rem" />
                <Skeleton w="60%" h="0.8125rem" />
                <Skeleton w="9rem" h="2.75rem" radius="sm" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Matches `InboxTable` in both of its shapes, switched on the same container
 * width: the seven-column band from 52rem, and below that the stacked register
 * of who and when, the note at full width, then its badges.
 */
export function InboxRowsSkeleton({ rows = 12, label }: { rows?: number; label: string }) {
  return (
    <div className="@container">
      <div className="hidden @min-[52rem]:block">
        <TableSkeleton
          columns={7}
          rows={rows}
          label={label}
          className="rounded-md border border-border-hair"
        />
      </div>
      <div className="rounded-md border border-border-hair @min-[52rem]:hidden">
        <p role="status" className="sr-only">
          {label}
        </p>
        <div aria-hidden="true" className="border-b border-border-hair bg-surface-2 px-md py-sm">
          <Skeleton w="16rem" h="1.5rem" />
        </div>
        {Array.from({ length: Math.min(rows, 6) }, (_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className={cn(
              'flex gap-sm border-b border-border-hair px-md py-sm last:border-b-0',
              i % 2 === 1 && 'bg-surface-2',
            )}
          >
            <Skeleton w="1.5rem" h="1.5rem" />
            <div className="flex flex-1 flex-col gap-xs py-2xs">
              <Skeleton w="45%" h="1.5rem" />
              <Skeleton lines={2} h="0.875rem" />
              <Skeleton w="11rem" h="1.25rem" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Matches a hairline-ruled register: avatar, two lines, a timestamp. */
export function RegisterSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center gap-sm py-sm',
            i > 0 && 'border-t border-border-hair',
          )}
          style={{ minBlockSize: 'var(--row-h)' }}
        >
          <Skeleton w="2rem" h="2rem" radius="xs" />
          <div className="flex min-w-0 flex-1 flex-col gap-3xs">
            <Skeleton w="40%" h="1.3125rem" />
            <Skeleton w="70%" h="1.1875rem" />
          </div>
          <Skeleton w="9ch" h="1.1875rem" />
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------- forms --
 * A settings form is not one shape, so one skeleton cannot stand in for all
 * five routes. Each piece below matches a real `Field`, whose stack is: label
 * line, optional hint line, control, and a helper slot reserved at 1lh. The
 * heights are written as `1lh` inside an element carrying the same text class as
 * the thing it stands in for, so a change to the type scale moves both together
 * instead of leaving a measured constant behind.
 */

export interface FieldShape {
  /** Label width in characters, counted from the real label. */
  label: string
  /** Hint width in characters. Omit for a field with no hint. */
  hint?: string
  /** Control height. 2.75rem is the shared control height; textareas are taller. */
  control?: string
  /** A counter under the control, as `Textarea` renders when `maxChars` is set. */
  counter?: boolean
}

/** One labelled control, box for box: label, hint, control, reserved helper. */
export function FieldSkeleton({ label, hint, control = '2.75rem', counter }: FieldShape) {
  return (
    <div className="flex flex-col gap-2xs">
      <div className="text-base">
        <Skeleton w={label} h="1lh" />
      </div>
      {hint ? (
        <div className="text-xs">
          <Skeleton w={hint} h="1lh" />
        </div>
      ) : null}
      <Skeleton h={control} radius="sm" />
      {counter ? (
        <div className="text-xs">
          <Skeleton w="7ch" h="1lh" className="ms-auto" />
        </div>
      ) : null}
      {/* The helper slot is reserved whether or not it has content (§5.5). */}
      <div className="text-xs" style={{ minBlockSize: '1lh' }} />
    </div>
  )
}

/** A `RadioGroup`: legend, hint, then one 44px row per option. */
export function ChoiceSkeleton({
  legend,
  hint,
  options,
}: {
  legend: string
  hint?: string
  options: number
}) {
  return (
    <div className="flex flex-col gap-2xs">
      <div className="text-base">
        <Skeleton w={legend} h="1lh" />
      </div>
      {hint ? (
        <div className="text-xs">
          <Skeleton w={hint} h="1lh" />
        </div>
      ) : null}
      <div className="flex flex-col gap-xs">
        {Array.from({ length: options }, (_, i) => (
          <div key={i} className="flex items-start gap-sm py-2xs" style={{ minBlockSize: '2.75rem' }}>
            <Skeleton w="1.25rem" h="1.25rem" radius="xs" />
            <div className="flex flex-1 flex-col gap-3xs">
              <Skeleton w="12ch" h="1.5rem" />
              <Skeleton w="28ch" h="0.8125rem" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** A `Checkbox` with a description under it. */
export function CheckboxSkeleton({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex items-start gap-sm py-2xs" style={{ minBlockSize: '2.75rem' }}>
      <Skeleton w="1.25rem" h="1.25rem" radius="xs" />
      <div className="flex flex-1 flex-col gap-3xs">
        <Skeleton w={label} h="1.5rem" />
        <Skeleton w={description} h="0.8125rem" />
      </div>
    </div>
  )
}

/**
 * Matches a settings form. Pass the real field shapes; the default is the
 * four-plain-inputs case so a caller that has nothing specific to say still
 * gets the right stack rather than a rectangle.
 */
export function FormSkeleton({
  fields,
  submit = '11rem',
  children,
}: {
  fields?: readonly FieldShape[]
  /** Width of the submit button, from its label. */
  submit?: string
  /** Anything between the last field and the submit row. */
  children?: ReactNode
}) {
  const shapes: readonly FieldShape[] =
    fields ?? Array.from({ length: 4 }, () => ({ label: '14ch', hint: '30ch' }))
  return (
    <div aria-hidden="true" className="flex max-w-prose flex-col gap-lg">
      {shapes.map((shape, i) => (
        <FieldSkeleton key={i} {...shape} />
      ))}
      {children}
      <Skeleton w={submit} h="2.75rem" radius="sm" />
    </div>
  )
}

/**
 * Matches the notification preferences: a bordered scroll region holding a
 * header band and one row per kind, each row a label over its detail with one
 * checkbox column.
 */
export function PrefsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      aria-hidden="true"
      className="w-full overflow-x-auto rounded-md border border-border-hair"
    >
      <div className="relative">
        <div className="flex items-center gap-md border-b border-border-hair bg-surface-2 px-md py-sm">
          <Skeleton w="14ch" h="0.75rem" />
          <Skeleton w="8ch" h="0.75rem" className="ms-auto" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-md border-b border-border-hair px-md py-sm',
              i % 2 === 1 && 'bg-surface-2',
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-3xs">
              <Skeleton w="70%" h="0.875rem" />
              <Skeleton w="90%" h="0.8125rem" />
            </div>
            <Skeleton w="1.25rem" h="1.25rem" radius="xs" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Matches the danger zone: three sections of heading, sentence and one action,
 * separated by a hairline, with the confirm field on the last one.
 */
export function DangerSkeleton() {
  return (
    <div aria-hidden="true" className="flex max-w-prose flex-col gap-2xl">
      {[0, 1].map((i) => (
        <div
          key={i}
          className={cn('flex flex-col gap-sm', i > 0 && 'border-t border-border-hair pt-2xl')}
        >
          <Skeleton w="22ch" h="1.25rem" />
          <Skeleton lines={2} h="1.3125rem" />
          <Skeleton w="18rem" h="2.75rem" radius="sm" />
        </div>
      ))}
      <div className="flex flex-col gap-sm border-t border-border-hair pt-2xl">
        <Skeleton w="18ch" h="1.25rem" />
        <div className="rounded-md border border-border-hair p-md">
          <Skeleton lines={4} h="1.3125rem" />
        </div>
        <FieldSkeleton label="24ch" hint="42ch" />
        <Skeleton w="13rem" h="2.75rem" radius="sm" />
      </div>
    </div>
  )
}

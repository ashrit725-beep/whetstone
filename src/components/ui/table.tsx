/**
 * Table: a real table. Used for the dashboard inbox and anything else that is
 * genuinely tabular.
 *
 * Keyboard contract: the horizontal scroll region is a <div tabIndex={0}> with
 * a role and an accessible name, so a keyboard user can scroll a wide table
 * without a pointer (SC 2.1.1). Arrow keys scroll it. Sortable headers are real
 * links: Tab reaches them, Enter follows them, and the new order comes back
 * from the server with `aria-sort` set on the column that is now sorted. There
 * is no grid navigation and no roving tabindex: this is a table of content, not
 * a spreadsheet.
 *
 * Contract notes: 0px radius on cells (§5.1), zebra from surface-1/surface-2
 * (§4.4.5), `tabular-nums` on every figure (§3.4), a required <caption> so the
 * table is named even when the heading above it scrolls away, and a row hover
 * that moves the background exactly one surface step with no lift and no shadow
 * (§5.4).
 */

import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, CircleAlert } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export type SortDirection = 'ascending' | 'descending' | 'none'

const HEAD_TYPE = { fontVariationSettings: '"wdth" 87, "wght" 600' } as const

export interface TableProps {
  /** Required. What this table lists, as a sentence. */
  caption: string
  /** Show the caption above the table. Off by default, but never absent. */
  captionVisible?: boolean
  children: ReactNode
  className?: string
}

export function Table({ caption, captionVisible = false, children, className }: TableProps) {
  return (
    <div
      // A wide table scrolls inside its own named, focusable region rather than
      // pushing the document sideways (§8.3.31).
      role="region"
      aria-label={caption}
      tabIndex={0}
      data-scroll-region
      className="w-full overflow-x-auto rounded-md border border-border-hair"
    >
      <table className={cn('w-full border-collapse text-left', className)}>
        <caption
          className={cn(
            captionVisible
              ? 'px-md py-sm text-left text-xs text-text-3'
              : 'sr-only',
          )}
        >
          {caption}
        </caption>
        {children}
      </table>
    </div>
  )
}

export function THead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <thead className={cn('bg-surface-2', className)}>
      {children}
    </thead>
  )
}

export function TBody({ children, className }: { children: ReactNode; className?: string }) {
  return <tbody className={className}>{children}</tbody>
}

export interface TRProps {
  children: ReactNode
  /** The one current row in this view. Draws the grind-mark, sets aria-current. */
  selected?: boolean
  /** Rows that lead somewhere get the hover step. Rows that do not, do not. */
  interactive?: boolean
  className?: string
}

export function TR({ children, selected = false, interactive = false, className }: TRProps) {
  return (
    <tr
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'border-b border-border-hair odd:bg-surface-1 even:bg-surface-2',
        interactive &&
          'transition-[background-color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-surface-3',
        selected && 'grind-mark-on',
        className,
      )}
    >
      {children}
    </tr>
  )
}

export interface THProps extends ThHTMLAttributes<HTMLTableCellElement> {
  children: ReactNode
  scope?: 'col' | 'row' | 'colgroup' | 'rowgroup'
  /** Current sort state of this column. Omit for columns that do not sort. */
  sort?: SortDirection
  /** Href that applies the next sort. Presence is what makes a header sortable. */
  sortHref?: string
  numeric?: boolean
}

export function TH({
  children,
  scope = 'col',
  sort,
  sortHref,
  numeric = false,
  className,
  ...rest
}: THProps) {
  const SortIcon = sort === 'ascending' ? ArrowUp : sort === 'descending' ? ArrowDown : ArrowUpDown
  return (
    <th
      scope={scope}
      aria-sort={sortHref ? (sort ?? 'none') : undefined}
      className={cn(
        'rounded-none border-b border-border-hair px-md py-sm text-2xs whitespace-nowrap text-text-3',
        numeric && 'text-right',
        className,
      )}
      style={HEAD_TYPE}
      {...rest}
    >
      {sortHref ? (
        <Link
          href={sortHref}
          className={cn(
            'inline-flex items-center gap-2xs py-2xs no-underline transition-[color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-text-1',
            numeric && 'flex-row-reverse',
          )}
        >
          <span>{children}</span>
          <SortIcon size={16} strokeWidth={1.5} aria-hidden="true" />
          <span className="sr-only">
            {sort === 'ascending'
              ? ', sorted low to high. Activate to sort high to low.'
              : sort === 'descending'
                ? ', sorted high to low. Activate to sort low to high.'
                : ', not sorted. Activate to sort by this column.'}
          </span>
        </Link>
      ) : (
        children
      )}
    </th>
  )
}

export interface TDProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children: ReactNode
  numeric?: boolean
}

export function TD({ children, numeric = false, className, ...rest }: TDProps) {
  return (
    <td
      className={cn(
        'rounded-none px-md py-sm align-middle text-sm text-text-2',
        numeric && 'tnum text-right',
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  )
}

/* -------------------------------------------------------------- states -- */

export interface TableSkeletonProps {
  /** One entry per column, in characters, so the skeleton matches the real grid. */
  columnWidths: readonly number[]
  rows?: number
  label?: string
}

/**
 * Loading. Static by contract: nothing in this product pulses, shimmers or
 * loops (§6.3). The geometry matches, the copy says what is loading, and
 * `aria-busy` keeps a screen reader from reading a half-built table.
 */
export function TableSkeleton({
  columnWidths,
  rows = 5,
  label = 'Loading rows',
}: TableSkeletonProps) {
  return (
    <tbody aria-busy="true">
      <tr>
        <td colSpan={columnWidths.length} className="px-md py-sm">
          <span className="sr-only">{label}…</span>
        </td>
      </tr>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr
          key={`skeleton-row-${String(rowIndex)}`}
          aria-hidden="true"
          className="border-b border-border-hair odd:bg-surface-1 even:bg-surface-2"
        >
          {columnWidths.map((ch, colIndex) => (
            <td key={`skeleton-cell-${String(rowIndex)}-${String(colIndex)}`} className="px-md py-sm">
              <span
                className="block h-md rounded-xs bg-surface-3"
                style={{ inlineSize: `${String(ch)}ch` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

export interface TableMessageRowProps {
  colSpan: number
  /** What is empty or what broke. */
  title: string
  /** Why it matters. One sentence. */
  detail: string
  /** One control naming the single next action. */
  action?: ReactNode
  tone?: 'empty' | 'error'
}

/**
 * The empty and error rows. Three beats, one action, no apology, no
 * exclamation mark, no illustration (§7.1.4, §7.1.5).
 */
export function TableMessageRow({
  colSpan,
  title,
  detail,
  action,
  tone = 'empty',
}: TableMessageRowProps) {
  return (
    <tbody>
      <tr className="bg-surface-1">
        <td colSpan={colSpan} className="px-md py-xl">
          <div
            className={cn(
              'measure-ui flex flex-col items-start gap-xs',
              tone === 'error' && 'rounded-md border border-critical p-md',
            )}
            role={tone === 'error' ? 'alert' : undefined}
          >
            <p
              className={cn(
                'flex items-center gap-2xs text-md',
                tone === 'error' ? 'text-critical' : 'text-text-1',
              )}
            >
              {tone === 'error' ? (
                <CircleAlert size={20} strokeWidth={1.5} aria-hidden="true" />
              ) : null}
              {title}
            </p>
            <p className="text-sm text-text-2">{detail}</p>
            {action}
          </div>
        </td>
      </tr>
    </tbody>
  )
}

export function TableEmpty(props: Omit<TableMessageRowProps, 'tone'>) {
  return <TableMessageRow {...props} tone="empty" />
}

export function TableError(props: Omit<TableMessageRowProps, 'tone'>) {
  return <TableMessageRow {...props} tone="error" />
}

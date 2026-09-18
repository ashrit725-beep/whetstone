'use client'

/**
 * The dashboard rail (contract §4.4 surface 5: full-bleed with a 16rem left
 * rail).
 *
 * Keyboard contract: it is a list of real links. Tab reaches each one in visual
 * order, Enter follows it. No roving tabindex and no arrow-key handling: this is
 * navigation, not a widget, and adding a grid contract here would cost the
 * secondary links their tab stop.
 *
 * Below 60rem the rail becomes a horizontal row above the content rather than
 * disappearing behind a hover affordance, so every destination stays visible on
 * a phone (polish checklist 35). That row *wraps*; it does not scroll
 * sideways. A sideways-scrolling nav hid “Suggestions” at 390px, and the
 * visually hidden count inside each link is absolutely positioned, so it
 * escaped the scroll container and pushed the document itself to 498px wide.
 * Wrapping fixes both: nothing is clipped and nothing leaves the viewport.
 *
 * The current item is marked three ways: `aria-current="page"`, its ink steps
 * from text-2 to text-1, and its ground steps one surface. The accent
 * grind-mark is deliberately *not* used here: it is capped at one element per
 * view (§2.4.7) and the inbox spends it on the note you have open.
 *
 * Project scope. Every page beside the rail is about one project, picked by
 * `?project=`, which a layout cannot read. The rail used to name the default
 * project and count across all of them whatever was in view, so it could say
 * "Inbox 9" beside an inbox of six, and following it to Insights dropped the
 * project the reader had picked. It now reads the param itself: the project
 * block and the counts are the project in view, and the links carry it on.
 * "All projects" is a filter of the page that offers it, so it is not carried.
 */

import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Bell,
  ChartColumn,
  CircleHelp,
  Columns3,
  Gauge,
  Inbox,
  Palette,
  Settings,
  TriangleAlert,
  User,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GritChip, MIN_TAP } from '@/components/ui'

export interface RailItem {
  readonly href: string
  readonly label: string
  readonly icon:
    | 'overview'
    | 'inbox'
    | 'insights'
    | 'suggestions'
    | 'settings'
    | 'help'
    | 'profile'
    | 'bell'
    | 'appearance'
    | 'danger'
  /** Which per-project count sits beside the link, if any. */
  readonly count?: keyof RailCounts
  /** What the count means, for the screen reader. */
  readonly countNoun?: string
  /** Carries the project in view on to the destination. */
  readonly scoped?: boolean
}

/** Real counts from real rows, for one project or for all of them. */
export interface RailCounts {
  readonly unread: number
  readonly openSuggestions: number
}

export interface RailProject extends RailCounts {
  readonly id: string
  readonly title: string
  readonly grit: number
  readonly stageLabel: string
}

const ICONS: Record<RailItem['icon'], LucideIcon> = {
  overview: Gauge,
  inbox: Inbox,
  insights: ChartColumn,
  suggestions: Columns3,
  settings: Settings,
  help: CircleHelp,
  profile: User,
  bell: Bell,
  appearance: Palette,
  danger: TriangleAlert,
}

export interface DashboardRailProps {
  primary: readonly RailItem[]
  secondary: readonly RailItem[]
  /** Every project the reader owns, with its counts. */
  projects?: readonly RailProject[]
  /** The project a page shows when the URL names none. */
  defaultProjectId?: string | null
  /** The counts across every project, for the "All projects" view. */
  totals?: RailCounts
  /** Names the rail for assistive tech. */
  label: string
}

function isCurrent(pathname: string, href: string): boolean {
  // Exact match for the section roots, so “Overview” is not current while the
  // reader is three routes deeper inside the same prefix.
  if (href === '/dashboard' || href === '/settings') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function DashboardRail({
  primary,
  secondary,
  projects = [],
  defaultProjectId = null,
  totals,
  label,
}: DashboardRailProps) {
  const pathname = usePathname()
  const param = useSearchParams().get('project')
  // The same resolution `creatorScope` makes on the server: a known id, the
  // whole account, or the default for anything else.
  const named = param ? projects.find((p) => p.id === param) : undefined
  const allInView = param === 'all' && projects.length > 0
  const project = allInView ? null : (named ?? projects.find((p) => p.id === defaultProjectId) ?? null)
  const counts: RailCounts | undefined = allInView ? totals : (project ?? undefined)

  const hrefOf = (item: RailItem): string =>
    item.scoped && named ? `${item.href}?project=${encodeURIComponent(named.id)}` : item.href
  const countOf = (item: RailItem): number | undefined =>
    item.count && counts ? counts[item.count] : undefined

  return (
    <nav
      aria-label={label}
      className="border-b border-border-hair bg-surface-2 md:h-full md:border-r md:border-b-0"
    >
      <div className="flex flex-col gap-md p-md md:sticky md:top-0 md:gap-lg">
        {project ? (
          <div className="flex min-w-0 flex-col gap-2xs">
            <p className="truncate text-sm text-text-1">{project.title}</p>
            <div className="flex items-center gap-xs">
              <GritChip value={project.grit} size="sm" />
              <span className="text-xs text-text-3">{project.stageLabel}</span>
            </div>
          </div>
        ) : null}

        <ul className="m-0 flex list-none flex-wrap gap-2xs p-0 md:flex-col md:flex-nowrap">
          {primary.map((item) => (
            <RailLink
              key={item.href}
              item={item}
              href={hrefOf(item)}
              count={countOf(item)}
              current={isCurrent(pathname, item.href)}
            />
          ))}
        </ul>

        <div className="flex flex-col gap-2xs">
          <hr className="hidden md:block" />
          <ul className="m-0 flex list-none flex-wrap gap-2xs p-0 md:flex-col md:flex-nowrap">
            {secondary.map((item) => (
              <RailLink
                key={item.href}
                item={item}
                href={hrefOf(item)}
                count={countOf(item)}
                current={isCurrent(pathname, item.href)}
              />
            ))}
          </ul>
        </div>
      </div>
    </nav>
  )
}

function RailLink({
  item,
  href,
  count,
  current,
}: {
  item: RailItem
  href: string
  count: number | undefined
  current: boolean
}) {
  const Icon = ICONS[item.icon]
  return (
    <li className="shrink-0 md:shrink">
      <Link
        href={href}
        aria-current={current ? 'page' : undefined}
        style={MIN_TAP}
        className={cn(
          'flex items-center gap-xs rounded-xs border border-transparent px-sm py-xs text-sm whitespace-nowrap no-underline',
          'transition-[background-color,border-color,color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
          'hover:border-border-hair hover:bg-surface-3 hover:text-text-1',
          current ? 'border-border-hair bg-surface-3 text-text-1' : 'text-text-2',
        )}
      >
        <Icon size={20} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
        <span className="min-w-0 truncate">{item.label}</span>
        {count !== undefined && count > 0 ? (
          <span className="tnum ms-auto ps-xs text-xs text-text-3">
            <span aria-hidden="true">{count.toLocaleString('en')}</span>
            <span className="sr-only">{`, ${String(count)} ${item.countNoun ?? ''}`.trimEnd()}</span>
          </span>
        ) : null}
      </Link>
    </li>
  )
}

export default DashboardRail

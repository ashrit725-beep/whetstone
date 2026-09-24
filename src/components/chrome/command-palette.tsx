'use client'

/**
 * CommandPalette: ⌘K / Ctrl+K, the fastest way to any project, person or thread.
 *
 * Keyboard contract
 *   Cmd+K / Ctrl+K   open from anywhere, including from inside a text field.
 *   Escape           close and return focus to whatever opened it.
 *   ArrowDown / Up   move the active option, wrapping at both ends.
 *   Home / End       jump to the first or last option.
 *   Enter            follow the active option.
 *   Tab / Shift+Tab  cycle inside the sheet; the page behind is inert.
 *   Typing filters. Focus never leaves the field: the active option is carried
 *   by `aria-activedescendant`, which is what lets one keystroke both type and
 *   navigate (WAI-ARIA combobox with a listbox popup). Letters typed straight
 *   after the shortcut, before the field has focus, land in the field too.
 *
 * Only a chorded shortcut is bound, so SC 2.1.4 (Character Key Shortcuts) has
 * nothing to satisfy: there is no single-character accelerator to intercept a
 * reader typing into the composer.
 *
 * Latency: the reader's own recent destinations render on the first frame from
 * `localStorage`, before any query runs. Typing debounces 150ms and every
 * response carries a sequence number, so a slow early query can never overwrite
 * a fast later one.
 *
 * Icons: `Search` is the standard affordance for a search field (Jakob's Law).
 * `CircleAlert` carries the failure, because it still reads at 16px.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { CircleAlert, Search } from 'lucide-react'
import {
  Kbd,
  OverlayStyles,
  Skeleton,
  Spinner,
  useDelayedLoading,
  useModalDialog,
  useOverlayPortal,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { searchCommand } from './actions'
import { ChromeStyles } from './chrome-styles'
import { APPLE_UA } from './platform'
import type { CommandGroup, CommandGroupKey, CommandHit, RecentHit } from './types'

const RECENTS_KEY = 'ws_palette_recents'
const RECENTS_MAX = 5
const DEBOUNCE_MS = 150
/** Uneven on purpose: three identical bars read as a pattern, not as text. */
const SKELETON_W: readonly string[] = ['11rem', '8rem', '13rem']
const SKELETON_META_W: readonly string[] = ['17rem', '21rem', '14rem']
const LABEL_AXES = { fontVariationSettings: '"wdth" 100, "wght" 600' } as const

/** Destinations that are not a search result: real routes, named as verbs.
 *  Each href was checked against `src/app`, not against ROUTES.md: the
 *  composer ships at `/new`, not `/projects/new`, and a palette row that opens
 *  a 404 is banned (ban 32). */
const ACTIONS: readonly CommandHit[] = [
  { id: 'action:new', label: 'Post a project', meta: 'Write the ask and pick the grit', href: '/new' },
  { id: 'action:discover', label: 'Browse Discover', meta: 'Filter the feed by type, stage and grit', href: '/discover' },
  { id: 'action:inbox', label: 'Open the feedback inbox', meta: 'Everything reviewers sent you', href: '/dashboard/inbox' },
  { id: 'action:notifications', label: 'Open your notifications', meta: 'Reviews, replies and shipped suggestions, newest first', href: '/notifications' },
  { id: 'action:suggestions', label: 'Open the suggestion tracker', meta: 'Move notes from queued to shipped', href: '/dashboard/suggestions' },
  { id: 'action:experts', label: 'Find a reviewer', meta: 'People who review for a fee, by domain', href: '/experts' },
  { id: 'action:bounties', label: 'Browse bounties', meta: 'Paid review requests open right now', href: '/bounties' },
  { id: 'action:settings', label: 'Open settings', meta: 'Profile, account, appearance', href: '/settings/profile' },
]

/** The rows above that speak to an account: an inbox, a tracker, settings, and
 *  the composer that needs somewhere to put the project. A reader without one
 *  was offered all five, and every one of them bounced to /sign-in. */
const ACCOUNT_ACTIONS: ReadonlySet<string> = new Set([
  'action:new',
  'action:inbox',
  'action:notifications',
  'action:suggestions',
  'action:settings',
])

/** What a signed-out reader is offered in their place: the two ways in. */
const VISITOR_ACTIONS: readonly CommandHit[] = [
  { id: 'action:sign-in', label: 'Sign in', meta: 'Pick up where you left off', href: '/sign-in' },
  { id: 'action:sign-up', label: 'Create an account', meta: 'Post work and send feedback', href: '/sign-up' },
]

function actionsFor(signedIn: boolean): readonly CommandHit[] {
  if (signedIn) return ACTIONS
  return [...ACTIONS.filter((hit) => !ACCOUNT_ACTIONS.has(hit.id)), ...VISITOR_ACTIONS]
}

function readRecents(): readonly RecentHit[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is RecentHit =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as RecentHit).href === 'string' &&
        typeof (entry as RecentHit).label === 'string' &&
        typeof (entry as RecentHit).meta === 'string',
    )
  } catch {
    // A private window, or storage the reader has blocked. Recents are a
    // convenience; their absence changes nothing about the palette.
    return []
  }
}

function writeRecent(hit: CommandHit, group: CommandGroupKey): readonly RecentHit[] {
  const entry: RecentHit = { ...hit, group }
  const next = [entry, ...readRecents().filter((r) => r.href !== hit.href)].slice(0, RECENTS_MAX)
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    /* Nothing to recover: the palette works identically without recents. */
  }
  return next
}

function matches(hit: CommandHit, query: string): boolean {
  const q = query.toLowerCase()
  return hit.label.toLowerCase().includes(q) || hit.meta.toLowerCase().includes(q)
}

export interface CommandPaletteProps {
  /** Whether the request came from an Apple device, whose modifier is ⌘. Read
   *  from the user agent on the server, so the key cap is right on first paint. */
  apple: boolean
  /** Whether there is an account behind this reader, which decides which
   *  destinations the palette offers. */
  signedIn: boolean
}

export function CommandPalette({ apple, signedIn }: CommandPaletteProps) {
  const router = useRouter()
  const host = useOverlayPortal()
  const labelId = useId()
  const inputId = useId()
  const listId = useId()
  const optionPrefix = useId()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<readonly CommandGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [recents, setRecents] = useState<readonly RecentHit[]>([])
  const [isApple, setIsApple] = useState(apple)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sequence = useRef(0)
  /* Opening takes two commits: the dialog mounts, then it is shown and the
     field takes focus. A reader who types straight after the shortcut would
     land the first letters in that gap, on the page behind, which can be the
     composer. Until the field has focus they are held here, then handed to it.
     `null` means nothing is being held. */
  const heldKeys = useRef<string | null>(null)

  const spinning = useDelayedLoading(loading)

  const { phase, requestClose, dialogProps } = useModalDialog({
    open,
    onOpenChange: setOpen,
    dismissible: true,
    initialFocus: inputRef,
    exitMs: 160,
    host,
  })

  /* The key cap has to name the reader's own modifier, or it is a lie. The
     server's guess comes from the same test, so this only ever confirms it,
     unless something between the browser and the server rewrote the header. */
  useEffect(() => {
    setIsApple(APPLE_UA.test(navigator.userAgent))
  }, [])

  /* ---- the one global shortcut, and the keys typed before the field has focus ---- */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((current) => !current)
        return
      }
      const held = heldKeys.current
      if (held === null || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return
      if (document.activeElement === inputRef.current) {
        heldKeys.current = null
        return
      }
      if (event.key.length !== 1 && event.key !== 'Backspace') return
      // Captured at the window, so no handler on the page sees the key either.
      event.preventDefault()
      event.stopPropagation()
      heldKeys.current = event.key === 'Backspace' ? held.slice(0, -1) : held + event.key
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  /* Recents are re-read on every open, so a destination visited in another tab
     is already in the list. The open commit is flushed before the browser
     dispatches the next key, so holding starts in time for the first letter. */
  useEffect(() => {
    if (!open) {
      heldKeys.current = null
      return
    }
    heldKeys.current = ''
    setRecents(readRecents())
    setQuery('')
    setGroups([])
    setFailed(false)
    setActiveIndex(0)
  }, [open])

  useEffect(
    () => () => {
      if (debounce.current !== null) clearTimeout(debounce.current)
    },
    [],
  )

  /* ---- what the listbox shows right now ---- */
  const actions = useMemo(() => actionsFor(signedIn), [signedIn])

  const displayed: readonly CommandGroup[] = useMemo(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      const out: CommandGroup[] = []
      if (recents.length > 0) out.push({ key: 'actions', label: 'Recent', hits: recents })
      out.push({ key: 'actions', label: 'Actions', hits: actions })
      return out
    }
    const actionHits = actions.filter((hit) => matches(hit, trimmed))
    return actionHits.length > 0
      ? [...groups, { key: 'actions' as const, label: 'Actions', hits: actionHits }]
      : groups
  }, [actions, groups, query, recents])

  const flat: readonly { hit: CommandHit; group: CommandGroupKey }[] = useMemo(
    () => displayed.flatMap((group) => group.hits.map((hit) => ({ hit, group: group.key }))),
    [displayed],
  )

  /* Clamped rather than reset by an effect: derived state synced by an effect
     renders one wrong frame first (ban 53). */
  const safeIndex = flat.length === 0 ? 0 : Math.min(activeIndex, flat.length - 1)

  /* ---- the query ---- */
  const runQuery = useCallback((next: string) => {
    const trimmed = next.trim()
    if (debounce.current !== null) clearTimeout(debounce.current)

    if (trimmed.length < 2) {
      sequence.current += 1
      setGroups([])
      setLoading(false)
      setFailed(false)
      return
    }

    setLoading(true)
    debounce.current = setTimeout(() => {
      debounce.current = null
      const ticket = (sequence.current += 1)
      searchCommand(trimmed)
        .then((results) => {
          if (ticket !== sequence.current) return
          setGroups(results.groups)
          setFailed(false)
          setLoading(false)
          setActiveIndex(0)
        })
        .catch(() => {
          if (ticket !== sequence.current) return
          setGroups([])
          setFailed(true)
          setLoading(false)
        })
    }, DEBOUNCE_MS)
  }, [])

  const go = useCallback(
    (index: number) => {
      const entry = flat[index]
      if (!entry) return
      setRecents(writeRecent(entry.hit, entry.group))
      setOpen(false)
      router.push(entry.hit.href)
    },
    [flat, router],
  )

  const move = useCallback(
    (delta: number | 'first' | 'last') => {
      if (flat.length === 0) return
      setActiveIndex((current) => {
        if (delta === 'first') return 0
        if (delta === 'last') return flat.length - 1
        const from = Math.min(current, flat.length - 1)
        const next = from + delta
        if (next < 0) return flat.length - 1
        if (next >= flat.length) return 0
        return next
      })
    },
    [flat.length],
  )

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'Home':
        event.preventDefault()
        move('first')
        break
      case 'End':
        event.preventDefault()
        move('last')
        break
      case 'Enter':
        if (flat.length === 0) return
        event.preventDefault()
        go(safeIndex)
        break
      default:
        break
    }
  }

  /* Keep the active option in view without moving anything already visible. */
  useEffect(() => {
    if (phase !== 'open') return
    const node = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    node?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
  }, [safeIndex, phase])

  const trimmed = query.trim()
  const searching = trimmed.length >= 2
  const resultsMessage = !searching
    ? ''
    : loading
      ? 'Searching…'
      : failed
        ? 'The search did not run.'
        : `${String(flat.length)} result${flat.length === 1 ? '' : 's'} for “${trimmed}”.`

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        aria-label="Search projects, people and discussions"
        className={cn(
          'inline-flex h-11 items-center gap-xs rounded-sm border border-border-control bg-surface-1 px-sm text-sm text-text-3',
          'transition-[color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
          'hover:border-border-strong hover:bg-surface-3 hover:text-text-1 active:translate-y-px',
        )}
      >
        <Search size={20} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
        <span aria-hidden="true" className="hidden md:inline">
          Search
        </span>
        <span aria-hidden="true" className="hidden items-center gap-2xs md:inline-flex">
          <Kbd>{isApple ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      {host && phase !== 'closed'
        ? createPortal(
            <dialog
              {...dialogProps}
              aria-labelledby={labelId}
              className="whetstone-overlay whetstone-dialog ws-palette"
            >
              <OverlayStyles />
              <ChromeStyles />

              <div className="flex min-h-0 grow flex-col">
                <div className="flex items-baseline justify-between gap-sm px-md pt-md">
                  <label id={labelId} htmlFor={inputId} className="text-xs text-text-3" style={LABEL_AXES}>
                    Search Whetstone
                  </label>
                  <span className="hidden items-center gap-2xs text-xs text-text-3 sm:inline-flex">
                    <Kbd>Esc</Kbd> to close
                  </span>
                </div>

                <div className="flex items-center gap-sm border-b border-border-hair px-md">
                  <Search size={20} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-text-3" />
                  <input
                    ref={inputRef}
                    id={inputId}
                    type="text"
                    role="combobox"
                    autoComplete="off"
                    spellCheck={false}
                    aria-expanded={flat.length > 0}
                    aria-controls={flat.length > 0 ? listId : undefined}
                    aria-autocomplete="list"
                    aria-activedescendant={
                      flat.length > 0 ? `${optionPrefix}-${String(safeIndex)}` : undefined
                    }
                    aria-describedby={`${listId}-status`}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      runQuery(event.target.value)
                    }}
                    onFocus={() => {
                      const held = heldKeys.current
                      heldKeys.current = null
                      if (held) {
                        setQuery(held)
                        runQuery(held)
                      }
                    }}
                    onKeyDown={onInputKeyDown}
                    placeholder="Project, person or thread"
                    className="h-13 w-full min-w-0 grow border-0 bg-transparent text-base text-text-1"
                  />
                  {/* Reserved permanently, so the field never jogs when the
                      spinner arrives (contract §5.5). */}
                  <span className="flex w-lg shrink-0 justify-center">
                    {spinning ? <Spinner size={16} label="Searching" /> : null}
                  </span>
                </div>

                <div ref={listRef} className="min-h-0 grow overflow-y-auto py-2xs" data-scroll-region>
                  {failed ? (
                    <p className="flex items-start gap-xs px-md py-sm text-sm text-critical">
                      <CircleAlert size={16} strokeWidth={1.5} aria-hidden="true" className="mt-3xs shrink-0" />
                      <span className="measure-ui">
                        The search did not run, so nothing below is current. Close the palette and
                        run the query again, or open Discover and filter there.
                      </span>
                    </p>
                  ) : searching && loading && flat.length === 0 ? (
                    /* The rows the answer will occupy, at the option's own
                       geometry, so nothing jumps when the results land. The
                       live region below already says "Searching…" aloud. */
                    <div aria-hidden="true" className="flex flex-col">
                      {[0, 1, 2].map((row) => (
                        <div
                          key={row}
                          className="flex flex-col justify-center gap-3xs px-md py-xs"
                          style={{ minBlockSize: '2.75rem' }}
                        >
                          <Skeleton w={SKELETON_W[row] ?? '12rem'} h="0.875rem" radius="xs" />
                          <Skeleton w={SKELETON_META_W[row] ?? '18rem'} h="0.75rem" radius="xs" />
                        </div>
                      ))}
                    </div>
                  ) : flat.length === 0 ? (
                    <p className="measure-ui px-md py-sm text-sm text-text-2">
                      {searching
                        ? `Nothing matches “${trimmed}”. Titles, taglines and thread subjects are searched, so try a word the author would have written.`
                        : 'Type two letters to search projects, people and discussions.'}
                    </p>
                  ) : (
                    <div role="listbox" id={listId} aria-label="Search results">
                      <PaletteOptions
                        displayed={displayed}
                        activeIndex={safeIndex}
                        optionPrefix={optionPrefix}
                        onPick={go}
                        onHover={setActiveIndex}
                      />
                    </div>
                  )}
                </div>

                <p id={`${listId}-status`} role="status" aria-live="polite" className="sr-only">
                  {resultsMessage}
                </p>

                <footer className="flex flex-wrap items-center gap-md border-t border-border-hair px-md py-xs text-xs text-text-3">
                  <span className="inline-flex items-center gap-2xs">
                    <span className="sr-only">Arrow up and arrow down</span>
                    <span aria-hidden="true" className="inline-flex items-center gap-2xs">
                      <Kbd>↑</Kbd>
                      <Kbd>↓</Kbd>
                    </span>
                    to move
                  </span>
                  <span className="inline-flex items-center gap-2xs">
                    <Kbd>Enter</Kbd> to open
                  </span>
                  <button
                    type="button"
                    onClick={requestClose}
                    className="ms-auto inline-flex h-11 items-center rounded-sm px-2xs text-xs text-text-2 transition-[color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-text-1"
                  >
                    Close the palette
                  </button>
                </footer>
              </div>
            </dialog>,
            host,
          )
        : null}
    </>
  )
}

interface PaletteOptionsProps {
  displayed: readonly CommandGroup[]
  activeIndex: number
  optionPrefix: string
  onPick: (index: number) => void
  onHover: (index: number) => void
}

function PaletteOptions({ displayed, activeIndex, optionPrefix, onPick, onHover }: PaletteOptionsProps) {
  let cursor = -1
  return (
    <>
      {displayed.map((group, groupIndex) => {
        const headingId = `${optionPrefix}-g${String(groupIndex)}`
        return (
          <div key={`${group.key}-${group.label}`} role="group" aria-labelledby={headingId}>
            <p id={headingId} className="px-md pt-sm pb-2xs text-xs text-text-3" style={LABEL_AXES}>
              {group.label}
            </p>
            {group.hits.map((hit) => {
              cursor += 1
              const index = cursor
              const selected = index === activeIndex
              return (
                <div
                  key={hit.id}
                  id={`${optionPrefix}-${String(index)}`}
                  role="option"
                  aria-selected={selected}
                  onClick={() => onPick(index)}
                  /* Mouse only: on a touch screen pointermove fires while the
                     reader scrolls, and the highlight would chase their thumb. */
                  onPointerMove={(event) => {
                    if (event.pointerType === 'mouse') onHover(index)
                  }}
                  className={cn(
                    'ws-cmd-option flex flex-col justify-center gap-3xs px-md py-xs',
                    'transition-[color,background-color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
                    selected ? undefined : 'text-text-2',
                  )}
                  style={{ minBlockSize: '2.75rem' }}
                >
                  <span className="truncate text-sm" style={LABEL_AXES}>
                    {hit.label}
                  </span>
                  <span className="truncate text-xs text-text-3">{hit.meta}</span>
                </div>
              )
            })}
          </div>
        )
      })}
    </>
  )
}

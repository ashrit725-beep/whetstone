'use client'

/**
 * ThemeToggle: dark, light, or follow the system.
 *
 * Keyboard contract: one real <button>. Tab reaches it, Enter and Space cycle
 * system → light → dark → system. The accessible name always states the
 * current setting and the next one ("Theme: dark. Switch to follow the
 * system."), so a screen-reader user never has to guess what pressing it does.
 * The change is announced through a polite live region.
 *
 * No flash: the button writes `document.documentElement.dataset.theme`
 * synchronously and sets the `ws_theme` cookie, which the boot script in
 * layout.tsx reads before first paint on the next load. "System" deletes the
 * cookie and the attribute, which hands control back to the
 * `prefers-color-scheme` block in globals.css.
 *
 * There is no transition on the swap. Cross-fading a whole palette is both over
 * the motion budget and unpleasant (§6.3).
 */

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ThemeSetting = 'system' | 'light' | 'dark'

const ORDER: readonly ThemeSetting[] = ['system', 'light', 'dark']

const META: Record<ThemeSetting, { icon: typeof Monitor; word: string }> = {
  system: { icon: Monitor, word: 'follow the system' },
  light: { icon: Sun, word: 'light' },
  dark: { icon: Moon, word: 'dark' },
}

function readCookie(): ThemeSetting {
  if (typeof document === 'undefined') return 'system'
  const match = /(?:^|; )ws_theme=([^;]*)/.exec(document.cookie)
  const raw = match?.[1] ? decodeURIComponent(match[1]) : ''
  return raw === 'light' || raw === 'dark' ? raw : 'system'
}

function apply(next: ThemeSetting) {
  const root = document.documentElement
  if (next === 'system') {
    delete root.dataset.theme
    document.cookie = 'ws_theme=; path=/; max-age=0; samesite=lax'
    return
  }
  root.dataset.theme = next
  document.cookie = `ws_theme=${next}; path=/; max-age=31536000; samesite=lax`
}

export interface ThemeToggleProps {
  /** Pass the cookie value read on the server to avoid a one-frame wrong label. */
  initial?: ThemeSetting
  /** Show the current setting as a word beside the glyph. */
  showLabel?: boolean
  className?: string
}

export function ThemeToggle({ initial = 'system', showLabel = false, className }: ThemeToggleProps) {
  const [setting, setSetting] = useState<ThemeSetting>(initial)
  // A status region reports what the reader just did, so it stays empty until
  // they press. Rendered with the setting in it, the effect below rewrote it on
  // every page whose server could not pass `initial` (the statically rendered
  // marketing shell), and a screen reader announced a theme change nobody made.
  const [announce, setAnnounce] = useState(false)

  // The cookie is the source of truth; the server may not have passed it. The
  // appearance form writes it too and says so with a `ws-theme` event.
  useEffect(() => {
    const sync = () => {
      setSetting(readCookie())
    }
    sync()
    window.addEventListener('ws-theme', sync)
    return () => {
      window.removeEventListener('ws-theme', sync)
    }
  }, [])

  const index = ORDER.indexOf(setting)
  const next = ORDER[(index + 1) % ORDER.length] ?? 'system'
  const current = META[setting]
  const Icon = current.icon

  return (
    <span className={cn('inline-flex items-center gap-2xs', className)}>
      {/* 44px, the height the search field, the bell and the account button
          beside it in the masthead all use. At 48 this was the one control
          whose box broke the row's top and bottom edges, and the only one
          drawing a permanent border while it did it. */}
      <button
        type="button"
        onClick={() => {
          apply(next)
          setSetting(next)
          setAnnounce(true)
          window.dispatchEvent(new Event('ws-theme'))
        }}
        aria-label={`Theme: ${current.word}. Switch to ${META[next].word}.`}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2xs rounded-sm border border-border-control bg-surface-2 px-sm text-sm text-text-2 transition-[background-color,border-color,color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border-strong hover:bg-surface-3 hover:text-text-1 active:translate-y-px"
      >
        <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
        {showLabel ? <span aria-hidden="true">{current.word}</span> : null}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {announce ? `Theme set to ${current.word}.` : null}
      </span>
    </span>
  )
}

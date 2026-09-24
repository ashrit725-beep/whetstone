'use client'

/**
 * Light · Dark · System, as three words.
 *
 * The footer's theme control used to be a 48px boxed icon button that cycled
 * through the three settings: the one filled box on a page made of hairlines,
 * and a control whose current state was a glyph and whose next state was a
 * guess. Three named options say what the choices are and which one is on.
 *
 * It writes the same `ws_theme` cookie the product's own toggle writes, applies
 * the attribute synchronously so nothing flashes, and announces the change on
 * the shared `ws-theme` event, so a toggle elsewhere on the page stays in step
 * with this one.
 *
 * Keyboard contract: three real buttons in a group with a name. Tab reaches each
 * one, Enter and Space press it. The chosen one carries `aria-pressed`, so the
 * state is not carried by weight alone.
 */

import { useEffect, useState } from 'react'
import styles from './paper.module.css'

type Setting = 'light' | 'dark' | 'system'

const OPTIONS: readonly { readonly value: Setting; readonly label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

function readCookie(): Setting {
  if (typeof document === 'undefined') return 'system'
  const match = /(?:^|; )ws_theme=([^;]*)/.exec(document.cookie)
  const raw = match?.[1] ? decodeURIComponent(match[1]) : ''
  return raw === 'light' || raw === 'dark' ? raw : 'system'
}

function apply(next: Setting): void {
  const root = document.documentElement
  if (next === 'system') {
    delete root.dataset.theme
    document.cookie = 'ws_theme=; path=/; max-age=0; samesite=lax'
  } else {
    root.dataset.theme = next
    document.cookie = `ws_theme=${next}; path=/; max-age=31536000; samesite=lax`
  }
  window.dispatchEvent(new Event('ws-theme'))
}

export function ThemeChoice() {
  // The server cannot read the cookie here: these pages are cached and shared,
  // so the markup must be the same for everybody. "System" is the rest state and
  // the effect below corrects it on the first frame after paint.
  const [setting, setSetting] = useState<Setting>('system')
  const [announce, setAnnounce] = useState(false)

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

  return (
    <span className={styles.themeChoice}>
      <span aria-hidden="true" className="text-2xs uppercase text-ink-3">
        Theme
      </span>
      <span role="group" aria-label="Theme" className={styles.themeOptions}>
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={setting === option.value}
            onClick={() => {
              apply(option.value)
              setSetting(option.value)
              setAnnounce(true)
            }}
          >
            {option.label}
          </button>
        ))}
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {announce ? `Theme set to ${setting === 'system' ? 'follow the system' : setting}.` : null}
      </span>
    </span>
  )
}

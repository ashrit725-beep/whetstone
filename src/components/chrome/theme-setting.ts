/**
 * The reader's stored theme, read on the server.
 *
 * The bar hands it to the `ThemeToggle` primitive as `initial`, so the
 * button's label is right on the very first frame. Without this the control
 * renders "follow the system" for one paint and then corrects itself, which
 * reads as a bug on every page load.
 */

import { cookies } from 'next/headers'
import type { ThemeSetting } from '@/components/ui'

export async function readThemeSetting(): Promise<ThemeSetting> {
  const jar = await cookies()
  const raw = jar.get('ws_theme')?.value
  return raw === 'light' || raw === 'dark' ? raw : 'system'
}

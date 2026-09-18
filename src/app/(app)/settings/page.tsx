/**
 * `/settings` has no content of its own: every setting belongs to a named
 * section. Landing here sends the reader to the first one rather than showing a
 * page of links to the rail they can already see.
 */

import { redirect } from 'next/navigation'

export default function SettingsIndex(): never {
  redirect('/settings/profile')
}

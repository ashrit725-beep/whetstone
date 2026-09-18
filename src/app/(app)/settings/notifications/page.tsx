/**
 * Notification preferences.
 *
 * A table, so the kind is a `<th scope="row">` and its switch sits beside it.
 * The bell is the one channel: nothing sends email, so no email column is
 * offered. Every stored default lives in code rather than in a
 * row, so a preference nobody has touched still renders its real value.
 *
 * The wording names what happened, not the notification kind: “someone reviewed
 * your project” rather than `feedback_received`.
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { getNotificationPrefs } from '@/server/repos/notifications'
import type { NotificationKind } from '@/lib/types'
import { PageHeader } from '@/components/dashboard/section'
import {
  NotificationPrefs,
  type NotificationRow,
} from '@/components/dashboard/settings-forms'

export const metadata: Metadata = { title: 'Notification settings' }

const KINDS: readonly { kind: NotificationKind; label: string; detail: string }[] = [
  {
    kind: 'feedback_received',
    label: 'Someone reviewed your project',
    detail: 'The one most creators keep on. It is the reason the inbox fills.',
  },
  {
    kind: 'feedback_reply',
    label: 'Someone replied on a note',
    detail: 'A reviewer answered you, or answered a reply of yours.',
  },
  {
    kind: 'feedback_helpful',
    label: 'A creator marked your note helpful',
    detail: 'The mark that carries weight in your reviewer score.',
  },
  {
    kind: 'suggestion_shipped',
    label: 'A suggestion you fed shipped',
    detail: 'A creator shipped something your note asked for, and credited you.',
  },
  {
    kind: 'suggestion_status',
    label: 'A suggestion you fed moved',
    detail: 'Planned, in progress, or declined with the reason attached.',
  },
  {
    kind: 'new_follower',
    label: 'Someone followed you',
    detail: 'They see your projects and reviews in their feed.',
  },
  {
    kind: 'mention',
    label: 'Someone mentioned you',
    detail: 'In a note, a reply or a discussion thread.',
  },
  {
    kind: 'bounty_awarded',
    label: 'A bounty was awarded to you',
    detail: 'Paid work, so this is the one to leave on.',
  },
]

export default async function NotificationSettingsPage() {
  const claims = await currentClaimsLive()
  if (!claims) redirect('/sign-in?next=%2Fsettings%2Fnotifications')

  const prefs = getNotificationPrefs(
    claims.uid,
    KINDS.map((entry) => entry.kind),
  )
  const byKind = new Map(prefs.map((pref) => [pref.kind, pref]))

  const rows: NotificationRow[] = KINDS.map((entry) => {
    const pref = byKind.get(entry.kind)
    return {
      kind: entry.kind,
      label: entry.label,
      detail: entry.detail,
      inApp: pref?.inApp ?? true,
    }
  })

  return (
    <>
      <PageHeader
        title="Notifications"
        lede="What rings the bell. Turning a kind off silences the bell, never the thing itself: a note is still in the inbox when you come looking."
      />
      {/* One switch per row, so the table keeps to a reading width rather than
          putting the switch a screen's width from the words it acts on. */}
      <div className="max-w-prose">
        <NotificationPrefs rows={rows} />
      </div>
    </>
  )
}

'use server'

/**
 * Server Actions the app chrome owns: palette search, the bell's read
 * transitions, and sign-out.
 *
 * Every one of them re-derives identity from the cookie through
 * `currentUser()`. Nothing here trusts an argument to say who is acting.
 *
 * Every href returned from here is a route that exists in `src/app`: projects
 * ship at `/p/[slug]` and threads at `/c/[channel]/[threadId]`, whatever
 * ROUTES.md predicted. A result row that leads to a 404 is banned (ban 32).
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { clearSessionCookie } from '@/lib/auth'
import { currentSessionId } from '@/server/queries/auth'
import { revokeSession } from '@/server/repos/users'
import { currentUser, currentUserId } from '@/server/auth/session'
import { searchProjects } from '@/server/repos/search'
import { listDiscussions } from '@/server/repos/discussions'
import { listExperts } from '@/server/repos/profiles'
import { markAllRead, markRead } from '@/server/repos/notifications'
import type { CommandGroup, CommandHit, CommandResults } from './types'

/** Non-breaking space, so a count never wraps away from its unit (§3.4). */
const NBSP = '\u00A0'

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString('en')}${NBSP}${count === 1 ? one : many}`
}

/**
 * Grouped type-ahead across the three things a reader navigates to by name.
 * Runs on every keystroke after a 150ms rest, so each query is capped short:
 * a palette that returns forty rows is a search page wearing a costume.
 */
export async function searchCommand(rawQuery: string): Promise<CommandResults> {
  const query = rawQuery.trim().slice(0, 120)
  if (query.length < 2) return { query, groups: [], total: 0 }

  const viewerId = await currentUserId()

  const projectHits: CommandHit[] = searchProjects(query, { limit: 5, viewerId }).items.map(
    (hit): CommandHit => ({
      id: `project:${hit.project.id}`,
      label: hit.project.title,
      meta: hit.project.tagline ?? `${hit.project.typeLabel}, grit ${String(hit.project.grit)}`,
      href: `/p/${hit.project.slug}`,
    }),
  )

  const peopleHits: CommandHit[] = listExperts({ query }, { limit: 4 }).items.map(
    (expert): CommandHit => ({
      id: `person:${expert.user.id}`,
      label: expert.user.displayName,
      meta: expert.headline,
      href: `/u/${expert.user.handle}`,
    }),
  )

  const discussionHits: CommandHit[] = listDiscussions({ query, limit: 4, sort: 'hot' }).items.map(
    (thread): CommandHit => ({
      id: `thread:${thread.id}`,
      label: thread.title,
      meta: `${thread.channel.label}, ${plural(thread.postCount, 'reply', 'replies')}`,
      href: `/c/${thread.channel.slug}/${thread.id}`,
    }),
  )

  const groups: CommandGroup[] = []
  if (projectHits.length > 0) groups.push({ key: 'projects', label: 'Projects', hits: projectHits })
  if (peopleHits.length > 0) groups.push({ key: 'people', label: 'People', hits: peopleHits })
  if (discussionHits.length > 0) {
    groups.push({ key: 'discussions', label: 'Discussions', hits: discussionHits })
  }

  return {
    query,
    groups,
    total: projectHits.length + peopleHits.length + discussionHits.length,
  }
}

/** Marks one notification read. Scoped by user id inside the repository. */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const user = await currentUser()
  if (!user) return
  markRead(notificationId, user.id)
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await currentUser()
  if (!user) return
  markAllRead(user.id)
}

/**
 * Ends this session on the server, clears the cookie, and lands on the public
 * feed, which is where a signed-out reader can still do something useful.
 *
 * Clearing the cookie alone was not signing out. The session row stayed live
 * for up to thirty days, so a copy of the cookie (a shared computer, a synced
 * browser profile) went on working after the person had signed out.
 */
export async function signOut(): Promise<void> {
  const sessionId = await currentSessionId()
  if (sessionId) revokeSession(sessionId)
  await clearSessionCookie()
  revalidatePath('/', 'layout')
  redirect('/discover')
}

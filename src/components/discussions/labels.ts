/**
 * The words this surface uses. Kept in one file so a label, a sort key and an
 * empty state cannot drift apart, and so the punctuation pass (curly quotes,
 * ellipsis, en dash, no em dash) has one place to happen.
 */

import type { ThreadKind } from '@/lib/types'

/* --------------------------------------------------------------- sorting -- */

export const THREAD_SORTS = [
  { value: 'hot', label: 'Most active' },
  { value: 'newest', label: 'Newest' },
  { value: 'unanswered', label: 'Unanswered' },
] as const

export type ThreadSortKey = (typeof THREAD_SORTS)[number]['value']

export const DEFAULT_THREAD_SORT: ThreadSortKey = 'hot'

export function isThreadSort(value: string | undefined): value is ThreadSortKey {
  return THREAD_SORTS.some((s) => s.value === value)
}

export function threadSortKey(value: string | string[] | undefined): ThreadSortKey {
  const single = Array.isArray(value) ? value[0] : value
  return isThreadSort(single) ? single : DEFAULT_THREAD_SORT
}

/* ----------------------------------------------------------------- kinds -- */

export const THREAD_KIND_LABEL: Record<ThreadKind, string> = {
  discussion: 'Discussion',
  question: 'Question',
  showcase: 'Showcase',
  announcement: 'Announcement',
}

/** Kinds a member can start. Announcements are posted by moderators. */
export const AUTHORABLE_KINDS = [
  {
    value: 'discussion',
    label: 'Discussion',
    description: 'An open topic. No single right answer expected.',
  },
  {
    value: 'question',
    label: 'Question',
    description: 'You want an answer, and you can mark the one that worked.',
  },
  {
    value: 'showcase',
    label: 'Showcase',
    description: 'You are putting work up and saying what you are unsure about.',
  },
] as const

export type AuthorableKind = (typeof AUTHORABLE_KINDS)[number]['value']

/* ---------------------------------------------------------- empty states -- */

export interface EmptyCopy {
  readonly title: string
  readonly body: string
  readonly actionLabel: string
}

/**
 * Three beats, written for the channel rather than for the component: what is
 * empty, why that matters here, and the one thing to do about it.
 */
const CHANNEL_EMPTY: Record<string, EmptyCopy> = {
  playtesting: {
    title: 'No threads in Playtesting yet',
    body: 'This channel is where people compare notes on running sessions, recruiting testers, and reading what comes back. A thread that names the round you just ran gets read first.',
    actionLabel: 'Start a thread in Playtesting',
  },
  'giving-feedback': {
    title: 'No threads in Giving feedback yet',
    body: 'This channel is for how to say the hard thing so it gets used. Post the note you could not word, and someone will show you the sentence that lands.',
    actionLabel: 'Start a thread in Giving feedback',
  },
  pricing: {
    title: 'No threads in Pricing & money yet',
    body: 'Rates, bounties, and what a review is worth. People here answer a real number faster than they answer a general question about value.',
    actionLabel: 'Start a thread in Pricing & money',
  },
  craft: {
    title: 'No threads in Craft yet',
    body: 'Type, sound, code, tolerance, the cut. Post the decision you are stuck on and the constraint it has to survive.',
    actionLabel: 'Start a thread in Craft',
  },
  'show-your-work': {
    title: 'No threads in Show your work yet',
    body: 'Post a build, a cut, a page, or a board, and say what you are unsure about. A showcase with a named doubt gets specific replies instead of applause.',
    actionLabel: 'Start a showcase thread',
  },
  'whetstone-meta': {
    title: 'No threads in About Whetstone yet',
    body: 'Feature requests, bugs in the site itself, and moderation questions land here. Every thread in this channel is read by the people who build the product.',
    actionLabel: 'Start a thread about Whetstone',
  },
}

export function channelEmptyCopy(slug: string, label: string): EmptyCopy {
  return (
    CHANNEL_EMPTY[slug] ?? {
      title: `No threads in ${label} yet`,
      body: `This channel is open and nobody has written in it. The first thread sets what ${label} is for, so make it a specific one.`,
      actionLabel: `Start a thread in ${label}`,
    }
  )
}

/** Copy for a channel that has threads, but none under the current sort. */
export function filteredEmptyCopy(sort: ThreadSortKey, channelLabel: string, total: number): EmptyCopy {
  if (sort === 'unanswered') {
    return {
      title: `No unanswered questions in ${channelLabel}`,
      body: `Every question in this channel already has at least one reply. There are ${String(total)}\u00A0threads here under the other sorts.`,
      actionLabel: 'Show the most active threads',
    }
  }
  return {
    title: `Nothing to show in ${channelLabel} under this sort`,
    body: `This channel holds ${String(total)}\u00A0threads, and none of them match the sort you picked. Switching back shows the whole register.`,
    actionLabel: 'Show the most active threads',
  }
}

/* ------------------------------------------------------------- moderation -- */

/**
 * The subset of `content_reports.reason` a discussion can actually be. Twelve
 * reasons is a form nobody reads; these are the seven that reach a moderator
 * with the routing they need.
 *
 * This list lives here rather than beside the query because the report dialog
 * is a Client Component and must not pull the database client into the bundle.
 */
export const DISCUSSION_REPORT_REASONS = [
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'harassment', label: 'Harassment of a person' },
  { value: 'hate', label: 'Hateful content' },
  { value: 'off_topic', label: 'Off topic for this channel' },
  { value: 'low_effort', label: 'Low effort or noise' },
  { value: 'undisclosed_paid', label: 'Undisclosed paid promotion' },
  { value: 'other', label: 'Something else' },
] as const

export type DiscussionReportReason = (typeof DISCUSSION_REPORT_REASONS)[number]['value']

export function isDiscussionReportReason(value: string): value is DiscussionReportReason {
  return DISCUSSION_REPORT_REASONS.some((reason) => reason.value === value)
}

export type ReportTargetType = 'discussion_thread' | 'discussion_post'

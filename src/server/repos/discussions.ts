/**
 * Community discussions: channels, threads, and one level of nested replies.
 *
 * Threads carry no slug column, so they are addressed by id. The channel has a
 * slug and that is what the URL segment above the thread uses.
 */

import { all, get, run, tx } from '@/server/db/client'
import { threadUrl } from './notification-targets'
import { now, uid } from '@/lib/utils'
import type {
  DiscussionChannelRow,
  DiscussionPostView,
  Millis,
  Page,
  PageOptions,
  ThreadCard,
  ThreadDetail,
  ThreadKind,
  ThreadStatus,
} from '@/lib/types'
import {
  bool,
  decodeCursor,
  encodeCursor,
  excerpt,
  mapUserCard,
  num,
  numOrNull,
  pageLimit,
  str,
  strOrNull,
  toPage,
  userCardJoin,
  userCardSelect,
  type Row,
} from './_shared'
import { notify, notifyMany } from './notifications'
import { recordReputationEvent } from './reputation'

/* ------------------------------------------------------------------------- *
 * Channels
 * ------------------------------------------------------------------------- */

export function listChannels(): readonly DiscussionChannelRow[] {
  return all<DiscussionChannelRow>(
    `SELECT * FROM discussion_channels WHERE is_archived = 0 AND is_private = 0
      ORDER BY sort_order, label`,
  )
}

/**
 * One channel by slug, if it is one anybody may read.
 *
 * `is_private = 0` belongs here for the same reason it is on the register query
 * and the thread list: this is the lookup the channel page and the new-thread
 * form both use to resolve a slug before reading or writing, and without it a
 * private channel was reachable, and postable to, by anyone who knew its slug.
 * There is no private-channel membership model yet; when there is, the check
 * goes here and nowhere else.
 */
export function getChannel(slug: string): DiscussionChannelRow | undefined {
  return get<DiscussionChannelRow>(
    `SELECT * FROM discussion_channels WHERE slug = ? AND is_archived = 0 AND is_private = 0`,
    [slug],
  )
}

/* ------------------------------------------------------------------------- *
 * Threads
 * ------------------------------------------------------------------------- */

export type ThreadSort = 'hot' | 'newest' | 'unanswered' | 'top'

export interface ThreadFilters extends PageOptions {
  readonly channelSlug?: string | null
  readonly projectId?: string | null
  readonly kind?: ThreadKind | null
  readonly sort?: ThreadSort
  readonly query?: string | null
}

const SORT_COLUMN: Record<ThreadSort, string> = {
  hot: 'dt.hot_score',
  newest: 'dt.created_at',
  unanswered: 'dt.created_at',
  top: 'dt.score',
}

export function listDiscussions(filters: ThreadFilters = {}): Page<ThreadCard> {
  const limit = pageLimit(filters.limit, 20)
  const sort: ThreadSort = filters.sort ?? 'hot'
  const column = SORT_COLUMN[sort]
  const cursor = decodeCursor(filters.cursor)

  const where: string[] = ['dt.deleted_at IS NULL', "dt.status <> 'removed'", 'dc.is_private = 0']
  const params: unknown[] = []

  if (filters.channelSlug) {
    where.push('dc.slug = ?')
    params.push(filters.channelSlug)
  }
  if (filters.projectId) {
    where.push('dt.project_id = ?')
    params.push(filters.projectId)
  }
  if (filters.kind) {
    where.push('dt.thread_kind = ?')
    params.push(filters.kind)
  }
  if (sort === 'unanswered') {
    where.push("dt.thread_kind = 'question'", "dt.status = 'open'", 'dt.post_count = 0')
  }
  if (filters.query) {
    where.push('(dt.title LIKE ? OR dt.body_md LIKE ?)')
    const like = `%${filters.query.trim()}%`
    params.push(like, like)
  }
  if (cursor) {
    // The keyset has to carry every term the ORDER BY leads with. `is_pinned`
    // was missing, so a pinned thread sorted to the top of every page while the
    // predicate only ever looked at the sort column: page two, three and four
    // all opened with the same pinned threads again.
    where.push(
      `(dt.is_pinned < ? OR (dt.is_pinned = ? AND (${column} < ? OR (${column} = ? AND dt.id < ?))))`,
    )
    const pinned = num(cursor, 'p')
    params.push(pinned, pinned, num(cursor, 'v'), num(cursor, 'v'), str(cursor, 'id'))
  }

  const rows = all<Row>(
    `SELECT dt.*, dc.slug AS channel_slug, dc.label AS channel_label,
            p.slug AS project_slug, p.title AS project_title,
            ${userCardSelect('u', 'pr', 'rs', 'a')},
            ${column} AS sort_value
       FROM discussion_threads dt
       JOIN discussion_channels dc ON dc.id = dt.channel_id
       JOIN users u ON u.id = dt.author_id
       ${userCardJoin('u', 'pr', 'rs')}
       LEFT JOIN projects p ON p.id = dt.project_id
      WHERE ${where.join(' AND ')}
      ORDER BY dt.is_pinned DESC, ${column} DESC, dt.id DESC
      LIMIT ?`,
    [...params, limit + 1],
  )

  const page = toPage(rows, limit, (last) =>
    encodeCursor({ p: num(last, 'is_pinned'), v: num(last, 'sort_value'), id: str(last, 'id') }),
  )
  return { items: page.items.map(mapThreadCard), hasMore: page.hasMore, nextCursor: page.nextCursor }
}

function mapThreadCard(r: Row): ThreadCard {
  return {
    id: str(r, 'id'),
    title: str(r, 'title'),
    kind: (str(r, 'thread_kind') || 'discussion') as ThreadKind,
    status: (str(r, 'status') || 'open') as ThreadStatus,
    channel: {
      id: str(r, 'channel_id'),
      slug: str(r, 'channel_slug'),
      label: str(r, 'channel_label'),
    },
    author: mapUserCard(r, 'a'),
    excerpt: excerpt(str(r, 'body_md')),
    postCount: num(r, 'post_count'),
    viewCount: num(r, 'view_count'),
    score: num(r, 'score'),
    isPinned: bool(r, 'is_pinned'),
    hasAcceptedAnswer: strOrNull(r, 'accepted_post_id') !== null,
    project: strOrNull(r, 'project_slug')
      ? { slug: str(r, 'project_slug'), title: str(r, 'project_title') }
      : null,
    lastPostAt: numOrNull(r, 'last_post_at'),
    createdAt: num(r, 'created_at'),
  }
}

/**
 * The thread and its whole reply tree, in two queries.
 *
 * Readable on the same terms as the register lists it: a thread a moderator
 * removed, or one in a private or archived channel, does not resolve, so its
 * page is a 404 rather than a page whose breadcrumb leads to one.
 */
export function getDiscussion(threadId: string, viewerId?: string | null): ThreadDetail | undefined {
  const row = get<Row>(
    `SELECT dt.*, dc.slug AS channel_slug, dc.label AS channel_label,
            p.slug AS project_slug, p.title AS project_title,
            ${userCardSelect('u', 'pr', 'rs', 'a')}
       FROM discussion_threads dt
       JOIN discussion_channels dc ON dc.id = dt.channel_id
       JOIN users u ON u.id = dt.author_id
       ${userCardJoin('u', 'pr', 'rs')}
       LEFT JOIN projects p ON p.id = dt.project_id
      WHERE dt.id = ? AND dt.deleted_at IS NULL AND dt.status <> 'removed'
        AND dc.is_private = 0 AND dc.is_archived = 0`,
    [threadId],
  )
  if (!row) return undefined

  const card = mapThreadCard(row)
  return {
    ...card,
    bodyMd: str(row, 'body_md'),
    posts: listPosts(threadId, viewerId ?? null),
    viewerSubscribed:
      viewerId !== null &&
      viewerId !== undefined &&
      get<Row>(
        `SELECT 1 AS hit FROM thread_subscriptions
          WHERE thread_id = ? AND user_id = ? AND state = 'subscribed'`,
        [threadId, viewerId],
      ) !== undefined,
    viewerIsAuthor: viewerId === card.author.id,
  }
}

export type PostSort = 'oldest' | 'newest' | 'top'

/** Replies, nested by `parent_post_id`, with the accepted answer hoisted first. */
export function listPosts(
  threadId: string,
  viewerId: string | null,
  sort: PostSort = 'oldest',
): readonly DiscussionPostView[] {
  const order =
    sort === 'newest' ? 'dp.created_at DESC' : sort === 'top' ? 'dp.score DESC, dp.created_at' : 'dp.created_at'

  const rows = all<Row>(
    `SELECT dp.*, ${userCardSelect('u', 'pr', 'rs', 'a')},
            ${viewerId ? '(SELECT pv.vote_value FROM post_votes pv WHERE pv.post_id = dp.id AND pv.voter_id = ?)' : 'NULL'} AS viewer_vote
       FROM discussion_posts dp
       JOIN users u ON u.id = dp.author_id
       ${userCardJoin('u', 'pr', 'rs')}
      WHERE dp.thread_id = ? AND dp.deleted_at IS NULL
      ORDER BY dp.is_accepted DESC, ${order}`,
    [...(viewerId ? [viewerId] : []), threadId],
  )

  const byId = new Map<string, DiscussionPostView & { childList: DiscussionPostView[] }>()
  const roots: (DiscussionPostView & { childList: DiscussionPostView[] })[] = []

  for (const r of rows) {
    const childList: DiscussionPostView[] = []
    const view = {
      id: str(r, 'id'),
      bodyMd: str(r, 'body_md'),
      author: mapUserCard(r, 'a'),
      depth: num(r, 'depth'),
      score: num(r, 'score'),
      isAccepted: bool(r, 'is_accepted'),
      parentPostId: strOrNull(r, 'parent_post_id'),
      editedAt: numOrNull(r, 'edited_at'),
      createdAt: num(r, 'created_at'),
      viewerVote: normalizeVote(numOrNull(r, 'viewer_vote')),
      children: childList,
      childList,
    }
    byId.set(view.id, view)
  }
  for (const view of byId.values()) {
    const parent = view.parentPostId ? byId.get(view.parentPostId) : undefined
    if (parent) parent.childList.push(view)
    else roots.push(view)
  }
  return roots
}

function normalizeVote(value: number | null): -1 | 0 | 1 {
  return value === 1 ? 1 : value === -1 ? -1 : 0
}

/* ------------------------------------------------------------------------- *
 * Writes
 * ------------------------------------------------------------------------- */

export interface NewThreadInput {
  readonly channelId: string
  readonly authorId: string
  readonly title: string
  readonly bodyMd: string
  readonly kind?: ThreadKind
  readonly projectId?: string | null
}

export function createThread(input: NewThreadInput): string {
  const id = uid()
  const ts = now()
  tx(() => {
    run(
      `INSERT INTO discussion_threads
         (id, channel_id, project_id, author_id, title, body_md, thread_kind,
          status, post_count, view_count, score, hot_score, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', 0, 0, 0, ?, ?, ?)`,
      [
        id,
        input.channelId,
        input.projectId ?? null,
        input.authorId,
        input.title,
        input.bodyMd,
        input.kind ?? 'discussion',
        // A new thread starts at the top of `hot` and decays from there.
        1.0,
        ts,
        ts,
      ],
    )
    // Counted, not incremented. Nothing decrements on removal, and this column
    // is what the channel page prints, so a `+ 1` drifts the moment a thread is
    // taken down. The register query already derives the same number.
    run(
      `UPDATE discussion_channels SET thread_count = (
         SELECT COUNT(*) FROM discussion_threads t
          WHERE t.channel_id = ? AND t.deleted_at IS NULL AND t.status <> 'removed')
       WHERE id = ?`,
      [input.channelId, input.channelId],
    )
    // The author is subscribed explicitly rather than inferred, so muting works.
    run(
      `INSERT INTO thread_subscriptions (thread_id, user_id, state, created_at)
       VALUES (?, ?, 'subscribed', ?) ON CONFLICT (thread_id, user_id) DO NOTHING`,
      [id, input.authorId, ts],
    )
  })
  // hot_score goes in at 1.0 and nothing was ever recomputing it, so a thread
  // created in the app sat at the top of `hot` permanently while every seeded
  // thread decayed past it. The formula lives one function away.
  recomputeThreadHotScores(ts)
  return id
}

export interface NewPostInput {
  readonly threadId: string
  readonly authorId: string
  readonly bodyMd: string
  readonly parentPostId?: string | null
}

export function createPost(input: NewPostInput): string {
  const id = uid()
  const ts = now()
  tx(() => {
    // The parent is read within this thread only. Looked up by id alone, a
    // reply could hang off a post in another thread and take its depth from it.
    // The action refuses a foreign parent before it gets here; this keeps the
    // repository from trusting it either.
    const parent = input.parentPostId
      ? get<Row>(
          `SELECT depth FROM discussion_posts WHERE id = ? AND thread_id = ? AND deleted_at IS NULL`,
          [input.parentPostId, input.threadId],
        )
      : undefined
    if (input.parentPostId && !parent) {
      throw new Error('createPost: the parent post is not a live reply in this thread')
    }
    const parentDepth = parent ? num(parent, 'depth') : -1
    // The schema caps depth at 4; deeper replies flatten onto the last level
    // rather than being refused, because losing a reply is worse than nesting it
    // one step shallower than the person intended.
    const depth = Math.min(4, parentDepth + 1)

    run(
      `INSERT INTO discussion_posts
         (id, thread_id, parent_post_id, author_id, body_md, depth, score, is_accepted, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)`,
      [id, input.threadId, input.parentPostId ?? null, input.authorId, input.bodyMd, depth, ts],
    )
    run(
      `UPDATE discussion_threads
          SET post_count = (SELECT COUNT(*) FROM discussion_posts
                             WHERE thread_id = ? AND deleted_at IS NULL),
              last_post_at = ?, updated_at = ?
        WHERE id = ?`,
      [input.threadId, ts, ts, input.threadId],
    )
    run(
      `INSERT INTO thread_subscriptions (thread_id, user_id, state, created_at)
       VALUES (?, ?, 'subscribed', ?) ON CONFLICT (thread_id, user_id) DO NOTHING`,
      [input.threadId, input.authorId, ts],
    )

    const thread = get<Row>(
      `SELECT dt.title, dc.slug AS channel_slug FROM discussion_threads dt
         JOIN discussion_channels dc ON dc.id = dt.channel_id WHERE dt.id = ?`,
      [input.threadId],
    )
    const subscribers = all<Row>(
      `SELECT user_id FROM thread_subscriptions WHERE thread_id = ? AND state = 'subscribed'`,
      [input.threadId],
    ).map((r) => str(r, 'user_id'))

    notifyMany(subscribers, {
      actorId: input.authorId,
      kind: 'thread_reply',
      subjectType: 'discussion_thread',
      subjectId: input.threadId,
      title: `New reply in ${str(thread, 'title')}`,
      url: threadUrl(str(thread, 'channel_slug'), input.threadId),
      groupKey: `thread:${input.threadId}`,
    })
  })
  // A reply is the strongest term in the hot formula, so the score moves with
  // it rather than waiting for a recompute nobody was running.
  recomputeThreadHotScores(ts)
  return id
}

export function getPostAuthorId(postId: string): string | null {
  const row = get<Row>(`SELECT author_id FROM discussion_posts WHERE id = ?`, [postId])
  return row ? str(row, 'author_id') : null
}

export function votePost(postId: string, voterId: string, value: -1 | 0 | 1): number {
  const ts = now()
  tx(() => {
    if (value === 0) {
      run(`DELETE FROM post_votes WHERE post_id = ? AND voter_id = ?`, [postId, voterId])
    } else {
      run(
        `INSERT INTO post_votes (post_id, voter_id, vote_value, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (post_id, voter_id) DO UPDATE SET vote_value = excluded.vote_value`,
        [postId, voterId, value, ts],
      )
    }
    run(
      `UPDATE discussion_posts SET score = COALESCE((
         SELECT SUM(vote_value) FROM post_votes WHERE post_id = ?), 0) WHERE id = ?`,
      [postId, postId],
    )
    const post = get<Row>(`SELECT thread_id, author_id FROM discussion_posts WHERE id = ?`, [postId])
    run(
      `UPDATE discussion_threads SET score = COALESCE((
         SELECT SUM(dp.score) FROM discussion_posts dp
          WHERE dp.thread_id = ? AND dp.deleted_at IS NULL), 0)
       WHERE id = ?`,
      [str(post, 'thread_id'), str(post, 'thread_id')],
    )
    if (value === 1 && str(post, 'author_id') !== voterId) {
      recordReputationEvent({
        userId: str(post, 'author_id'),
        facet: 'community',
        kind: 'discussion_upvoted',
        delta: 2,
        subjectType: 'discussion_post',
        subjectId: postId,
        actorId: voterId,
      })
    }
  })
  return num(get<Row>(`SELECT score FROM discussion_posts WHERE id = ?`, [postId]), 'score')
}

/** Only questions get answered, and only one answer per thread. */
export function acceptAnswer(threadId: string, postId: string, actorId: string): boolean {
  const ts = now()
  return tx(() => {
    const thread = get<Row>(
      `SELECT author_id, thread_kind, title FROM discussion_threads WHERE id = ?`,
      [threadId],
    )
    if (!thread) return false
    if (str(thread, 'thread_kind') !== 'question') return false
    if (str(thread, 'author_id') !== actorId) return false

    // The post has to be a live reply in this thread, and that is checked before
    // anything is written. It used to be looked up by id alone after the writes,
    // so any post on the site could be "accepted": the thread flipped to answered
    // with nothing marked, and the post's author was paid +15 for it, once per
    // question. `accepted_post_id` has no foreign key to catch it either.
    const post = get<Row>(
      `SELECT author_id FROM discussion_posts WHERE id = ? AND thread_id = ? AND deleted_at IS NULL`,
      [postId, threadId],
    )
    if (!post) return false

    run(`UPDATE discussion_posts SET is_accepted = 0 WHERE thread_id = ? AND is_accepted = 1`, [threadId])
    run(`UPDATE discussion_posts SET is_accepted = 1 WHERE id = ?`, [postId])
    run(
      `UPDATE discussion_threads SET accepted_post_id = ?, status = 'answered', updated_at = ? WHERE id = ?`,
      [postId, ts, threadId],
    )
    const answerAuthor = str(post, 'author_id')
    if (answerAuthor !== actorId) {
      recordReputationEvent({
        userId: answerAuthor,
        facet: 'community',
        kind: 'accepted_answer',
        delta: 15,
        subjectType: 'discussion_post',
        subjectId: postId,
        actorId,
      })
      notify({
        userId: answerAuthor,
        actorId,
        kind: 'answer_accepted',
        subjectType: 'discussion_post',
        subjectId: postId,
        title: `Your answer was accepted on ${str(thread, 'title')}`,
      })
    }
    return true
  })
}

export function setSubscription(threadId: string, userId: string, state: 'subscribed' | 'muted'): void {
  run(
    `INSERT INTO thread_subscriptions (thread_id, user_id, state, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (thread_id, user_id) DO UPDATE SET state = excluded.state`,
    [threadId, userId, state, now()],
  )
}

export function incrementThreadViews(threadId: string): void {
  run(`UPDATE discussion_threads SET view_count = view_count + 1 WHERE id = ?`, [threadId])
}

/**
 * Gravity ranking over the thread's own score and age. Comment activity counts
 * here, unlike on projects, because a discussion that is still being discussed
 * genuinely is the live one.
 */
export function recomputeThreadHotScores(at?: Millis): void {
  const ts = at ?? now()
  run(
    `UPDATE discussion_threads
        SET hot_score = (1.0 + score + 0.5 * post_count)
                      / POW(((? - COALESCE(last_post_at, created_at)) / 3600000.0) + 2.0, 1.5)
      WHERE deleted_at IS NULL AND created_at > ?`,
    [ts, ts - 90 * 86_400_000],
  )
}

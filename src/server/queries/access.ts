import { get } from '@/server/db/client'

/**
 * Authorisation facts.
 *
 * Every mutating route has to answer two separate questions, and the common bug
 * in an app this shape is answering only the first: *is anyone signed in*, and
 * *may this person act on this row*. These projections exist so the second
 * question is one call with one obvious answer, rather than three joins written
 * out again in each handler.
 *
 * Each function returns the identity facts and nothing else: no titles, no
 * bodies, no counts. A route that needs to render something reads a repository
 * afterwards. Keeping them separate means an authorisation check can never be
 * accidentally satisfied by a view model that happened to be loaded already.
 */

export interface ProjectAccess {
  readonly id: string
  readonly slug: string
  readonly ownerId: string
  readonly visibility: 'private' | 'unlisted' | 'public'
  readonly status: string
  readonly feedbackState: 'open' | 'invite_only' | 'closed'
  readonly typeId: string
  readonly deleted: boolean
}

export function projectAccess(projectId: string): ProjectAccess | undefined {
  const row = get<{
    id: string
    slug: string
    owner_id: string
    visibility: string
    status: string
    feedback_state: string
    project_type_id: string
    deleted_at: number | null
  }>(
    `SELECT id, slug, owner_id, visibility, status, feedback_state, project_type_id, deleted_at
       FROM projects WHERE id = ?`,
    [projectId],
  )
  if (!row) return undefined
  return {
    id: row.id,
    slug: row.slug,
    ownerId: row.owner_id,
    visibility: row.visibility as ProjectAccess['visibility'],
    status: row.status,
    feedbackState: row.feedback_state as ProjectAccess['feedbackState'],
    typeId: row.project_type_id,
    deleted: row.deleted_at !== null,
  }
}

export function isCollaborator(projectId: string, userId: string): boolean {
  const row = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM project_collaborators WHERE project_id = ? AND user_id = ?`,
    [projectId, userId],
  )
  return (row?.n ?? 0) > 0
}

/** May this viewer see the project at all? Owners and collaborators always can. */
export function canSeeProject(project: ProjectAccess, viewerId: string | null): boolean {
  if (project.deleted) return false
  if (viewerId && (project.ownerId === viewerId || isCollaborator(project.id, viewerId))) return true
  return project.status === 'published' && project.visibility !== 'private'
}

/** May this viewer change the project, its board, or its rollups? */
export function canManageProject(project: ProjectAccess, viewerId: string | null): boolean {
  if (!viewerId || project.deleted) return false
  return project.ownerId === viewerId || isCollaborator(project.id, viewerId)
}

/* -------------------------------------------------------------------------- *
 * Feedback
 * -------------------------------------------------------------------------- */

export interface FeedbackAccess {
  readonly id: string
  readonly projectId: string
  readonly projectSlug: string
  readonly reviewerId: string
  readonly projectOwnerId: string
  readonly visibility: 'public' | 'creator_only'
  readonly status: string
  readonly deleted: boolean
}

export function feedbackAccess(feedbackId: string): FeedbackAccess | undefined {
  const row = get<{
    id: string
    project_id: string
    slug: string
    reviewer_id: string
    owner_id: string
    visibility: string
    status: string
    deleted_at: number | null
  }>(
    `SELECT f.id, f.project_id, p.slug, f.reviewer_id, p.owner_id, f.visibility, f.status, f.deleted_at
       FROM feedback f JOIN projects p ON p.id = f.project_id
      WHERE f.id = ?`,
    [feedbackId],
  )
  if (!row) return undefined
  return {
    id: row.id,
    projectId: row.project_id,
    projectSlug: row.slug,
    reviewerId: row.reviewer_id,
    projectOwnerId: row.owner_id,
    visibility: row.visibility as FeedbackAccess['visibility'],
    status: row.status,
    deleted: row.deleted_at !== null,
  }
}

/**
 * Creator-only feedback is readable by three people and no one else: the
 * reviewer who wrote it, the creator it was written for, and a collaborator on
 * that project. A vote route that skipped this would let any signed-in account
 * confirm the existence of a private review by its id.
 */
export function canSeeFeedback(feedback: FeedbackAccess, viewerId: string | null): boolean {
  if (feedback.deleted || feedback.status !== 'submitted') return false
  if (feedback.visibility === 'public') return true
  if (!viewerId) return false
  return (
    viewerId === feedback.reviewerId ||
    viewerId === feedback.projectOwnerId ||
    isCollaborator(feedback.projectId, viewerId)
  )
}

export interface PointAccess {
  readonly id: string
  readonly feedbackId: string
}

export function pointAccess(pointId: string): PointAccess | undefined {
  const row = get<{ id: string; feedback_id: string }>(
    `SELECT id, feedback_id FROM feedback_points WHERE id = ?`,
    [pointId],
  )
  return row ? { id: row.id, feedbackId: row.feedback_id } : undefined
}

/* -------------------------------------------------------------------------- *
 * Suggestions and discussion posts
 * -------------------------------------------------------------------------- */

export interface SuggestionAccess {
  readonly id: string
  readonly projectId: string
  readonly createdBy: string
  readonly status: string
}

export function suggestionAccess(suggestionId: string): SuggestionAccess | undefined {
  const row = get<{ id: string; project_id: string; created_by: string; status: string }>(
    `SELECT id, project_id, created_by, status FROM suggestions WHERE id = ?`,
    [suggestionId],
  )
  return row
    ? { id: row.id, projectId: row.project_id, createdBy: row.created_by, status: row.status }
    : undefined
}

export interface PostAccess {
  readonly id: string
  readonly threadId: string
  readonly authorId: string
  readonly deleted: boolean
  readonly threadStatus: string
  readonly channelPrivate: boolean
}

export function postAccess(postId: string): PostAccess | undefined {
  const row = get<{
    id: string
    thread_id: string
    author_id: string
    deleted_at: number | null
    status: string
    is_private: number
  }>(
    `SELECT dp.id, dp.thread_id, dp.author_id, dp.deleted_at, dt.status, dc.is_private
       FROM discussion_posts dp
       JOIN discussion_threads dt ON dt.id = dp.thread_id
       JOIN discussion_channels dc ON dc.id = dt.channel_id
      WHERE dp.id = ? AND dt.deleted_at IS NULL`,
    [postId],
  )
  if (!row) return undefined
  return {
    id: row.id,
    threadId: row.thread_id,
    authorId: row.author_id,
    deleted: row.deleted_at !== null,
    threadStatus: row.status,
    channelPrivate: row.is_private === 1,
  }
}

/* -------------------------------------------------------------------------- *
 * People
 * -------------------------------------------------------------------------- */

export interface UserAccess {
  readonly id: string
  readonly handle: string
  readonly status: string
  readonly deleted: boolean
}

export function userAccessByHandle(handle: string): UserAccess | undefined {
  const row = get<{ id: string; handle: string; status: string; deleted_at: number | null }>(
    `SELECT id, handle, status, deleted_at FROM users WHERE handle_normalized = ?`,
    [handle.trim().toLowerCase().replace(/^@/, '')],
  )
  if (!row) return undefined
  return { id: row.id, handle: row.handle, status: row.status, deleted: row.deleted_at !== null }
}

/** True when either party has blocked the other. Blocking is symmetric here. */
export function eitherBlocks(a: string, b: string): boolean {
  const row = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM user_blocks
      WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
    [a, b, b, a],
  )
  return (row?.n ?? 0) > 0
}

/** The account age term of the new-account throttle in ROUTES §3. */
export function accountAgeMs(userId: string): number {
  const row = get<{ created_at: number }>(`SELECT created_at FROM users WHERE id = ?`, [userId])
  return row ? Date.now() - row.created_at : 0
}

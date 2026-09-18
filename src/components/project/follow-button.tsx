'use client'

/**
 * Ask to hear about this project's next build.
 *
 * Saving and following are different promises and the labels say so: Save puts
 * the project on your list, Follow asks the product to tell you when it moves.
 * `project_follows` already carried a notify preference and drove the creator's
 * build notification; until this control existed it was a row nobody could write.
 *
 * Keyboard contract matches SaveButton: one real submit button, 44px tall,
 * `aria-pressed` carrying the state, and a live region that says what happened
 * rather than leaving the change to a silent colour swap. Signed out it is a
 * link to sign-in that says why, not a disabled control with no explanation.
 */

import { useOptimistic } from 'react'
import Link from 'next/link'
import { Bell, BellRing } from 'lucide-react'

export interface FollowButtonProps {
  slug: string
  following: boolean
  signedIn: boolean
  action: (formData: FormData) => void | Promise<void>
}

export function FollowButton({ slug, following, signedIn, action }: FollowButtonProps) {
  const [optimistic, flip] = useOptimistic(following, (_current: boolean, next: boolean) => next)

  if (!signedIn) {
    return (
      <Link href={`/sign-in?next=/p/${slug}`} className="ws-toggle">
        <Bell size={16} strokeWidth={1.75} aria-hidden="true" />
        Follow
        <span className="sr-only">, which needs a signed-in account</span>
      </Link>
    )
  }

  return (
    <form
      action={(formData: FormData) => {
        flip(!optimistic)
        return action(formData)
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="following" value={optimistic ? 'false' : 'true'} />
      <button type="submit" className="ws-toggle" aria-pressed={optimistic}>
        {optimistic ? (
          <BellRing size={16} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Bell size={16} strokeWidth={1.75} aria-hidden="true" />
        )}
        {optimistic ? 'Following' : 'Follow'}
      </button>
      <span aria-live="polite" className="sr-only">
        {optimistic
          ? 'Following. You will hear when a new build lands.'
          : 'Not following.'}
      </span>
    </form>
  )
}

export default FollowButton

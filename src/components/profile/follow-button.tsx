'use client'

/**
 * Follow and unfollow, applied optimistically.
 *
 * The button flips the instant it is pressed, because the result is visible on
 * screen and waiting for a round trip to redraw a two-word label is the kind of
 * lag Doherty is about. The Server Action returns the state the database
 * actually holds; if that disagrees, React reverts the label and a danger
 * Banner says what happened and what to do about it.
 *
 * Keyboard contract: a single submit button inside a form. Enter and Space
 * activate it. Focus stays on the button across the flip, so a keyboard user
 * never loses their place. The error message is a `role="alert"` Banner, which
 * announces itself without moving focus.
 */

import { useOptimistic, useState } from 'react'
import { Check, UserPlus } from 'lucide-react'
import { Banner, Button } from '@/components/ui'
import { toggleFollow } from '@/server/actions/follow'

export interface FollowButtonProps {
  handle: string
  displayName: string
  /** Null when nobody is signed in. */
  following: boolean | null
  /** The viewer is looking at their own profile. */
  isSelf: boolean
  /** Where to come back to after signing in. */
  returnTo: string
}

export function FollowButton({
  handle,
  displayName,
  following,
  isSelf,
  returnTo,
}: FollowButtonProps) {
  const [optimistic, setOptimistic] = useOptimistic(following ?? false, (_prev, next: boolean) => next)
  const [error, setError] = useState<string | null>(null)

  if (isSelf) {
    return (
      <Button as="a" href="/settings/profile" variant="secondary">
        Edit your profile
      </Button>
    )
  }

  if (following === null) {
    return (
      <Button
        as="a"
        href={`/sign-in?next=${encodeURIComponent(returnTo)}`}
        variant="secondary"
        iconLeading={<UserPlus size={20} strokeWidth={1.5} />}
      >
        Sign in to follow
      </Button>
    )
  }

  async function act() {
    const next = !optimistic
    setOptimistic(next)
    setError(null)
    const result = await toggleFollow(handle, next)
    if (!result.ok) {
      setError(result.message ?? 'The follow did not save. Reload the page and try once more.')
    }
  }

  return (
    <div className="flex flex-col gap-xs">
      <form action={act}>
        <Button
          type="submit"
          variant={optimistic ? 'secondary' : 'primary'}
          iconLeading={
            optimistic ? (
              <Check size={20} strokeWidth={1.5} />
            ) : (
              <UserPlus size={20} strokeWidth={1.5} />
            )
          }
        >
          {optimistic ? 'Following' : `Follow ${displayName.split(' ')[0] ?? displayName}`}
        </Button>
      </form>
      {error ? (
        <Banner variant="danger" title="The follow did not save">
          {error}
        </Banner>
      ) : null}
    </div>
  )
}

export default FollowButton

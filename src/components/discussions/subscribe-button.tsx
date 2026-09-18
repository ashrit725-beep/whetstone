'use client'

/**
 * Following a thread, written straight to `thread_subscriptions`.
 *
 * The control names the current setting and the next one, the way the theme
 * toggle does, rather than relying on a pressed state nobody can see. The
 * sentence under it is a polite live region, so the change is announced once and
 * the button label is not read twice.
 *
 * Keyboard contract: Tab reaches the button; Enter and Space activate it. The
 * label and the status sentence both update in place; focus never moves.
 */

import { useOptimistic, useState, useTransition } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { Button } from '@/components/ui'
import { setThreadSubscriptionAction } from '@/server/actions/discussions'

export interface SubscribeButtonProps {
  threadId: string
  subscribed: boolean
}

export function SubscribeButton({ threadId, subscribed }: SubscribeButtonProps) {
  const [following, setFollowing] = useOptimistic(subscribed, (_current, next: boolean) => next)
  const [problem, setProblem] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const toggle = () => {
    startTransition(async () => {
      const next = !following
      setProblem(null)
      setFollowing(next)
      const result = await setThreadSubscriptionAction(threadId, next)
      if (!result.ok) {
        setProblem(
          result.message ??
            'The setting did not reach the server. Check the connection and press it again.',
        )
      }
    })
  }

  return (
    <div className="flex flex-col gap-2xs">
      <Button
        variant="secondary"
        onClick={toggle}
        iconLeading={
          following ? (
            <BellOff size={20} strokeWidth={1.5} />
          ) : (
            <Bell size={20} strokeWidth={1.5} />
          )
        }
      >
        {following ? 'Mute this thread' : 'Follow this thread'}
      </Button>

      <p aria-live="polite" className="measure-ui text-xs text-text-3" style={{ minHeight: '1lh' }}>
        {problem ? (
          <span className="text-critical">{problem}</span>
        ) : following ? (
          'You get a notification on every reply.'
        ) : (
          'You get no notifications from this thread.'
        )}
      </p>
    </div>
  )
}

export default SubscribeButton

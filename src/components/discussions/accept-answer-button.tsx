'use client'

/**
 * Marking one reply as the answer. Only rendered on a question, and only for the
 * person who asked it; the action re-checks both on the server.
 *
 * Success is silent: the badge appears on the reply and the thread status
 * changes on screen, so a toast would only repeat what the reader can see
 * (§5.4). Failure says what to do next, in place.
 *
 * Keyboard contract: Tab reaches the button; Enter and Space activate it. While
 * the action is in flight the button is busy and a second press is dropped.
 */

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui'
import { acceptAnswerAction } from '@/server/actions/discussions'

export interface AcceptAnswerButtonProps {
  threadId: string
  postId: string
  authorName: string
  /** True when some other reply currently holds the mark. */
  replacesExisting: boolean
}

export function AcceptAnswerButton({
  threadId,
  postId,
  authorName,
  replacesExisting,
}: AcceptAnswerButtonProps) {
  const [problem, setProblem] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const mark = () => {
    startTransition(async () => {
      setProblem(null)
      const result = await acceptAnswerAction(threadId, postId)
      if (!result.ok) {
        setProblem(
          result.message ??
            'The mark did not reach the server. Check the connection and press it again.',
        )
      }
    })
  }

  return (
    <div className="flex flex-col gap-2xs">
      <Button
        variant="ghost"
        size="sm"
        loading={pending}
        loadingLabel="Marking the answer…"
        onClick={mark}
        iconLeading={<Check size={16} strokeWidth={1.5} />}
      >
        {replacesExisting ? 'Mark this one instead' : 'Mark as the answer'}
        <span className="sr-only"> from {authorName}</span>
      </Button>

      {problem ? (
        <p role="alert" className="measure-ui text-xs text-critical">
          {problem}
        </p>
      ) : null}
    </div>
  )
}

export default AcceptAnswerButton

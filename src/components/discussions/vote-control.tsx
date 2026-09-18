'use client'

/**
 * Up and down on one reply. The score moves the moment the button is pressed
 * and reconciles when the server answers, so the response is inside the 400ms
 * budget without a spinner (§6.5).
 *
 * Pressing the vote you already cast clears it, which is why both controls are
 * toggles carrying `aria-pressed` rather than a pair of one-way actions. The
 * label stays the same in both states: a toggle whose name also flips reads as
 * "Clear your upvote, pressed", which says the state twice and names the wrong
 * action.
 *
 * Keyboard contract: Tab reaches each control; Enter and Space activate it.
 * Nothing opens on hover, and the control never moves under the pointer.
 */

import { useOptimistic, useState, useTransition } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui'
import { voteOnPostAction } from '@/server/actions/discussions'

type VoteValue = -1 | 0 | 1

interface VoteState {
  score: number
  vote: VoteValue
}

export interface VoteControlProps {
  postId: string
  score: number
  viewerVote: VoteValue
  /** Named in the accessible label, so a list of votes is not a list of "Upvote". */
  authorName: string
}

export function VoteControl({ postId, score, viewerVote, authorName }: VoteControlProps) {
  const [state, applyVote] = useOptimistic<VoteState, VoteValue>(
    { score, vote: viewerVote },
    (current, next) => ({ score: current.score - current.vote + next, vote: next }),
  )
  const [problem, setProblem] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const cast = (next: VoteValue) => {
    startTransition(async () => {
      setProblem(null)
      applyVote(next)
      const result = await voteOnPostAction(postId, next)
      if (!result.ok) {
        setProblem(
          result.message ??
            'The vote did not reach the server. Check the connection and press it again.',
        )
      }
    })
  }

  return (
    <div className="flex flex-col gap-2xs">
      <div className="flex items-center gap-xs">
        <Button
          variant="ghost"
          aria-pressed={state.vote === 1}
          onClick={() => {
            cast(state.vote === 1 ? 0 : 1)
          }}
          iconLeading={<ChevronUp size={20} strokeWidth={1.5} />}
        >
          <span className="sr-only">Upvote the reply by {authorName}</span>
        </Button>

        <span className="tnum text-sm text-text-2">
          {state.score.toLocaleString('en')}
          <span className="sr-only"> net votes</span>
        </span>

        <Button
          variant="ghost"
          aria-pressed={state.vote === -1}
          onClick={() => {
            cast(state.vote === -1 ? 0 : -1)
          }}
          iconLeading={<ChevronDown size={20} strokeWidth={1.5} />}
        >
          <span className="sr-only">Downvote the reply by {authorName}</span>
        </Button>
      </div>

      {problem ? (
        <p role="alert" className="measure-ui text-xs text-critical">
          {problem}
        </p>
      ) : null}
    </div>
  )
}

export default VoteControl

/**
 * The channel index: one hairline-ruled row per open channel.
 *
 * Server-safe. The only interactive element in a row is the channel link, whose
 * `::after` covers the row, so the row is a 44px+ target and the accessible name
 * is still just the channel.
 *
 * Keyboard contract: Tab moves between channel links in reading order. Nothing
 * here traps, and nothing here is reachable by pointer alone.
 */

import { Link, Timestamp } from '@/components/ui'
import type { ChannelSummary } from '@/server/queries/discussions'

export interface ChannelRegisterProps {
  channels: readonly ChannelSummary[]
  /** Names the list for assistive technology. */
  label: string
}

export function ChannelRegister({ channels, label }: ChannelRegisterProps) {
  return (
    <ul className="ws-register" aria-label={label}>
      {channels.map((channel) => (
        <li key={channel.id} className="ws-row ws-channel-row">
          <div className="track-safe">
            <h2 className="ws-row-title text-md" style={{ fontVariationSettings: '"wdth" 100, "wght" 600' }}>
              <Link
                href={`/c/${channel.slug}`}
                variant="inline"
                className="text-text-1 no-underline hover:underline"
              >
                {channel.label}
              </Link>
            </h2>
            {channel.description ? (
              <p className="measure-ui mt-3xs text-xs text-text-2">{channel.description}</p>
            ) : null}
            {channel.unansweredCount > 0 ? (
              <p className="mt-2xs text-xs text-text-3">
                <span className="tnum">{channel.unansweredCount}</span>
                {channel.unansweredCount === 1
                  ? '\u00A0question is still waiting on a first reply.'
                  : '\u00A0questions are still waiting on a first reply.'}
              </p>
            ) : null}
          </div>

          <div className="ws-row-side">
            <dl className="ws-cell ws-cell-count">
              <dt>Threads</dt>
              <dd>{channel.threadCount.toLocaleString('en')}</dd>
            </dl>
            <dl className="ws-cell ws-cell-count">
              <dt>Replies</dt>
              <dd>{channel.replyCount.toLocaleString('en')}</dd>
            </dl>
            <dl className="ws-cell ws-cell-when">
              <dt>Last activity</dt>
              <dd>
                {channel.lastActivityAt === null ? (
                  <span className="text-text-3">None yet</span>
                ) : (
                  <Timestamp ts={channel.lastActivityAt} />
                )}
              </dd>
            </dl>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default ChannelRegister

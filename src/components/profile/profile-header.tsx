/**
 * The public profile header (§4.4 surface 6).
 *
 * The organising element is the five-cell grit history strip, not a grid and
 * not a card: how far this person's work actually gets, at a glance, in
 * greyscale. Under it, reputation is a sentence with tabular figures, then the
 * bio in Literata at 66ch, then the route-mapped tabs.
 *
 * Where boldness is spent on this surface: the grit history strip. Nothing else
 * here is allowed to compete with it.
 */

import { CalendarDays, MapPin } from 'lucide-react'
import { safeHref } from '@/lib/utils'
import { Avatar, Badge, GritHistoryStrip, Link, Prose } from '@/components/ui'
import { FollowButton } from '@/components/profile/follow-button'
import { ReputationSentence } from '@/components/profile/reputation-sentence'
import { ProfileTabs } from '@/components/profile/profile-tabs'
import type { GritCounts } from '@/server/queries/profile'
import type { ProfileView } from '@/lib/types'

const AVAILABILITY: Record<ProfileView['availability'], string> = {
  open: 'Open to review requests',
  limited: 'Limited availability',
  closed: 'Not taking review requests',
}

export interface ProfileHeaderProps {
  profile: ProfileView
  gritCounts: GritCounts
  totals: {
    projects: number
    shipped: number
    feedbackReceived: number
    reviewsWritten: number
    helpfulMarks: number
  }
  /** Present when this person has a listed reviewer rate card. */
  hasExpertListing: boolean
  counts: { projects: number; reviews: number }
}

export function ProfileHeader({
  profile,
  gritCounts,
  totals,
  hasExpertListing,
  counts,
}: ProfileHeaderProps) {
  const base = `/u/${profile.handle}`

  return (
    <>
      <header className="flex flex-col gap-lg">
        <div className="flex flex-wrap items-start justify-between gap-md">
          <div className="flex min-w-0 items-start gap-md">
            <Avatar userId={profile.id} name={profile.displayName} src={profile.avatarUrl} size="lg" />
            <div className="flex min-w-0 flex-col gap-2xs">
              <h1 className="text-2xl break-words">{profile.displayName}</h1>
              <p className="text-sm text-text-3">
                <span>@{profile.handle}</span>
                {profile.pronouns ? <span> · {profile.pronouns}</span> : null}
              </p>
              <dl className="flex flex-wrap items-center gap-x-md gap-y-2xs text-xs text-text-3">
                {profile.location ? (
                  <div className="flex items-center gap-2xs">
                    <dt className="flex items-center gap-2xs">
                      <MapPin size={16} strokeWidth={1.5} aria-hidden="true" />
                      <span className="sr-only">Location</span>
                    </dt>
                    <dd>{profile.location}</dd>
                  </div>
                ) : null}
                <div className="flex items-center gap-2xs">
                  <dt className="flex items-center gap-2xs">
                    <CalendarDays size={16} strokeWidth={1.5} aria-hidden="true" />
                    <span className="sr-only">Joined</span>
                  </dt>
                  <dd className="tnum">
                    {new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(
                      new Date(profile.joinedAt),
                    )}
                  </dd>
                </div>
              </dl>
              <div className="flex flex-wrap items-center gap-xs pt-2xs">
                <Badge tone={profile.availability === 'closed' ? 'neutral' : 'positive'}>
                  {AVAILABILITY[profile.availability]}
                </Badge>
                {hasExpertListing ? (
                  <Link href={`/experts/${profile.handle}`} variant="standalone">
                    See the rate card
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <FollowButton
            handle={profile.handle}
            displayName={profile.displayName}
            following={profile.viewerFollows}
            isSelf={profile.isSelf}
            returnTo={base}
          />
        </div>

        {/* The bold element of this surface. */}
        <section aria-labelledby="grit-history" className="flex flex-col gap-xs">
          <h2 id="grit-history" className="text-md">
            How far this work gets
          </h2>
          <GritHistoryStrip counts={gritCounts} />
        </section>

        <ReputationSentence
          projects={totals.projects}
          shipped={totals.shipped}
          feedbackReceived={totals.feedbackReceived}
          reviewsWritten={totals.reviewsWritten}
          helpfulMarks={totals.helpfulMarks}
        />

        {profile.bio ? <Prose content={profile.bio} allow="comment" /> : null}

        {profile.links.length > 0 ? (
          <ul className="flex flex-wrap items-center gap-lg">
            {profile.links.map((link) => {
              // A stored URL is data, and data reaching an href goes through the
              // allowlist first. Nothing writes these today; this is what keeps
              // that true the day something does.
              const href = safeHref(link.url)
              if (href === null) return null
              return (
                <li key={link.id}>
                  <Link href={href} variant="quiet">
                    {link.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : null}
      </header>

      {/* `Tabs mode="links"` is its own "Profile sections" nav landmark. */}
      <ProfileTabs base={base} counts={counts} />
    </>
  )
}

export default ProfileHeader

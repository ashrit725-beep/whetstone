/**
 * Starting a thread in a channel.
 *
 * Where boldness is spent on this surface: nowhere. One column of labelled
 * fields on the page ground, the same as auth (§4.4 surface 9), because a
 * composer that is also a card is two containers for one job.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Banner, Breadcrumbs } from '@/components/ui'
import { NewThreadForm } from '@/components/discussions/new-thread-form'
import { getChannel } from '@/server/repos/discussions'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'

type Params = Promise<{ channel: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { channel: slug } = await params
  const channel = getChannel(slug)
  if (!channel) notFound()
  return {
    title: `Start a thread in ${channel.label}`,
    description: `Open a new thread in the ${channel.label} channel.`,
    alternates: { canonical: `/c/${channel.slug}/new` },
  }
}

export default async function NewThreadPage({ params }: { params: Params }) {
  const { channel: slug } = await params
  const channel = getChannel(slug)
  if (!channel) notFound()

  const claims = await currentClaimsLive()

  // The shell already owns <main id="main">; this is the content column inside
  // it, so the skip link still lands in exactly one place.
  return (
    <div className="pad-inline mx-auto w-full max-w-prose py-xl">
      <Breadcrumbs
        items={[
          { label: 'Discussions', href: '/c' },
          { label: channel.label, href: `/c/${channel.slug}` },
          { label: 'Start a thread' },
        ]}
      />

      <header className="mt-lg flex flex-col gap-sm">
        <h1>Start a thread in {channel.label}</h1>
        {channel.description ? (
          <p className="measure-ui text-base text-text-2">{channel.description}</p>
        ) : null}
      </header>

      <div className="mt-xl">
        {claims ? (
          <NewThreadForm channelSlug={channel.slug} channelLabel={channel.label} />
        ) : (
          <Banner
            variant="info"
            title="Threads are posted from an account"
            action={{
              label: 'Sign in',
              href: `/sign-in?next=${encodeURIComponent(`/c/${channel.slug}/new`)}`,
              primary: true,
            }}
          >
            Reading a channel needs no account. Posting one does, so replies can reach you and so
            a moderator has someone to answer.
          </Banner>
        )}
      </div>
    </div>
  )
}

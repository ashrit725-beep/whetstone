/**
 * The shared shell for the two legal pages.
 *
 * Long-form prose, so it runs at the prose measure on the paper ground rather
 * than in the twelve-column grid the rest of the marketing pages use: a terms
 * page read edge to edge is a terms page nobody reads.
 */

import type { ReactNode } from 'react'

export interface LegalDocProps {
  title: string
  updated: string
  standfirst: string
  children: ReactNode
}

export function LegalDoc({ title, updated, standfirst, children }: LegalDocProps) {
  return (
    <article className="pad-inline py-16">
      <div className="mx-auto max-w-[40rem]">
        <p className="eyebrow">Last updated {updated}</p>
        <h1 className="mt-6 text-2xl text-ink">{title}</h1>
        <p className="voice mt-6 text-voice">{standfirst}</p>
        <div className="voice mt-12 flex flex-col gap-8">{children}</div>
      </div>
    </article>
  )
}

export function Clause({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-rule pt-8 first:border-0 first:pt-0">
      <h2 className="text-md text-ink">{heading}</h2>
      {children}
    </section>
  )
}

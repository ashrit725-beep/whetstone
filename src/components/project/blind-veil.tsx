/**
 * The anti-anchoring gate.
 *
 * Server-safe; both actions are real form submits, so it works with JavaScript
 * off. It stands in for the thread when a signed-in reviewer has not yet
 * written their own first impression of this build.
 *
 * It is a method, not a paywall: the number of hidden notes is stated, the
 * reason is stated in one sentence, and the second button opens it immediately
 * with no penalty. What it buys is the only data a comment box cannot produce,
 * which is what a reviewer thought before they read the consensus.
 *
 * Drawn as veiled paper rather than a locked box. The field behind it is the
 * same ruled ink the stage uses, at the finest step, so “there is something
 * here you cannot read yet” is said by the drawing and not by an icon.
 */

import Link from 'next/link'

export interface BlindVeilProps {
  slug: string
  projectId: string
  projectTitle: string
  hiddenCount: number
  reviewerCount: number
  skipAction: (formData: FormData) => void | Promise<void>
}

export function BlindVeil({
  slug,
  projectId,
  projectTitle,
  hiddenCount,
  reviewerCount,
  skipAction,
}: BlindVeilProps) {
  return (
    <section id="thread" aria-labelledby="veil-heading" className="flex flex-col gap-8">
      <div className="grid gap-x-16 gap-y-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
        <div>
          {/* One text run: the eyebrow is a flex row, and every separate
              child of it would get the row's gap instead of a word space. */}
          <span className="eyebrow tnum text-ink-3">
            {`${String(hiddenCount)} ${hiddenCount === 1 ? 'note' : 'notes'} from ${String(reviewerCount)} ${reviewerCount === 1 ? 'reviewer' : 'reviewers'}, held back`}
          </span>
          <h2 id="veil-heading" className="mt-3 text-lg lg:text-xl">
            Yours first, then theirs.
          </h2>
        </div>
        <p className="voice text-base">
          A reviewer who reads the thread first tends to write the thread back. Record what you
          noticed on {projectTitle} before the consensus reaches you, and these open the moment you
          do.
        </p>
      </div>

      <div className="relative overflow-hidden border-[1.5px] border-ink bg-paper-hi">
        <svg
          aria-hidden="true"
          focusable="false"
          className="absolute inset-0 h-full w-full text-ink"
          style={{ opacity: 0.18 }}
        >
          <defs>
            <pattern id="veil-hatch" patternUnits="userSpaceOnUse" width="6" height="6">
              <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#veil-hatch)" />
        </svg>

        <div className="relative flex flex-col gap-6 p-8">
          <p className="voice max-w-[52ch] bg-paper-hi px-3 py-2 text-base">
            It takes a sentence. What did you notice first, and did you like it?
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/p/${slug}/feedback`} className="btn">
              Write my first impression
            </Link>

            <form action={skipAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="slug" value={slug} />
              <button type="submit" className="btn btn-secondary">
                Skip, and show me the notes
              </button>
            </form>
          </div>

          <p className="max-w-[52ch] bg-paper-hi px-3 py-1 text-xs text-ink-3">
            Skipping is recorded, not punished. Your review still posts and still counts.
          </p>
        </div>
      </div>
    </section>
  )
}

export default BlindVeil

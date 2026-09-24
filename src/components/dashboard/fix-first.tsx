/**
 * “You have 40 notes. Here are the three that matter.”
 *
 * The ranking is impact against a conservative effort guess, computed by
 * `src/server/ai/digest.ts` over themes that were already clustered and scored
 * by `themes.ts` and `impact.ts`. Impact itself is 45% reach, 35% severity, 20%
 * reviewer credibility, and reach saturates, so one loud theme cannot flatten
 * the rest.
 *
 * Every claim on this panel traces to a theme on the board or a suggestion
 * shipped in the same seven days the strip counts; the layer drops anything
 * citing an id it was not given. Effort is always printed as a guess, because
 * on both paths that is exactly what it is.
 *
 * This is the slow panel. It renders inside a `<Suspense>` whose fallback is
 * `FixFirstSkeleton`, which is measured against this markup.
 */

import { Banner } from '@/components/ui'
import { THEME_FLOOR, weeklyBrief, type ThemeBoard } from '@/server/queries/dashboard'
import { Provenance } from './provenance'
import { PromoteTheme } from './promote-theme'

// 'unknown' is not rendered: the row is dropped instead. The key stays so the
// map still covers every value `effortGuess` can carry.
const EFFORT_WORD: Record<'small' | 'medium' | 'large' | 'unknown', string> = {
  small: 'Small, at a guess',
  medium: 'Medium, at a guess',
  large: 'Large, at a guess',
  unknown: 'Not guessed',
}

/**
 * Why nothing is ranked, from the board rather than assumed. A creator with
 * forty-five points was told a ranking "needs more than a couple of notes",
 * which was false and read as a fault.
 */
function unrankedCopy(board: ThemeBoard): { title: string; body: string } {
  if (!board.enoughNotes) {
    return {
      title: 'Nothing is ranked above anything else yet',
      body: `Themes start at ${String(THEME_FLOOR)} notes, and this project has ${String(board.noteCount)}. Until then every note is in the inbox on its own, and nothing here would be more than a guess.`,
    }
  }
  if (board.themes.length > 0) {
    return {
      title: 'Nothing here needs fixing right now',
      body: 'Every group on the board is either praise or has had all of its points resolved. New points that need work will be ranked here as they arrive.',
    }
  }
  return {
    title: 'No two reviewers have hit the same thing yet',
    body: `${String(board.pointCount)} points came in and none of them overlap enough to group. They are all in the inbox, and the first problem two people share will be ranked here.`,
  }
}

export interface FixFirstProps {
  userId: string
  projectId: string
  /** Show the promote control beside each item. */
  actionable?: boolean
}

export async function FixFirst({ userId, projectId, actionable = true }: FixFirstProps) {
  const brief = await weeklyBrief(userId, projectId)
  const { digest, board } = brief
  const themeById = new Map(board.themes.map((theme) => [theme.id, theme]))
  const unranked = unrankedCopy(board)

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-2xs">
        <p className="measure-ui text-md text-text-1">{digest.headline}</p>
        <p className="measure-ui text-sm text-text-2">{digest.weekSummary}</p>
      </div>

      {digest.fixFirst.length === 0 ? (
        <Banner variant="info" title={unranked.title}>
          {unranked.body}
        </Banner>
      ) : (
        // Capped at 72ch. Left to fill the content column, a 1440px row put
        // “Track this” some 500px clear of the sentence it acts on, with the
        // rule under it running out into empty space. Capping the list keeps
        // the action beside its item and stacks the three buttons into one
        // alignment the eye can follow down.
        <ol className="measure-cap m-0 flex list-none flex-col p-0">
          {digest.fixFirst.map((item, index) => {
            const theme = themeById.get(item.themeId)
            return (
              <li
                key={item.themeId}
                className="flex flex-wrap items-start gap-md border-t border-border-hair py-md first:border-t-0 first:pt-0"
              >
                <p
                  aria-hidden="true"
                  className="tnum text-lg text-text-3"
                  style={{ fontVariationSettings: '"wdth" 104, "wght" 620' }}
                >
                  {index + 1}
                </p>

                {/* The 15rem basis is what lets "Track this" wrap under the
                    item on a phone instead of squeezing the title to a word
                    or two a line beside it. */}
                <div className="flex min-w-0 flex-1 basis-60 flex-col gap-2xs">
                  <h3 className="text-md text-text-1">
                    <span className="sr-only">{`Number ${String(index + 1)}: `}</span>
                    {item.title}
                  </h3>
                  <p className="measure-ui text-sm text-text-2">{item.why}</p>
                  <dl className="m-0 flex flex-wrap items-baseline gap-x-lg gap-y-2xs">
                    <div className="flex items-baseline gap-2xs">
                      <dt className="text-xs text-text-3">Reviewers</dt>
                      <dd className="tnum m-0 text-sm text-text-1">
                        {item.reporterCount.toLocaleString('en')}
                      </dd>
                    </div>
                    <div className="flex items-baseline gap-2xs">
                      <dt className="text-xs text-text-3">Impact</dt>
                      <dd className="tnum m-0 text-sm text-text-1">
                        {item.impact}
                        <span className="text-text-3"> of 100</span>
                      </dd>
                    </div>
                    {/* Only when there is a guess to print. The deterministic
                        ranking has none, so the pair was three rows of "Not
                        guessed" on a page that shows real efforts two rail
                        items away. The provenance line below already says the
                        ranking was made here, without a model. */}
                    {item.effortGuess === 'unknown' ? null : (
                      <div className="flex items-baseline gap-2xs">
                        <dt className="text-xs text-text-3">Effort</dt>
                        <dd className="m-0 text-sm text-text-1">{EFFORT_WORD[item.effortGuess]}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {actionable && theme ? (
                  <PromoteTheme
                    projectId={projectId}
                    themeLabel={item.title}
                    summary={item.why}
                    pointIds={theme.pointIds}
                    pointCount={theme.pointCount}
                    reviewers={theme.reviewers}
                  />
                ) : null}
              </li>
            )
          })}
        </ol>
      )}

      {digest.wins.length > 0 ? (
        <div className="flex flex-col gap-2xs border-t border-border-hair pt-md">
          <h3 className="text-md text-text-1">What went right</h3>
          <ul className="m-0 flex list-none flex-col gap-2xs p-0">
            {digest.wins.map((win) => (
              <li key={win.title} className="measure-ui text-sm text-text-2">
                {win.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {digest.regressions.length > 0 ? (
        <div className="flex flex-col gap-2xs border-t border-border-hair pt-md">
          <h3 className="text-md text-text-1">What moved the wrong way</h3>
          <ul className="m-0 flex list-none flex-col gap-2xs p-0">
            {digest.regressions.map((regression) => (
              <li key={regression.themeId} className="measure-ui text-sm text-text-2">
                {regression.note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="measure-ui border-t border-border-hair pt-md text-sm text-text-1">
        <span className="text-text-3">Next: </span>
        {digest.nextStep}
      </p>

      <Provenance value={brief.provenance} />
    </div>
  )
}

export default FixFirst

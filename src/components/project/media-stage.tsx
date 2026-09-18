/**
 * The stage: the large visual area at the top of a project.
 *
 * Two states, both designed.
 *
 * A project with real artwork on disk shows it at its true pixel size, offset
 * on the stage rather than stretched to fill a rectangle, with the rest of the
 * plates beside it as a strip. The box is reserved from the file's own width
 * and height, so the picture landing moves nothing.
 *
 * A project without artwork gets a composition instead of a grey box: five
 * panels of ruled ink at the five grit densities, the project's own step
 * outlined, the grit numeral set large in outline, and a baseline carrying the
 * build, the type and the places in the work where reviewers actually left a
 * note. Every one of those is a row from the database.
 *
 * Server-safe. No hand-built browser chrome, no phone frame, no tilt, no glow.
 */

import { GRIT_STAGES } from '@/lib/taxonomy'
import { Spotlight } from '@/components/motion'
import type { ProjectArtwork } from './artwork'
import { GRIT_SCALE } from './grit-values'
import { INK_DENSITY, gritIndex, gritLabel, plural } from './paper'

export interface StageAnchor {
  /** What the reviewer pointed at: a timecode, a route, a screen, a level. */
  readonly label: string
  readonly kindLabel: string
  readonly noteCount: number
}

export interface MediaStageProps {
  slug: string
  title: string
  grit: number
  typeLabel: string
  versionLabel: string | null
  reviewerCount: number
  anchors: readonly StageAnchor[]
  artwork: ProjectArtwork | null
}

/**
 * The stage's own reading of the five steps.
 *
 * The taxonomy's spacings go down to a single pixel, which is correct for a
 * 48px chip and wrong for a 400px field: at that size the top of the ramp fills
 * in and the device stops being lines of ink and becomes a grey rectangle,
 * which is the exact thing this stage exists not to be. So the stage keeps the
 * ramp and stretches it, and the five steps stay legibly apart at poster size.
 */
const STAGE_RULE: readonly { spacing: number; width: number; opacity: number }[] = [
  { spacing: 26, width: 3, opacity: 0.14 },
  { spacing: 16, width: 2, opacity: 0.2 },
  { spacing: 10, width: 1.5, opacity: 0.26 },
  { spacing: 7, width: 1.25, opacity: 0.34 },
  { spacing: 5, width: 1, opacity: 0.44 },
]

/**
 * The five ruled fields behind everything, one per step of the scale.
 *
 * Drawn as real strokes in `userSpaceOnUse`, exactly as the feed's generated covers do, so a 3px concept rule is 3px wide on a phone and on a 27 inch
 * display and the five grades stay distinguishable at both. Not a gradient:
 * the whole device is lines of ink at five densities, which is the grit scale.
 */
function PanelField({ here, seed }: { here: number; seed: string }) {
  const spans = ['1.55fr', '1fr', '1.1fr', '0.62fr', '1.35fr']
  const offsets = ['mb-8', 'mt-12', 'mb-6', 'mt-24', 'mb-4']
  const angles = [0, 90, 0, 90, 0]

  return (
    <div
      aria-hidden="true"
      className="ws-stage-strip"
      style={{ gridTemplateColumns: spans.join(' ') }}
    >
      {GRIT_STAGES.map((stage, i) => {
        const id = `hatch-${seed}-${stage.key}`
        return (
          <span
            key={stage.key}
            className={`ws-panel ${offsets[i] ?? ''} ${i === here ? 'ws-panel-here' : ''}`}
          >
            <svg className="h-full w-full" aria-hidden="true" focusable="false">
              <defs>
                <pattern
                  id={id}
                  patternUnits="userSpaceOnUse"
                  width={STAGE_RULE[i]?.spacing ?? 12}
                  height={STAGE_RULE[i]?.spacing ?? 12}
                  patternTransform={`rotate(${String(angles[i] ?? 0)})`}
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2={STAGE_RULE[i]?.spacing ?? 12}
                    stroke="currentColor"
                    strokeWidth={STAGE_RULE[i]?.width ?? 1}
                    opacity={STAGE_RULE[i]?.opacity ?? 0.2}
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#${id})`} />
            </svg>
          </span>
        )
      })}
    </div>
  )
}

export function MediaStage({
  slug,
  title,
  grit,
  typeLabel,
  versionLabel,
  reviewerCount,
  anchors,
  artwork,
}: MediaStageProps) {
  const here = gritIndex(grit)
  const step = gritLabel(grit)

  return (
    <figure className="m-0 flex flex-col gap-4">
      {/* Moving the pointer over the stage uncovers where reviewers actually
          pointed. It is the page's question made physical: the base layer is
          the build, the revealed layer is what people marked on it. A touch or
          keyboard visitor, or anyone with motion turned down, is shown the
          marks outright rather than a feature they cannot reach. */}
      <Spotlight
        // A column, so the content below can grow to the frame's full height:
        // the base band then sits on the frame's bottom edge, where the ruled
        // field ends, and no panel shows beneath it.
        className="ws-stage flex min-h-[19rem] flex-col p-4 sm:min-h-[24rem] sm:p-8 lg:min-h-[28rem]"
        revealLabel={
          anchors.length > 0
            ? `Reviewers marked ${String(anchors.length)} ${anchors.length === 1 ? 'place' : 'places'} on this build: ${anchors.map((a) => `${a.label}, ${String(a.noteCount)} ${a.noteCount === 1 ? 'note' : 'notes'}`).join('; ')}.`
            : 'Nobody has marked a specific place on this build yet.'
        }
        reveal={<AnchorMarks anchors={anchors} />}
        base={
          <>
        <PanelField here={here} seed={slug} />

        {artwork ? (
          <div className="relative z-1 flex flex-1 flex-col justify-between gap-8">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <StageLabel className="text-ink-2">{versionLabel ? `${title} · ${versionLabel}` : title}</StageLabel>
              <StageLabel className="hidden text-ink-3 sm:inline-flex">{typeLabel}</StageLabel>
            </div>

            <div className="flex min-w-0 flex-wrap items-end gap-6 lg:flex-nowrap">
              <img
                src={artwork.hero.src}
                alt={artwork.hero.alt}
                width={artwork.hero.width}
                height={artwork.hero.height}
                fetchPriority="high"
                className="w-full min-w-0 max-w-[26.5rem] border-[1.5px] border-ink bg-paper-hi"
                style={{ aspectRatio: `${String(artwork.hero.width)} / ${String(artwork.hero.height)}` }}
              />
              {artwork.plates.length > 0 ? (
                <ul className="m-0 flex list-none flex-wrap items-end gap-4 p-0">
                  {artwork.plates.map((plate) => (
                    <li key={plate.src}>
                      <img
                        src={plate.src}
                        alt={plate.alt}
                        width={plate.width}
                        height={plate.height}
                        loading="lazy"
                        className="border border-rule-2 bg-paper-hi"
                        style={{ aspectRatio: `${String(plate.width)} / ${String(plate.height)}` }}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <StageBase
              grit={grit}
              step={step}
              typeLabel={typeLabel}
              reviewerCount={reviewerCount}
              anchors={anchors}
            />
          </div>
        ) : (
          <div className="relative z-1 flex min-h-[17rem] flex-1 flex-col justify-between gap-8 sm:min-h-[21rem] lg:min-h-[25rem]">
            {/* One label, not two. The right-hand one used to read "No file
                uploaded yet", which promised an upload this product does not
                have; the caption under the stage says what is and is not
                here. */}
            <div>
              <StageLabel className="text-ink-2">{versionLabel ? `${title} · ${versionLabel}` : title}</StageLabel>
            </div>

            <div className="bg-paper-deep py-3 pr-5 sm:w-fit sm:pr-7">
              <span className="ws-outline tnum block text-2xl leading-[0.8] sm:text-3xl lg:text-hero">
                {grit}
              </span>
              <span className="eyebrow mt-4 block text-ink">{step}</span>
              <span className="mt-2 block max-w-[34ch] text-sm text-ink-2">
                {GRIT_SCALE[here]?.definition ?? ''}
              </span>
            </div>

            <StageBase
              grit={grit}
              step={step}
              typeLabel={typeLabel}
              reviewerCount={reviewerCount}
              anchors={anchors}
            />
          </div>
        )}
          </>
        }
      />

      {artwork?.hero.caption ? (
        <figcaption className="measure text-xs text-ink-3">{artwork.hero.caption}</figcaption>
      ) : (
        <figcaption className="measure text-xs text-ink-3">
          {anchors.length > 0
            ? `No file is hosted here. The marks above are the places in the work reviewers pointed at, taken from their notes.`
            : `No file is hosted here. The field is the grit scale drawn as ink density, with ${step.toLowerCase()} picked out.`}
        </figcaption>
      )}
    </figure>
  )
}

function StageBase({
  grit,
  step,
  typeLabel,
  reviewerCount,
  anchors,
}: {
  grit: number
  step: string
  typeLabel: string
  reviewerCount: number
  anchors: readonly StageAnchor[]
}) {
  return (
    <div className="flex flex-col gap-3 bg-paper-deep pt-2">
      {anchors.length > 0 ? (
        <>
          <StageLabel className="text-ink-3">Where the notes are pinned</StageLabel>
          <ul
            className="m-0 grid list-none grid-cols-2 gap-x-6 gap-y-6 border-t-[1.5px] border-ink p-0 sm:grid-cols-4"
          >
            {anchors.map((anchor) => (
              <li key={`${anchor.kindLabel}-${anchor.label}`} className="flex min-w-0 flex-col items-start">
                <span aria-hidden="true" className="block h-3 w-[1.5px] bg-ink" />
                <span className="tnum mt-2 block hyphens-auto break-words text-base font-bold text-ink">
                  {anchor.label}
                </span>
                <span className="eyebrow block text-ink-3">
                  {`${String(anchor.noteCount)} ${plural(anchor.noteCount, 'note', 'notes')}`}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <span aria-hidden="true" className="block h-px w-full bg-rule-2" />
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <StageLabel className="tnum text-ink-3">{`${typeLabel} · ${String(grit)} ${step.toLowerCase()}`}</StageLabel>
            <StageLabel className="tnum text-ink-3">
              {`${String(reviewerCount)} ${plural(reviewerCount, 'reviewer', 'reviewers')} so far`}
            </StageLabel>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * A label set on the stage. It carries its own paper, so a ruled panel passing
 * behind it stops at the text instead of running through it, and its content
 * is one text run, because the eyebrow is a flex row and separate children
 * would be spaced by its gap rather than by a word space.
 */
function StageLabel({ className, children }: { className: string; children: string }) {
  return <span className={`eyebrow -mx-2 bg-paper-deep px-2 ${className}`}>{children}</span>
}

export default MediaStage

/**
 * What reviewers pointed at, drawn over the stage.
 *
 * Ink and rule only. The marks sit over a stage that is already ink, so
 * anything chromatic here would be the only colour on the page and would read
 * as an alert rather than as annotation.
 */
function AnchorMarks({ anchors }: { anchors: readonly StageAnchor[] }) {
  if (anchors.length === 0) {
    return (
      <div className="flex h-full items-end p-4 sm:p-8">
        <p className="bg-paper-hi px-3 py-2 text-xs text-ink-2">
          Nobody has marked a place on this build yet.
        </p>
      </div>
    )
  }

  return (
    <div aria-hidden="true" className="relative h-full w-full bg-[rgb(var(--ink-rgb)/0.06)] p-4 sm:p-8">
      <ul className="m-0 flex h-full list-none flex-col justify-between p-0">
        {anchors.slice(0, 5).map((a, i) => (
          <li
            key={`${a.label}-${String(i)}`}
            className="flex items-center gap-3"
            style={{ marginInlineStart: `${String((i % 3) * 12)}%` }}
          >
            <span className="block h-px w-10 bg-ink" />
            <span className="bg-paper-hi px-2 py-1 text-2xs tracking-[0.1em] whitespace-nowrap text-ink uppercase">
              {a.label}
            </span>
            <span className="tnum text-2xs text-ink-2">
              {a.noteCount} {a.noteCount === 1 ? 'note' : 'notes'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

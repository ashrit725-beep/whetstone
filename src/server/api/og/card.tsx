import { ImageResponse } from 'next/og'
import type { ReactElement } from 'react'
import { OG } from './palette'
import { OG_FONT_FAMILY, ogFonts } from './fonts'
import { gritStageFor, hatchDataUri } from './hatch'
import type { GritCell } from '@/server/queries/publishing'

/**
 * The social card, in the Grit Index visual language.
 *
 * Three cards, one frame: a hatched bevel rail in the left gutter at the
 * subject's grit value, a 2px accent grind-mark on the leading edge of the one
 * thing the card is about, and the numeral beside the hatch, because CONTRACT
 * §5.7 does not let a hatch carry the value on its own.
 *
 * Satori's constraints shape the markup, not the design: flexbox only, an
 * explicit `display: flex` on every element with more than one child, no
 * `var()` and no CSS custom properties, margins rather than `gap`, no CSS grid.
 * The one genuine drawing is an `<img>`, because satori lays out and sets type
 * but does not draw.
 *
 * **Every box carries an explicit width.** Satori will not wrap a line inside a
 * box whose width it has to infer, so a column sized only by `flexGrow` silently
 * runs a long title off the right edge instead of breaking it. The arithmetic is
 * written out below and every measurement descends from it.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const
export const OG_CONTENT_TYPE = 'image/png'

/* The whole geometry, derived once. */
const RAIL_W = 88
const PAD = 60
const BODY_W = OG_SIZE.width - RAIL_W // 1112
const CONTENT_W = BODY_W - PAD * 2 // 992
const MARK_W = 2
const MARK_GAP = 22
const TEXT_W = CONTENT_W - MARK_W - MARK_GAP // 968

/* -------------------------------------------------------------------------- *
 * Text fitting
 * -------------------------------------------------------------------------- */

/** Trims on a word boundary and closes with a real ellipsis, never three dots. */
export function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  const kept = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${kept.replace(/[,;:.–-]$/, '')}…`
}

/**
 * Title size, chosen so the title never needs a fourth line.
 *
 * Archivo at wdth 112 / wght 700 measures close to 0.56em per Latin character,
 * so a line of `size` px holds about `TEXT_W / (0.56 * size)` of them. Both
 * constants were read off a rendered card, not guessed. The ladder
 * below tries each size in turn and takes the first that fits its own line
 * budget, which is what keeps a seven-character title large and a ninety-
 * character one legible rather than clipped.
 */
/** Measured average advance per Latin glyph, in ems, for the two roles. */
const TITLE_EM = 0.56
const BODY_EM = 0.48

interface TitleStep {
  readonly size: number
  readonly lineHeight: number
  readonly maxLines: number
}

const SMALLEST_TITLE: TitleStep = { size: 44, lineHeight: 1.14, maxLines: 5 }

const TITLE_STEPS: readonly TitleStep[] = [
  { size: 84, lineHeight: 1.04, maxLines: 2 },
  { size: 68, lineHeight: 1.06, maxLines: 2 },
  { size: 54, lineHeight: 1.1, maxLines: 4 },
  SMALLEST_TITLE,
]

interface TitleFit {
  readonly size: number
  readonly lineHeight: number
  readonly lines: number
  readonly height: number
}

function fitTitle(text: string, width = TEXT_W): TitleFit {
  const last = SMALLEST_TITLE
  for (const step of TITLE_STEPS) {
    const perLine = Math.max(1, Math.floor(width / (step.size * TITLE_EM)))
    const lines = Math.max(1, Math.ceil(text.length / perLine))
    if (lines <= step.maxLines) {
      return {
        size: step.size,
        lineHeight: step.lineHeight,
        lines,
        height: Math.ceil(lines * step.size * step.lineHeight),
      }
    }
  }
  const perLine = Math.max(1, Math.floor(width / (last.size * TITLE_EM)))
  const lines = Math.min(last.maxLines, Math.max(1, Math.ceil(text.length / perLine)))
  return {
    size: last.size,
    lineHeight: last.lineHeight,
    lines,
    height: Math.ceil(lines * last.size * last.lineHeight),
  }
}

/** Same arithmetic for a plain paragraph, so the grind-mark knows how tall to be. */
function blockHeight(text: string, fontSize: number, lineHeight: number, width = TEXT_W): number {
  const perLine = Math.max(1, Math.floor(width / (fontSize * BODY_EM)))
  const lines = Math.max(1, Math.ceil(text.length / perLine))
  return Math.ceil(lines * fontSize * lineHeight)
}

/* -------------------------------------------------------------------------- *
 * Frame
 * -------------------------------------------------------------------------- */

function Rail({ grit }: { grit: number }): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        width: RAIL_W,
        height: OG_SIZE.height,
        backgroundColor: OG.surface2,
        borderRight: `1px solid ${OG.borderHair}`,
        flexShrink: 0,
      }}
    >
      <img
        src={hatchDataUri({ width: RAIL_W, height: OG_SIZE.height, grit, fade: true })}
        width={RAIL_W}
        height={OG_SIZE.height}
        alt=""
      />
    </div>
  )
}

/** The identity motif: 2px of accent on the leading edge, once per card. */
function GrindMark({ height }: { height: number }): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        width: MARK_W,
        height,
        backgroundColor: OG.accent,
        marginRight: MARK_GAP,
        flexShrink: 0,
      }}
    />
  )
}

function Header({ right }: { right: string }): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: CONTENT_W,
        paddingBottom: 18,
        borderBottom: `1px solid ${OG.borderHair}`,
      }}
    >
      <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: OG.text1 }}>Whetstone</div>
      <div style={{ display: 'flex', fontSize: 22, fontWeight: 600, color: OG.text3 }}>
        {clip(right, 40)}
      </div>
    </div>
  )
}

function Frame({
  grit,
  right,
  children,
}: {
  grit: number
  right: string
  children: readonly ReactElement[]
}): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        backgroundColor: OG.surface1,
        color: OG.text1,
        fontFamily: OG_FONT_FAMILY,
      }}
    >
      <Rail grit={grit} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: BODY_W,
          height: OG_SIZE.height,
          padding: PAD,
        }}
      >
        <Header right={right} />
        {children}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- *
 * The grit strip: five cells, hatched at their own density, numeral beneath
 * -------------------------------------------------------------------------- */

function GritStrip({ cells }: { cells: readonly GritCell[] }): ReactElement {
  const gap = 12
  const cellW = Math.floor((CONTENT_W - gap * (cells.length - 1)) / cells.length)
  return (
    <div style={{ display: 'flex', flexDirection: 'row', width: CONTENT_W }}>
      {cells.map((cell, index) => {
        const reached = cell.count > 0
        return (
          <div
            key={cell.key}
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: cellW,
              marginRight: index === cells.length - 1 ? 0 : gap,
            }}
          >
            <div
              style={{
                display: 'flex',
                width: cellW,
                height: 54,
                backgroundColor: OG.surface2,
                border: `1px solid ${reached ? OG.borderControl : OG.borderHair}`,
                overflow: 'hidden',
              }}
            >
              <img
                src={hatchDataUri({
                  width: cellW,
                  height: 54,
                  grit: cell.grit,
                  color: reached ? OG.hatch : OG.borderHair,
                })}
                width={cellW}
                height={54}
                alt=""
              />
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'baseline',
                width: cellW,
                marginTop: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 22,
                  fontWeight: 700,
                  color: reached ? OG.text1 : OG.text3,
                }}
              >
                {cell.grit}
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 19,
                  fontWeight: 600,
                  color: OG.text3,
                  marginLeft: 9,
                }}
              >
                {cell.count}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------------- *
 * Cards
 * -------------------------------------------------------------------------- */

async function render(node: ReactElement): Promise<ImageResponse> {
  return new ImageResponse(node, { ...OG_SIZE, fonts: await ogFonts() })
}

export interface ProjectCardInput {
  readonly title: string
  readonly tagline: string | null
  readonly typeLabel: string
  readonly grit: number
  readonly stageLabel: string
  readonly handle: string
  readonly feedbackCount: number
}

export function renderProjectCard(input: ProjectCardInput): Promise<ImageResponse> {
  const title = clip(input.title, 104)
  const fit = fitTitle(title)
  const tagline = input.tagline ? clip(input.tagline, 132) : null
  const taglineH = tagline ? 22 + blockHeight(tagline, 28, 1.4) : 0
  const stage = gritStageFor(input.grit)
  const reviews =
    input.feedbackCount === 1 ? '1 review' : `${input.feedbackCount} reviews`

  return render(
    <Frame grit={input.grit} right={input.typeLabel}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: CONTENT_W,
          justifyContent: 'center',
          flexGrow: 1,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', width: CONTENT_W }}>
          <GrindMark height={fit.height + taglineH} />
          <div style={{ display: 'flex', flexDirection: 'column', width: TEXT_W }}>
            <div
              style={{
                display: 'flex',
                width: TEXT_W,
                fontSize: fit.size,
                lineHeight: fit.lineHeight,
                fontWeight: 700,
                letterSpacing: '-0.025em',
                color: OG.text1,
              }}
            >
              {title}
            </div>
            {tagline ? (
              <div
                style={{
                  display: 'flex',
                  width: TEXT_W,
                  marginTop: 22,
                  fontSize: 28,
                  lineHeight: 1.4,
                  fontWeight: 400,
                  color: OG.text2,
                }}
              >
                {tagline}
              </div>
            ) : (
              <div style={{ display: 'flex' }} />
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          width: CONTENT_W,
          paddingTop: 22,
          borderTop: `1px solid ${OG.borderHair}`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline' }}>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: OG.text1 }}>
            {input.grit}
          </div>
          <div
            style={{ display: 'flex', fontSize: 24, fontWeight: 600, color: OG.text3, marginLeft: 10 }}
          >
            of 8000
          </div>
          <div
            style={{ display: 'flex', fontSize: 24, fontWeight: 600, color: OG.text2, marginLeft: 24 }}
          >
            {stage.label}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline' }}>
          {input.feedbackCount > 0 ? (
            <div
              style={{
                display: 'flex',
                fontSize: 24,
                fontWeight: 600,
                color: OG.text3,
                marginRight: 24,
              }}
            >
              {reviews}
            </div>
          ) : (
            <div style={{ display: 'flex' }} />
          )}
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, color: OG.text1 }}>
            {`@${clip(input.handle, 24)}`}
          </div>
        </div>
      </div>
    </Frame>,
  )
}

export interface ProfileCardInput {
  readonly displayName: string
  readonly handle: string
  readonly bio: string | null
  readonly cells: readonly GritCell[]
  readonly topGrit: number
  readonly projects: number
  readonly shipped: number
  readonly reviews: number
}

export function renderProfileCard(input: ProfileCardInput): Promise<ImageResponse> {
  const name = clip(input.displayName, 46)
  const fit = fitTitle(name)
  const bio = input.bio ? clip(input.bio, 168) : null

  // CONTRACT §4.4 surface 6 and §7.6: reputation is a sentence, and every
  // number in it is a row count.
  const sentence = [
    `${input.projects} ${input.projects === 1 ? 'project' : 'projects'}`,
    `${input.shipped} shipped`,
    `${input.reviews} ${input.reviews === 1 ? 'review' : 'reviews'} written`,
  ].join(', ')

  return render(
    <Frame grit={input.topGrit} right="Creator">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: CONTENT_W,
          justifyContent: 'center',
          flexGrow: 1,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', width: CONTENT_W }}>
          <GrindMark height={fit.height + 12 + 38} />
          <div style={{ display: 'flex', flexDirection: 'column', width: TEXT_W }}>
            <div
              style={{
                display: 'flex',
                width: TEXT_W,
                fontSize: fit.size,
                lineHeight: fit.lineHeight,
                fontWeight: 700,
                letterSpacing: '-0.025em',
                color: OG.text1,
              }}
            >
              {name}
            </div>
            <div
              style={{
                display: 'flex',
                marginTop: 12,
                fontSize: 26,
                lineHeight: 1.45,
                fontWeight: 600,
                color: OG.text3,
              }}
            >
              {`@${clip(input.handle, 24)}`}
            </div>
          </div>
        </div>
        {bio ? (
          <div
            style={{
              display: 'flex',
              width: TEXT_W,
              marginTop: 26,
              marginLeft: MARK_W + MARK_GAP,
              fontSize: 26,
              lineHeight: 1.45,
              fontWeight: 400,
              color: OG.text2,
            }}
          >
            {bio}
          </div>
        ) : (
          <div style={{ display: 'flex' }} />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', width: CONTENT_W }}>
        <div
          style={{
            display: 'flex',
            width: CONTENT_W,
            fontSize: 22,
            fontWeight: 600,
            color: OG.text2,
            marginBottom: 18,
          }}
        >
          {sentence}
        </div>
        <GritStrip cells={input.cells} />
      </div>
    </Frame>,
  )
}

export interface SiteCardInput {
  readonly cells: readonly GritCell[]
  readonly projects: number
  readonly reviews: number
}

export function renderSiteCard(input: SiteCardInput): Promise<ImageResponse> {
  const lede = 'Post the build. Pick the questions. Get review notes back, sorted by theme.'
  const sentence = `${input.projects} ${
    input.projects === 1 ? 'project' : 'projects'
  } published, ${input.reviews} ${input.reviews === 1 ? 'review' : 'reviews'} written`

  return render(
    <Frame grit={8000} right="Feedback on work in progress">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: CONTENT_W,
          justifyContent: 'center',
          flexGrow: 1,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', width: CONTENT_W }}>
          <GrindMark height={96 + 22 + blockHeight(lede, 30, 1.4, 760)} />
          <div style={{ display: 'flex', flexDirection: 'column', width: TEXT_W }}>
            <div
              style={{
                display: 'flex',
                width: TEXT_W,
                fontSize: 92,
                lineHeight: 1.04,
                fontWeight: 700,
                letterSpacing: '-0.025em',
                color: OG.text1,
              }}
            >
              Ship sharper.
            </div>
            <div
              style={{
                display: 'flex',
                width: 760,
                marginTop: 22,
                fontSize: 30,
                lineHeight: 1.4,
                fontWeight: 400,
                color: OG.text2,
              }}
            >
              {lede}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', width: CONTENT_W }}>
        <div
          style={{
            display: 'flex',
            width: CONTENT_W,
            fontSize: 22,
            fontWeight: 600,
            color: OG.text2,
            marginBottom: 18,
          }}
        >
          {sentence}
        </div>
        <GritStrip cells={input.cells} />
      </div>
    </Frame>,
  )
}

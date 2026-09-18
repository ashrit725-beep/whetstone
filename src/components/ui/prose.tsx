/**
 * Prose renders every word a human wrote: the ask, feedback bodies, discussion
 * posts, bios.
 *
 * Keyboard contract: none of its own. Links inside are real links and behave
 * like links. Code blocks inside a post are focusable, named scroll regions so
 * a long line can be read without a pointer.
 *
 * Safety: this never touches `dangerouslySetInnerHTML`. User text is parsed
 * into React nodes, so anything that is not in the grammar below survives as
 * literal text: a pasted `<script>` renders as the characters `<script>` and
 * nothing else. That is a stronger guarantee than sanitising a string, and it
 * is why the product needs no HTML sanitiser dependency.
 *
 * The grammar, deliberately small:
 *   headings      `#` … `######`, shifted so user content can never emit an
 *                 <h1> and never break the page's heading order (§9.4.33).
 *                 In `comment` mode headings are demoted to a bold line, because
 *                 a reply has no business introducing document structure.
 *   emphasis      **strong**, __strong__, *em*, _em_
 *   code          `inline` and ``` fenced ```
 *   links         [text](https://… | mailto:… | /internal). Anything else,
 *                 such as `javascript:`, `data:` or a protocol-relative
 *                 `//host`, is dropped and the link text kept as plain words.
 *   lists         `-` / `*` unordered, `1.` ordered, one level
 *   quotes        `>`
 *   paragraphs    everything else
 *
 * Every external link carries rel="ugc nofollow noopener" (§ web hygiene: the
 * product must not pass ranking signal to whatever a stranger pastes).
 *
 * Typography: a light typographic pass runs on text outside code, turning
 * straight quotes into curly ones, a three-period run into an ellipsis and a
 * double hyphen into an en dash, so user prose obeys the same punctuation rules
 * as the chrome (§3.4) without anyone having to type the characters.
 */

import type { ReactNode } from 'react'
import { cn, safeHref} from '@/lib/utils'

export type ProseAllow = 'comment' | 'article'

export interface ProseProps {
  content: string
  /** `comment` demotes headings. `article` allows h2–h6. Default `comment`. */
  allow?: ProseAllow
  className?: string
}

/* ------------------------------------------------------------ typography -- */

export function smarten(input: string): string {
  return input
    .replace(/\u002E\u002E\u002E/g, '…')
    .replace(/(\s)--(\s)/g, '$1–$2')
    .replace(/(^|[\s([{])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(^|[\s([{])'/g, '$1‘')
    .replace(/'/g, '’')
}

/* ------------------------------------------------------------------ urls -- */

// The allowlist lives in @/lib/utils so every render site shares one rule.

function isExternal(href: string): boolean {
  return !href.startsWith('/')
}

/* ---------------------------------------------------------------- inline -- */

const CODE_RE = /`([^`\n]+)`/
const LINK_RE = /\[([^\]\n]+)\]\(([^)\s]+)\)/
const STRONG_RE = /\*\*([^*\n]+)\*\*|__([^_\n]+)__/
const EM_RE = /\*([^*\n]+)\*|_([^_\n]+)_/

interface Match {
  index: number
  length: number
  node: ReactNode
}

function firstMatch(text: string, keyBase: string): Match | null {
  const candidates: Match[] = []

  const code = CODE_RE.exec(text)
  const codeText = code?.[1]
  if (code && codeText !== undefined) {
    candidates.push({
      index: code.index,
      length: code[0].length,
      node: (
        <code
          key={`${keyBase}-code-${String(code.index)}`}
          className="rounded-xs border border-border-hair bg-surface-0 px-3xs text-text-2"
        >
          {codeText}
        </code>
      ),
    })
  }

  const link = LINK_RE.exec(text)
  const linkLabel = link?.[1]
  const linkTarget = link?.[2]
  if (link && linkLabel !== undefined && linkTarget !== undefined) {
    const href = safeHref(linkTarget)
    const label = linkLabel
    candidates.push({
      index: link.index,
      length: link[0].length,
      node: href ? (
        <a
          key={`${keyBase}-link-${String(link.index)}`}
          href={href}
          // User-authored links carry no ranking signal off this site. An
          // internal route keeps its follow, because that is our own graph.
          rel={isExternal(href) ? 'ugc nofollow noopener' : undefined}
          // Underlined, not just coloured: colour alone is SC 1.4.1, and this is
          // body text where a link has no other affordance to distinguish it.
          className="text-accent underline decoration-from-font underline-offset-2"
        >
          {smarten(label)}
        </a>
      ) : (
        // An unsafe scheme loses its link and keeps its words.
        <span key={`${keyBase}-link-${String(link.index)}`}>{smarten(label)}</span>
      ),
    })
  }

  const strong = STRONG_RE.exec(text)
  const strongText = strong?.[1] ?? strong?.[2]
  if (strong && strongText !== undefined) {
    candidates.push({
      index: strong.index,
      length: strong[0].length,
      node: <strong key={`${keyBase}-strong-${String(strong.index)}`}>{smarten(strongText)}</strong>,
    })
  }

  const em = EM_RE.exec(text)
  const emText = em?.[1] ?? em?.[2]
  if (em && emText !== undefined) {
    candidates.push({
      index: em.index,
      length: em[0].length,
      node: <em key={`${keyBase}-em-${String(em.index)}`}>{smarten(emText)}</em>,
    })
  }

  if (candidates.length === 0) return null
  let best = candidates[0]
  if (!best) return null
  for (const candidate of candidates) {
    if (candidate.index < best.index) best = candidate
  }
  return best
}

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  let rest = text
  let guard = 0
  while (rest.length > 0 && guard < 500) {
    guard += 1
    const match = firstMatch(rest, `${keyBase}-${String(guard)}`)
    if (!match) {
      out.push(smarten(rest))
      break
    }
    if (match.index > 0) out.push(smarten(rest.slice(0, match.index)))
    out.push(match.node)
    rest = rest.slice(match.index + match.length)
  }
  return out
}

/* ---------------------------------------------------------------- blocks -- */

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }

const UL_RE = /^[-*]\s+(.*)$/
const OL_RE = /^\d+\.\s+(.*)$/
const HEADING_RE = /^(#{1,6})\s+(.*)$/
const QUOTE_RE = /^>\s?(.*)$/

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n').slice(0, 2000)
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line === undefined) break

    if (line.trim().length === 0) {
      i += 1
      continue
    }

    if (line.trimStart().startsWith('```')) {
      const body: string[] = []
      i += 1
      while (i < lines.length) {
        const next = lines[i]
        if (next === undefined || next.trimStart().startsWith('```')) break
        body.push(next)
        i += 1
      }
      i += 1
      blocks.push({ kind: 'code', text: body.join('\n') })
      continue
    }

    const heading = HEADING_RE.exec(line)
    const hashes = heading?.[1]
    const headingText = heading?.[2]
    if (hashes !== undefined && headingText !== undefined) {
      blocks.push({ kind: 'heading', level: hashes.length, text: headingText })
      i += 1
      continue
    }

    const quoteText = QUOTE_RE.exec(line)?.[1]
    if (quoteText !== undefined) {
      const body: string[] = [quoteText]
      i += 1
      while (i < lines.length) {
        const next = lines[i]
        if (next === undefined) break
        const more = QUOTE_RE.exec(next)?.[1]
        if (more === undefined) break
        body.push(more)
        i += 1
      }
      blocks.push({ kind: 'quote', text: body.join(' ').trim() })
      continue
    }

    const unorderedItem = UL_RE.exec(line)?.[1]
    const orderedItem = OL_RE.exec(line)?.[1]
    if (unorderedItem !== undefined || orderedItem !== undefined) {
      const isOrdered = orderedItem !== undefined
      const pattern = isOrdered ? OL_RE : UL_RE
      const items: string[] = []
      while (i < lines.length) {
        const next = lines[i]
        if (next === undefined) break
        const item = pattern.exec(next)?.[1]
        if (item === undefined) break
        items.push(item)
        i += 1
      }
      blocks.push({ kind: 'list', ordered: isOrdered, items })
      continue
    }

    const body: string[] = []
    while (i < lines.length) {
      const next = lines[i]
      if (next === undefined) break
      if (
        next.trim().length === 0 ||
        next.trimStart().startsWith('```') ||
        HEADING_RE.test(next) ||
        QUOTE_RE.test(next) ||
        UL_RE.test(next) ||
        OL_RE.test(next)
      ) {
        break
      }
      body.push(next.trim())
      i += 1
    }
    blocks.push({ kind: 'paragraph', text: body.join(' ') })
  }

  return blocks
}

/* -------------------------------------------------------------- renderer -- */

type HeadingTag = 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

function headingTag(level: number): HeadingTag {
  const shifted = Math.min(6, Math.max(2, level + 1))
  return (`h${String(shifted)}`) as HeadingTag
}

export function Prose({ content, allow = 'comment', className }: ProseProps) {
  const blocks = parseBlocks(content)

  if (blocks.length === 0) return null

  return (
    <div className={cn('prose-human', className)}>
      {blocks.map((block, index) => {
        const key = `block-${String(index)}`

        if (block.kind === 'code') {
          return (
            <pre
              key={key}
              role="region"
              aria-label="Code in this post, scrollable"
              tabIndex={0}
              data-scroll-region
              className="m-0 overflow-x-auto rounded-sm border border-border-hair bg-surface-0 p-sm text-sm"
            >
              <code>{block.text}</code>
            </pre>
          )
        }

        if (block.kind === 'heading') {
          if (allow === 'comment') {
            return (
              <p key={key}>
                <strong>{inline(block.text, key)}</strong>
              </p>
            )
          }
          const Tag = headingTag(block.level)
          return <Tag key={key}>{inline(block.text, key)}</Tag>
        }

        if (block.kind === 'quote') {
          return (
            <blockquote
              key={key}
              className="border-l border-border-control pl-md text-text-2 italic"
            >
              {inline(block.text, key)}
            </blockquote>
          )
        }

        if (block.kind === 'list') {
          const items = block.items.map((item, itemIndex) => (
            <li key={`${key}-item-${String(itemIndex)}`}>{inline(item, `${key}-${String(itemIndex)}`)}</li>
          ))
          return block.ordered ? (
            <ol key={key} className="list-decimal pl-lg">
              {items}
            </ol>
          ) : (
            <ul key={key} className="list-disc pl-lg">
              {items}
            </ul>
          )
        }

        return <p key={key}>{inline(block.text, key)}</p>
      })}
    </div>
  )
}

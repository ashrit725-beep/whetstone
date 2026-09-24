/**
 * One line somebody wrote, with its code spans set as code.
 *
 * Asks and prompts are markdown in the database, and 445 of the 5,000-odd asks
 * contain a backtick pair: "run `squallcroft check` with a timer going" printed
 * its backticks as literal characters in italic serif, which is the one thing
 * on these pages that read as unfinished text rather than as a person's words.
 *
 * This is deliberately not `Prose`: an ask is one line inside a paragraph the
 * surface has already styled, so it must not introduce a block, a measure or a
 * margin. Only inline code is recognised, because that is the only markdown the
 * asks actually carry. Anything else, including an unclosed backtick, survives
 * as the characters the person typed.
 */

import { Fragment } from 'react'

export interface InlineAskProps {
  text: string
}

/** Splits on paired backticks; an odd trailing backtick stays literal text. */
function segments(text: string): readonly { readonly code: boolean; readonly text: string }[] {
  const parts = text.split('`')
  if (parts.length < 3) return [{ code: false, text }]

  const out: { code: boolean; text: string }[] = []
  for (let index = 0; index < parts.length; index += 1) {
    const piece = parts[index] ?? ''
    // An unterminated span: the backtick that opened it was never closed, so
    // give the reader back the tick and the rest of the line as they wrote it.
    const unterminated = index % 2 === 1 && index === parts.length - 1
    if (unterminated) out.push({ code: false, text: `\`${piece}` })
    else if (piece.length > 0) out.push({ code: index % 2 === 1, text: piece })
  }
  return out
}

export function InlineAsk({ text }: InlineAskProps) {
  return (
    <>
      {segments(text).map((segment, index) => (
        <Fragment key={`${String(index)}-${segment.text}`}>
          {segment.code ? (
            <code className="font-mono text-[0.875em] not-italic text-ink">{segment.text}</code>
          ) : (
            segment.text
          )}
        </Fragment>
      ))}
    </>
  )
}

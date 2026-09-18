'use client'

/**
 * The markdown field used by both composers: a real edit and preview toggle,
 * carried by `SegmentedControl` rather than by two buttons, so it is one tab
 * stop, arrow-navigable, and states which mode is current through
 * `aria-checked` as well as through the moving indicator.
 *
 * The textarea stays mounted while the preview is showing, so the draft posts
 * even from the preview mode and nothing is retyped.
 *
 * Keyboard contract:
 *  · Tab reaches the mode control, then the textarea.
 *  · Arrow keys move between Write and Preview and switch immediately.
 *  · Home and End jump to the ends of the mode control.
 *  · Nothing here traps focus, and nothing opens on hover.
 */

import { useId, useState, type Ref } from 'react'
import { Eye, PencilLine } from 'lucide-react'
import { Field, Prose, SegmentedControl, Textarea } from '@/components/ui'
import type { ProseAllow } from '@/components/ui/prose'

type EditorMode = 'write' | 'preview'

const MODES = [
  { value: 'write', label: 'Write', iconLeading: <PencilLine size={16} strokeWidth={1.5} /> },
  { value: 'preview', label: 'Preview', iconLeading: <Eye size={16} strokeWidth={1.5} /> },
] as const

export interface MarkdownComposerProps {
  /** Stable id, so a server action can key its field error to this field. */
  id: string
  /** The name the value posts under. */
  name: string
  label: string
  hint?: string
  value: string
  onValueChange: (value: string) => void
  error?: string | null
  maxChars?: number
  /** Passed through to the textarea so a caller can focus it on disclosure. */
  textareaRef?: Ref<HTMLTextAreaElement>
  /** Long-form threads get more room than a reply does. */
  tall?: boolean
  /** Marks the field required, in the label and on the textarea. */
  required?: boolean
  /**
   * How the page will render the text, so the preview matches it: an opening
   * post keeps its headings (`article`), a reply has them demoted (`comment`).
   */
  allow?: ProseAllow
}

export function MarkdownComposer({
  id,
  name,
  label,
  hint,
  value,
  onValueChange,
  error,
  maxChars,
  textareaRef,
  tall = false,
  required = false,
  allow = 'comment',
}: MarkdownComposerProps) {
  const [mode, setMode] = useState<EditorMode>('write')
  const previewId = useId()
  const trimmed = value.trim()

  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      {({ id: fieldId, describedBy, invalid }) => (
        <div className="flex flex-col gap-xs">
          {/* self-start, or the column flex stretches a two-option toggle to
              the full width of the composer, which reads as a tab bar. The
              field label above already says what this is for, so its own
              label names the group for assistive technology and is not
              printed as a second heading between the label and the text. */}
          <SegmentedControl<EditorMode>
            label="Editor mode"
            labelHidden
            options={MODES}
            value={mode}
            onValueChange={setMode}
            className="self-start"
          />

          <div hidden={mode !== 'write'}>
            <Textarea
              ref={textareaRef}
              id={fieldId}
              name={name}
              prose
              required={required}
              value={value}
              onChange={(event) => {
                onValueChange(event.target.value)
              }}
              aria-describedby={describedBy}
              invalid={invalid}
              maxChars={maxChars}
              className={tall ? 'min-h-64' : undefined}
            />
          </div>

          <div hidden={mode !== 'preview'}>
            <div
              id={previewId}
              role="group"
              aria-label={`Preview of ${label.toLowerCase()}`}
              className={`overflow-y-auto rounded-sm border border-border-control bg-surface-0 p-sm ${
                tall ? 'max-h-96 min-h-64' : 'max-h-80 min-h-24'
              }`}
            >
              {/* No width override: the preview is the post at its real measure. */}
              {trimmed.length > 0 ? (
                <Prose content={value} allow={allow} />
              ) : (
                <p className="measure-ui text-xs text-text-3">
                  Nothing to preview yet. Switch back to Write, and this panel shows the post
                  exactly as the channel will render it.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Field>
  )
}

export default MarkdownComposer

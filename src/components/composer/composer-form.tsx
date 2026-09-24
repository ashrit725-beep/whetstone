'use client'

/**
 * The feedback composer.
 *
 * Keyboard contract
 * - Before hydration the areas are a plain list of in-page links and every
 *   panel is open, so the whole form is reachable and postable with JavaScript
 *   turned off.
 * - After hydration the areas become a real tablist (the `Tabs` primitive:
 *   roving tabindex, Left/Right wrap, Home/End) and the panels hide. Panels
 *   stay mounted, so a note written under one area still posts after you move
 *   to another.
 * - Every focusable keeps the footer's own measured height clear of itself, so
 *   the sticky footer never covers the thing that just took focus (SC 2.4.11).
 *
 * Geometry: one column. On the page it sits flush with the page heading and
 * the footer is ruled across the column; in the dialog both are inset by the
 * dialog's own padding and the body scrolls under a pinned footer. Every control
 * shares the 44px base height, the textarea has `resize: vertical`, and the
 * counter is the Textarea primitive's own polite live region.
 *
 * The coach is advisory. It cannot disable the submit and it is not in the tab
 * order ahead of the note it is about.
 *
 * A refused post opens the first area whose note came back with a message, and
 * each link in the error summary opens its own area before it moves focus, so
 * no message is left inside a hidden panel where the link cannot reach it.
 *
 * What is written under the areas is kept between visits: a few seconds after
 * the reviewer stops typing it is saved against their account, and the form
 * opens with it the next time, on the page or in the dialog. Leaving the page,
 * "Keep writing later", or a post that fails on its way out no longer throws
 * the review away. The saved copy is cleared when the review posts.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { flushSync } from 'react-dom'
import { CircleAlert, Clock, ExternalLink } from 'lucide-react'
import {
  Field,
  Form,
  Select,
  SubmitButton,
  Tabs,
  Textarea,
  type FormAction,
  type FormState,
} from '@/components/ui'
import { cn, inSentence, safeHref } from '@/lib/utils'
import { saveComposerNotes } from '@/server/actions/feedback'
import { AxisRating } from './axis-rating'
import { CoachPanel } from './coach-panel'
import { ProjectStyles } from '../project/styles'
import { NOTE_CHARS, SAVED_NOTE_MAX, type ComposerData, type OptimisticNote } from './types'

/** How long the reviewer stops typing before the notes are saved. */
const SAVE_IDLE_MS = 2500
/** One more try for a save that was not kept, such as one that came too soon after the last. */
const SAVE_RETRY_MS = 4000
/** Air between a focused control's ring and the top rule of the sticky footer. */
const FOOTER_CLEARANCE_PX = 16

export interface ComposerFormProps {
  data: ComposerData
  action: FormAction
  /** Called with the assembled notes the moment the form is submitted. */
  onOptimistic?: (notes: readonly OptimisticNote[]) => void
  /** Rendered by the dialog so Escape and Cancel have somewhere to go. */
  onCancel?: () => void
  cancelHref: string
  /**
   * `page` sits in the route's own column, under its h1. `dialog` supplies its
   * own inset, scroll region and title, because nothing around it does.
   */
  variant?: 'page' | 'dialog'
  className?: string
}

interface NoteState {
  body: string
  rating: number | null
  category: string
  severity: string
  actionability: string
}

/**
 * The notes as last typed in this tab, by project. The saved copy reaches the
 * form through its props, and props can be older than the typing: a page the
 * back button restores is given the props it was first rendered with. Without
 * this, going back to a project after "Keep writing later" opened an empty
 * composer whose next save wrote over the notes. Whichever copy is newer wins.
 * Only ever filled in the browser, after hydration, so the server's render and
 * the first client render always agree.
 */
const typedNotes = new Map<string, { at: number; notes: Record<string, NoteState> }>()

/** The notes as the server has them: the saved copy, or every area blank. */
function notesFromData(data: ComposerData): Record<string, NoteState> {
  const notes: Record<string, NoteState> = {}
  for (const axis of data.axes) {
    const saved = data.savedNotes?.[axis.key]
    notes[axis.key] = saved
      ? { ...saved }
      : {
          body: '',
          rating: null,
          category: axis.defaultCategory,
          severity: 'minor',
          actionability: 'suggestion',
        }
  }
  return notes
}

export function ComposerForm({
  data,
  action,
  onOptimistic,
  onCancel,
  cancelHref,
  variant = 'dialog',
  className,
}: ComposerFormProps) {
  const { project, axes, categories, severities, actionabilities } = data
  const onPage = variant === 'page'
  // On the page the route's h1 names the project, so the composer's own
  // headings start one level higher than they do inside the dialog.
  const Heading = onPage ? 'h2' : 'h3'
  // Stable on both renders: React's useId emits characters that are not legal
  // in a fragment link, and these ids are link targets before hydration.
  const idBase = `composer-${project.id.slice(0, 8)}`
  const [enhanced, setEnhanced] = useState(false)
  const [active, setActive] = useState(axes[0]?.key ?? '')
  const [seconds, setSeconds] = useState(data.secondsSoFar)
  // Honest, not assumed: the dwell floor reads this, so it is only true once the
  // reviewer has actually opened the build from here.
  const [openedArtifact, setOpenedArtifact] = useState(false)
  const [notes, setNotes] = useState<Record<string, NoteState>>(() => {
    const typed = typedNotes.get(project.id)
    return typed && typed.at > (data.savedAt ?? 0) ? typed.notes : notesFromData(data)
  })
  const textareas = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const scope = useRef<HTMLDivElement | null>(null)
  // SC 2.4.11 again, with the real number. The stylesheet keeps 5rem of scroll
  // margin under every focusable so the sticky footer cannot cover the control
  // that just took focus, and at 390 the footer wraps to two lines and is
  // taller than that: tabbing to "How much it hurts" put the select and most
  // of its focus ring behind it. The height depends on the words in the
  // footer, so it is measured rather than assumed.
  const footer = useRef<HTMLElement | null>(null)
  const [footerHeight, setFooterHeight] = useState(0)

  useEffect(() => {
    setEnhanced(true)
  }, [])

  useEffect(() => {
    const node = footer.current
    if (!node) return
    const measure = () => {
      setFooterHeight(node.offsetHeight)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [])

  // Keeping the notes between visits. Only a change to what was written or
  // chosen is saved, never the clock ticking, and nothing is saved once a post
  // is on its way: the post clears the saved copy, and a save landing after it
  // would bring posted notes back the next time the composer opens.
  const latest = useRef({ notes, seconds })
  // What the server holds, so notes restored from this tab's own copy are
  // saved again when that copy is the newer one.
  const [serverCopy] = useState(() => JSON.stringify(notesFromData(data)))
  // Said once, about what the form opened with, from either copy.
  const [restored] = useState(() =>
    Object.values(notes).some((note) => note.body.trim().length > 0 || note.rating !== null),
  )
  const lastSaved = useRef(serverCopy)
  const saveTimer = useRef<number | undefined>(undefined)
  const posting = useRef(false)

  useEffect(() => {
    latest.current = { notes, seconds }
  }, [notes, seconds])

  useEffect(() => {
    if (!posting.current) typedNotes.set(project.id, { at: Date.now(), notes })
  }, [notes, project.id])

  const persist = (retry: boolean): void => {
    if (posting.current) return
    const current = latest.current
    const json = JSON.stringify(current.notes)
    if (json === lastSaved.current) return
    const kept = Object.fromEntries(
      Object.entries(current.notes).map(([key, note]) => [key, { ...note, body: note.body.slice(0, SAVED_NOTE_MAX) }]),
    )
    saveComposerNotes({
      projectId: project.id,
      payload: { seconds: Math.min(current.seconds, 60 * 60 * 8), notes: kept },
    })
      .then((saved) => {
        if (saved) lastSaved.current = json
        else if (retry) saveTimer.current = window.setTimeout(() => persist(false), SAVE_RETRY_MS)
      })
      .catch(() => {
        // A dropped connection. The next change tries again.
      })
  }
  // The latest `persist` for the timers and the unmount below, which outlive
  // the render that scheduled them.
  const persistRef = useRef(persist)
  useEffect(() => {
    persistRef.current = persist
  })

  useEffect(() => {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => persistRef.current(true), SAVE_IDLE_MS)
    return () => {
      window.clearTimeout(saveTimer.current)
    }
  }, [notes])

  // Moving on inside the site before the pause is over still keeps the words.
  useEffect(
    () => () => {
      persistRef.current(false)
    },
    [],
  )

  // Stable, so a refusal resumes saving once, when it arrives, and not again
  // on every tick of the clock while a second post is on its way.
  const resumeSaving = useCallback(() => {
    posting.current = false
    typedNotes.set(project.id, { at: Date.now(), notes: latest.current.notes })
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => persistRef.current(true), SAVE_IDLE_MS)
  }, [project.id])

  // The summary's links focus `#note-<area>`. Focusing a control inside a
  // hidden panel does nothing, so the area is shown first, synchronously, in
  // the capture phase ahead of the summary's own handler.
  useEffect(() => {
    const root = scope.current
    if (!root) return
    const keys = new Set(axes.map((axis) => axis.key))
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href^="#note-"]') : null
      const key = link?.getAttribute('href')?.slice('#note-'.length)
      if (key && keys.has(key)) flushSync(() => setActive(key))
    }
    root.addEventListener('click', onClick, true)
    return () => root.removeEventListener('click', onClick, true)
  }, [axes])

  // Time with the build. It is a real input to the dwell floor, not decoration:
  // a review written in forty seconds is capped before it can earn anything.
  useEffect(() => {
    const id = window.setInterval(() => {
      setSeconds((s) => s + 1)
    }, 1000)
    return () => {
      window.clearInterval(id)
    }
  }, [])

  const written = useMemo(
    () => axes.filter((axis) => (notes[axis.key]?.body.trim().length ?? 0) >= NOTE_CHARS.min).length,
    [axes, notes],
  )

  const update = (key: string, patch: Partial<NoteState>): void => {
    setNotes((current) => {
      const existing = current[key]
      if (!existing) return current
      return { ...current, [key]: { ...existing, ...patch } }
    })
  }

  // The page posts the Server Action itself, so React can render a real form
  // action and the review posts with JavaScript turned off. Only the dialog,
  // which exists only once scripts run, wraps it to put the notes in the
  // thread first; a client wrapper on the page rendered an action that throws.
  const submit: FormAction = onOptimistic
    ? (state: FormState, formData: FormData) => {
        const posted: OptimisticNote[] = axes
          .filter((axis) => (notes[axis.key]?.body.trim().length ?? 0) >= NOTE_CHARS.min)
          .map((axis) => ({
            axisKey: axis.key,
            axisLabel: axis.label,
            body: notes[axis.key]?.body.trim() ?? '',
          }))
        if (posted.length > 0) onOptimistic(posted)
        return action(state, formData)
      }
    : action

  const tabs = axes.map((axis) => ({ value: axis.key, label: axis.label }))

  return (
    <div
      ref={scope}
      className={cn('ws-composer-scope flex flex-col', className)}
      style={
        footerHeight > 0
          ? ({ '--ws-focus-gap': `${String(footerHeight + FOOTER_CLEARANCE_PX)}px` } as CSSProperties)
          : undefined
      }
    >
      <ProjectStyles />
      <Form
        action={submit}
        summaryTitle="This review was not posted."
        className="flex min-h-0 flex-col"
        onSubmit={() => {
          // The last words go into the saved copy first. Server Actions run
          // one at a time, in order, so this save lands before the post that
          // clears it rather than after.
          window.clearTimeout(saveTimer.current)
          persistRef.current(false)
          posting.current = true
          // A review that posts must not come back from this tab's copy
          // either; a refusal puts the copy back.
          typedNotes.delete(project.id)
        }}
      >
        {({ state }) => (
          <>
            <OpenFirstError state={state} axes={axes} onOpen={setActive} />
            <ResumeSaving state={state} onResume={resumeSaving} />
            <div
              className={cn(
                'flex min-h-0 flex-1 flex-col gap-lg',
                // Only the dialog scrolls itself. On the page an overflow box
                // would clip the focus ring of every full-width control.
                onPage ? 'py-lg' : 'overflow-y-auto p-lg',
              )}
              data-scroll-region={onPage ? undefined : true}
            >
              <input type="hidden" name="slug" value={project.slug} />
              <input type="hidden" name="seconds" value={seconds} />
              <input type="hidden" name="openedArtifact" value={openedArtifact ? 'true' : ''} />

              <header className="flex flex-col gap-sm">
                <p className="text-xs text-ink-3">
                  Feedback for {project.ownerName}
                  {project.versionLabel ? `, on ${project.versionLabel}` : ''}
                </p>
                {onPage ? null : <h2 className="text-md text-ink">{project.title}</h2>}
                {project.askPrompt ? (
                  // The mark means "this is the ask" everywhere in the product,
                  // so the one thing the review should answer carries it here too.
                  <div className="marked flex flex-col gap-2xs bg-paper-hi py-md pr-md pl-lg">
                    <p className="eyebrow text-ink-3">What the creator asked for</p>
                    <p className="voice text-base text-ink">{project.askPrompt}</p>
                  </div>
                ) : null}
                {safeHref(project.buildUrl) ? (
                  <a
                    className="ws-scaffold w-fit gap-2xs text-sm"
                    href={safeHref(project.buildUrl) ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      setOpenedArtifact(true)
                    }}
                  >
                    <ExternalLink size={16} strokeWidth={1.5} aria-hidden="true" />
                    Open the build again
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : null}
                {restored ? (
                  <p className="measure-ui text-sm text-ink-2">
                    The notes you had not posted yet are back under their areas. Nobody else sees them until you
                    post the review.
                  </p>
                ) : null}
              </header>

              {data.impression ? (
                <section aria-labelledby={`${idBase}-impression`} className="flex flex-col gap-2xs">
                  <Heading id={`${idBase}-impression`} className="text-sm text-ink">
                    Your first impression, before you read anyone else
                  </Heading>
                  <p className="voice text-base">{data.impression}</p>
                  <input type="hidden" name="impression" value={data.impression} />
                </section>
              ) : null}

              {state.fieldErrors?.['composer-notes'] ? (
                <p
                  id="composer-notes"
                  className="measure-ui flex items-start gap-2xs text-xs text-critical"
                  tabIndex={-1}
                >
                  <CircleAlert size={16} strokeWidth={1.5} aria-hidden="true" className="mt-3xs shrink-0" />
                  {state.fieldErrors['composer-notes']}
                </p>
              ) : null}

              {enhanced ? (
                <Tabs
                  idBase={`${idBase}-areas`}
                  label={`Areas to review on ${project.title}`}
                  tabs={tabs}
                  value={active}
                  onValueChange={setActive}
                />
              ) : (
                <nav aria-label={`Areas to review on ${project.title}`}>
                  <ul className="flex list-none flex-wrap gap-xs p-0">
                    {axes.map((axis) => (
                      <li key={axis.key}>
                        <a className="ws-area-link" href={`#${idBase}-areas-panel-${axis.key}`}>
                          {axis.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}

              {axes.map((axis) => {
                const note = notes[axis.key]
                if (!note) return null
                const selected = axis.key === active
                const noteId = `note-${axis.key}`
                const error = state.fieldErrors?.[noteId] ?? null
                return (
                  <div
                    key={axis.key}
                    id={`${idBase}-areas-panel-${axis.key}`}
                    role={enhanced ? 'tabpanel' : undefined}
                    aria-labelledby={enhanced ? `${idBase}-areas-tab-${axis.key}` : undefined}
                    tabIndex={enhanced ? 0 : undefined}
                    hidden={enhanced && !selected}
                  >
                    <fieldset className="m-0 flex flex-col gap-md border-0 p-0">
                      <legend className="mb-2xs flex flex-col gap-3xs p-0">
                        <span
                          className="text-md text-text-1"
                          style={{ fontVariationSettings: '"wdth" 100, "wght" 600' }}
                        >
                          {axis.label}
                        </span>
                        <span className="measure-ui block text-xs text-text-3">{axis.definition}</span>
                      </legend>

                      <AxisRating
                        name={`rating-${axis.key}`}
                        axisLabel={axis.label}
                        lowLabel={axis.lowLabel}
                        highLabel={axis.highLabel}
                        scale={data.ratingScale}
                        value={note.rating}
                        onChange={(next) => {
                          update(axis.key, { rating: next })
                        }}
                      />

                      <Field
                        id={noteId}
                        label={`What you noticed about ${inSentence(axis.label)}`}
                        hint={axis.prompt ?? 'Name the moment, what you expected, and what happened instead.'}
                        error={error}
                      >
                        {({ id, describedBy, invalid }) => (
                          <Textarea
                            id={id}
                            name={id}
                            prose
                            maxChars={NOTE_CHARS.max}
                            rows={5}
                            value={note.body}
                            onChange={(event) => {
                              update(axis.key, { body: event.target.value })
                            }}
                            ref={(element) => {
                              textareas.current[axis.key] = element
                            }}
                            aria-describedby={describedBy}
                            invalid={invalid}
                          />
                        )}
                      </Field>

                      <div className="grid gap-md sm:grid-cols-2">
                        <Field id={`category-${axis.key}`} label="File it under">
                          {({ id }) => (
                            <Select
                              id={id}
                              name={id}
                              value={note.category}
                              onChange={(event) => {
                                update(axis.key, { category: event.target.value })
                              }}
                              options={categories.map((c) => ({ value: c.key, label: c.label }))}
                            />
                          )}
                        </Field>
                        <Field id={`severity-${axis.key}`} label="How much it hurts">
                          {({ id }) => (
                            <Select
                              id={id}
                              name={id}
                              value={note.severity}
                              onChange={(event) => {
                                update(axis.key, { severity: event.target.value })
                              }}
                              options={severities.map((s) => ({ value: s.key, label: s.label }))}
                            />
                          )}
                        </Field>
                      </div>

                      <Field
                        id={`actionability-${axis.key}`}
                        label="How close it is to a task"
                        hint={actionabilities.find((a) => a.key === note.actionability)?.definition}
                      >
                        {({ id }) => (
                          <Select
                            id={id}
                            name={id}
                            value={note.actionability}
                            onChange={(event) => {
                              update(axis.key, { actionability: event.target.value })
                            }}
                            options={actionabilities.map((a) => ({ value: a.key, label: a.label }))}
                          />
                        )}
                      </Field>

                      <CoachPanel
                        draftId={`${project.id}:${axis.key}`}
                        projectId={project.id}
                        axisKey={axis.key}
                        ask={project.askPrompt ?? ''}
                        value={note.body}
                        onAppend={(scaffold) => {
                          const current = notes[axis.key]?.body ?? ''
                          const joined = current.trimEnd().length > 0 ? `${current.trimEnd()} ${scaffold}` : scaffold
                          update(axis.key, { body: joined })
                          const element = textareas.current[axis.key]
                          if (element) {
                            element.focus()
                            element.setSelectionRange(joined.length, joined.length)
                          }
                        }}
                      />
                    </fieldset>
                  </div>
                )
              })}
            </div>

            <footer
              ref={footer}
              className={cn(
                'sticky bottom-0 flex flex-wrap items-center justify-between gap-sm border-t border-rule',
                // On the page the footer is the column's last ruled line, on the
                // same paper as the page, so nothing floats beside the text.
                onPage ? 'bg-paper py-md' : 'bg-paper-hi p-lg',
              )}
            >
              <p className="flex items-center gap-2xs text-xs text-text-3">
                <Clock size={16} strokeWidth={1.5} aria-hidden="true" />
                <span>
                  <span className="tnum">{written}</span> of <span className="tnum">{axes.length}</span> areas written,{' '}
                  <span className="tnum">{formatDuration(seconds)}</span>{' '}
                  {/* Same wording rule as the blind step: with no build to open,
                      the clock is measuring the review, not time with a build. */}
                  {safeHref(project.buildUrl) ? 'with the build' : 'on this review'}
                </span>
              </p>
              <div className="flex items-center gap-xs">
                {onCancel ? (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="ws-scaffold text-sm"
                  >
                    Keep writing later
                  </button>
                ) : (
                  <a href={cancelHref} className="ws-scaffold text-sm">
                    Back to the project
                  </a>
                )}
                <SubmitButton variant="primary" pendingLabel="Posting the review…">
                  Post feedback
                </SubmitButton>
              </div>
            </footer>
          </>
        )}
      </Form>
    </div>
  )
}

/** Shows the first area whose note the server refused, once per refusal. */
function OpenFirstError({
  state,
  axes,
  onOpen,
}: {
  state: FormState
  axes: ComposerData['axes']
  onOpen: (key: string) => void
}) {
  useEffect(() => {
    const first = axes.find((axis) => state.fieldErrors?.[`note-${axis.key}`])
    if (first) onOpen(first.key)
  }, [state, axes, onOpen])
  return null
}

/**
 * A refused post leaves the review with the reviewer, so saving picks up
 * again. A post that went through navigates away and never gets here.
 */
function ResumeSaving({ state, onResume }: { state: FormState; onResume: () => void }) {
  useEffect(() => {
    if (state.status === 'error') onResume()
  }, [state, onResume])
  return null
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export default ComposerForm

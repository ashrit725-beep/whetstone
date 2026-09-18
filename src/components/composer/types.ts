/** Serializable props shared by the composer's page and dialog forms. */

/**
 * The length a note under one area may be. The counter under each box prints
 * the maximum and `postFeedback` refuses anything outside the range, so the
 * limit the reviewer is shown is the limit that holds.
 */
export const NOTE_CHARS = { min: 40, max: 1200 } as const

/**
 * The longest note the composer keeps between visits. Longer than a note may
 * be posted, because the box lets a reviewer run over and trim back, and a
 * save refused for that would drop everything else they wrote with it.
 */
export const SAVED_NOTE_MAX = 4_000

export interface ComposerAxis {
  readonly key: string
  readonly label: string
  readonly definition: string
  readonly lowLabel: string
  readonly highLabel: string
  /** One elicitation question from the project type's taxonomy. */
  readonly prompt: string | null
  /** The category this axis most often produces notes in, pre-selected. */
  readonly defaultCategory: string
}

export interface ComposerOption {
  readonly key: string
  readonly label: string
  readonly definition: string
}

export interface ComposerProject {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly typeLabel: string
  readonly ownerName: string
  readonly askPrompt: string | null
  readonly askDetail: string | null
  readonly buildUrl: string | null
  readonly versionLabel: string | null
}

export interface ComposerData {
  readonly project: ComposerProject
  readonly axes: readonly ComposerAxis[]
  readonly categories: readonly ComposerOption[]
  readonly severities: readonly ComposerOption[]
  readonly actionabilities: readonly ComposerOption[]
  /** The reviewer's blind first impression, once they have recorded one. */
  readonly impression: string | null
  /** Seconds already spent with the build, carried from the blind step. */
  readonly secondsSoFar: number
  /** The top of every axis's rating scale; `postFeedback` checks against it. */
  readonly ratingScale: number
  /**
   * What this reviewer wrote under the areas and has not posted yet, keyed by
   * axis, as the composer last saved it. Null when there is nothing to bring
   * back.
   */
  readonly savedNotes: Readonly<Record<string, SavedNote>> | null
  /** When `savedNotes` was saved, in epoch milliseconds. */
  readonly savedAt: number | null
}

/** One area of an unposted review, as the composer saves it between visits. */
export interface SavedNote {
  readonly body: string
  readonly rating: number | null
  readonly category: string
  readonly severity: string
  readonly actionability: string
}

/** What the thread inserts optimistically the moment a review is submitted. */
export interface OptimisticNote {
  readonly axisKey: string
  readonly axisLabel: string
  readonly body: string
}

import game from './game.mjs'
import web_app from './web_app.mjs'
import mobile_app from './mobile_app.mjs'
import website from './website.mjs'
import video from './video.mjs'
import writing from './writing.mjs'
import design from './design.mjs'
import business_idea from './business_idea.mjs'
import hardware from './hardware.mjs'
import api_tool from './api_tool.mjs'

export const TYPES = { game, web_app, mobile_app, website, video, writing, design, business_idea, hardware, api_tool }

/** Kinds whose subjects are noun phrases, which any "thing" sentence can take. */
const THING_KINDS = new Set(['visual', 'audio', 'copy', 'flow', 'feel', 'pacing', 'perf', 'pitch', 'money', 'reason', 'system',
  'physical', 'story', 'access', 'craft', 'tone', 'power', 'balance'])
const DOING_KINDS = new Set(['flow', 'feel', 'system', 'perf'])

for (const t of Object.values(TYPES)) {
  const things = []
  const doing = []
  for (const [label, [kind, subjects]] of Object.entries(t.cats)) {
    if (!THING_KINDS.has(kind)) continue
    for (const s of subjects) {
      things.push({ kind, raw: s, label })
      if (DOING_KINDS.has(kind)) doing.push({ kind, raw: s, label })
    }
  }
  /** Every noun-phrase subject in the type, with the kind it came from. */
  t.things = things
  /** The subset a reviewer could plausibly call friction. */
  t.doing = doing
}

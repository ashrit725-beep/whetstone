import { get } from '@/server/db/client'
import { aiAvailability } from '@/lib/env'
import { handler } from '@/server/api/handler'
import { LIMITS } from '@/server/api/limits'

/**
 * GET /api/health
 *
 * A liveness probe that actually touches the database, because a process that
 * is up and a process that can serve are different things. Reports which AI
 * providers are configured, never whether a key is valid and never any part of
 * a key: the product runs its deterministic paths with none of them set, so
 * `false` here is a capability statement, not an incident.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler({
  auth: 'none',
  limit: LIMITS.health,
  run() {
    const ai = aiAvailability()

    let db: 'up' | 'down' = 'down'
    try {
      const row = get<{ n: number }>('SELECT COUNT(*) AS n FROM users')
      db = row ? 'up' : 'down'
    } catch {
      db = 'down'
    }

    return {
      ok: db === 'up',
      db,
      ai: { anthropic: ai.anthropic, openai: ai.openai, kimi: ai.kimi },
      at: Date.now(),
    }
  },
})

import './guard'
import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/env'
import type { JsonSchema } from './schemas'
import type { RunUsage } from './types'

/**
 * The Anthropic adapter. Primary provider for every reasoning task.
 *
 * Structured output is done with a strict tool definition and a forced
 * `tool_choice`, which is the part of the API that makes prompt injection
 * structurally unable to produce free text: the only shape the model can emit is
 * the schema. The system prefix carries `cache_control` when it is large enough
 * to clear the minimum cacheable prefix, and the run ledger records
 * `cache_read_input_tokens` so a cache-miss streak is visible rather than
 * silently expensive.
 *
 * `maxRetries: 1` is deliberate. The SDK default of two means a hung provider
 * can burn three timeouts of wall clock before the deterministic path runs, and
 * reaching that path quickly matters more than one extra attempt.
 */

let cached: Anthropic | undefined
let cachedKey: string | undefined

export function anthropicClient(): Anthropic | undefined {
  const key = env.anthropicKey
  if (!key) return undefined
  if (cached && cachedKey === key) return cached
  cached = new Anthropic({ apiKey: key, maxRetries: 1 })
  cachedKey = key
  return cached
}

export type AdapterResponse = {
  value: unknown
  usage: RunUsage
  /** Raw token counts before pricing, kept for the ledger. */
  rawUsage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number }
}

export type AdapterRequest = {
  model: string
  system: string
  user: string
  toolName: string
  toolDescription: string
  schema: JsonSchema
  maxTokens: number
  timeoutMs: number
  /**
   * How hard a reasoning model should think. Anthropic ignores it; OpenAI's
   * gpt-5 family spends its completion budget on reasoning tokens unless told
   * otherwise, which is what made every structured call run out of room before
   * it reached the tool.
   */
  effort: 'minimal' | 'low' | 'medium'
  cachePrefix: boolean
  signal: AbortSignal
  /** A follow-up turn appended after a schema violation, for the repair retry. */
  repair?: { previous: string; problem: string }
}

export async function anthropicStructured(request: AdapterRequest): Promise<AdapterResponse> {
  const client = anthropicClient()
  if (!client) throw new Error('anthropic key absent')

  // The repair used to replay the failed answer as an assistant turn, cut to
  // 4,000 characters. A theme report is longer than that, so the model saw
  // half a JSON document and answered in kind: arrays came back as strings.
  // The problem is stated instead, and the model answers the task afresh.
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: request.repair ? `${request.user}\n\n${repairNote(request.repair.problem)}` : request.user },
  ]

  const response = await client.messages.create(
    {
      model: request.model,
      max_tokens: request.maxTokens,
      system: [
        {
          type: 'text',
          text: request.system,
          ...(request.cachePrefix ? { cache_control: { type: 'ephemeral' as const } } : {}),
        },
      ],
      messages,
      tools: [
        {
          name: request.toolName,
          description: request.toolDescription,
          input_schema: request.schema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: request.toolName },
    },
    { signal: request.signal, timeout: request.timeoutMs, maxRetries: 1 },
  )

  const block = response.content.find((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use')
  if (!block) throw new Error('no tool_use block in response')

  const usage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
  }

  return {
    value: block.input,
    usage: { ...usage, costMicros: 0 },
    rawUsage: usage,
  }
}

/** Maps a provider error onto the degradation ladder without leaking details. */
export function anthropicErrorCode(error: unknown): string {
  if (error instanceof Anthropic.APIError) return `http_${error.status ?? 0}`
  if (error instanceof Error && error.name === 'AbortError') return 'aborted'
  return 'unknown'
}

export function isRateLimit(error: unknown): boolean {
  return error instanceof Anthropic.APIError && error.status === 429
}

/** Shared by both adapters: what went wrong last time, and how to avoid it. */
export function repairNote(problem: string): string {
  return [
    `A previous attempt at this tool call failed validation: ${problem}.`,
    'Call the tool again. Every array must be a JSON array, not a string holding one, and every string must stay',
    'within its stated maximum length.',
  ].join(' ')
}

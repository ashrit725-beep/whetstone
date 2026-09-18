import './guard'
import OpenAI from 'openai'
import { env } from '@/lib/env'
import { repairNote, type AdapterRequest, type AdapterResponse } from './anthropic'

/**
 * OpenAI and Kimi.
 *
 * Kimi speaks the OpenAI protocol, so one adapter serves both: the only
 * difference is the base URL, which comes from `env.kimiBaseUrl`. Neither key is
 * ever read from `process.env` here; `@/lib/env` is the single accessor.
 *
 * Structured output uses a strict function tool with a forced `tool_choice`,
 * the same contract as the Anthropic path, so a response that reaches zod has
 * already been shaped twice.
 */

type ClientCache = { client: OpenAI; key: string; baseUrl?: string }

let openaiCache: ClientCache | undefined
let kimiCache: ClientCache | undefined

export function openaiClient(): OpenAI | undefined {
  const key = env.openaiKey
  if (!key) return undefined
  if (openaiCache && openaiCache.key === key) return openaiCache.client
  const client = new OpenAI({ apiKey: key, maxRetries: 1 })
  openaiCache = { client, key }
  return client
}

export function kimiClient(): OpenAI | undefined {
  const key = env.kimiKey
  if (!key) return undefined
  const baseURL = env.kimiBaseUrl
  if (kimiCache && kimiCache.key === key && kimiCache.baseUrl === baseURL) return kimiCache.client
  const client = new OpenAI({ apiKey: key, baseURL, maxRetries: 1 })
  kimiCache = { client, key, baseUrl: baseURL }
  return client
}

export function compatClient(provider: 'openai' | 'kimi'): OpenAI | undefined {
  return provider === 'openai' ? openaiClient() : kimiClient()
}

export async function compatStructured(
  provider: 'openai' | 'kimi',
  request: AdapterRequest,
): Promise<AdapterResponse> {
  const client = compatClient(provider)
  if (!client) throw new Error(`${provider} key absent`)

  // See `anthropicStructured`: the repair states the problem rather than
  // replaying a truncated copy of the failed answer.
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: request.system },
    { role: 'user', content: request.repair ? `${request.user}\n\n${repairNote(request.repair.problem)}` : request.user },
  ]

  // Kimi accepts the older `max_tokens`; OpenAI has moved to
  // `max_completion_tokens`. Sending the wrong one is a 400, so the branch is
  // load-bearing rather than cosmetic.
  const limit =
    provider === 'openai'
      ? { max_completion_tokens: request.maxTokens }
      : { max_tokens: request.maxTokens }

  // gpt-5 spends max_completion_tokens on reasoning before it writes anything,
  // so a 400-token ceiling produced a response with no tool call in it and a
  // 700ms deadline was never once met. Naming the effort puts both back in
  // reach: at "minimal" the same call returns in about two seconds and spends
  // no reasoning tokens at all. Kimi and older OpenAI models do not take the
  // parameter, so it is only sent where it is understood.
  const reasoning =
    provider === 'openai' && /^(?:gpt-5|o[1-9])/.test(request.model)
      ? { reasoning_effort: request.effort }
      : {}

  const response = await client.chat.completions.create(
    {
      model: request.model,
      messages,
      ...reasoning,
      tools: [
        {
          type: 'function',
          function: {
            name: request.toolName,
            description: request.toolDescription,
            parameters: request.schema as unknown as Record<string, unknown>,
            strict: true,
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: request.toolName } },
      ...limit,
    },
    { signal: request.signal, timeout: request.timeoutMs, maxRetries: 1 },
  )

  const choice = response.choices[0]
  const call = choice?.message.tool_calls?.find((c) => c.type === 'function')
  if (!call || call.type !== 'function') throw new Error('no tool call in response')

  let value: unknown
  try {
    value = JSON.parse(call.function.arguments) as unknown
  } catch {
    throw new Error('tool arguments were not valid JSON')
  }

  const usage = {
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    cacheReadTokens: response.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    cacheCreationTokens: 0,
  }
  // Cached prompt tokens are reported inside the prompt total on this protocol,
  // so subtract them out or the ledger double-counts the expensive rate.
  usage.inputTokens = Math.max(0, usage.inputTokens - usage.cacheReadTokens)

  return { value, usage: { ...usage, costMicros: 0 }, rawUsage: usage }
}

export function compatErrorCode(error: unknown): string {
  if (error instanceof OpenAI.APIError) return `http_${error.status ?? 0}`
  if (error instanceof Error && error.name === 'AbortError') return 'aborted'
  return 'unknown'
}

export function compatIsRateLimit(error: unknown): boolean {
  return error instanceof OpenAI.APIError && error.status === 429
}

/**
 * The embeddings tier. Anthropic has no embeddings endpoint, so when an OpenAI
 * key is present the clustering and duplicate paths can upgrade from lexical
 * vectors to semantic ones without involving a chat model at all. A genuine
 * middle tier: better recall than keywords, a fraction of the cost of a model.
 */
export interface EmbedResult {
  readonly vectors: number[][]
  /** Prompt tokens billed, so the caller can put this in the same ledger a
   *  chat call goes into. It is a paid request like any other. */
  readonly inputTokens: number
}

export async function embed(
  texts: readonly string[],
  signal?: AbortSignal,
): Promise<EmbedResult | undefined> {
  const client = openaiClient()
  if (!client || texts.length === 0) return undefined
  try {
    const response = await client.embeddings.create(
      { model: 'text-embedding-3-small', input: [...texts] },
      { signal, maxRetries: 1, timeout: 15_000 },
    )
    const ordered = [...response.data].sort((a, b) => a.index - b.index)
    return {
      vectors: ordered.map((d) => d.embedding),
      inputTokens: response.usage?.prompt_tokens ?? 0,
    }
  } catch {
    return undefined
  }
}

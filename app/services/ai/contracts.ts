/**
 * The contract of the AI layer (ai-provider-engine.md, Architecture).
 * The content module builds an AIRequest and calls the AIGateway; only
 * a provider knows how a vendor's API looks.
 */

/**
 * Error classes, decided once by the provider; the gateway acts on the
 * class (ai-provider-engine.md, Error handling). `empty_reply` is a
 * reply without content (for example a thinking model that spent its
 * output budget): it fails over like Fondasi ai-assistant.md asks.
 */
export type AIErrorClass =
  | 'rate_limited'
  | 'rate_limited_daily'
  | 'bad_request'
  | 'project_unavailable'
  | 'key_invalid'
  | 'model_unavailable'
  | 'transient'
  | 'timeout'
  | 'blocked'
  | 'malformed_output'
  | 'empty_reply'

/** What the content module asks for. Teacher data goes in `parts` as delimited data. */
export type AIRequest = {
  /** Templates name a purpose, never a model (config/ai.ts). */
  purpose: string
  system: string
  parts: string[]
  /** JSON Schema of the expected output; the reply is parsed as JSON when set. */
  responseSchema?: Record<string, unknown>
  maxOutputTokens?: number
}

/** One call as the provider sees it: a request, one key, one model. */
export type ProviderCall = AIRequest & {
  model: string
  credential: { id: number; secret: string }
  timeoutMs: number
  /** Aborted when the teacher cancels the generation. */
  signal?: AbortSignal
  /** Ids for scripted providers and logs; never sent to a vendor. */
  trace: { generationId?: number; stepKey?: string; run?: number; attempt: number }
}

export type AIResponse = {
  /** Parsed JSON when a schema was given, otherwise `{ text }`. */
  data: Record<string, unknown>
  text: string
  finishReason: string | null
  inputTokens: number
  outputTokens: number
  model: string
}

export interface AIProvider {
  readonly name: string
  generate(call: ProviderCall): Promise<AIResponse>
}

/**
 * A classified provider failure. `retryAfterMs` comes from the vendor's
 * suggested delay when it gives one.
 */
export class AIError extends Error {
  constructor(
    readonly errorClass: AIErrorClass,
    message: string,
    readonly details: { httpStatus?: number; retryAfterMs?: number } = {}
  ) {
    super(message)
    this.name = 'AIError'
  }
}

/** The generation was cancelled while a call or a wait was running. */
export class AICancelledError extends Error {
  constructor() {
    super('The generation was cancelled')
    this.name = 'AICancelledError'
  }
}

/**
 * Throws when the signal is aborted. Used before and after every wait.
 */
export function throwIfCancelled(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new AICancelledError()
  }
}

/**
 * A wait that ends early, with AICancelledError, when the signal aborts.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfCancelled(signal)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new AICancelledError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

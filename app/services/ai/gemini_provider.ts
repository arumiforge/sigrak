import {
  AICancelledError,
  AIError,
  type AIErrorClass,
  type AIProvider,
  type AIResponse,
  type ProviderCall,
} from '#services/ai/contracts'

type GeminiErrorBody = {
  error?: {
    code?: number
    status?: string
    message?: string
    details?: { '@type'?: string; retryDelay?: string; violations?: { quotaId?: string }[] }[]
  }
}

type GeminiReply = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  modelVersion?: string
}

const blockedReasons = new Set([
  'SAFETY',
  'PROHIBITED_CONTENT',
  'BLOCKLIST',
  'RECITATION',
  'SPII',
  'IMAGE_SAFETY',
  'OTHER',
])

/** "27s" or "1.5s" → milliseconds. */
function parseDelay(value: string | undefined): number | undefined {
  const match = value?.match(/^(\d+(?:\.\d+)?)s$/)
  return match ? Math.round(Number.parseFloat(match[1]) * 1000) : undefined
}

/**
 * Maps an HTTP error of generateContent to an error class
 * (ai-provider-engine.md, Error handling). A 429 is per day when one of
 * its quota ids names a per-day limit; still to be confirmed against
 * real responses (open question in the engine doc).
 */
export function classifyGeminiError(
  status: number,
  body: GeminiErrorBody
): { errorClass: AIErrorClass; retryAfterMs?: number } {
  const details = body.error?.details ?? []
  const apiStatus = body.error?.status

  if (status === 429) {
    const quotaIds = details.flatMap((detail) => detail.violations ?? []).map((v) => v.quotaId ?? '')
    const retryAfterMs = parseDelay(details.find((detail) => detail.retryDelay)?.retryDelay)
    const daily = quotaIds.some((id) => /per ?day/i.test(id))
    return { errorClass: daily ? 'rate_limited_daily' : 'rate_limited', retryAfterMs }
  }
  if (status === 400) {
    return {
      errorClass: apiStatus === 'FAILED_PRECONDITION' ? 'project_unavailable' : 'bad_request',
    }
  }
  if (status === 401 || status === 403) return { errorClass: 'key_invalid' }
  if (status === 402) return { errorClass: 'project_unavailable' }
  if (status === 404) return { errorClass: 'model_unavailable' }
  if (status === 504) return { errorClass: 'timeout' }
  if (status === 408 || status >= 500) return { errorClass: 'transient' }
  return { errorClass: 'bad_request' }
}

/**
 * Gemini generateContent over plain HTTP (D-116): the key goes in the
 * `x-goog-api-key` header per call, never in the URL, and nothing here
 * logs headers. Only used when AI_PROVIDER=gemini; the tests use
 * recorded bodies through an injected fetch.
 */
export class GeminiProvider implements AIProvider {
  readonly name = 'gemini'

  constructor(
    private baseUrl: string,
    private fetchFn: typeof fetch = fetch
  ) {}

  async generate(call: ProviderCall): Promise<AIResponse> {
    const timeout = AbortSignal.timeout(call.timeoutMs)
    const signal = call.signal ? AbortSignal.any([call.signal, timeout]) : timeout

    const body = {
      systemInstruction: { parts: [{ text: call.system }] },
      contents: [{ role: 'user', parts: call.parts.map((text) => ({ text })) }],
      generationConfig: {
        ...(call.responseSchema
          ? { responseMimeType: 'application/json', responseJsonSchema: call.responseSchema }
          : {}),
        ...(call.maxOutputTokens ? { maxOutputTokens: call.maxOutputTokens } : {}),
      },
    }

    let response: Response
    try {
      response = await this.fetchFn(
        `${this.baseUrl.replace(/\/$/, '')}/models/${encodeURIComponent(call.model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': call.credential.secret },
          body: JSON.stringify(body),
          signal,
        }
      )
    } catch (error) {
      if (call.signal?.aborted) throw new AICancelledError()
      if (timeout.aborted) throw new AIError('timeout', 'Gemini did not answer in time')
      throw new AIError('transient', `Gemini request failed: ${(error as Error).name}`)
    }

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as GeminiErrorBody
      const { errorClass, retryAfterMs } = classifyGeminiError(response.status, errorBody)
      throw new AIError(errorClass, `Gemini answered ${response.status}`, {
        httpStatus: response.status,
        retryAfterMs,
      })
    }

    const reply = (await response.json().catch(() => null)) as GeminiReply | null
    return this.#parseReply(reply, call, response.status)
  }

  #parseReply(reply: GeminiReply | null, call: ProviderCall, httpStatus: number): AIResponse {
    const blockReason = reply?.promptFeedback?.blockReason
    if (blockReason) {
      throw new AIError('blocked', `Prompt blocked: ${blockReason}`, { httpStatus })
    }

    const candidate = reply?.candidates?.[0]
    const finishReason = candidate?.finishReason ?? null
    if (finishReason && blockedReasons.has(finishReason)) {
      throw new AIError('blocked', `Reply blocked: ${finishReason}`, { httpStatus })
    }

    const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? '').join('')
    if (text.trim() === '') {
      throw new AIError('empty_reply', `Empty reply (${finishReason ?? 'no candidate'})`, {
        httpStatus,
      })
    }
    if (finishReason === 'MAX_TOKENS') {
      throw new AIError('malformed_output', 'Reply cut off at the output limit', { httpStatus })
    }

    let data: Record<string, unknown> = { text }
    if (call.responseSchema) {
      try {
        data = JSON.parse(text) as Record<string, unknown>
      } catch {
        throw new AIError('malformed_output', 'Reply is not valid JSON', { httpStatus })
      }
    }

    return {
      data,
      text,
      finishReason,
      inputTokens: reply?.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: reply?.usageMetadata?.candidatesTokenCount ?? 0,
      model: reply?.modelVersion ?? call.model,
    }
  }
}

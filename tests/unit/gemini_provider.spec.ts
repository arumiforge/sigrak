import { test } from '@japa/runner'
import { AIError, type ProviderCall } from '#services/ai/contracts'
import { GeminiProvider, classifyGeminiError } from '#services/ai/gemini_provider'

const call: ProviderCall = {
  purpose: 'demo',
  system: 'Instruksi',
  parts: ['<DATA>{}</DATA>'],
  responseSchema: { type: 'object' },
  model: 'gemini-3.8-flash',
  credential: { id: 1, secret: 'AIza-test-secret' },
  timeoutMs: 1_000,
  trace: { attempt: 1 },
}

/**
 * A fetch that answers with one recorded body and remembers the request.
 * The bodies follow Google's documented error shape; the real 429 detail
 * fields are still to be confirmed against live responses (engine doc,
 * open question).
 */
function recorded(status: number, body: unknown) {
  const requests: { url: string; init: RequestInit }[] = []
  const fetchFn = (async (url: string, init: RequestInit) => {
    requests.push({ url, init })
    return new Response(JSON.stringify(body), { status })
  }) as unknown as typeof fetch
  return { provider: new GeminiProvider('https://gemini.test/v1beta', fetchFn), requests }
}

async function failureOf(status: number, body: unknown) {
  const error = await recorded(status, body)
    .provider.generate(call)
    .catch((caught) => caught)
  if (!(error instanceof AIError)) throw new Error('Expected an AIError')
  return error
}

const quota = (quotaId: string, retryDelay?: string) => ({
  error: {
    code: 429,
    status: 'RESOURCE_EXHAUSTED',
    details: [
      {
        '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
        'violations': [{ quotaId }],
      },
      ...(retryDelay
        ? [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', 'retryDelay': retryDelay }]
        : []),
    ],
  },
})

test.group('Gemini provider', () => {
  test('sends the key in a header, never in the URL', async ({ assert }) => {
    const { provider, requests } = recorded(200, {
      candidates: [{ content: { parts: [{ text: '{"text":"Halo"}' }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 3 },
    })

    const response = await provider.generate(call)

    assert.deepEqual(response.data, { text: 'Halo' })
    assert.equal(response.inputTokens, 12)
    assert.equal(
      requests[0].url,
      'https://gemini.test/v1beta/models/gemini-3.8-flash:generateContent'
    )
    assert.notInclude(requests[0].url, 'AIza')
    assert.equal(
      (requests[0].init.headers as Record<string, string>)['x-goog-api-key'],
      'AIza-test-secret'
    )
    const body = JSON.parse(requests[0].init.body as string)
    assert.notProperty(body.generationConfig, 'temperature')
    assert.equal(body.generationConfig.responseMimeType, 'application/json')
  })

  test('tells a per-minute 429 from a per-day 429', async ({ assert }) => {
    const minute = await failureOf(
      429,
      quota('GenerateRequestsPerMinutePerProjectPerModel-FreeTier', '27s')
    )
    assert.equal(minute.errorClass, 'rate_limited')
    assert.equal(minute.details.retryAfterMs, 27_000)

    const day = await failureOf(429, quota('GenerateRequestsPerDayPerProjectPerModel-FreeTier'))
    assert.equal(day.errorClass, 'rate_limited_daily')
  })

  test('maps HTTP errors to the error table', ({ assert }) => {
    const cases: [number, unknown, string][] = [
      [400, { error: { status: 'INVALID_ARGUMENT' } }, 'bad_request'],
      [400, { error: { status: 'FAILED_PRECONDITION' } }, 'project_unavailable'],
      [401, {}, 'key_invalid'],
      [403, { error: { status: 'PERMISSION_DENIED' } }, 'key_invalid'],
      [402, {}, 'project_unavailable'],
      [404, {}, 'model_unavailable'],
      [408, {}, 'transient'],
      [500, {}, 'transient'],
      [503, {}, 'transient'],
      [504, {}, 'timeout'],
    ]
    for (const [status, body, expected] of cases) {
      assert.equal(classifyGeminiError(status, body as never).errorClass, expected, `${status}`)
    }
  })

  test('a blocked prompt or reply is "blocked"', async ({ assert }) => {
    const prompt = await failureOf(200, { promptFeedback: { blockReason: 'SAFETY' } })
    assert.equal(prompt.errorClass, 'blocked')
    const reply = await failureOf(200, { candidates: [{ finishReason: 'PROHIBITED_CONTENT' }] })
    assert.equal(reply.errorClass, 'blocked')
  })

  test('a reply without text is an empty reply, so the gateway fails over', async ({ assert }) => {
    // A thinking model that spent its output budget (Fondasi ai-assistant.md).
    const error = await failureOf(200, {
      candidates: [{ content: { parts: [] }, finishReason: 'MAX_TOKENS' }],
    })
    assert.equal(error.errorClass, 'empty_reply')
  })

  test('invalid JSON for a schema is malformed output', async ({ assert }) => {
    const error = await failureOf(200, {
      candidates: [{ content: { parts: [{ text: 'bukan json' }] }, finishReason: 'STOP' }],
    })
    assert.equal(error.errorClass, 'malformed_output')
  })
})

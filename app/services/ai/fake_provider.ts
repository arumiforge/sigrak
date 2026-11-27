import {
  AIError,
  sleep,
  type AIErrorClass,
  type AIProvider,
  type AIResponse,
  type ProviderCall,
} from '#services/ai/contracts'

/**
 * What one scripted call does.
 * - `ok`: answers after `delayMs` with `data`
 * - `error`: fails after `delayMs` with an error class
 * - `empty`: answers without content (`empty_reply`)
 * - `hang`: never answers, so the call runs into its timeout
 */
export type FakeOutcome =
  | { kind: 'ok'; data?: Record<string, unknown>; delayMs?: number }
  | {
      kind: 'error'
      errorClass: AIErrorClass
      httpStatus?: number
      retryAfterMs?: number
      delayMs?: number
    }
  | { kind: 'empty'; delayMs?: number }
  | { kind: 'hang' }

/** A call as the script sees it; `index` counts calls on this provider from 0. */
export type FakeCall = ProviderCall & { index: number }

export type FakeScript = (call: FakeCall) => FakeOutcome

/**
 * Scenarios the demo page offers while AI_PROVIDER=fake. Each one
 * misbehaves in the second step ("content"), so the first step shows
 * the normal path.
 */
export const demoScenarios = [
  'smooth',
  'rate_limited',
  'timeout',
  'empty_reply',
  'fails_then_recovers',
] as const

export type DemoScenario = (typeof demoScenarios)[number]

const sampleOutputs: Record<string, Record<string, unknown>> = {
  outline: { text: 'Kerangka: pembuka, kegiatan inti dengan tiga langkah, penutup dan refleksi.' },
  content: { text: 'Isi: murid mengamati gambar, berdiskusi dalam kelompok, lalu menulis kesimpulan.' },
  review: { text: 'Pemeriksaan: semua bagian lengkap dan sesuai alokasi waktu.' },
}

/**
 * A provider with scripted answers and failures, for tests and for the
 * demo page without a real key (ai-provider-engine.md, Testing). It
 * honours the call's timeout and cancel signal like a real provider.
 */
export class FakeProvider implements AIProvider {
  readonly name = 'fake'

  /** Every call made, in order: which key, model and step, and what happened. */
  readonly calls: {
    credentialId: number
    model: string
    stepKey?: string
    attempt: number
    kind: FakeOutcome['kind']
  }[] = []

  constructor(
    private script: FakeScript,
    private defaultDelayMs = 0
  ) {}

  /** Answers with the given outcomes in order, then with `rest`. */
  static sequence(outcomes: FakeOutcome[], rest: FakeOutcome = { kind: 'ok' }, delayMs = 0) {
    return new FakeProvider(({ index }) => outcomes[index] ?? rest, delayMs)
  }

  /**
   * The demo scenarios. A new provider is made for every step, so
   * `index` counts the calls within one step.
   */
  static scenario(name: DemoScenario, delayMs: number) {
    return new FakeProvider(({ trace: { stepKey, run }, index }) => {
      if (stepKey !== 'content') {
        return { kind: 'ok' }
      }
      switch (name) {
        case 'rate_limited':
          // A 30 s suggested delay is too long to wait on the same key: fail over.
          return index === 0
            ? { kind: 'error', errorClass: 'rate_limited', httpStatus: 429, retryAfterMs: 30_000 }
            : { kind: 'ok' }
        case 'timeout':
          // Retried once on the same key, which then answers.
          return index === 0 ? { kind: 'hang' } : { kind: 'ok' }
        case 'empty_reply':
          return index === 0 ? { kind: 'empty' } : { kind: 'ok' }
        case 'fails_then_recovers':
          // Every key is busy on the first run; "Coba lagi" then works.
          return (run ?? 1) === 1
            ? { kind: 'error', errorClass: 'transient', httpStatus: 503, delayMs: 200 }
            : { kind: 'ok' }
        default:
          return { kind: 'ok' }
      }
    }, delayMs)
  }

  async generate(call: ProviderCall): Promise<AIResponse> {
    const outcome = this.script({ ...call, index: this.calls.length })
    this.calls.push({
      credentialId: call.credential.id,
      model: call.model,
      stepKey: call.trace.stepKey,
      attempt: call.trace.attempt,
      kind: outcome.kind,
    })

    if (outcome.kind === 'hang') {
      await sleep(call.timeoutMs, call.signal)
      throw new AIError('timeout', 'The scripted call did not answer in time')
    }

    const delayMs = outcome.delayMs ?? this.defaultDelayMs
    if (delayMs > call.timeoutMs) {
      await sleep(call.timeoutMs, call.signal)
      throw new AIError('timeout', 'The scripted call did not answer in time')
    }
    await sleep(delayMs, call.signal)

    if (outcome.kind === 'error') {
      throw new AIError(outcome.errorClass, `Scripted ${outcome.errorClass}`, {
        httpStatus: outcome.httpStatus,
        retryAfterMs: outcome.retryAfterMs,
      })
    }
    if (outcome.kind === 'empty') {
      throw new AIError('empty_reply', 'Scripted empty reply', { httpStatus: 200 })
    }

    const data = outcome.data ??
      sampleOutputs[call.trace.stepKey ?? ''] ?? { text: 'Hasil contoh.' }
    return {
      data,
      text: JSON.stringify(data),
      finishReason: 'STOP',
      inputTokens: 100,
      outputTokens: 50,
      model: call.model,
    }
  }
}

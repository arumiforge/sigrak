import app from '@adonisjs/core/services/app'
import type { AiConfig } from '#config/ai'
import type { AIProvider } from '#services/ai/contracts'
import { FakeProvider, demoScenarios, type DemoScenario } from '#services/ai/fake_provider'
import { GeminiProvider } from '#services/ai/gemini_provider'

export type ProviderContext = {
  /** A demo scenario from the generation's specification (fake driver only). */
  scenario?: string
}

type Factory = (context: ProviderContext) => AIProvider

let override: Factory | null = null

/**
 * Picks the provider for a step from config/ai.ts. The real Gemini path
 * is used only with AI_PROVIDER=gemini; otherwise every step runs on
 * the scripted fake provider. Tests swap the factory.
 */
export const aiProviders = {
  resolve(context: ProviderContext = {}): AIProvider {
    if (override) {
      return override(context)
    }
    const config = app.config.get<AiConfig>('ai')
    if (config.driver === 'gemini') {
      return new GeminiProvider(config.gemini.baseUrl)
    }
    const scenario = demoScenarios.includes(context.scenario as DemoScenario)
      ? (context.scenario as DemoScenario)
      : 'smooth'
    return FakeProvider.scenario(scenario, config.fake.callDelayMs)
  },

  swap(factory: Factory) {
    override = factory
  },

  restore() {
    override = null
  },
}

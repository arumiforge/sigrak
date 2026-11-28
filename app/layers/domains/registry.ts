import { Exception } from '@adonisjs/core/exceptions'
import type { DomainAdapter } from './domain_adapter.js'
import { extracurricularAdapter } from './extracurricular.js'

export class UnknownLayerDomainException extends Exception {
  static status = 404
  static code = 'E_UNKNOWN_LAYER_DOMAIN'
}

const adapters = new Map<string, DomainAdapter<any, any>>([
  [extracurricularAdapter.domain, extracurricularAdapter],
])

/**
 * The adapter of a layered domain. R1-08 registers `calendar` here.
 */
export function domainAdapter<V = Record<string, unknown>, P = Record<string, unknown>>(
  domain: string
): DomainAdapter<V, P> {
  const adapter = adapters.get(domain)
  if (!adapter) throw new UnknownLayerDomainException(`No layer adapter for domain "${domain}"`)
  return adapter as DomainAdapter<V, P>
}

/**
 * Registers an adapter (a later domain, or a test domain).
 */
export function registerDomainAdapter(adapter: DomainAdapter<any, any>) {
  adapters.set(adapter.domain, adapter)
}

export function layerDomains() {
  return [...adapters.keys()]
}

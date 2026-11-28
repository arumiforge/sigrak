/**
 * In-process cache of resolutions, keyed by a hash that holds the
 * school and the layer stamps (§5.4). Bounded (least recently used out
 * first) with a 24-hour lifetime; values are copied in and out so no
 * caller can change a cached value. No school's value is ever served to
 * another school: the school id is part of the key.
 */
export class ResolutionCache {
  #entries = new Map<string, { expires: number; value: unknown }>()

  constructor(
    private readonly maxEntries = 2000,
    private readonly ttlMs = 24 * 60 * 60 * 1000
  ) {}

  get<T>(key: string): T | undefined {
    const entry = this.#entries.get(key)
    if (!entry) return undefined
    if (entry.expires <= Date.now()) {
      this.#entries.delete(key)
      return undefined
    }
    this.#entries.delete(key)
    this.#entries.set(key, entry)
    return structuredClone(entry.value) as T
  }

  set(key: string, value: unknown) {
    this.#entries.delete(key)
    this.#entries.set(key, { expires: Date.now() + this.ttlMs, value: structuredClone(value) })
    while (this.#entries.size > this.maxEntries) {
      const oldest = this.#entries.keys().next().value as string
      this.#entries.delete(oldest)
    }
  }

  get size() {
    return this.#entries.size
  }

  clear() {
    this.#entries.clear()
  }
}

/**
 * A small seeded random generator (mulberry32), so a draft made with
 * the same seed and input is the same draft (D-262, Acak ulang).
 */
export function seededRandom(seed: number) {
  let state = seed >>> 0
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Random = ReturnType<typeof seededRandom>

/** Fisher–Yates shuffle in place with the given generator. */
export function shuffle<T>(items: T[], random: Random) {
  for (let index = items.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    ;[items[index], items[other]] = [items[other], items[index]]
  }
  return items
}

/** A new seed for a draft: a positive 31-bit integer. */
export function newSeed() {
  return 1 + Math.floor(Math.random() * 0x7ffffffe)
}

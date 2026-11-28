import { test } from '@japa/runner'
import {
  resolveLayers,
  type HideInput,
  type ItemInput,
  type PackageInput,
  type ResolveInput,
} from '#layers/resolver/resolve_core'
import { ResolutionCache } from '#layers/resolver/resolution_cache'
import type { Force, Layer, Line, PackageKind } from '#layers/types'

/**
 * Property-style checks of the resolver's algorithm
 * (docs/drafts/regional-layers.md §11.3) on seeded random layer stacks:
 * a small deterministic generator instead of a new dependency, so a
 * failure always reproduces from its seed.
 */

function generator(seed: number) {
  let state = seed >>> 0 || 1
  const next = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x1_0000_0000
  }
  return {
    int: (max: number) => Math.floor(next() * max),
    pick: <T>(values: readonly T[]) => values[Math.floor(next() * values.length)],
    chance: (p: number) => next() < p,
    shuffle: <T>(values: T[]) => {
      const copy = [...values]
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
      }
      return copy
    },
  }
}

const layerKinds: [Layer, PackageKind][] = [
  ['national', 'base'],
  ['province', 'official'],
  ['province', 'local_agreement'],
  ['regency', 'official'],
  ['district', 'local_agreement'],
  ['school', 'school'],
]

function randomStack(seed: number): ResolveInput {
  const g = generator(seed)
  const packages: PackageInput[] = []
  const items: ItemInput[] = []
  const hides: HideInput[] = []
  const pool = Array.from({ length: 12 }, (_, index) => `K${index}`)
  let id = 1
  for (const [layer, kind] of layerKinds) {
    const lines: Line[] = layer === 'national' || layer === 'school' ? ['all'] : ['all']
    if (layer === 'province' && g.chance(0.5)) lines.push('kemenag')
    for (const line of lines) {
      const pkg: PackageInput = {
        id: id++,
        code: `${layer}-${kind}-${line}`,
        name: `${layer} ${kind}`,
        layer,
        kind,
        line,
        version: 1 + g.int(5),
        regionName: layer === 'national' || layer === 'school' ? null : `Area ${layer}`,
        regionKind: layer === 'regency' ? 'kabupaten' : null,
        evidence: null,
      }
      packages.push(pkg)
      const count = 1 + g.int(5)
      const used = new Set<string>()
      for (let n = 0; n < count; n++) {
        const key = g.pick(pool)
        if (used.has(key)) continue
        used.add(key)
        const force: Force = layer === 'national' && g.chance(0.3) ? 'mandatory' : 'free'
        items.push({
          packageId: pkg.id,
          itemKey: key,
          matchKey: g.chance(0.8) ? key.toLowerCase() : `m${g.int(12)}`,
          shape: g.chance(0.15) ? 'setting' : 'list',
          force,
          origin: kind === 'base' ? 'sigrak' : kind === 'school' ? 'school' : (kind as never),
          groupKey: g.chance(0.2) ? 'scouting' : null,
          sourceRef: null,
          revision: 1,
          value: { label: key },
        })
      }
      if (layer !== 'national') {
        for (let n = 0; n < g.int(3); n++) {
          hides.push({ packageId: pkg.id, targetItemKey: g.pick(pool), reason: null })
        }
      }
    }
  }
  return {
    packages,
    items,
    hides,
    groupRules: g.chance(0.5)
      ? [{ groupKey: 'scouting', label: 'Kepanduan', min: 1, defaultItemKey: 'K0', line: 'all' }]
      : [],
    line: 'kemenag',
  }
}

const SEEDS = Array.from({ length: 200 }, (_, index) => index * 7919 + 13)

test.group('Layers | resolver properties', () => {
  test('mandatory national items with unique match keys are always in items', ({ assert }) => {
    for (const seed of SEEDS) {
      const input = randomStack(seed)
      const national = input.packages.find((pkg) => pkg.layer === 'national')!
      const matchCounts = new Map<string, number>()
      for (const item of input.items) {
        matchCounts.set(item.matchKey, (matchCounts.get(item.matchKey) ?? 0) + 1)
      }
      const result = resolveLayers(input)
      for (const item of input.items) {
        if (item.packageId !== national.id || item.force !== 'mandatory') continue
        const sameKeyNational = input.items.filter(
          (other) => other.packageId === national.id && other.matchKey === item.matchKey
        )
        if (sameKeyNational.length > 1) continue
        assert.isTrue(
          result.items.some(
            (entry) => entry.itemKey === item.itemKey && entry.source.layer === 'national'
          ),
          `seed ${seed}: mandatory ${item.itemKey} missing`
        )
      }
    }
  })

  test('no item key appears twice and every item names its source', ({ assert }) => {
    for (const seed of SEEDS) {
      const result = resolveLayers(randomStack(seed))
      const seen = new Set<string>()
      for (const item of result.items) {
        assert.isFalse(seen.has(item.itemKey), `seed ${seed}: ${item.itemKey} twice`)
        seen.add(item.itemKey)
        assert.isString(item.source.packageCode)
        assert.isString(item.source.layer)
      }
    }
  })

  test('items, hidden and shadowed together cover every item in scope exactly once', ({
    assert,
  }) => {
    for (const seed of SEEDS) {
      const input = randomStack(seed)
      const result = resolveLayers(input)
      const codeOf = new Map(input.packages.map((pkg) => [pkg.id, pkg.code]))
      const expected = input.items.map((item) => `${codeOf.get(item.packageId)}|${item.itemKey}`).sort()
      const actual = [...result.items, ...result.hidden, ...result.shadowed]
        .map((item) => `${item.source.packageCode}|${item.itemKey}`)
        .sort()
      assert.deepEqual(actual, expected, `seed ${seed}`)
    }
  })

  test('resolving twice, or with the input in another order, gives the same result', ({
    assert,
  }) => {
    for (const seed of SEEDS) {
      const input = randomStack(seed)
      const g = generator(seed + 1)
      const first = resolveLayers(input)
      assert.deepEqual(resolveLayers(input), first, `seed ${seed}: twice`)
      const shuffled: ResolveInput = {
        ...input,
        packages: g.shuffle(input.packages),
        items: g.shuffle(input.items),
        hides: g.shuffle(input.hides),
      }
      assert.deepEqual(resolveLayers(shuffled), first, `seed ${seed}: order`)
    }
  })

  test('adding a hide and taking it away gives the original result', ({ assert }) => {
    for (const seed of SEEDS) {
      const input = randomStack(seed)
      const before = resolveLayers(input)
      const school = input.packages.find((pkg) => pkg.layer === 'school')!
      const schoolKeys = new Set(
        input.items.filter((item) => item.packageId === school.id).map((item) => item.itemKey)
      )
      const target = before.items.find(
        (item) =>
          item.force !== 'mandatory' &&
          item.source.layer !== 'school' &&
          !schoolKeys.has(item.itemKey)
      )
      if (!target) continue
      const withHide = resolveLayers({
        ...input,
        hides: [...input.hides, { packageId: school.id, targetItemKey: target.itemKey, reason: null }],
      })
      if (!withHide.warnings.some((w) => w.kind === 'group_minimum')) {
        assert.notInclude(
          withHide.items.map((item) => item.itemKey),
          target.itemKey,
          `seed ${seed}`
        )
      }
      assert.deepEqual(resolveLayers({ ...input, hides: [...input.hides] }), before, `seed ${seed}`)
    }
  })
})

test.group('Layers | resolution cache', () => {
  test('copies values, evicts the oldest entry and expires', async ({ assert }) => {
    const cache = new ResolutionCache(2, 20)
    const value = { items: [1, 2] }
    cache.set('a', value)
    value.items.push(3)
    assert.deepEqual(cache.get('a'), { items: [1, 2] })
    cache.get<{ items: number[] }>('a')!.items.push(9)
    assert.deepEqual(cache.get('a'), { items: [1, 2] })
    cache.set('b', 1)
    cache.get('a')
    cache.set('c', 1)
    assert.isUndefined(cache.get('b'))
    assert.isDefined(cache.get('a'))
    await new Promise((resolve) => setTimeout(resolve, 30))
    assert.isUndefined(cache.get('a'))
  })
})

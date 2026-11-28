import { test } from '@japa/runner'
import { readdirSync, readFileSync } from 'node:fs'
import { join, matchesGlob, relative } from 'node:path'
import app from '@adonisjs/core/services/app'
import rcFile from '../../adonisrc.js'

/**
 * The production build copies only `metaFiles` besides the compiled code.
 * Every data folder the app reads at run time (`app.makePath('docs/data/…')`)
 * must be among them, or the built app fails where the dev server works
 * (R1-11: the Profil Jenjang were missing and /jadwal answered 500).
 */
function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [path]
  })
}

function dataFoldersReadByApp(): string[] {
  const folders = new Set<string>()
  for (const file of filesUnder(app.makePath('app'))) {
    if (!file.endsWith('.ts')) continue
    for (const match of readFileSync(file, 'utf8').matchAll(/['"`]docs\/data\/([a-z_-]+)/g)) {
      folders.add(match[1])
    }
  }
  return [...folders].sort()
}

test.group('Build | meta files', () => {
  test('every data folder the app reads is copied into the build', ({ assert }) => {
    const patterns = (rcFile.metaFiles ?? []).map((meta) => meta.pattern)
    const folders = dataFoldersReadByApp()
    assert.includeMembers(folders, ['profiles', 'curriculum', 'regions', 'calendar', 'catalogs'])

    for (const folder of folders) {
      const files = filesUnder(app.makePath('docs/data', folder)).filter((file) =>
        file.endsWith('.json')
      )
      assert.isAbove(files.length, 0, `docs/data/${folder} has no JSON files`)
      for (const file of files) {
        const path = relative(app.makePath(), file)
        assert.isTrue(
          patterns.some((pattern) => matchesGlob(path, pattern)),
          `${path} is read at run time but not in adonisrc.ts metaFiles`
        )
      }
    }
  })

  test('the owner material is not copied', ({ assert }) => {
    const patterns = (rcFile.metaFiles ?? []).map((meta) => meta.pattern)
    assert.isFalse(patterns.some((pattern) => matchesGlob('docs/sources/x.json', pattern)))
  })
})

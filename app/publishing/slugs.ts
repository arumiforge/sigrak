import type { QueryClientContract } from '@adonisjs/lucid/types/database'

/**
 * URL slugs for Kabar, Acara and Cerita Sekolah (D-149: plain
 * kebab-case): letters without accents, digits and hyphens, at most 80
 * characters. A taken slug gets "-2", "-3", …
 */
export function slugify(title: string) {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
  return slug || 'tulisan'
}

/** A slug for `title` that no other row of `table` uses. */
export async function uniqueSlug(
  client: QueryClientContract,
  table: 'announcements' | 'events' | 'stories',
  title: string,
  exceptId?: number
) {
  const base = slugify(title)
  const query = client
    .from(table)
    .where((where) => where.where('slug', base).orWhereLike('slug', `${base}-%`))
    .select('slug')
  if (exceptId !== undefined) query.whereNot('id', exceptId)
  const rows: { slug: string }[] = await query
  const taken = new Set(rows.map((row) => row.slug))
  if (!taken.has(base)) return base
  for (let index = 2; ; index++) {
    const candidate = `${base}-${index}`
    if (!taken.has(candidate)) return candidate
  }
}

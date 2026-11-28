import { useEffect, useId, useState } from 'react'
import { FormField, controlClass } from '~/components/patterns/form_field'
import { Icon } from '~/components/icon'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'

/**
 * The app targets of a Kabar (D-319): regions (province, kabupaten/kota
 * or kecamatan), named schools, levels and school roles. Empty parts
 * mean "all". Regions and schools are found by typing; the picker asks
 * /kabar/pilihan-sasaran, which only offers places inside the staff
 * member's scope (the server checks again on save).
 */
export type RegionOption = { id: number; name: string; kind: string; parentName: string | null }
export type SchoolOption = { id: number; name: string; npsn: string | null }

export type TargetValue = {
  regions: RegionOption[]
  schools: SchoolOption[]
  levels: string[]
  roles: string[]
}

export function useRegionLabel() {
  const t = useT()
  return (region: RegionOption) => {
    const label = t(`regions.kinds.${region.kind}`, { name: region.name })
    return region.parentName ? `${label}, ${region.parentName}` : label
  }
}

export const schoolLabel = (school: SchoolOption) =>
  school.npsn ? `${school.name} (${school.npsn})` : school.name

function useSearch<T>(kind: 'wilayah' | 'sekolah', query: string) {
  const term = query.trim()
  const [answer, setAnswer] = useState<{ term: string; items: T[] } | null>(null)
  useEffect(() => {
    if (term.length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/kabar/pilihan-sasaran?${kind}=${encodeURIComponent(term)}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        if (response.ok) {
          const body = (await response.json()) as { regions: T[]; schools: T[] }
          setAnswer({ term, items: kind === 'wilayah' ? body.regions : body.schools })
        }
      } catch {
        // An aborted or failed search leaves the last answer.
      }
    }, 250)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [kind, term])
  const ready = term.length >= 2 && answer?.term === term
  return { results: ready ? answer.items : null, loading: term.length >= 2 && !ready }
}

function Picker<T extends { id: number }>({
  kind,
  label,
  hint,
  chosen,
  optionLabel,
  onPick,
  onRemove,
}: {
  kind: 'wilayah' | 'sekolah'
  label: string
  hint: string
  chosen: T[]
  optionLabel: (item: T) => string
  onPick: (item: T) => void
  onRemove: (item: T) => void
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const { results, loading } = useSearch<T>(kind, query)
  const listId = useId()
  const fresh = (results ?? []).filter((item) => !chosen.some((picked) => picked.id === item.id))

  return (
    <div className="space-y-2">
      <FormField label={label} hint={hint}>
        {(field) => (
          <input
            {...field}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-controls={listId}
            autoComplete="off"
            className={cn(controlClass, 'h-11')}
          />
        )}
      </FormField>
      <div id={listId} aria-live="polite">
        {loading && (
          <p className="text-sm text-muted">{t('publishing.announcements.form.searching')}</p>
        )}
        {!loading && results !== null && fresh.length === 0 && (
          <p className="text-sm text-muted">{t('publishing.announcements.form.no_matches')}</p>
        )}
        {fresh.length > 0 && (
          <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
            {fresh.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onPick(item)}
                  aria-label={t('publishing.announcements.form.add_item', {
                    name: optionLabel(item),
                  })}
                  className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-tint"
                >
                  <Icon name="add" size={16} />
                  <span className="min-w-0 break-words">{optionLabel(item)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {chosen.map((item) => (
            <li
              key={item.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border bg-brand-tint py-0.5 pr-0.5 pl-3 text-sm font-medium text-brand-strong"
            >
              <span className="break-words">{optionLabel(item)}</span>
              <button
                type="button"
                onClick={() => onRemove(item)}
                aria-label={t('publishing.announcements.form.remove_item', {
                  name: optionLabel(item),
                })}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-surface"
              >
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function CheckboxGroup({
  legend,
  hint,
  options,
  value,
  onChange,
  error,
}: {
  legend: string
  hint?: string
  options: { value: string; label: string; hint?: string }[]
  value: string[]
  onChange: (value: string[]) => void
  error?: string
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{legend}</legend>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <div className="grid gap-1 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-surface-hover"
          >
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 accent-[var(--color-brand)]"
              checked={value.includes(option.value)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, option.value]
                    : value.filter((item) => item !== option.value)
                )
              }
            />
            <span>
              <span className="block">{option.label}</span>
              {option.hint && <span className="block text-xs text-muted">{option.hint}</span>}
            </span>
          </label>
        ))}
      </div>
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
    </fieldset>
  )
}

export function TargetEditor({
  value,
  onChange,
  levels,
  roles,
  error,
}: {
  value: TargetValue
  onChange: (value: TargetValue) => void
  levels: string[]
  roles: string[]
  error?: string
}) {
  const t = useT()
  const regionLabel = useRegionLabel()

  return (
    <div className="space-y-5">
      <Picker<RegionOption>
        kind="wilayah"
        label={t('publishing.announcements.form.region_search')}
        hint={t('publishing.announcements.form.region_search_hint')}
        chosen={value.regions}
        optionLabel={regionLabel}
        onPick={(region) => onChange({ ...value, regions: [...value.regions, region] })}
        onRemove={(region) =>
          onChange({ ...value, regions: value.regions.filter((r) => r.id !== region.id) })
        }
      />
      <Picker<SchoolOption>
        kind="sekolah"
        label={t('publishing.announcements.form.school_search')}
        hint={t('publishing.announcements.form.school_search_hint')}
        chosen={value.schools}
        optionLabel={schoolLabel}
        onPick={(school) => onChange({ ...value, schools: [...value.schools, school] })}
        onRemove={(school) =>
          onChange({ ...value, schools: value.schools.filter((s) => s.id !== school.id) })
        }
      />
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      <CheckboxGroup
        legend={t('publishing.announcements.form.levels')}
        hint={t('publishing.announcements.form.levels_hint')}
        options={levels.map((level) => ({
          value: level,
          label: t(`publishing.levels.${level}`),
        }))}
        value={value.levels}
        onChange={(selected) => onChange({ ...value, levels: selected })}
      />
      <CheckboxGroup
        legend={t('publishing.announcements.form.roles')}
        hint={t('publishing.announcements.form.roles_hint')}
        options={roles.map((role) => ({ value: role, label: t(`publishing.roles.${role}`) }))}
        value={value.roles}
        onChange={(selected) => onChange({ ...value, roles: selected })}
      />
    </div>
  )
}

import { useEffect, useId, useState } from 'react'
import { FormField, controlClass } from '~/components/patterns/form_field'
import { Icon } from '~/components/icon'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'

/**
 * The scope of one staff role (D-338): regions, named schools, levels
 * and fields, showing only the parts the role uses (app/staff/roles.ts,
 * sent as `roleScopes`). Regions and schools are found by typing; the
 * picker asks /staf/pilihan-cakupan. The parent form sends the value.
 */
export type RoleScopeRule = {
  area: 'none' | 'optional' | 'required'
  schools: boolean
  levels: boolean
  fields: boolean
}

export type RegionOption = { id: number; name: string; kind: string; parentName: string | null }
export type SchoolOption = { id: number; name: string; npsn: string | null }

export type ScopeValue = {
  regions: RegionOption[]
  schools: SchoolOption[]
  levels: string[]
  fields: string[]
}

export const emptyScope: ScopeValue = { regions: [], schools: [], levels: [], fields: [] }

/** The form fields the server reads (app/staff/validators.ts). */
export function scopePayload(scope: ScopeValue, rule: RoleScopeRule) {
  return {
    region_ids: rule.area === 'none' ? [] : scope.regions.map((region) => region.id),
    school_ids: rule.schools ? scope.schools.map((school) => school.id) : [],
    levels: rule.levels ? scope.levels : [],
    fields: rule.fields ? scope.fields : [],
  }
}

export function hasScopeParts(rule: RoleScopeRule) {
  return rule.area !== 'none' || rule.levels || rule.fields
}

export function useRegionLabel() {
  const t = useT()
  return (region: RegionOption) => {
    const label = t(`regions.kinds.${region.kind}`, { name: region.name })
    return region.parentName ? `${label}, ${region.parentName}` : label
  }
}

/**
 * Results for the typed term once the server answered (after a short
 * pause in typing); null while the term is too short or still loading.
 */
function useSearch<T>(kind: 'wilayah' | 'sekolah', query: string) {
  const term = query.trim()
  const [answer, setAnswer] = useState<{ term: string; items: T[] } | null>(null)
  useEffect(() => {
    if (term.length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/staf/pilihan-cakupan?${kind}=${encodeURIComponent(term)}`, {
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
  return {
    results: ready ? answer.items : null,
    loading: term.length >= 2 && !ready,
  }
}

function Chips<T extends { id: number }>({
  items,
  label,
  onRemove,
}: {
  items: T[]
  label: (item: T) => string
  onRemove: (item: T) => void
}) {
  const t = useT()
  if (items.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="inline-flex max-w-full items-center gap-1 rounded-full border bg-brand-tint py-0.5 pr-0.5 pl-3 text-sm font-medium text-brand-strong"
        >
          <span className="break-words">{label(item)}</span>
          <button
            type="button"
            onClick={() => onRemove(item)}
            aria-label={t('staff.scope.remove', { name: label(item) })}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-surface"
          >
            <Icon name="close" size={16} />
          </button>
        </li>
      ))}
    </ul>
  )
}

function Picker<T extends { id: number }>({
  kind,
  label,
  hint,
  chosen,
  optionLabel,
  onPick,
}: {
  kind: 'wilayah' | 'sekolah'
  label: string
  hint: string
  chosen: T[]
  optionLabel: (item: T) => string
  onPick: (item: T) => void
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
        {loading && <p className="text-sm text-muted">{t('staff.scope.searching')}</p>}
        {!loading && results !== null && fresh.length === 0 && (
          <p className="text-sm text-muted">{t('staff.scope.no_matches')}</p>
        )}
        {fresh.length > 0 && (
          <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
            {fresh.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onPick(item)}
                  aria-label={t('staff.scope.add', { name: optionLabel(item) })}
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
    </div>
  )
}

function CheckboxGroup({
  legend,
  hint,
  options,
  value,
  onChange,
}: {
  legend: string
  hint: string
  options: { value: string; label: string }[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{legend}</legend>
      <p className="text-xs text-muted">{hint}</p>
      <div className="grid gap-1 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-surface-hover"
          >
            <input
              type="checkbox"
              className="size-5 accent-[var(--color-brand)]"
              checked={value.includes(option.value)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, option.value]
                    : value.filter((item) => item !== option.value)
                )
              }
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function ScopeEditor({
  rule,
  fields,
  value,
  onChange,
}: {
  rule: RoleScopeRule
  fields: readonly string[]
  value: ScopeValue
  onChange: (value: ScopeValue) => void
}) {
  const t = useT()
  const regionLabel = useRegionLabel()
  const schoolLabel = (school: SchoolOption) =>
    school.npsn ? `${school.name} (${school.npsn})` : school.name

  if (!hasScopeParts(rule)) {
    return <p className="text-sm text-muted">{t('staff.scope.no_scope')}</p>
  }

  return (
    <div className="space-y-5">
      {rule.area !== 'none' && (
        <div className="space-y-2">
          <p
            className={cn(
              'text-sm',
              rule.area === 'required' && value.regions.length + value.schools.length === 0
                ? 'font-semibold text-warn'
                : 'text-muted'
            )}
          >
            {t(
              rule.area === 'required' ? 'staff.scope.area_required' : 'staff.scope.area_optional'
            )}
          </p>
          <Picker<RegionOption>
            kind="wilayah"
            label={t('staff.scope.region_search')}
            hint={t('staff.scope.region_search_hint')}
            chosen={value.regions}
            optionLabel={regionLabel}
            onPick={(region) => onChange({ ...value, regions: [...value.regions, region] })}
          />
          <Chips
            items={value.regions}
            label={regionLabel}
            onRemove={(region) =>
              onChange({ ...value, regions: value.regions.filter((r) => r.id !== region.id) })
            }
          />
        </div>
      )}
      {rule.schools && (
        <div className="space-y-2">
          <Picker<SchoolOption>
            kind="sekolah"
            label={t('staff.scope.school_search')}
            hint={t('staff.scope.school_search_hint')}
            chosen={value.schools}
            optionLabel={schoolLabel}
            onPick={(school) => onChange({ ...value, schools: [...value.schools, school] })}
          />
          <Chips
            items={value.schools}
            label={schoolLabel}
            onRemove={(school) =>
              onChange({ ...value, schools: value.schools.filter((s) => s.id !== school.id) })
            }
          />
        </div>
      )}
      {rule.levels && (
        <CheckboxGroup
          legend={t('staff.scope.levels')}
          hint={t('staff.scope.levels_hint')}
          options={['sd', 'mi'].map((level) => ({
            value: level,
            label: t(`staff.levels.${level}`),
          }))}
          value={value.levels}
          onChange={(levels) => onChange({ ...value, levels })}
        />
      )}
      {rule.fields && (
        <CheckboxGroup
          legend={t('staff.scope.fields')}
          hint={t('staff.scope.fields_hint')}
          options={fields.map((field) => ({ value: field, label: t(`staff.fields.${field}`) }))}
          value={value.fields}
          onChange={(selected) => onChange({ ...value, fields: selected })}
        />
      )}
    </div>
  )
}

/** A one-line summary of a scope for lists ("Kabupaten Uji · SD"). */
export function ScopeSummary({ rule, value }: { rule: RoleScopeRule; value: ScopeValue }) {
  const t = useT()
  const regionLabel = useRegionLabel()
  if (!hasScopeParts(rule)) return <span>{t('staff.scope.no_scope')}</span>
  const parts: string[] = []
  if (rule.area !== 'none') {
    const places = [...value.regions.map(regionLabel), ...value.schools.map((s) => s.name)]
    if (places.length > 0) parts.push(places.join('; '))
    else if (rule.area === 'optional') parts.push(t('staff.scope.everywhere'))
  }
  if (rule.levels) {
    parts.push(
      value.levels.length > 0
        ? value.levels.map((level) => t(`staff.levels.${level}`)).join(', ')
        : t('staff.scope.all_levels')
    )
  }
  if (rule.fields) {
    parts.push(
      value.fields.length > 0
        ? value.fields.map((field) => t(`staff.fields.${field}`)).join(', ')
        : t('staff.scope.all_fields')
    )
  }
  const empty = rule.area === 'required' && value.regions.length + value.schools.length === 0
  return (
    <span className={cn(empty && 'font-semibold text-warn')}>
      {empty ? t('staff.scope.nothing_yet') : parts.join(' · ')}
    </span>
  )
}

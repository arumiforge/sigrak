import { FormField, controlClass } from '~/components/patterns/form_field'
import { useT } from '~/lib/i18n'

export type RegionOptions = {
  regions: { id: number; name: string; kind: string }[]
  /** False when the staff member's area limits the choice (no "no region"). */
  unlimited: boolean
}

/**
 * Kabupaten/kota and level of a problem, as two selects. Staff with an
 * area only see the kabupaten/kota inside it and must pick one.
 */
export function PlaceFields({
  options,
  levels,
  regionId,
  level,
  errors,
  onRegion,
  onLevel,
}: {
  options: RegionOptions
  levels: string[]
  regionId: number | null
  level: string | null
  errors: { region_id?: string; level?: string }
  onRegion: (value: number | null) => void
  onLevel: (value: string | null) => void
}) {
  const t = useT()
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        label={t('problems.fields.region')}
        hint={
          options.unlimited
            ? t('problems.fields.region_hint')
            : t('problems.fields.region_scoped_hint')
        }
        error={errors.region_id}
      >
        {(field) => (
          <select
            {...field}
            name="region_id"
            value={regionId ? String(regionId) : ''}
            required={!options.unlimited}
            onChange={(event) => onRegion(event.target.value ? Number(event.target.value) : null)}
            className={controlClass}
          >
            <option value="">
              {options.unlimited
                ? t('problems.fields.no_region')
                : t('problems.fields.pick_region')}
            </option>
            {options.regions.map((region) => (
              <option key={region.id} value={region.id}>
                {t(`regions.kinds.${region.kind}`, { name: region.name })}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <FormField label={t('problems.fields.level')} error={errors.level}>
        {(field) => (
          <select
            {...field}
            name="level"
            value={level ?? ''}
            onChange={(event) => onLevel(event.target.value || null)}
            className={controlClass}
          >
            <option value="">{t('problems.fields.all_levels')}</option>
            {levels.map((value) => (
              <option key={value} value={value}>
                {t(`problems.levels.${value}`)}
              </option>
            ))}
          </select>
        )}
      </FormField>
    </div>
  )
}

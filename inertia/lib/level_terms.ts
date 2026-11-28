import { useT } from '~/lib/i18n'
import {
  levelTermParams,
  type LevelTermParams,
  type LevelTermSource,
} from '../../app/services/i18n/level_terms'

export type { LevelTermParams, LevelTermSource }
export { levelTermParams }

/**
 * Level terms as translation parameters (D-383):
 * t('classes.homeroom_hint', { ...useLevelTerms(level) }).
 */
export function useLevelTerms(source: LevelTermSource): LevelTermParams {
  const t = useT()
  return levelTermParams(t, source)
}

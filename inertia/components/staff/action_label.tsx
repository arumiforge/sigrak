import { useT } from '~/lib/i18n'

/** The words of a logged action (`staff.audit.actions.*`), or the raw key for an unknown one. */
export function actionText(t: ReturnType<typeof useT>, action: string) {
  const key = `staff.audit.actions.${action}`
  const label = t(key)
  return label === key ? action : label
}

/** "Peran diberikan: Penjualan" from a log action and its role. */
export function ActionLabel({ action, role }: { action: string; role?: string | null }) {
  const t = useT()
  const text = actionText(t, action)
  return <>{role ? `${text}: ${t(`staff.roles.${role}`)}` : text}</>
}

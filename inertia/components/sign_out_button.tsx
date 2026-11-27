import { Form } from '@inertiajs/react'
import { Button } from '~/components/ui/button'
import { Icon } from '~/components/icon'
import { useT } from '~/lib/i18n'

/**
 * POST /keluar on the current host (icon + text, design system).
 */
export function SignOutButton() {
  const t = useT()

  return (
    <Form action="/keluar" method="post">
      {({ processing }) => (
        <Button type="submit" variant="ghost" disabled={processing}>
          <Icon name="logout" />
          {t('common.nav.sign_out')}
        </Button>
      )}
    </Form>
  )
}

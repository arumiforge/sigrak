import { useState, type ComponentProps } from 'react'
import { TextField } from '~/components/text_field'
import { Icon } from '~/components/icon'
import { useT } from '~/lib/i18n'

type PasswordFieldProps = Omit<ComponentProps<typeof TextField>, 'type' | 'trailing'>

/**
 * A password input with a show/hide button (44 px touch target).
 */
export function PasswordField(props: PasswordFieldProps) {
  const t = useT()
  const [visible, setVisible] = useState(false)

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          className="flex size-11 items-center justify-center text-muted hover:text-text"
          aria-label={visible ? t('auth.actions.hide_password') : t('auth.actions.show_password')}
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
        >
          <Icon name={visible ? 'eye-off' : 'eye'} />
        </button>
      }
    />
  )
}

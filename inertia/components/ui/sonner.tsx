import type { CSSProperties } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { Icon } from '~/components/icon'
import { useIsDesktop } from '~/lib/media'

/**
 * Toasts placed per Fondasi feedback.md: bottom-right on desktop,
 * top-centre on phones (clear of the bottom navigation); at most 3; a
 * close button; at least 5 s. Colours come from the tokens; the status
 * shows as an icon in the status colour, never colour alone.
 */
const Toaster = (props: ToasterProps) => {
  const wide = useIsDesktop()

  return (
    <Sonner
      theme="system"
      className="toaster group"
      position={wide ? 'bottom-right' : 'top-center'}
      visibleToasts={3}
      closeButton
      duration={6000}
      icons={{
        success: <Icon name="success" size={18} className="text-ok" />,
        info: <Icon name="info" size={18} className="text-info" />,
        warning: <Icon name="warning" size={18} className="text-warn" />,
        error: <Icon name="error" size={18} className="text-danger" />,
        loading: <Icon name="loading" size={18} className="text-muted" />,
        close: <Icon name="close" size={14} />,
      }}
      toastOptions={{
        classNames: {
          toast: 'font-sans text-sm shadow-float',
          actionButton:
            '!min-h-9 !rounded-md !bg-brand-tint !px-3 !text-sm !font-semibold !text-brand-strong hover:!bg-brand hover:!text-on-brand',
        },
      }}
      style={
        {
          '--normal-bg': 'var(--surface)',
          '--normal-text': 'var(--text)',
          '--normal-border': 'var(--border-line)',
          '--border-radius': 'var(--radius-card)',
          '--width': '380px',
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }

import { useSyncExternalStore } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { Icon } from '~/components/icon'

const wideQuery = '(min-width: 640px)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(wideQuery)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/**
 * Toasts placed per Fondasi feedback.md: bottom-right on desktop,
 * top-centre on phones; at most 3; a close button; at least 5 s.
 */
const Toaster = (props: ToasterProps) => {
  const wide = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(wideQuery).matches,
    () => true
  )

  return (
    <Sonner
      theme="system"
      className="toaster group"
      position={wide ? 'bottom-right' : 'top-center'}
      visibleToasts={3}
      closeButton
      duration={6000}
      icons={{
        success: <Icon name="success" size={16} />,
        info: <Icon name="info" size={16} />,
        warning: <Icon name="warning" size={16} />,
        error: <Icon name="error" size={16} />,
        loading: <Icon name="loading" size={16} />,
        close: <Icon name="close" size={14} />,
      }}
      style={
        {
          '--normal-bg': 'var(--surface)',
          '--normal-text': 'var(--text)',
          '--normal-border': 'var(--border-line)',
          '--border-radius': '10px',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }

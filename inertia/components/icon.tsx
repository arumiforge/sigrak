import type { SVGProps } from 'react'
import { cn } from '~/lib/utils'

/**
 * The one place icons come from. SIGRAK uses Hugeicons Pro (D-402); the
 * owner uploads the licensed files later. Until then every name renders
 * a neutral placeholder glyph of the right size, so swapping in the real
 * set changes only this file.
 */
export const iconNames = [
  'calendar',
  'chevron-left',
  'chevron-right',
  'list',
  'grid',
  'logout',
  'success',
  'error',
  'info',
  'warning',
  'loading',
  'close',
  'eye',
  'eye-off',
  'lab',
  'user',
  'users',
  'mail',
  'school',
  'settings',
  'switch',
  'search',
] as const

export type IconName = (typeof iconNames)[number]

type IconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: IconName
  /** Pixel size; 20 by default, 24 in the bottom nav (design system). */
  size?: number
  /** Accessible label. Without it the icon is decorative (aria-hidden). */
  label?: string
}

/**
 * Placeholder shapes: simple strokes that hint at the meaning, drawn in
 * currentColor at a 1.5 px stroke.
 */
const placeholderPaths: Partial<Record<IconName, string>> = {
  'chevron-left': 'M14 6l-6 6 6 6',
  'chevron-right': 'M10 6l6 6-6 6',
  'close': 'M6 6l12 12M18 6L6 18',
  'list': 'M5 7h14M5 12h14M5 17h14',
  'grid': 'M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z',
  'calendar': 'M5 6h14v13H5zM5 10h14M9 4v4M15 4v4',
  'success': 'M7 12.5l3 3 7-7',
  'error': 'M12 7v6M12 16.5v.5',
  'warning': 'M12 8v5M12 16.5v.5',
  'info': 'M12 11v6M12 7.5v.5',
  'lab': 'M9.5 4h5M10.5 4v5.5L6 18.5h12l-4.5-9V4M8 14.5h8',
  'user': 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0',
  'users':
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 19a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 13.5a6 6 0 0 1 3 5.5',
  'mail': 'M4 6h16v12H4zM4 7l8 6 8-6',
  'school': 'M3 9l9-5 9 5-9 5zM7 11.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5',
  'settings':
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
  'switch': 'M7 7h12l-3-3M17 17H5l3 3',
  'search': 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16 16l4 4',
}

export function Icon({ name, size = 20, label, className, ...props }: IconProps) {
  const path = placeholderPaths[name]

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      data-icon={name}
      className={cn('shrink-0', name === 'loading' && 'animate-spin', className)}
      {...props}
    >
      {path ? (
        <path d={path} />
      ) : name === 'loading' ? (
        <path d="M12 4a8 8 0 1 0 8 8" />
      ) : (
        <circle cx="12" cy="12" r="7" />
      )}
    </svg>
  )
}

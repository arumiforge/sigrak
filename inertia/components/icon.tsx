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

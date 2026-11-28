import { useSyncExternalStore } from 'react'

/**
 * Media queries the shell reacts to. Phones are below 640 px (tables
 * become cards, dialogs become bottom sheets); the sidebar appears from
 * 1024 px (`lg`).
 */
export const DESKTOP_QUERY = '(min-width: 640px)'
export const SIDEBAR_QUERY = '(min-width: 1024px)'
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function matches(query: string) {
  return typeof window !== 'undefined' && window.matchMedia(query).matches
}

export function useMediaQuery(query: string, serverValue = false) {
  return useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', notify)
      return () => media.removeEventListener('change', notify)
    },
    () => window.matchMedia(query).matches,
    () => serverValue
  )
}

/** 640 px and wider: dialogs, popovers and tables instead of sheets and cards. */
export function useIsDesktop() {
  return useMediaQuery(DESKTOP_QUERY, true)
}

/** The visitor asked for less motion (OS setting). */
export function usePrefersReducedMotion() {
  return useMediaQuery(REDUCED_MOTION_QUERY)
}

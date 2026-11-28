import type { SVGProps } from 'react'
import { cn } from '~/lib/utils'

/*
 * Hugeicons Pro under the owner's licence (D-402, D-434). Only the files
 * named here are bundled: each is a static `?raw` import, so the other
 * ~7,300 licensed SVGs never reach the build. Rounded Stroke is the
 * default style; Rounded Solid is for active and selected states only
 * (bottom nav, sidebar). Components never import the SVG files; they
 * use <Icon name="…" />.
 */
import calendarSvg from '~/icons/hugeicons/rounded-stroke/date-and-time/calendar-03.svg?raw'
import timetableSvg from '~/icons/hugeicons/rounded-stroke/date-and-time/time-schedule.svg?raw'
import schoolYearsSvg from '~/icons/hugeicons/rounded-stroke/date-and-time/calendar-04.svg?raw'
import todaySvg from '~/icons/hugeicons/rounded-stroke/home/home-01.svg?raw'
import homeSvg from '~/icons/hugeicons/rounded-stroke/dashboard/dashboard-square-01.svg?raw'
import chevronLeftSvg from '~/icons/hugeicons/rounded-stroke/arrows-round/arrow-left-01-round.svg?raw'
import chevronRightSvg from '~/icons/hugeicons/rounded-stroke/arrows-round/arrow-right-01-round.svg?raw'
import chevronDownSvg from '~/icons/hugeicons/rounded-stroke/arrows-round/arrow-down-01-round.svg?raw'
import menuSvg from '~/icons/hugeicons/rounded-stroke/more-menu/menu-01.svg?raw'
import moreSvg from '~/icons/hugeicons/rounded-stroke/more-menu/more-horizontal.svg?raw'
import listSvg from '~/icons/hugeicons/rounded-stroke/edit-formatting/check-list.svg?raw'
import gridSvg from '~/icons/hugeicons/rounded-stroke/dashboard/dashboard-square-02.svg?raw'
import logoutSvg from '~/icons/hugeicons/rounded-stroke/login-logout/logout-03.svg?raw'
import successSvg from '~/icons/hugeicons/rounded-stroke/check-validation/checkmark-circle-02.svg?raw'
import errorSvg from '~/icons/hugeicons/rounded-stroke/alert-notification/alert-circle.svg?raw'
import infoSvg from '~/icons/hugeicons/rounded-stroke/alert-notification/information-circle.svg?raw'
import warningSvg from '~/icons/hugeicons/rounded-stroke/alert-notification/alert-02.svg?raw'
import loadingSvg from '~/icons/hugeicons/rounded-stroke/arrows-round/circle-arrow-reload-01-round.svg?raw'
import closeSvg from '~/icons/hugeicons/rounded-stroke/add-remove-delete/cancel-01.svg?raw'
import eyeSvg from '~/icons/hugeicons/rounded-stroke/edit-formatting/view.svg?raw'
import eyeOffSvg from '~/icons/hugeicons/rounded-stroke/edit-formatting/view-off.svg?raw'
import labSvg from '~/icons/hugeicons/rounded-stroke/science-technology/test-tube.svg?raw'
import userSvg from '~/icons/hugeicons/rounded-stroke/users/user.svg?raw'
import usersSvg from '~/icons/hugeicons/rounded-stroke/users/user-group.svg?raw'
import teachersSvg from '~/icons/hugeicons/rounded-stroke/users/user-multiple.svg?raw'
import mailSvg from '~/icons/hugeicons/rounded-stroke/communications/mail-01.svg?raw'
import schoolSvg from '~/icons/hugeicons/rounded-stroke/education/school.svg?raw'
import classesSvg from '~/icons/hugeicons/rounded-stroke/education/desk.svg?raw'
import settingsSvg from '~/icons/hugeicons/rounded-stroke/settings/setting-01.svg?raw'
import switchSvg from '~/icons/hugeicons/rounded-stroke/users/user-switch.svg?raw'
import searchSvg from '~/icons/hugeicons/rounded-stroke/search/search.svg?raw'
import extracurricularSvg from '~/icons/hugeicons/rounded-stroke/award-reward/medal-01.svg?raw'
import packagesSvg from '~/icons/hugeicons/rounded-stroke/location-map/maps-location-01.svg?raw'
import proposalsSvg from '~/icons/hugeicons/rounded-stroke/note-task/note-edit.svg?raw'
import directorySvg from '~/icons/hugeicons/rounded-stroke/education/library.svg?raw'
import regionSvg from '~/icons/hugeicons/rounded-stroke/location-map/location-01.svg?raw'
import addSvg from '~/icons/hugeicons/rounded-stroke/add-remove-delete/add-01.svg?raw'
import deleteSvg from '~/icons/hugeicons/rounded-stroke/add-remove-delete/delete-02.svg?raw'
import undoSvg from '~/icons/hugeicons/rounded-stroke/arrows-round/arrow-turn-backward-round.svg?raw'
import inboxSvg from '~/icons/hugeicons/rounded-stroke/communications/inbox.svg?raw'
import checkSvg from '~/icons/hugeicons/rounded-stroke/check-validation/tick-02.svg?raw'
import calendarSolidSvg from '~/icons/hugeicons/rounded-solid/date-and-time/calendar-03.svg?raw'
import timetableSolidSvg from '~/icons/hugeicons/rounded-solid/date-and-time/time-schedule.svg?raw'
import schoolYearsSolidSvg from '~/icons/hugeicons/rounded-solid/date-and-time/calendar-04.svg?raw'
import todaySolidSvg from '~/icons/hugeicons/rounded-solid/home/home-01.svg?raw'
import homeSolidSvg from '~/icons/hugeicons/rounded-solid/dashboard/dashboard-square-01.svg?raw'
import listSolidSvg from '~/icons/hugeicons/rounded-solid/edit-formatting/check-list.svg?raw'
import gridSolidSvg from '~/icons/hugeicons/rounded-solid/dashboard/dashboard-square-02.svg?raw'
import labSolidSvg from '~/icons/hugeicons/rounded-solid/science-technology/test-tube.svg?raw'
import userSolidSvg from '~/icons/hugeicons/rounded-solid/users/user.svg?raw'
import usersSolidSvg from '~/icons/hugeicons/rounded-solid/users/user-group.svg?raw'
import teachersSolidSvg from '~/icons/hugeicons/rounded-solid/users/user-multiple.svg?raw'
import schoolSolidSvg from '~/icons/hugeicons/rounded-solid/education/school.svg?raw'
import classesSolidSvg from '~/icons/hugeicons/rounded-solid/education/desk.svg?raw'
import settingsSolidSvg from '~/icons/hugeicons/rounded-solid/settings/setting-01.svg?raw'
import extracurricularSolidSvg from '~/icons/hugeicons/rounded-solid/award-reward/medal-01.svg?raw'
import packagesSolidSvg from '~/icons/hugeicons/rounded-solid/location-map/maps-location-01.svg?raw'
import proposalsSolidSvg from '~/icons/hugeicons/rounded-solid/note-task/note-edit.svg?raw'
import directorySolidSvg from '~/icons/hugeicons/rounded-solid/education/library.svg?raw'
import regionSolidSvg from '~/icons/hugeicons/rounded-solid/location-map/location-01.svg?raw'
import staffSvg from '~/icons/hugeicons/rounded-stroke/users/user-shield-01.svg?raw'
import staffSolidSvg from '~/icons/hugeicons/rounded-solid/users/user-shield-01.svg?raw'
import accessSvg from '~/icons/hugeicons/rounded-stroke/security/security-check.svg?raw'
import accessSolidSvg from '~/icons/hugeicons/rounded-solid/security/security-check.svg?raw'
import activitySvg from '~/icons/hugeicons/rounded-stroke/note-task/task-daily-01.svg?raw'
import activitySolidSvg from '~/icons/hugeicons/rounded-solid/note-task/task-daily-01.svg?raw'
import healthSvg from '~/icons/hugeicons/rounded-stroke/medical/cardiogram-01.svg?raw'
import healthSolidSvg from '~/icons/hugeicons/rounded-solid/medical/cardiogram-01.svg?raw'

/** SIGRAK icon names → Rounded Stroke file. */
const strokeIcons = {
  'calendar': calendarSvg,
  'timetable': timetableSvg,
  'school-years': schoolYearsSvg,
  'today': todaySvg,
  'home': homeSvg,
  'chevron-left': chevronLeftSvg,
  'chevron-right': chevronRightSvg,
  'chevron-down': chevronDownSvg,
  'menu': menuSvg,
  'more': moreSvg,
  'list': listSvg,
  'grid': gridSvg,
  'logout': logoutSvg,
  'success': successSvg,
  'error': errorSvg,
  'info': infoSvg,
  'warning': warningSvg,
  'loading': loadingSvg,
  'close': closeSvg,
  'eye': eyeSvg,
  'eye-off': eyeOffSvg,
  'lab': labSvg,
  'user': userSvg,
  'users': usersSvg,
  'teachers': teachersSvg,
  'mail': mailSvg,
  'school': schoolSvg,
  'classes': classesSvg,
  'settings': settingsSvg,
  'switch': switchSvg,
  'search': searchSvg,
  'extracurricular': extracurricularSvg,
  'packages': packagesSvg,
  'proposals': proposalsSvg,
  'directory': directorySvg,
  'region': regionSvg,
  'add': addSvg,
  'delete': deleteSvg,
  'undo': undoSvg,
  'inbox': inboxSvg,
  'check': checkSvg,
  'staff': staffSvg,
  'access': accessSvg,
  'activity': activitySvg,
  'health': healthSvg,
} as const

export type IconName = keyof typeof strokeIcons

export const iconNames = Object.keys(strokeIcons) as IconName[]

/** Rounded Solid twins, for the icons that can mark an active item. */
const solidIcons: Partial<Record<IconName, string>> = {
  'calendar': calendarSolidSvg,
  'timetable': timetableSolidSvg,
  'school-years': schoolYearsSolidSvg,
  'today': todaySolidSvg,
  'home': homeSolidSvg,
  'list': listSolidSvg,
  'grid': gridSolidSvg,
  'lab': labSolidSvg,
  'user': userSolidSvg,
  'users': usersSolidSvg,
  'teachers': teachersSolidSvg,
  'school': schoolSolidSvg,
  'classes': classesSolidSvg,
  'settings': settingsSolidSvg,
  'extracurricular': extracurricularSolidSvg,
  'packages': packagesSolidSvg,
  'proposals': proposalsSolidSvg,
  'directory': directorySolidSvg,
  'region': regionSolidSvg,
  'staff': staffSolidSvg,
  'access': accessSolidSvg,
  'activity': activitySolidSvg,
  'health': healthSolidSvg,
}

type ParsedIcon = { viewBox: string; body: string }

const parsed = new Map<string, ParsedIcon>()

/**
 * The licensed files draw in #141B34; the colour becomes currentColor
 * so icons follow the text colour and the dark theme.
 */
function parse(raw: string): ParsedIcon {
  const cached = parsed.get(raw)
  if (cached) return cached
  const viewBox = /viewBox="([^"]+)"/.exec(raw)?.[1] ?? '0 0 24 24'
  const body = raw
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/#141B34/gi, 'currentColor')
    .trim()
  const icon = { viewBox, body }
  parsed.set(raw, icon)
  return icon
}

type IconProps = Omit<SVGProps<SVGSVGElement>, 'name' | 'dangerouslySetInnerHTML'> & {
  name: IconName
  /** Pixel size; 20 by default, 24 in the bottom nav (design system). */
  size?: number
  /** Rounded Solid, for an active or selected item (D-434). */
  active?: boolean
  /** Accessible label. Without it the icon is decorative (aria-hidden). */
  label?: string
}

export function Icon({ name, size = 20, active = false, label, className, ...props }: IconProps) {
  const raw = (active ? solidIcons[name] : undefined) ?? strokeIcons[name]
  const { viewBox, body } = parse(raw)

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      data-icon={name}
      data-active={active || undefined}
      className={cn(
        'shrink-0',
        name === 'loading' && 'animate-spin motion-reduce:animate-none',
        className
      )}
      // The SVG bodies are the licensed files checked at import (no
      // scripts, handlers or links); see inertia/icons/hugeicons/README.md.
      dangerouslySetInnerHTML={{ __html: body }}
      {...props}
    />
  )
}

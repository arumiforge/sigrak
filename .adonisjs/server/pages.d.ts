import '@adonisjs/inertia/types'

import type React from 'react'
import type { Prettify } from '@adonisjs/core/types/common'

type ExtractProps<T> =
  T extends React.FC<infer Props>
    ? Prettify<Omit<Props, 'children'>>
    : T extends React.Component<infer Props>
      ? Prettify<Omit<Props, 'children'>>
      : never

declare module '@adonisjs/inertia/types' {
  export interface InertiaPages {
    'accounts/account': ExtractProps<(typeof import('../../inertia/pages/accounts/account.tsx'))['default']>
    'accounts/switch_role': ExtractProps<(typeof import('../../inertia/pages/accounts/switch_role.tsx'))['default']>
    'accounts/teachers': ExtractProps<(typeof import('../../inertia/pages/accounts/teachers.tsx'))['default']>
    'admin/calendar': ExtractProps<(typeof import('../../inertia/pages/admin/calendar.tsx'))['default']>
    'admin/home': ExtractProps<(typeof import('../../inertia/pages/admin/home.tsx'))['default']>
    'admin/layers/area_proposals': ExtractProps<(typeof import('../../inertia/pages/admin/layers/area_proposals.tsx'))['default']>
    'admin/region_changes': ExtractProps<(typeof import('../../inertia/pages/admin/region_changes.tsx'))['default']>
    'admin/school_directory': ExtractProps<(typeof import('../../inertia/pages/admin/school_directory.tsx'))['default']>
    'auth/confirm_email': ExtractProps<(typeof import('../../inertia/pages/auth/confirm_email.tsx'))['default']>
    'auth/forgot_password': ExtractProps<(typeof import('../../inertia/pages/auth/forgot_password.tsx'))['default']>
    'auth/invitation': ExtractProps<(typeof import('../../inertia/pages/auth/invitation.tsx'))['default']>
    'auth/login': ExtractProps<(typeof import('../../inertia/pages/auth/login.tsx'))['default']>
    'auth/reset_password': ExtractProps<(typeof import('../../inertia/pages/auth/reset_password.tsx'))['default']>
    'auth/sign_up': ExtractProps<(typeof import('../../inertia/pages/auth/sign_up.tsx'))['default']>
    'auth/two_factor_challenge': ExtractProps<(typeof import('../../inertia/pages/auth/two_factor_challenge.tsx'))['default']>
    'console/access_matrix': ExtractProps<(typeof import('../../inertia/pages/console/access_matrix.tsx'))['default']>
    'console/account': ExtractProps<(typeof import('../../inertia/pages/console/account.tsx'))['default']>
    'console/activity_log': ExtractProps<(typeof import('../../inertia/pages/console/activity_log.tsx'))['default']>
    'console/ai_models': ExtractProps<(typeof import('../../inertia/pages/console/ai_models.tsx'))['default']>
    'console/integrations': ExtractProps<(typeof import('../../inertia/pages/console/integrations.tsx'))['default']>
    'console/school': ExtractProps<(typeof import('../../inertia/pages/console/school.tsx'))['default']>
    'console/schools': ExtractProps<(typeof import('../../inertia/pages/console/schools.tsx'))['default']>
    'console/settings': ExtractProps<(typeof import('../../inertia/pages/console/settings.tsx'))['default']>
    'console/staff_member': ExtractProps<(typeof import('../../inertia/pages/console/staff_member.tsx'))['default']>
    'console/staff': ExtractProps<(typeof import('../../inertia/pages/console/staff.tsx'))['default']>
    'console/system_health': ExtractProps<(typeof import('../../inertia/pages/console/system_health.tsx'))['default']>
    'console/two_factor_setup': ExtractProps<(typeof import('../../inertia/pages/console/two_factor_setup.tsx'))['default']>
    'console/users': ExtractProps<(typeof import('../../inertia/pages/console/users.tsx'))['default']>
    'errors/error': ExtractProps<(typeof import('../../inertia/pages/errors/error.tsx'))['default']>
    'exam/home': ExtractProps<(typeof import('../../inertia/pages/exam/home.tsx'))['default']>
    'school_year/academic_year_edit': ExtractProps<(typeof import('../../inertia/pages/school_year/academic_year_edit.tsx'))['default']>
    'school_year/academic_years': ExtractProps<(typeof import('../../inertia/pages/school_year/academic_years.tsx'))['default']>
    'school_year/class': ExtractProps<(typeof import('../../inertia/pages/school_year/class.tsx'))['default']>
    'school_year/classes': ExtractProps<(typeof import('../../inertia/pages/school_year/classes.tsx'))['default']>
    'school/ai_demo': ExtractProps<(typeof import('../../inertia/pages/school/ai_demo.tsx'))['default']>
    'school/calendar': ExtractProps<(typeof import('../../inertia/pages/school/calendar.tsx'))['default']>
    'school/layers/extracurriculars': ExtractProps<(typeof import('../../inertia/pages/school/layers/extracurriculars.tsx'))['default']>
    'school/layers/packages': ExtractProps<(typeof import('../../inertia/pages/school/layers/packages.tsx'))['default']>
    'school/layers/proposals': ExtractProps<(typeof import('../../inertia/pages/school/layers/proposals.tsx'))['default']>
    'timetable/class': ExtractProps<(typeof import('../../inertia/pages/timetable/class.tsx'))['default']>
    'timetable/compose': ExtractProps<(typeof import('../../inertia/pages/timetable/compose.tsx'))['default']>
    'timetable/draft': ExtractProps<(typeof import('../../inertia/pages/timetable/draft.tsx'))['default']>
    'timetable/index': ExtractProps<(typeof import('../../inertia/pages/timetable/index.tsx'))['default']>
    'timetable/mine': ExtractProps<(typeof import('../../inertia/pages/timetable/mine.tsx'))['default']>
  }
}

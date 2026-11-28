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
    'admin/home': ExtractProps<(typeof import('../../inertia/pages/admin/home.tsx'))['default']>
    'admin/layers/area_proposals': ExtractProps<(typeof import('../../inertia/pages/admin/layers/area_proposals.tsx'))['default']>
    'admin/region_changes': ExtractProps<(typeof import('../../inertia/pages/admin/region_changes.tsx'))['default']>
    'admin/school_directory': ExtractProps<(typeof import('../../inertia/pages/admin/school_directory.tsx'))['default']>
    'auth/login': ExtractProps<(typeof import('../../inertia/pages/auth/login.tsx'))['default']>
    'errors/error': ExtractProps<(typeof import('../../inertia/pages/errors/error.tsx'))['default']>
    'exam/home': ExtractProps<(typeof import('../../inertia/pages/exam/home.tsx'))['default']>
    'school/ai_demo': ExtractProps<(typeof import('../../inertia/pages/school/ai_demo.tsx'))['default']>
    'school/calendar': ExtractProps<(typeof import('../../inertia/pages/school/calendar.tsx'))['default']>
    'school/layers/extracurriculars': ExtractProps<(typeof import('../../inertia/pages/school/layers/extracurriculars.tsx'))['default']>
    'school/layers/packages': ExtractProps<(typeof import('../../inertia/pages/school/layers/packages.tsx'))['default']>
    'school/layers/proposals': ExtractProps<(typeof import('../../inertia/pages/school/layers/proposals.tsx'))['default']>
  }
}

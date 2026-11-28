import type { ComponentType, ReactNode } from 'react'
import AppLayout from '~/layouts/app_layout'
import AuthLayout from '~/layouts/auth_layout'
import ConsoleLayout from '~/layouts/console_layout'
import ErrorLayout from '~/layouts/error_layout'
import ExamLayout from '~/layouts/exam_layout'

type Layout = ComponentType<{ children: ReactNode }>

/**
 * The persistent layout of every page, by the page's folder (R1-12):
 * one place instead of a `Page.layout` line in each file. Inertia keeps
 * the layout mounted while the visitor moves between pages that share
 * it (D-389). A page that sets its own `layout` still wins.
 */
const layoutsByFolder: [prefix: string, layout: Layout][] = [
  ['auth/', AuthLayout],
  ['errors/', ErrorLayout],
  ['exam/', ExamLayout],
  ['admin/', ConsoleLayout],
  ['console/', ConsoleLayout],
]

export function layoutFor(page: string): Layout {
  return layoutsByFolder.find(([prefix]) => page.startsWith(prefix))?.[1] ?? AppLayout
}

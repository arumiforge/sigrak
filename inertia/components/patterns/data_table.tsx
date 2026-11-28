import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createColumnHelper, tableFeatures, useTable, type RowData } from '@tanstack/react-table'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { useIsDesktop } from '~/lib/media'
import { cn } from '~/lib/utils'

/**
 * A table on screens from 640 px and a card list on phones (design
 * system, Mobile rules: tables become card lists below 640 px). Built on
 * TanStack Table (row model) and TanStack Virtual: lists longer than
 * `virtualizeAbove` rows render only the rows in view, against the
 * window scroll, so a school's 900 pupils scroll smoothly on a phone.
 *
 * Columns name their header (Indonesian, from lang/id) and how a cell
 * renders. On a card, the `primary` column is the title, the others are
 * "Header: value" lines, and `rowActions` sit at the bottom.
 */
export type DataColumn<Row> = {
  id: string
  header: string
  cell: (row: Row) => ReactNode
  /** The card title on phones (one column). */
  primary?: boolean
  /** Left out of the card on phones (for example a column the title repeats). */
  hideOnCard?: boolean
  align?: 'left' | 'right'
  className?: string
}

const features = tableFeatures({})

export function DataTable<Row extends RowData>({
  rows,
  columns,
  getRowId,
  caption,
  empty,
  rowActions,
  virtualizeAbove = 60,
  estimateRowHeight = 56,
  estimateCardHeight = 140,
  className,
}: {
  rows: Row[]
  columns: DataColumn<Row>[]
  getRowId: (row: Row) => string
  /** Accessible name of the table (visually hidden). */
  caption: string
  /** Shown instead of the table when there are no rows (an EmptyState). */
  empty?: ReactNode
  rowActions?: (row: Row) => ReactNode
  virtualizeAbove?: number
  estimateRowHeight?: number
  estimateCardHeight?: number
  className?: string
}) {
  const desktop = useIsDesktop()
  const helper = useMemo(() => createColumnHelper<typeof features, Row>(), [])
  const tableColumns = useMemo(
    () =>
      helper.columns(
        columns.map((column) =>
          helper.display({
            id: column.id,
            header: column.header,
            cell: ({ row }) => column.cell(row.original),
          })
        )
      ),
    [helper, columns]
  )
  const table = useTable({
    features,
    columns: tableColumns,
    data: rows,
    getRowId: (row) => getRowId(row),
  })
  const modelRows = table.getRowModel().rows
  const byId = new Map(columns.map((column) => [column.id, column]))
  const primary = columns.find((column) => column.primary) ?? columns[0]

  const listRef = useRef<HTMLDivElement>(null)
  const [scrollMargin, setScrollMargin] = useState(0)
  const virtual = modelRows.length > virtualizeAbove
  useLayoutEffect(() => {
    if (!virtual || !listRef.current) return
    setScrollMargin(listRef.current.getBoundingClientRect().top + window.scrollY)
  }, [virtual, desktop])
  const virtualizer = useWindowVirtualizer({
    count: virtual ? modelRows.length : 0,
    estimateSize: () => (desktop ? estimateRowHeight : estimateCardHeight),
    overscan: 8,
    scrollMargin,
    getItemKey: (index) => modelRows[index]?.id ?? index,
  })
  const virtualItems = virtual ? virtualizer.getVirtualItems() : []
  const items = virtual
    ? virtualItems.map((item) => ({ index: item.index }))
    : modelRows.map((_, index) => ({ index }))
  const first = virtualItems[0]
  const last = virtualItems.at(-1)
  const paddingTop = first ? first.start - scrollMargin : 0
  const paddingBottom = last ? virtualizer.getTotalSize() - (last.end - scrollMargin) : 0

  if (rows.length === 0 && empty) return <>{empty}</>

  if (!desktop) {
    return (
      <div ref={listRef} className={className}>
        <ul
          aria-label={caption}
          className="flex flex-col gap-3"
          style={virtual ? { paddingTop, paddingBottom } : undefined}
        >
          {items.map(({ index }) => {
            const row = modelRows[index]
            return (
              <li
                key={row.id}
                data-index={index}
                ref={virtual ? virtualizer.measureElement : undefined}
                className="rounded-lg border bg-surface p-4"
                data-testid="data-card"
              >
                <div className="font-bold break-words">{primary.cell(row.original)}</div>
                <dl className="mt-2 space-y-1 text-sm">
                  {columns
                    .filter((column) => column !== primary && !column.hideOnCard)
                    .map((column) => (
                      <div key={column.id} className="flex flex-wrap gap-x-2">
                        <dt className="text-muted">{column.header}</dt>
                        <dd className="min-w-0 font-medium break-words">
                          {column.cell(row.original)}
                        </dd>
                      </div>
                    ))}
                </dl>
                {rowActions && (
                  <div className="mt-3 flex flex-wrap gap-2">{rowActions(row.original)}</div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <div ref={listRef} className={cn('overflow-x-auto rounded-lg border bg-surface', className)}>
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b bg-page/60">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const column = byId.get(header.column.id)
                return (
                  <th
                    key={header.id}
                    scope="col"
                    className={cn(
                      'px-4 py-3 text-xs font-semibold whitespace-nowrap text-muted',
                      column?.align === 'right' && 'text-right'
                    )}
                  >
                    {column?.header}
                  </th>
                )
              })}
              {rowActions && <th scope="col" className="w-0 px-4 py-3" />}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y">
          {paddingTop > 0 && (
            <tr aria-hidden>
              <td style={{ height: paddingTop }} colSpan={columns.length + (rowActions ? 1 : 0)} />
            </tr>
          )}
          {items.map(({ index }) => {
            const row = modelRows[index]
            return (
              <tr
                key={row.id}
                data-index={index}
                ref={virtual ? virtualizer.measureElement : undefined}
                className="hover:bg-surface-hover/60"
              >
                {row.getAllCells().map((cell) => {
                  const column = byId.get(cell.column.id)
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        'px-4 py-3 align-middle',
                        column?.align === 'right' && 'text-right',
                        column?.className
                      )}
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  )
                })}
                {rowActions && (
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-2">{rowActions(row.original)}</div>
                  </td>
                )}
              </tr>
            )
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden>
              <td
                style={{ height: paddingBottom }}
                colSpan={columns.length + (rowActions ? 1 : 0)}
              />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

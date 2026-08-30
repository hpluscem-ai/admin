import type { ReactNode } from 'react'

export type DataTableColumn<Row> = {
  key: string
  label: string
  render: (row: Row) => ReactNode
}

type DataTableProps<Row> = {
  columns: readonly DataTableColumn<Row>[]
  emptyMessage?: string
  getRowKey: (row: Row) => string
  rows: readonly Row[]
}

export function DataTable<Row>({ columns, emptyMessage, getRowKey, rows }: DataTableProps<Row>) {
  return (
    <div className="data-view__table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="data-table__spacer" aria-hidden="true">
            <td colSpan={columns.length} />
          </tr>
          {rows.length === 0 && emptyMessage ? (
            <tr>
              <td className="data-table__empty" colSpan={columns.length}>{emptyMessage}</td>
            </tr>
          ) : rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

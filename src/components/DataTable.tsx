import type { ReactNode } from 'react'

export type DataTableColumn<Row> = {
  key: string
  label: string
  render: (row: Row) => ReactNode
}

type DataTableProps<Row> = {
  columns: readonly DataTableColumn<Row>[]
  getRowKey: (row: Row) => string
  rows: readonly Row[]
}

export function DataTable<Row>({ columns, getRowKey, rows }: DataTableProps<Row>) {
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
          {rows.map((row) => (
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

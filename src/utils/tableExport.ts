import { utils, write } from 'xlsx'

export function createTableWorkbook(values: readonly (readonly string[])[]): ArrayBuffer {
  const workbook = utils.book_new()
  const sheet = utils.aoa_to_sheet(values.map((row) => [...row]))
  utils.book_append_sheet(workbook, sheet, '목록')
  return write(workbook, { bookType: 'xlsx', type: 'array' })
}

export function downloadTableWorkbook(title: string, values: readonly (readonly string[])[]) {
  const bytes = createTableWorkbook(values)
  const blob = new Blob([new Uint8Array(bytes)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${title}.xlsx`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

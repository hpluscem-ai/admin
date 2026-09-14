export type DateRange = {
  end: string
  start: string
}

function toDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function subtractOneMonth(date: Date) {
  const result = new Date(date.getFullYear(), date.getMonth() - 1, 1)
  const lastDay = new Date(date.getFullYear(), date.getMonth(), 0).getDate()
  result.setDate(Math.min(date.getDate(), lastDay))

  return result
}

export function getDefaultDateRange(referenceDate = new Date()): DateRange {
  return {
    start: toDateValue(subtractOneMonth(referenceDate)),
    end: toDateValue(referenceDate),
  }
}

export function getDateRangeParams(range: DateRange): URLSearchParams {
  const start = new Date(`${range.start}T00:00:00`)
  const before = new Date(`${range.end}T00:00:00`)
  before.setDate(before.getDate() + 1)
  return new URLSearchParams({ createdFrom: start.toISOString(), createdBefore: before.toISOString() })
}

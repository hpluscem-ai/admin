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

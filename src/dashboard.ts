import { requestAdmin } from './adminAuth'
import type { DateRange } from './utils/dateRange'

export type DashboardReceipt = { id: string; driverName: string; date: string; status: '적립' | '대기' | '반려'; mileage: number | null }
export type DashboardData = {
  accumulatedMileage: number; settlementMileage: number; approvedCount: number; rejectedCount: number
  receipts: DashboardReceipt[]
  chart: { date: string; common: number; affiliation: number }[]
  affiliations: { value: string; label: string }[]
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid dashboard response')
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('Invalid dashboard text')
  return value
}
function amount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid dashboard amount')
  return value
}
function date(value: unknown): string {
  const day = text(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) throw new Error('Invalid dashboard date')
  return day
}
export async function getDashboard(range: DateRange, companyId: string): Promise<DashboardData> {
  const params = new URLSearchParams({ from: range.start, through: range.end })
  if (companyId) params.set('logisticsCompanyId', companyId)
  const value = record(await requestAdmin(`dashboard?${params}`))
  if (!Array.isArray(value.receipts) || value.receipts.length > 5 || !Array.isArray(value.chart) || !Array.isArray(value.affiliations)) throw new Error('Invalid dashboard lists')
  return {
    accumulatedMileage: amount(value.accumulatedMileage), settlementMileage: amount(value.settlementMileage),
    approvedCount: amount(value.approvedCount), rejectedCount: amount(value.rejectedCount),
    receipts: value.receipts.map((row: unknown) => {
      const r = record(row)
      const statuses = { approved: '적립', pending: '대기', rejected: '반려' } as const
      const status = statuses[r.status as keyof typeof statuses]
      if (!status) throw new Error('Invalid receipt status')
      return { id: text(r.id), driverName: text(r.driverName), date: date(r.date), status, mileage: r.mileage === null ? null : amount(r.mileage) }
    }),
    chart: value.chart.map((row: unknown) => { const r = record(row); return { date: date(r.date), common: amount(r.common), affiliation: amount(r.affiliation) } }),
    affiliations: value.affiliations.map((row: unknown) => { const r = record(row); return { value: text(r.value), label: text(r.label) } }),
  }
}

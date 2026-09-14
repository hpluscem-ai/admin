import { requestAdmin } from './adminAuth'
import type { DateRange } from './utils/dateRange'

export type Driver = {
  id: string
  logisticsCompanyId: string
  logisticsCompanyName: string
  name: string
  phone: string
  email: string
  joinedAt: string
}
export const DRIVERS_LOAD_ERROR = '기사 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'

type DriverQuery = { dateRange: DateRange; nameQuery: string; logisticsCompanyId: string }

export async function getDrivers(query?: DriverQuery): Promise<Driver[]> {
  const params = new URLSearchParams()
  if (query) {
    const start = new Date(`${query.dateRange.start}T00:00:00`)
    const before = new Date(`${query.dateRange.end}T00:00:00`)
    before.setDate(before.getDate() + 1)
    params.set('createdFrom', start.toISOString())
    params.set('createdBefore', before.toISOString())
    if (query.nameQuery.trim()) params.set('nameQuery', query.nameQuery.trim())
    if (query.logisticsCompanyId) params.set('logisticsCompanyId', query.logisticsCompanyId)
  }
  const data = await requestAdmin(`drivers${params.size ? `?${params}` : ''}`)
  if (!Array.isArray(data)) throw new Error(DRIVERS_LOAD_ERROR)
  return data.map((row: unknown) => {
    if (typeof row !== 'object' || row === null) throw new Error(DRIVERS_LOAD_ERROR)
    const record = row as Record<string, unknown>
    const fields = ['id', 'logisticsCompanyId', 'logisticsCompanyName', 'name', 'phone', 'email', 'joinedAt'] as const
    if (fields.some((field) => typeof record[field] !== 'string' || !record[field].trim()) ||
      !Number.isFinite(Date.parse(record.joinedAt as string))) throw new Error(DRIVERS_LOAD_ERROR)
    return Object.fromEntries(fields.map((field) => [field, record[field]])) as Driver
  })
}

export async function withdrawDriver(id: string): Promise<void> {
  await requestAdmin(`drivers/${encodeURIComponent(id)}`, { method: 'DELETE', status: 204 })
}

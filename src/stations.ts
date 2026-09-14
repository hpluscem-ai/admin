import { requestAdmin } from './adminAuth'
import type { InfrastructureValues } from './components/InfrastructureForm'
import { getDateRangeParams, type DateRange } from './utils/dateRange'

export type Station = {
  id: string
  businessName: string
  pole: string
  roadAddress: string
  note: string | null
  latitude: number | null
  longitude: number | null
  createdAt: string
  devices: { id: string; model: string; capacityLiters: number; active: boolean }[]
}
export const STATIONS_LOAD_ERROR = '인프라 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'

function readStation(data: unknown): Station {
  if (typeof data !== 'object' || data === null) throw new Error(STATIONS_LOAD_ERROR)
  const row = data as Record<string, unknown>
  const fields = ['id', 'businessName', 'pole', 'roadAddress', 'createdAt'] as const
  if (fields.some((field) => typeof row[field] !== 'string' || !row[field].trim()) ||
    !Number.isFinite(Date.parse(row.createdAt as string)) ||
    !(row.note === null || typeof row.note === 'string') || !Array.isArray(row.devices)) {
    throw new Error(STATIONS_LOAD_ERROR)
  }
  for (const [field, limit] of [['latitude', 90], ['longitude', 180]] as const) {
    const value = row[field]
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit)) {
      throw new Error(STATIONS_LOAD_ERROR)
    }
  }
  for (const device of row.devices) {
    if (typeof device !== 'object' || device === null || typeof device.id !== 'string' || !device.id.trim() ||
      typeof device.model !== 'string' || !device.model.trim() || !Number.isSafeInteger(device.capacityLiters) ||
      device.capacityLiters < 1 || typeof device.active !== 'boolean') throw new Error(STATIONS_LOAD_ERROR)
  }
  return row as Station
}

export function getStationValues(station: Station): InfrastructureValues {
  return {
    station: station.businessName, pole: station.pole, address: station.roadAddress,
    model: station.devices.map(({ model }) => model).join(' / '),
    capacity: station.devices.map(({ capacityLiters }) => `${capacityLiters.toLocaleString('ko-KR')}L`).join(' / '),
    note: station.note ?? '', latitude: station.latitude === null ? '' : String(station.latitude),
    longitude: station.longitude === null ? '' : String(station.longitude),
  }
}

export async function getStations(dateRange: DateRange, stationQuery: string): Promise<Station[]> {
  const params = getDateRangeParams(dateRange)
  if (stationQuery.trim()) params.set('stationQuery', stationQuery.trim())
  const data = await requestAdmin(`stations?${params}`)
  if (!Array.isArray(data)) throw new Error(STATIONS_LOAD_ERROR)
  return data.map(readStation)
}

export async function getStation(id: string): Promise<Station> {
  return readStation(await requestAdmin(`stations/${encodeURIComponent(id)}`))
}

export async function deleteStation(id: string): Promise<void> {
  await requestAdmin(`stations/${encodeURIComponent(id)}`, { method: 'DELETE', status: 204 })
}

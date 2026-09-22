import { AdminApiError, requestAdmin } from './adminAuth'
import type { InfrastructureSaveResult, InfrastructureValues } from './components/InfrastructureForm'
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

export async function saveStation(values: InfrastructureValues, station?: Station): Promise<InfrastructureSaveResult> {
  const invalid = { ok: false as const, message: '입력한 인프라 정보를 확인해주세요.' }
  const latitude = Number(values.latitude.trim())
  const longitude = Number(values.longitude.trim())
  if (!/^-?\d+(?:\.\d+)?$/.test(values.latitude.trim()) ||
    !/^-?\d+(?:\.\d+)?$/.test(values.longitude.trim()) ||
    !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) || Math.abs(longitude) > 180) return invalid

  let devices: { id?: string; model: string; capacityLiters: number }[]
  if (station && station.devices.length > 1) {
    const original = getStationValues(station)
    if (values.model !== original.model || values.capacity !== original.capacity) {
      return { ok: false, message: '복수 기기의 모델명과 용량은 현재 화면에서 변경할 수 없습니다.' }
    }
    devices = station.devices.map(({ id, model, capacityLiters }) => ({ id, model, capacityLiters }))
  } else {
    const capacity = values.capacity.trim()
    const capacityLiters = Number(capacity.replace(/[,L]/g, ''))
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)L?$/.test(capacity) ||
      !Number.isSafeInteger(capacityLiters) || capacityLiters <= 0 || !values.model.trim()) return invalid
    devices = [{ ...(station?.devices[0] ? { id: station.devices[0].id } : {}),
      model: values.model.trim(), capacityLiters }]
  }
  try {
    const saved = readStation(await requestAdmin(station ? `stations/${encodeURIComponent(station.id)}` : 'stations', {
      method: station ? 'PUT' : 'POST', status: station ? 200 : 201,
      body: { businessName: values.station.trim(), pole: values.pole.trim(), roadAddress: values.address.trim(),
        latitude, longitude, ...(values.note.trim() ? { note: values.note.trim() } : {}), devices },
    }))
    if (station && saved.id !== station.id) throw new Error(STATIONS_LOAD_ERROR)
    return { ok: true }
  } catch (error) {
    if (error instanceof AdminApiError) {
      if (error.status === 404) return { ok: false, message: '주유소를 찾을 수 없습니다.' }
      if (error.status === 400) return invalid
      if (error.status === 409 && ['UNKNOWN_DEVICE', 'DUPLICATE_DEVICE_ID'].includes(error.code)) {
        return { ok: false, message: '기기 정보가 변경되었습니다. 화면을 새로 열어 다시 시도해주세요.' }
      }
    }
    throw error
  }
}

import { AdminApiError, requestAdmin } from './adminAuth'

export type Receipt = {
  id: string
  reviewVersion: string
  settlementId: string | null
  userId: string
  logisticsCompanyId: string
  logisticsCompanyName: string
  name: string
  phone: string | null
  receiptAmount: number | null
  meterAmount: number | null
  finalAmount: number | null
  mileageAmount: number | null
  receiptAt: string | null
  matchStatus: 'pending' | 'matched' | 'mismatched' | 'ocr_failed' | 'duplicate_suspected'
  status: 'pending' | 'approved' | 'rejected'
  photos: { receipt: string | null; meter: string | null }
}

export const RECEIPTS_LOAD_ERROR = '영수 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'

export async function getReceipts(query?: { nameQuery: string; logisticsCompanyId: string }): Promise<Receipt[]> {
  const params = new URLSearchParams()
  if (query?.nameQuery.trim()) params.set('nameQuery', query.nameQuery.trim())
  if (query?.logisticsCompanyId) params.set('logisticsCompanyId', query.logisticsCompanyId)
  const data = await requestAdmin(`mileage/applications${params.size ? `?${params}` : ''}`)
  if (!Array.isArray(data)) throw new Error(RECEIPTS_LOAD_ERROR)
  return data.map(parseReceipt)
}

function parseReceipt(value: unknown): Receipt {
  if (typeof value !== 'object' || value === null) throw new Error(RECEIPTS_LOAD_ERROR)
  const row = value as Record<string, unknown>
  const texts = ['id', 'userId', 'logisticsCompanyId', 'logisticsCompanyName', 'name'] as const
  const amounts = ['receiptAmount', 'meterAmount', 'finalAmount', 'mileageAmount'] as const
  if (typeof row.reviewVersion !== 'string' || !/^[a-f0-9]{64}$/.test(row.reviewVersion) ||
    (row.settlementId !== null && (typeof row.settlementId !== 'string' || !row.settlementId.trim())) ||
    texts.some((field) => typeof row[field] !== 'string' || !row[field].trim()) ||
    amounts.some((field) => row[field] !== null && (typeof row[field] !== 'number' || !Number.isSafeInteger(row[field]) || row[field] < 0)) ||
    (row.phone !== null && (typeof row.phone !== 'string' || !row.phone.trim())) ||
    (row.receiptAt !== null && (typeof row.receiptAt !== 'string' || !Number.isFinite(Date.parse(row.receiptAt)))) ||
    !['pending', 'approved', 'rejected'].includes(row.status as string) ||
    !['pending', 'matched', 'mismatched', 'ocr_failed', 'duplicate_suspected'].includes(row.matchStatus as string) ||
    typeof row.photos !== 'object' || row.photos === null || Array.isArray(row.photos)) throw new Error(RECEIPTS_LOAD_ERROR)
  const photos = row.photos as Record<string, unknown>
  for (const kind of ['receipt', 'meter']) {
    if (photos[kind] !== null && photos[kind] !== `/api/v1/admin/mileage/applications/${encodeURIComponent(row.id as string)}/photos/${kind}`) {
      throw new Error(RECEIPTS_LOAD_ERROR)
    }
  }
  return Object.fromEntries([...texts, ...amounts, 'reviewVersion', 'settlementId', 'phone', 'receiptAt', 'status', 'matchStatus', 'photos']
    .map((field) => [field, row[field]])) as Receipt
}

export async function reviewReceipt(receipt: Pick<Receipt, 'id' | 'reviewVersion'>, action: 'approve' | 'reject',
  approval?: { finalAmount: number; liters: string }): Promise<Receipt> {
  if (action === 'approve' && !approval) throw new Error('확정 금액과 주유량을 입력해주세요.')
  const data = await requestAdmin(`mileage/applications/${encodeURIComponent(receipt.id)}/${action}`, {
    method: 'POST', body: { reviewVersion: receipt.reviewVersion, ...(action === 'approve' ? approval : {}) },
  })
  const result = parseReceipt(data)
  if (result.id !== receipt.id || result.reviewVersion !== receipt.reviewVersion ||
    result.status !== (action === 'approve' ? 'approved' : 'rejected') ||
    (action === 'approve' && (result.finalAmount !== approval?.finalAmount || result.mileageAmount === null))) throw new Error('심사 결과를 확인하지 못했습니다. 다시 시도해주세요.')
  return result
}

export async function getReceiptPhoto(path: string | null): Promise<Blob> {
  if (!path || !/^\/api\/v1\/admin\/mileage\/applications\/[a-f0-9-]{36}\/photos\/(receipt|meter)$/i.test(path)) {
    throw new Error('사진을 확인할 수 없습니다.')
  }
  const response = await fetch(path, { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (response.status !== 200) {
    const data: unknown = await response.json()
    throw new AdminApiError(response.status, typeof data === 'object' && data !== null &&
      'code' in data && typeof data.code === 'string' ? data.code : '')
  }
  if (response.headers.get('Content-Type')?.split(';')[0] !== 'image/jpeg') throw new Error('사진을 확인할 수 없습니다.')
  const blob = await response.blob()
  if (!blob.size) throw new Error('사진을 확인할 수 없습니다.')
  return blob
}

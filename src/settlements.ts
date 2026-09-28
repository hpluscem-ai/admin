import { AdminApiError, requestAdmin } from './adminAuth'
import type { LogisticsCompany } from './logisticsCompanies'
import { bankCodeOptions } from './data/bankCodeOptions'

export type SettlementCompany = LogisticsCompany & { active: boolean; mileage: number; transferStatus: 'pending' | 'completed' | null }

export async function getSettlements(month: string): Promise<SettlementCompany[]> {
  const data = await requestAdmin(`settlements?${new URLSearchParams({ month })}`)
  if (!Array.isArray(data)) throw new Error('Invalid settlement response')
  return data.map((row: unknown) => {
    if (!row || typeof row !== 'object') throw new Error('Invalid settlement response')
    const value = row as Record<string, unknown>
    const fields = ['id', 'businessName', 'businessNumber', 'corporateRegistrationNumber', 'businessAddress', 'managerName', 'managerPhone', 'bankCode', 'accountNumber', 'accountHolder']
    if (fields.some(field => typeof value[field] !== 'string' || !value[field]) || typeof value.active !== 'boolean' ||
      !Number.isSafeInteger(value.mileage) || (value.mileage as number) < 0 || ![null, 'pending', 'completed'].includes(value.transferStatus as string | null)) throw new Error('Invalid settlement response')
    const bank = bankCodeOptions.find(({ code }) => code === value.bankCode)?.name
    if (!bank) throw new Error('Invalid settlement bank')
    return { ...value, bank } as SettlementCompany
  })
}

async function transferRequest(action: 'export' | 'import', month: string, body?: FormData) {
  const response = await fetch(`/api/v1/admin/settlements/${action}?${new URLSearchParams({ month })}`, {
    method: 'POST', credentials: 'include', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30_000), body,
  })
  if (response.status !== 200) {
    const error: unknown = await response.json()
    throw new AdminApiError(response.status, error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : '')
  }
  return response
}

export async function downloadSettlements(month: string): Promise<Blob> {
  const response = await transferRequest('export', month)
  if (response.headers.get('Content-Type')?.split(';')[0] !== 'application/vnd.ms-excel') throw new Error('Invalid spreadsheet response')
  const blob = await response.blob()
  const signature = new Uint8Array(await blob.slice(0, 8).arrayBuffer())
  if (signature.join(',') !== '208,207,17,224,161,177,26,225') throw new Error('Invalid spreadsheet content')
  return blob
}

export async function uploadSettlements(month: string, file: File): Promise<void> {
  const body = new FormData()
  body.append('file', file)
  const response = await transferRequest('import', month, body)
  const result: unknown = await response.json()
  if (!result || typeof result !== 'object' || !('completed' in result) || !('alreadyCompleted' in result) ||
    !Number.isSafeInteger(result.completed) || !Number.isSafeInteger(result.alreadyCompleted) ||
    (result.completed as number) < 0 || (result.alreadyCompleted as number) < 0) throw new Error('Invalid settlement result')
}

export function settlementError(error: unknown, action: 'export' | 'import' = 'import'): string {
  if (error instanceof AdminApiError) {
    if (error.code === 'SETTLEMENT_EXPORT_EMPTY') return '선택한 월에 다운로드할 미완료 정산 내역이 없습니다.'
    if (error.code === 'SETTLEMENT_ROW_MISMATCH') return '정산 월·은행·계좌·금액·CMS코드를 확인해주세요. 파일은 반영되지 않았습니다.'
    if (error.code === 'SETTLEMENT_DUPLICATE_ROW') return '중복된 정산 행을 제거해주세요. 파일은 반영되지 않았습니다.'
    if (error.status === 400 || error.status === 413) return action === 'export'
      ? '정산 조건과 등록된 계좌 정보를 확인해주세요.'
      : '정산 조건 또는 엑셀 양식과 내용을 확인해주세요. 파일은 반영되지 않았습니다.'
  }
  return action === 'export' ? '대량이체 파일을 내려받지 못했습니다. 다시 시도해주세요.'
    : '정산 처리 결과를 확인하지 못했습니다. 같은 파일로 다시 시도해주세요.'
}

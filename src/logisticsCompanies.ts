import { AdminApiError, requestAdmin } from './adminAuth'
import type { LogisticsFormValues, LogisticsSaveResult } from './components/LogisticsForm'
import { bankCodeOptions } from './data/bankCodeOptions'

export type LogisticsCompany = LogisticsFormValues & { id: string }
export const LOGISTICS_LOAD_ERROR = '물류사 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'

function readCompany(data: unknown): LogisticsCompany {
  const fields = ['id', 'businessName', 'businessNumber', 'corporateRegistrationNumber', 'businessAddress',
    'managerName', 'managerPhone', 'bankCode', 'accountNumber', 'accountHolder'] as const
  if (typeof data !== 'object' || data === null) throw new Error(LOGISTICS_LOAD_ERROR)
  const record = data as Record<string, unknown>
  if (fields.some((field) => typeof record[field] !== 'string' || !record[field].trim())) {
    throw new Error(LOGISTICS_LOAD_ERROR)
  }
  const bank = bankCodeOptions.find(({ code }) => code === record.bankCode)?.name
  if (!bank) throw new Error(LOGISTICS_LOAD_ERROR)
  return { ...Object.fromEntries(fields.map((field) => [field, record[field]])), bank } as LogisticsCompany
}

export async function getLogisticsCompanies(): Promise<LogisticsCompany[]> {
  const data = await requestAdmin('logistics-companies')
  if (!Array.isArray(data)) throw new Error(LOGISTICS_LOAD_ERROR)
  return data.map(readCompany)
}

export async function getLogisticsCompany(id: string): Promise<LogisticsCompany> {
  return readCompany(await requestAdmin(`logistics-companies/${encodeURIComponent(id)}`))
}

export async function saveLogisticsCompany(values: LogisticsFormValues, id?: string): Promise<LogisticsSaveResult> {
  const { businessName, businessNumber, corporateRegistrationNumber, businessAddress, managerName,
    managerPhone, bankCode, accountNumber, accountHolder } = values
  try {
    readCompany(await requestAdmin(id ? `logistics-companies/${encodeURIComponent(id)}` : 'logistics-companies', {
      method: id ? 'PUT' : 'POST', status: id ? 200 : 201,
      body: { businessName, businessNumber, corporateRegistrationNumber, businessAddress, managerName,
        managerPhone, bankCode, accountNumber, accountHolder },
    }))
    return { ok: true }
  } catch (error) {
    if (error instanceof AdminApiError) {
      if (error.status === 409 && error.code === 'LOGISTICS_COMPANY_DUPLICATE') {
        return { ok: false, message: '이미 등록된 사업자 정보입니다.' }
      }
      if (error.status === 404) return { ok: false, message: '물류사를 찾을 수 없습니다.' }
      if (error.status === 400) return { ok: false, message: '입력한 물류사 정보를 확인해주세요.' }
    }
    throw error
  }
}

export async function deactivateLogisticsCompany(id: string): Promise<void> {
  await requestAdmin(`logistics-companies/${encodeURIComponent(id)}`, { method: 'DELETE', status: 204 })
}

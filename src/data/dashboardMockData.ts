export type DashboardReceiptStatus = '적립' | '대기' | '반려'

export type DashboardReceipt = {
  affiliation: string
  date: string
  driverName: string
  id: string
  isMatch: boolean
  mileage: number
  settlementEligible: boolean
  status: DashboardReceiptStatus
}

export type DashboardData = {
  receipts: readonly DashboardReceipt[]
  settlementDate: string
}

const affiliations = ['에이치플러스주유소', '하나에너지', '성북주유소'] as const
const driverNames = ['김민수', '이서연', '박지훈', '최유진', '정하늘', '윤서준'] as const
const mileages = [4500, 2800, 1200, 3750, 960, 3200, 1750, 2400] as const
const statuses: readonly DashboardReceiptStatus[] = ['적립', '적립', '대기', '적립', '반려', '적립']

function toDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getNextSettlementDate(referenceDate: Date) {
  const settlementDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 10)

  if (settlementDate < referenceDate) {
    settlementDate.setMonth(settlementDate.getMonth() + 1)
  }

  return settlementDate
}

/**
 * 서버 대시보드 API가 준비되기 전까지만 사용하는 임시 데이터다.
 * 연동 시 이 파일과 DashboardPage의 createDashboardMockData 호출만 제거하면 된다.
 */
export function createDashboardMockData(referenceDate = new Date()): DashboardData {
  const anchorDate = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  )

  const receipts = Array.from({ length: 60 }, (_, index): DashboardReceipt => {
    const receiptDate = new Date(anchorDate)
    receiptDate.setDate(anchorDate.getDate() - index)
    const status = statuses[index % statuses.length]

    return {
      affiliation: affiliations[index % affiliations.length],
      date: toDateValue(receiptDate),
      driverName: driverNames[index % driverNames.length],
      id: `dashboard-mock-${index}`,
      isMatch: index % 5 !== 3,
      mileage: mileages[index % mileages.length],
      settlementEligible: status === '적립' && index % 3 !== 0,
      status,
    }
  })

  return {
    receipts,
    settlementDate: toDateValue(getNextSettlementDate(anchorDate)),
  }
}

export type TransferStatus = '이체완료' | '이체대기'

export type LogisticsSettlementData = {
  accountHolder: string
  accountNumber: string
  bank: string
  businessAddress: string
  businessName: string
  businessNumber: string
  corporateRegistrationNumber: string
  id: string
  managerName: string
  managerPhone: string
  mileage: number
  settlementMonth: string
  transferStatus: TransferStatus
}

const logisticsSettlementSeeds = [
  { businessName: '(주)경인물류', businessNumber: '123-45-67890', corporateRegistrationNumber: '110111-0012345', businessAddress: '서울시 강남구 역삼동 123', managerName: '김민수', managerPhone: '010-1234-5678', accountNumber: '110-456-789012', bank: '국민은행', accountHolder: '김민수', mileage: 2400, transferStatus: '이체완료' },
  { businessName: '대한물류 강남', businessNumber: '234-56-78901', corporateRegistrationNumber: '110111-0023456', businessAddress: '서울시 서초구 서초동 45', managerName: '이영희', managerPhone: '010-9876-5432', accountNumber: '352-123-456789', bank: '농협은행', accountHolder: '(주)대한물류', mileage: 5680, transferStatus: '이체대기' },
  { businessName: '(주)삼진로지스', businessNumber: '345-67-89012', corporateRegistrationNumber: '110111-0034567', businessAddress: '경기도 고양시 일산동구 67', managerName: '박준혁', managerPhone: '010-5555-1234', accountNumber: '110-789-012345', bank: '신한은행', accountHolder: '박준혁', mileage: 1200, transferStatus: '이체대기' },
  { businessName: '부산항운수', businessNumber: '456-78-90123', corporateRegistrationNumber: '180111-0045678', businessAddress: '부산시 중구 중앙동 89', managerName: '최지은', managerPhone: '010-3333-7890', accountNumber: '269-456-123456', bank: '하나은행', accountHolder: '부산항운수', mileage: 8340, transferStatus: '이체대기' },
  { businessName: '(주)광진운수', businessNumber: '567-89-01234', corporateRegistrationNumber: '110111-0056789', businessAddress: '서울시 광진구 구의동 101', managerName: '정다영', managerPhone: '010-2222-4567', accountNumber: '302-789-654321', bank: '우리은행', accountHolder: '정다영', mileage: 3760, transferStatus: '이체대기' },
  { businessName: '순천물류센터', businessNumber: '678-90-12345', corporateRegistrationNumber: '200111-0067890', businessAddress: '전라남도 순천시 해룡면 12', managerName: '강태우', managerPhone: '010-8888-3456', accountNumber: '033-123-789012', bank: '기업은행', accountHolder: '강태우', mileage: 960, transferStatus: '이체대기' },
  { businessName: '(주)경주로지텍', businessNumber: '789-01-23456', corporateRegistrationNumber: '171111-0078901', businessAddress: '경상북도 경주시 외동읍 34', managerName: '윤서현', managerPhone: '010-7777-2345', accountNumber: '062-456-321098', bank: '국민은행', accountHolder: '(주)경주로지텍', mileage: 4520, transferStatus: '이체대기' },
  { businessName: '인천항만물류', businessNumber: '890-12-34567', corporateRegistrationNumber: '120111-0089012', businessAddress: '인천시 중구 항동 56', managerName: '임서연', managerPhone: '010-4444-6789', accountNumber: '032-789-456123', bank: '신한은행', accountHolder: '(주)한솔에너지', mileage: 7100, transferStatus: '이체대기' },
  { businessName: '(주)제주운송', businessNumber: '901-23-45678', corporateRegistrationNumber: '220111-0090123', businessAddress: '제주도 제주시 연동 78', managerName: '한재혁', managerPhone: '010-6666-8901', accountNumber: '088-321-654987', bank: '농협은행', accountHolder: '한재혁', mileage: 620, transferStatus: '이체대기' },
  { businessName: '창원화물운수', businessNumber: '012-34-56789', corporateRegistrationNumber: '190111-0101234', businessAddress: '경상남도 창원시 의창구 90', managerName: '소희진', managerPhone: '010-1111-5678', accountNumber: '055-654-987321', bank: '하나은행', accountHolder: '창원화물운수', mileage: 3180, transferStatus: '이체대기' },
] as const satisfies readonly Omit<LogisticsSettlementData, 'id' | 'settlementMonth'>[]

function toMonthValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')

  return `${year}-${month}`
}

/**
 * 서버 물류사 정산 목록 API가 준비되기 전까지만 사용하는 임시 데이터다.
 * 목록 연동 시 이 파일과 LogisticsSettlementPage의 호출을 제거하면 된다.
 */
export function createLogisticsSettlementMockData(
  referenceDate = new Date(),
): readonly LogisticsSettlementData[] {
  const settlementMonth = toMonthValue(referenceDate)

  return logisticsSettlementSeeds.map((settlement, index) => ({
    ...settlement,
    id: `logistics-settlement-mock-${index}`,
    settlementMonth,
  }))
}

export function getLogisticsSettlementMockDataById(id: string) {
  return createLogisticsSettlementMockData().find((settlement) => settlement.id === id)
}

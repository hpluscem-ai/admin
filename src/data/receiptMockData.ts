import type { ApprovalStatus } from '../components/StatusSelect'

// 서버 영수 데이터 조회가 연결되면 이 파일 전체를 삭제하고 API 응답으로 교체한다.
export type ReceiptMockRow = {
  affiliation: string
  finalAmount: string
  id: string
  isMatch: boolean
  meterAmount: string
  mileage: string
  name: string
  phone: string
  receiptAmount: string
  receiptDate: string
  status: ApprovalStatus
}

export const receiptMockRows: readonly ReceiptMockRow[] = [
  {
    id: 'receipt-001',
    affiliation: '(주)경인물류',
    name: '홍길동',
    phone: '010-1234-5678',
    receiptAmount: '34,830',
    meterAmount: '34,830',
    isMatch: true,
    finalAmount: '34,830',
    mileage: '348',
    receiptDate: '2025. 03. 12',
    status: '승인',
  },
  {
    id: 'receipt-002',
    affiliation: '대한통운 강남',
    name: '김영수',
    phone: '010-9876-5432',
    receiptAmount: '42,500',
    meterAmount: '42,500',
    isMatch: true,
    finalAmount: '42,500',
    mileage: '425',
    receiptDate: '2025. 05. 08',
    status: '승인',
  },
  {
    id: 'receipt-003',
    affiliation: '(주)삼진로지스',
    name: '이민호',
    phone: '010-5555-1234',
    receiptAmount: '28,600',
    meterAmount: '29,100',
    isMatch: false,
    finalAmount: '28,600',
    mileage: '0',
    receiptDate: '2024. 11. 20',
    status: '대기',
  },
  {
    id: 'receipt-004',
    affiliation: '부산항운수',
    name: '박지영',
    phone: '010-3333-7890',
    receiptAmount: '51,200',
    meterAmount: '51,200',
    isMatch: true,
    finalAmount: '51,200',
    mileage: '512',
    receiptDate: '2025. 01. 15',
    status: '승인',
  },
  {
    id: 'receipt-005',
    affiliation: '(주)한진운수',
    name: '최동현',
    phone: '010-2222-4567',
    receiptAmount: '19,750',
    meterAmount: '19,750',
    isMatch: true,
    finalAmount: '19,750',
    mileage: '197',
    receiptDate: '2026. 02. 03',
    status: '승인',
  },
  {
    id: 'receipt-006',
    affiliation: '순천물류센터',
    name: '정수민',
    phone: '010-8888-3456',
    receiptAmount: '63,400',
    meterAmount: '61,800',
    isMatch: false,
    finalAmount: '63,400',
    mileage: '0',
    receiptDate: '2025. 07. 22',
    status: '반려',
  },
  {
    id: 'receipt-007',
    affiliation: '(주)경주로지텍',
    name: '강태우',
    phone: '010-7777-2345',
    receiptAmount: '37,900',
    meterAmount: '37,900',
    isMatch: true,
    finalAmount: '37,900',
    mileage: '379',
    receiptDate: '2024. 09. 30',
    status: '승인',
  },
  {
    id: 'receipt-008',
    affiliation: '인천항만물류',
    name: '윤서연',
    phone: '010-4444-6789',
    receiptAmount: '45,100',
    meterAmount: '45,100',
    isMatch: true,
    finalAmount: '45,100',
    mileage: '451',
    receiptDate: '2025. 06. 17',
    status: '승인',
  },
  {
    id: 'receipt-009',
    affiliation: '(주)제주운송',
    name: '임재혁',
    phone: '010-6666-8901',
    receiptAmount: '22,300',
    meterAmount: '23,000',
    isMatch: false,
    finalAmount: '22,300',
    mileage: '0',
    receiptDate: '2026. 04. 05',
    status: '대기',
  },
  {
    id: 'receipt-010',
    affiliation: '창원화물운수',
    name: '한소희',
    phone: '010-1111-5678',
    receiptAmount: '56,700',
    meterAmount: '56,700',
    isMatch: true,
    finalAmount: '56,700',
    mileage: '567',
    receiptDate: '2025. 08. 28',
    status: '승인',
  },
]

export const receiptMockAffiliations = Array.from(
  new Set(receiptMockRows.map((row) => row.affiliation)),
)

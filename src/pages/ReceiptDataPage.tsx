import { DataPageHeader } from '../components/DataPageHeader'
import { DataTable, type DataTableColumn } from '../components/DataTable'
import { AffiliationFilter, SearchFilter } from '../components/PageFilters'
import { StatusSelect, type ApprovalStatus } from '../components/StatusSelect'

type ReceiptRow = {
  affiliation: string
  finalAmount: string
  isMatch: boolean
  meterAmount: string
  mileage: string
  name: string
  phone: string
  receiptAmount: string
  status: ApprovalStatus
}

const rows: readonly ReceiptRow[] = [
  { affiliation: '에이치플러스주유소', name: '홍길동', phone: '010-1234-5678', receiptAmount: '34,830', meterAmount: '34,830', isMatch: true, finalAmount: '34,830', mileage: '348', status: '승인' },
  { affiliation: '강남에너지', name: '김영수', phone: '010-9876-5432', receiptAmount: '42,500', meterAmount: '42,500', isMatch: true, finalAmount: '42,500', mileage: '425', status: '승인' },
  { affiliation: '서울오일', name: '이민호', phone: '010-5555-1234', receiptAmount: '28,600', meterAmount: '29,100', isMatch: false, finalAmount: '28,600', mileage: '0', status: '대기' },
  { affiliation: '한강주유소', name: '박지영', phone: '010-3333-7890', receiptAmount: '51,200', meterAmount: '51,200', isMatch: true, finalAmount: '51,200', mileage: '512', status: '승인' },
  { affiliation: '에이치플러스주유소', name: '최동현', phone: '010-2222-4567', receiptAmount: '19,750', meterAmount: '19,750', isMatch: true, finalAmount: '19,750', mileage: '197', status: '승인' },
  { affiliation: '고양에너지', name: '정수민', phone: '010-8888-3456', receiptAmount: '63,400', meterAmount: '61,800', isMatch: false, finalAmount: '63,400', mileage: '0', status: '반려' },
  { affiliation: '부산오일', name: '강태우', phone: '010-7777-2345', receiptAmount: '37,900', meterAmount: '37,900', isMatch: true, finalAmount: '37,900', mileage: '379', status: '승인' },
  { affiliation: '인천주유소', name: '윤서연', phone: '010-4444-6789', receiptAmount: '45,100', meterAmount: '45,100', isMatch: true, finalAmount: '45,100', mileage: '451', status: '승인' },
  { affiliation: '대전에너지', name: '임재혁', phone: '010-6666-8901', receiptAmount: '22,300', meterAmount: '23,000', isMatch: false, finalAmount: '22,300', mileage: '0', status: '대기' },
  { affiliation: '광주오일', name: '한소희', phone: '010-1111-5678', receiptAmount: '56,700', meterAmount: '56,700', isMatch: true, finalAmount: '56,700', mileage: '567', status: '승인' },
]

const photoButton = <button className="text-button" type="button">보기</button>

const columns: readonly DataTableColumn<ReceiptRow>[] = [
  { key: 'affiliation', label: '소속', render: (row) => row.affiliation },
  { key: 'name', label: '이름', render: (row) => row.name },
  { key: 'phone', label: '연락처', render: (row) => row.phone },
  { key: 'receiptPhoto', label: '영수증 사진', render: () => photoButton },
  { key: 'receiptAmount', label: '영수증 금액', render: (row) => row.receiptAmount },
  { key: 'meterPhoto', label: '계기판 사진', render: () => photoButton },
  { key: 'meterAmount', label: '계기판 금액', render: (row) => row.meterAmount },
  { key: 'match', label: '일치여부', render: (row) => <span className="match-result" data-match={row.isMatch}>{row.isMatch ? '일치' : '불일치'}</span> },
  { key: 'finalAmount', label: '최종 금액', render: (row) => row.finalAmount },
  { key: 'mileage', label: '적립 마일리지', render: (row) => row.mileage },
  { key: 'status', label: '승인여부', render: (row) => <StatusSelect label={row.name} status={row.status} /> },
]

export function ReceiptDataPage() {
  return (
    <section className="data-page" aria-labelledby="receipt-data-title">
      <DataPageHeader title="영수 데이터 목록" titleId="receipt-data-title">
        <SearchFilter />
        <AffiliationFilter />
      </DataPageHeader>
      <DataTable columns={columns} rows={rows} getRowKey={(row) => row.phone} />
    </section>
  )
}

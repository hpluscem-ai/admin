import { DataPageHeader } from '../components/DataPageHeader'
import { DataTable, type DataTableColumn } from '../components/DataTable'
import { AffiliationFilter, DateRangeFilter, SearchFilter } from '../components/PageFilters'
import { StatusSelect, type ApprovalStatus } from '../components/StatusSelect'

type DriverRow = {
  affiliation: string
  email: string
  joinedAt: string
  mileage: string
  name: string
  phone: string
  status: ApprovalStatus
  totalAmount: string
}

const rows: readonly DriverRow[] = [
  { affiliation: '하나에너지', name: '김도윤', phone: '010-3847-2951', email: 'doyun.kim@hanaenergy.kr', totalAmount: '52,300', mileage: '523', joinedAt: '2026. 06. 24', status: '승인' },
  { affiliation: '성북주유소', name: '이수빈', phone: '010-7263-4108', email: 'subin.lee@sbgas.co.kr', totalAmount: '38,750', mileage: '387', joinedAt: '2026. 05. 12', status: '승인' },
  { affiliation: '푸른에너지', name: '박현우', phone: '010-5521-8734', email: 'hw.park@pureun.kr', totalAmount: '0', mileage: '0', joinedAt: '2026. 07. 03', status: '대기' },
  { affiliation: '동작주유소', name: '최예진', phone: '010-9184-3260', email: 'yejin.choi@djgas.kr', totalAmount: '61,200', mileage: '612', joinedAt: '2025. 11. 18', status: '승인' },
  { affiliation: '하나에너지', name: '정민석', phone: '010-4432-7891', email: 'ms.jung@hanaenergy.kr', totalAmount: '15,800', mileage: '158', joinedAt: '2026. 03. 07', status: '승인' },
  { affiliation: '영등포에너지', name: '강서윤', phone: '010-6178-5042', email: 'sy.kang@ydpenergy.kr', totalAmount: '0', mileage: '0', joinedAt: '2026. 01. 29', status: '반려' },
  { affiliation: '마포주유소', name: '오태민', phone: '010-2395-6817', email: 'tm.oh@mapogas.kr', totalAmount: '43,600', mileage: '436', joinedAt: '2025. 09. 15', status: '승인' },
  { affiliation: '강서에너지', name: '신유나', phone: '010-8056-1423', email: 'yuna.shin@gsenergy.kr', totalAmount: '31,950', mileage: '319', joinedAt: '2026. 04. 22', status: '승인' },
  { affiliation: '관악주유소', name: '임하준', phone: '010-1749-8365', email: 'hj.lim@gwanakgas.kr', totalAmount: '0', mileage: '0', joinedAt: '2026. 08. 01', status: '대기' },
  { affiliation: '서초에너지', name: '배지호', phone: '010-6924-3570', email: 'jiho.bae@scenergy.kr', totalAmount: '24,850', mileage: '248', joinedAt: '2025. 12. 10', status: '승인' },
]

const columns: readonly DataTableColumn<DriverRow>[] = [
  { key: 'affiliation', label: '소속', render: (row) => row.affiliation },
  { key: 'name', label: '이름', render: (row) => row.name },
  { key: 'phone', label: '연락처', render: (row) => row.phone },
  { key: 'email', label: '이메일', render: (row) => row.email },
  { key: 'totalAmount', label: '최종 금액', render: (row) => row.totalAmount },
  { key: 'mileage', label: '적립 마일리지', render: (row) => row.mileage },
  { key: 'joinedAt', label: '가입일자', render: (row) => row.joinedAt },
  { key: 'status', label: '승인여부', render: (row) => <StatusSelect label={row.name} status={row.status} /> },
]

export function DriverDataPage() {
  return (
    <section className="data-page" aria-labelledby="driver-data-title">
      <DataPageHeader title="소속 기사 데이터 목록" titleId="driver-data-title">
        <DateRangeFilter />
        <SearchFilter />
        <AffiliationFilter />
      </DataPageHeader>
      <DataTable columns={columns} rows={rows} getRowKey={(row) => row.phone} />
    </section>
  )
}

import { useState } from 'react'
import chevronDownIcon from '../assets/chevron-down.svg'
import { DataPageHeader } from '../components/DataPageHeader'
import { DataTable, type DataTableColumn } from '../components/DataTable'
import { AffiliationFilter, SearchFilter } from '../components/PageFilters'
import {
  receiptMockAffiliations,
  receiptMockRows,
  type ReceiptMockRow,
} from '../data/receiptMockData'

const photoButton = <button className="text-button" type="button">보기</button>

function ApprovalStatusDisplay({ name, status }: Pick<ReceiptMockRow, 'name' | 'status'>) {
  return (
    <span className="approval-status" data-status={status} aria-label={`${name} 승인 여부: ${status}`}>
      <span>{status}</span>
      <span className="approval-status__icon" aria-hidden="true">
        <img src={chevronDownIcon} alt="" />
      </span>
    </span>
  )
}

const columns: readonly DataTableColumn<ReceiptMockRow>[] = [
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
  { key: 'receiptDate', label: '영수일시', render: (row) => row.receiptDate },
  { key: 'status', label: '승인여부', render: (row) => <ApprovalStatusDisplay name={row.name} status={row.status} /> },
]

export function ReceiptDataPage() {
  const [query, setQuery] = useState('')
  const [affiliation, setAffiliation] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredRows = receiptMockRows.filter((row) => {
    const matchesName = !normalizedQuery || row.name.toLocaleLowerCase().includes(normalizedQuery)
    const matchesAffiliation = !affiliation || row.affiliation === affiliation

    return matchesName && matchesAffiliation
  })

  return (
    <section className="data-page receipt-data-page" aria-labelledby="receipt-data-title">
      <DataPageHeader title="영수 데이터 목록" titleId="receipt-data-title">
        <SearchFilter onChange={setQuery} value={query} />
        <AffiliationFilter onChange={setAffiliation} options={receiptMockAffiliations} />
      </DataPageHeader>
      <DataTable columns={columns} rows={filteredRows} getRowKey={(row) => row.id} />
    </section>
  )
}

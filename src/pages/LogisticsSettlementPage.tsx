import { useEffect, useState } from 'react'
import { isInvalidAdminSession } from '../adminAuth'
import { getLogisticsCompanies, LOGISTICS_LOAD_ERROR, type LogisticsCompany } from '../logisticsCompanies'
import calendarIcon from '../assets/calendar.svg'
import packageIcon from '../assets/package.svg'
import { ConfirmationDialog } from '../components/ConfirmationDialog'
import { DataPageHeader } from '../components/DataPageHeader'
import { DataTable, type DataTableColumn } from '../components/DataTable'
import { SearchFilter } from '../components/PageFilters'

function toMonthValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')

  return `${year}-${month}`
}

function formatMonth(value: string) {
  const [year, month] = value.split('-')

  return `${year}. ${month}`
}

type MonthFilterProps = {
  onChange: (month: string) => void
  value: string
}

function MonthFilter({ onChange, value }: MonthFilterProps) {
  return (
    <label className="date-filter">
      <img className="filter-control__icon" src={calendarIcon} alt="" />
      <span aria-hidden="true">{formatMonth(value)}</span>
      <input
        aria-label="정산 월"
        className="date-filter__picker"
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value)
        }}
        type="month"
        value={value}
      />
    </label>
  )
}

function getColumns(
  onDelete: (settlement: LogisticsCompany) => void,
): readonly DataTableColumn<LogisticsCompany>[] {
  return [
    { key: 'businessName', label: '사업자명', render: (row) => row.businessName },
    { key: 'businessNumber', label: '사업자번호', render: (row) => row.businessNumber },
    { key: 'managerName', label: '담당자명', render: (row) => row.managerName },
    { key: 'managerPhone', label: '담당자연락처', render: (row) => row.managerPhone },
    { key: 'accountNumber', label: '계좌번호', render: (row) => row.accountNumber },
    { key: 'bank', label: '은행', render: (row) => row.bank },
    { key: 'accountHolder', label: '예금주', render: (row) => row.accountHolder },
    { key: 'mileage', label: '적립 마일리지', render: () => '-' },
    { key: 'transferStatus', label: '이체 상태', render: () => '-' },
    {
      key: 'actions',
      label: '관리',
      render: (row) => (
        <span className="table-actions">
          <a
            aria-label={`${row.businessName} 수정`}
            className="table-action table-action--brand"
            href={`#/settlements/edit/${encodeURIComponent(row.id)}`}
          >
            수정
          </a>
          <button
            aria-label={`${row.businessName} 삭제`}
            className="table-action table-action--danger"
            onClick={() => onDelete(row)}
            type="button"
          >
            삭제
          </button>
        </span>
      ),
    },
  ]
}

export function LogisticsSettlementPage() {
  const [companies, setCompanies] = useState<LogisticsCompany[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [businessNameQuery, setBusinessNameQuery] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(toMonthValue)
  const [deleteTarget, setDeleteTarget] = useState<LogisticsCompany | null>(null)
  useEffect(() => {
    let active = true
    void getLogisticsCompanies().then((loaded) => {
      if (active) setCompanies(loaded)
    }).catch((error: unknown) => {
      if (!active) return
      if (isInvalidAdminSession(error)) {
        window.location.hash = '/login'
        return
      }
      setLoadError(LOGISTICS_LOAD_ERROR)
    })
    return () => { active = false }
  }, [])
  const query = businessNameQuery.trim().toLocaleLowerCase('ko-KR')
  const filteredCompanies = (companies ?? []).filter((company) =>
    company.businessName.toLocaleLowerCase('ko-KR').includes(query))

  return (
    <section className="data-page settlement-page" aria-labelledby="logistics-settlement-title">
      <DataPageHeader title="물류사 정산 관리" titleId="logistics-settlement-title">
        <SearchFilter
          label="사업자명 검색"
          onChange={setBusinessNameQuery}
          placeholder="사업자명으로 검색해주세요."
          value={businessNameQuery}
        />
        <MonthFilter onChange={setSelectedMonth} value={selectedMonth} />
      </DataPageHeader>
      <DataTable
        columns={getColumns(setDeleteTarget)}
        emptyMessage={loadError || (companies === null ? '물류사 데이터를 불러오는 중입니다.' : '물류사 데이터가 없습니다.')}
        getRowKey={(row) => row.id}
        rows={filteredCompanies}
      />

      <div className="settlement-floating-actions">
        <label className="floating-action">
          <input accept=".xlsx,.xls" className="sr-only" type="file" />
          <img src={packageIcon} alt="" />
          이체 내역 엑셀 업로드
        </label>
        <button className="floating-action" type="button">
          <img src={packageIcon} alt="" />
          대량이체 엑셀 다운로드
        </button>
        <a className="floating-action" href="#/settlements/new">
          <img src={packageIcon} alt="" />
          물류사 데이터 추가
        </a>
      </div>

      {deleteTarget ? (
        <ConfirmationDialog
          actionLabel="삭제"
          description="물류사 정보를 삭제하면 소속 기사 및 마일리지 데이터 또한 복구하실 수 없습니다."
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => setDeleteTarget(null)}
          title="물류사 정보를 삭제하시겠습니까?"
        />
      ) : null}
    </section>
  )
}

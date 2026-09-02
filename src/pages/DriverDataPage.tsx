import { useState } from 'react'
import { ConfirmationDialog } from '../components/ConfirmationDialog'
import { DataPageHeader } from '../components/DataPageHeader'
import { DataTable, type DataTableColumn } from '../components/DataTable'
import {
  AffiliationFilter,
  DateRangeFilter,
  SearchFilter,
} from '../components/PageFilters'
import { createDriverMockData, type DriverData } from '../data/driverMockData'
import { getDefaultDateRange, type DateRange } from '../utils/dateRange'

const numberFormatter = new Intl.NumberFormat('ko-KR')

function formatDate(value: string) {
  return value.split('-').join('. ')
}

function getColumns(
  onWithdraw: (driver: DriverData) => void,
): readonly DataTableColumn<DriverData>[] {
  return [
    { key: 'affiliation', label: '소속', render: (row) => row.affiliation },
    { key: 'name', label: '이름', render: (row) => row.name },
    { key: 'phone', label: '연락처', render: (row) => row.phone },
    { key: 'email', label: '이메일', render: (row) => row.email },
    { key: 'totalAmount', label: '최종 금액', render: (row) => numberFormatter.format(row.totalAmount) },
    { key: 'mileage', label: '적립 마일리지', render: (row) => numberFormatter.format(row.mileage) },
    { key: 'joinedAt', label: '가입일자', render: (row) => formatDate(row.joinedAt) },
    {
      key: 'actions',
      label: '관리',
      render: (row) => (
        <button
          aria-label={`${row.name} 회원 탈퇴`}
          className="table-action table-action--danger"
          onClick={() => onWithdraw(row)}
          type="button"
        >
          탈퇴
        </button>
      ),
    },
  ]
}

type DriverFilterCriteria = {
  affiliation: string
  dateRange: DateRange
  nameQuery: string
}

function getFilteredDrivers(
  drivers: readonly DriverData[],
  { affiliation, dateRange, nameQuery }: DriverFilterCriteria,
) {
  const normalizedNameQuery = nameQuery.trim().toLocaleLowerCase('ko-KR')
  const filteredDrivers: DriverData[] = []

  for (const driver of drivers) {
    if (driver.joinedAt < dateRange.start || driver.joinedAt > dateRange.end) continue
    if (affiliation && driver.affiliation !== affiliation) continue
    if (normalizedNameQuery && !driver.name.toLocaleLowerCase('ko-KR').includes(normalizedNameQuery)) {
      continue
    }

    filteredDrivers.push(driver)
  }

  return filteredDrivers
}

export function DriverDataPage() {
  const [drivers, setDrivers] = useState(createDriverMockData)
  const [dateRange, setDateRange] = useState(getDefaultDateRange)
  const [nameQuery, setNameQuery] = useState('')
  const [selectedAffiliation, setSelectedAffiliation] = useState('')
  const [withdrawalTarget, setWithdrawalTarget] = useState<DriverData | null>(null)
  const affiliations = Array.from(new Set(drivers.map((driver) => driver.affiliation)))
  const filteredDrivers = getFilteredDrivers(drivers, {
    affiliation: selectedAffiliation,
    dateRange,
    nameQuery,
  })

  function handleWithdraw() {
    if (!withdrawalTarget) return

    setDrivers((currentDrivers) => (
      currentDrivers.filter((driver) => driver.id !== withdrawalTarget.id)
    ))
    setWithdrawalTarget(null)
  }

  return (
    <section className="data-page driver-data-page" aria-labelledby="driver-data-title">
      <DataPageHeader title="소속 기사 데이터 목록" titleId="driver-data-title">
        <DateRangeFilter {...dateRange} onChange={setDateRange} />
        <SearchFilter
          label="기사 이름 검색"
          value={nameQuery}
          onChange={setNameQuery}
        />
        <AffiliationFilter options={affiliations} onChange={setSelectedAffiliation} />
      </DataPageHeader>
      <DataTable
        columns={getColumns(setWithdrawalTarget)}
        emptyMessage="조회 조건에 맞는 기사 데이터가 없습니다."
        rows={filteredDrivers}
        getRowKey={(row) => row.id}
      />
      {withdrawalTarget ? (
        <ConfirmationDialog
          actionLabel="탈퇴"
          description="탈퇴한 회원 정보는 다시 복구할 수 없습니다."
          onCancel={() => setWithdrawalTarget(null)}
          onConfirm={handleWithdraw}
          title="회원을 탈퇴시키겠습니까?"
        />
      ) : null}
    </section>
  )
}

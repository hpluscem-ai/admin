import { useState } from 'react'
import { DataPageHeader } from '../components/DataPageHeader'
import { DataTable, type DataTableColumn } from '../components/DataTable'
import { DriverNameSearch } from '../components/DriverNameSearch'
import {
  AffiliationFilter,
  DateRangeFilter,
} from '../components/PageFilters'
import { StatusSelect } from '../components/StatusSelect'
import { createDriverMockData, type DriverData } from '../data/driverMockData'
import { getDefaultDateRange, type DateRange } from '../utils/dateRange'

const numberFormatter = new Intl.NumberFormat('ko-KR')

function formatDate(value: string) {
  return value.split('-').join('. ')
}

const columns: readonly DataTableColumn<DriverData>[] = [
  { key: 'affiliation', label: '소속', render: (row) => row.affiliation },
  { key: 'name', label: '이름', render: (row) => row.name },
  { key: 'phone', label: '연락처', render: (row) => row.phone },
  { key: 'email', label: '이메일', render: (row) => row.email },
  { key: 'totalAmount', label: '최종 금액', render: (row) => numberFormatter.format(row.totalAmount) },
  { key: 'mileage', label: '적립 마일리지', render: (row) => numberFormatter.format(row.mileage) },
  { key: 'joinedAt', label: '가입일자', render: (row) => formatDate(row.joinedAt) },
  { key: 'status', label: '승인여부', render: (row) => <StatusSelect label={row.name} status={row.status} /> },
]

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
  const [drivers] = useState(createDriverMockData)
  const [dateRange, setDateRange] = useState(getDefaultDateRange)
  const [nameQuery, setNameQuery] = useState('')
  const [selectedAffiliation, setSelectedAffiliation] = useState('')
  const affiliations = Array.from(new Set(drivers.map((driver) => driver.affiliation)))
  const filteredDrivers = getFilteredDrivers(drivers, {
    affiliation: selectedAffiliation,
    dateRange,
    nameQuery,
  })

  return (
    <section className="data-page" aria-labelledby="driver-data-title">
      <DataPageHeader title="소속 기사 데이터 목록" titleId="driver-data-title">
        <DateRangeFilter {...dateRange} onChange={setDateRange} />
        <DriverNameSearch value={nameQuery} onChange={setNameQuery} />
        <AffiliationFilter options={affiliations} onChange={setSelectedAffiliation} />
      </DataPageHeader>
      <DataTable
        columns={columns}
        emptyMessage="조회 조건에 맞는 기사 데이터가 없습니다."
        rows={filteredDrivers}
        getRowKey={(row) => row.id}
      />
    </section>
  )
}

import { useEffect, useState } from 'react'
import { ConfirmationDialog } from '../components/ConfirmationDialog'
import { DataPageHeader } from '../components/DataPageHeader'
import { DataTable, type DataTableColumn } from '../components/DataTable'
import {
  AffiliationFilter,
  DateRangeFilter,
  SearchFilter,
} from '../components/PageFilters'
import { isInvalidAdminSession } from '../adminAuth'
import { getDrivers, DRIVERS_LOAD_ERROR, type Driver } from '../drivers'
import { getDefaultDateRange } from '../utils/dateRange'

function formatDate(value: string) {
  const date = new Date(value)
  return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}`
}

function getColumns(
  onWithdraw: (driver: Driver) => void,
): readonly DataTableColumn<Driver>[] {
  return [
    { key: 'affiliation', label: '소속', render: (row) => row.logisticsCompanyName },
    { key: 'name', label: '이름', render: (row) => row.name },
    { key: 'phone', label: '연락처', render: (row) => row.phone },
    { key: 'email', label: '이메일', render: (row) => row.email },
    { key: 'totalAmount', label: '최종 금액', render: () => '-' },
    { key: 'mileage', label: '적립 마일리지', render: () => '-' },
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

export function DriverDataPage() {
  const [drivers, setDrivers] = useState<Driver[] | null>(null)
  const [affiliations, setAffiliations] = useState<{ value: string; label: string }[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [affiliationError, setAffiliationError] = useState('')
  const [withdrawalError, setWithdrawalError] = useState('')
  const [dateRange, setDateRange] = useState(getDefaultDateRange)
  const [nameQuery, setNameQuery] = useState('')
  const [selectedAffiliation, setSelectedAffiliation] = useState('')
  const [withdrawalTarget, setWithdrawalTarget] = useState<Driver | null>(null)
  useEffect(() => {
    let active = true
    void getDrivers().then((allDrivers) => {
      if (!active) return
      setAffiliations(Array.from(new Map(allDrivers.map((driver) => [driver.logisticsCompanyId,
        { value: driver.logisticsCompanyId, label: driver.logisticsCompanyName }])).values()))
    }).catch((error: unknown) => {
      if (!active) return
      if (isInvalidAdminSession(error)) window.location.hash = '/login'
      else setAffiliationError(DRIVERS_LOAD_ERROR)
    })
    return () => { active = false }
  }, [])
  useEffect(() => {
    let active = true
    setDrivers(null)
    setLoadError('')
    void getDrivers({ dateRange, nameQuery, logisticsCompanyId: selectedAffiliation }).then((loaded) => {
      if (active) setDrivers(loaded)
    }).catch((error: unknown) => {
      if (!active) return
      if (isInvalidAdminSession(error)) window.location.hash = '/login'
      else setLoadError(DRIVERS_LOAD_ERROR)
    })
    return () => { active = false }
  }, [dateRange, nameQuery, selectedAffiliation])

  function handleWithdraw() {
    setWithdrawalError('기사 탈퇴 서버 연동이 필요합니다.')
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
        <AffiliationFilter options={affiliations ?? []} value={selectedAffiliation} onChange={setSelectedAffiliation} />
      </DataPageHeader>
      <DataTable
        columns={getColumns((driver) => { setWithdrawalError(''); setWithdrawalTarget(driver) })}
        emptyMessage={loadError || affiliationError || (drivers === null || affiliations === null
          ? '기사 데이터를 불러오는 중입니다.' : '조회 조건에 맞는 기사 데이터가 없습니다.')}
        rows={affiliations && !affiliationError ? drivers ?? [] : []}
        getRowKey={(row) => row.id}
      />
      {withdrawalTarget ? (
        <ConfirmationDialog
          actionLabel="탈퇴"
          description={withdrawalError || '탈퇴한 회원 정보는 다시 복구할 수 없습니다.'}
          onCancel={() => setWithdrawalTarget(null)}
          onConfirm={handleWithdraw}
          title="회원을 탈퇴시키겠습니까?"
        />
      ) : null}
    </section>
  )
}

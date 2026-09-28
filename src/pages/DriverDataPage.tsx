import { navigate } from '../navigation'
import { useEffect, useRef, useState } from 'react'
import { ConfirmationDialog, NoticeDialog } from '../components/ConfirmationDialog'
import { DataPageHeader } from '../components/DataPageHeader'
import { DataTable, type DataTableColumn } from '../components/DataTable'
import {
  AffiliationFilter,
  DateRangeFilter,
  SearchFilter,
} from '../components/PageFilters'
import { AdminApiError, isInvalidAdminSession } from '../adminAuth'
import { getDrivers, withdrawDriver, DRIVERS_LOAD_ERROR, type Driver } from '../drivers'
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
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'failed'>('loading')
  const [affiliationError, setAffiliationError] = useState('')
  const [withdrawalError, setWithdrawalError] = useState('')
  const [dateRange, setDateRange] = useState(getDefaultDateRange)
  const [nameQuery, setNameQuery] = useState('')
  const [selectedAffiliation, setSelectedAffiliation] = useState('')
  const [withdrawalTarget, setWithdrawalTarget] = useState<Driver | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [affiliationRefresh, setAffiliationRefresh] = useState(0)
  const lifetime = useRef<object | null>(null)
  const modalOwner = useRef<object | null>(null)
  const submitting = useRef(false)
  const queryGeneration = useRef(0)
  useEffect(() => {
    lifetime.current = {}
    return () => { lifetime.current = null }
  }, [])
  useEffect(() => {
    let active = true
    setAffiliationError('')
    void getDrivers().then((allDrivers) => {
      if (!active) return
      setAffiliations(Array.from(new Map(allDrivers.map((driver) => [driver.logisticsCompanyId,
        { value: driver.logisticsCompanyId, label: driver.logisticsCompanyName }])).values()))
    }).catch((error: unknown) => {
      if (!active) return
      if (isInvalidAdminSession(error)) navigate('/login')
      else setAffiliationError(DRIVERS_LOAD_ERROR)
    })
    return () => { active = false }
  }, [affiliationRefresh])
  useEffect(() => {
    let active = true
    const generation = ++queryGeneration.current
    setLoadState('loading')
    setLoadError('')
    void getDrivers({ dateRange, nameQuery, logisticsCompanyId: selectedAffiliation }).then((loaded) => {
      if (!active || queryGeneration.current !== generation) return
      setDrivers(loaded)
      setLoadState('loaded')
    }).catch((error: unknown) => {
      if (!active || queryGeneration.current !== generation) return
      if (isInvalidAdminSession(error)) navigate('/login')
      else { setLoadError(DRIVERS_LOAD_ERROR); setLoadState('failed') }
    })
    return () => { active = false }
  }, [dateRange, nameQuery, selectedAffiliation, refresh])

  async function handleWithdraw() {
    if (!withdrawalTarget || submitting.current || !lifetime.current) return
    const owner = lifetime.current
    const targetOwner = modalOwner.current
    const targetId = withdrawalTarget.id
    const generation = queryGeneration.current
    const routePath = window.location.pathname
    const isCurrent = () => lifetime.current === owner && window.location.pathname === routePath
    submitting.current = true
    setWithdrawalError('')
    try {
      await withdrawDriver(targetId)
      if (!isCurrent()) return
      if (generation === queryGeneration.current) {
        setDrivers((current) => current?.filter(({ id }) => id !== targetId) ?? null)
      }
      ++queryGeneration.current
      setRefresh((current) => current + 1)
      if (modalOwner.current === targetOwner) {
        modalOwner.current = null
        setWithdrawalTarget(null)
      }
    } catch (error) {
      if (!isCurrent()) return
      if (isInvalidAdminSession(error)) {
        navigate('/login')
        return
      }
      if (modalOwner.current === targetOwner) {
        setWithdrawalError(error instanceof AdminApiError && error.status === 404
          ? '탈퇴 처리할 기사를 찾을 수 없습니다.'
          : '기사 탈퇴 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
      } else {
        // Closing the dialog does not cancel the server operation.
        ++queryGeneration.current
        setRefresh((current) => current + 1)
      }
    } finally {
      submitting.current = false
    }
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
        columns={getColumns((driver) => { modalOwner.current = {}; setWithdrawalError(''); setWithdrawalTarget(driver) })}
        emptyMessage={loadState === 'failed' ? undefined : loadState === 'loading' ? '기사 데이터를 불러오는 중입니다.' : '조회 조건에 맞는 기사 데이터가 없습니다.'}
        rows={drivers ?? []}
        getRowKey={(row) => row.id}
      />
      {!withdrawalTarget && (loadError || affiliationError) && <NoticeDialog message={loadError || affiliationError}
        onClose={() => { setLoadError(''); setAffiliationError('') }}
        onRetry={() => {
          if (loadError) setRefresh(current => current + 1)
          if (affiliationError) setAffiliationRefresh(current => current + 1)
        }} />}
      {withdrawalTarget ? (
        <ConfirmationDialog
          actionLabel="탈퇴"
          description={withdrawalError || '탈퇴한 회원 정보는 다시 복구할 수 없습니다.'}
          onCancel={() => { modalOwner.current = null; setWithdrawalTarget(null) }}
          onConfirm={handleWithdraw}
          title="회원을 탈퇴시키겠습니까?"
        />
      ) : null}
    </section>
  )
}

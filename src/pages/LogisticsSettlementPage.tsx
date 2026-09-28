import { navigate } from '../navigation'
import { useEffect, useRef, useState } from 'react'
import { AdminApiError, isInvalidAdminSession } from '../adminAuth'
import { deactivateLogisticsCompany, LOGISTICS_LOAD_ERROR, type LogisticsCompany } from '../logisticsCompanies'
import { getSettlements, downloadSettlements, uploadSettlements, settlementError, type SettlementCompany } from '../settlements'
import calendarIcon from '../assets/calendar.svg'
import packageIcon from '../assets/package.svg'
import { ConfirmationDialog, NoticeDialog } from '../components/ConfirmationDialog'
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
  disabled?: boolean
}

function MonthFilter({ onChange, value, disabled }: MonthFilterProps) {
  return (
    <label className="date-filter">
      <img className="filter-control__icon" src={calendarIcon} alt="" />
      <span aria-hidden="true">{formatMonth(value)}</span>
      <input
        aria-label="정산 월"
        disabled={disabled}
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
  onDeactivate: (settlement: LogisticsCompany) => void,
): readonly DataTableColumn<SettlementCompany>[] {
  return [
    { key: 'businessName', label: '사업자명', render: (row) => row.businessName },
    { key: 'businessNumber', label: '사업자번호', render: (row) => row.businessNumber },
    { key: 'managerName', label: '담당자명', render: (row) => row.managerName },
    { key: 'managerPhone', label: '담당자연락처', render: (row) => row.managerPhone },
    { key: 'accountNumber', label: '계좌번호', render: (row) => row.accountNumber },
    { key: 'bank', label: '은행', render: (row) => row.bank },
    { key: 'accountHolder', label: '예금주', render: (row) => row.accountHolder },
    { key: 'mileage', label: '적립 마일리지', render: (row) => row.mileage.toLocaleString('ko-KR') },
    { key: 'transferStatus', label: '이체 상태', render: (row) => row.transferStatus === 'completed' ? '이체완료' : row.transferStatus === 'pending' ? '이체대기' : '-' },
    {
      key: 'actions',
      label: '관리',
      render: (row) => (
        <span className="table-actions">
          <a
            aria-label={`${row.businessName} 수정`}
            className="table-action table-action--brand"
            href={row.active ? `/settlements/edit/${encodeURIComponent(row.id)}` : undefined}
            aria-disabled={!row.active}
          >
            수정
          </a>
          <button
            aria-label={`${row.businessName} 비활성화`}
            className="table-action table-action--danger"
            disabled={!row.active}
            onClick={() => onDeactivate(row)}
            type="button"
          >
            비활성화
          </button>
        </span>
      ),
    },
  ]
}

export function LogisticsSettlementPage() {
  const [companies, setCompanies] = useState<SettlementCompany[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'failed'>('loading')
  const [fileError, setFileError] = useState('')
  const [businessNameQuery, setBusinessNameQuery] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(toMonthValue)
  const [deactivationTarget, setDeactivationTarget] = useState<LogisticsCompany | null>(null)
  const [deactivationError, setDeactivationError] = useState('')
  const [fileBusy, setFileBusy] = useState(false)
  const fileSubmitting = useRef(false)
  const [refresh, setRefresh] = useState(0)
  const lifetime = useRef<object | null>(null)
  const modalOwner = useRef<object | null>(null)
  const loadOwner = useRef<object | null>(null)
  const submitting = useRef(false)
  useEffect(() => {
    lifetime.current = {}
    return () => { lifetime.current = null }
  }, [])
  useEffect(() => {
    const current = {}
    loadOwner.current = current
    setLoadState('loading')
    setLoadError('')
    setFileError('')
    void getSettlements(selectedMonth).then((loaded) => {
      if (loadOwner.current !== current) return
      setCompanies(loaded)
      setLoadState('loaded')
    }).catch((error: unknown) => {
      if (loadOwner.current !== current) return
      if (isInvalidAdminSession(error)) {
        navigate('/login')
        return
      }
      setLoadError(LOGISTICS_LOAD_ERROR)
      setLoadState('failed')
    })
    return () => { loadOwner.current = null }
  }, [refresh, selectedMonth])
  const query = businessNameQuery.trim().toLocaleLowerCase('ko-KR')
  const filteredCompanies = (companies ?? []).filter((company) =>
    company.businessName.toLocaleLowerCase('ko-KR').includes(query))

  async function handleFile(file?: File) {
    if (fileSubmitting.current || !lifetime.current) return
    const owner = lifetime.current
    const routePath = window.location.pathname
    const isCurrent = () => lifetime.current === owner && window.location.pathname === routePath
    fileSubmitting.current = true
    setFileBusy(true)
    setFileError('')
    try {
      if (file) await uploadSettlements(selectedMonth, file)
      else {
        const blob = await downloadSettlements(selectedMonth)
        if (!isCurrent()) return
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `settlements-${selectedMonth}.xls`
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
      if (isCurrent()) setRefresh(current => current + 1)
    } catch (error) {
      if (!isCurrent()) return
      if (isInvalidAdminSession(error)) { navigate('/login'); return }
      setFileError(settlementError(error, file ? 'import' : 'export'))
    } finally {
      fileSubmitting.current = false
      if (isCurrent()) setFileBusy(false)
    }
  }

  async function handleDeactivate() {
    if (!deactivationTarget || submitting.current || !lifetime.current) return
    const owner = lifetime.current
    const targetOwner = modalOwner.current
    const targetId = deactivationTarget.id
    const routePath = window.location.pathname
    const isCurrent = () => lifetime.current === owner && window.location.pathname === routePath
    submitting.current = true
    setDeactivationError('')
    try {
      await deactivateLogisticsCompany(targetId)
      if (!isCurrent()) return
      loadOwner.current = null
      setCompanies((current) => current?.filter(({ id }) => id !== targetId) ?? null)
      setRefresh((current) => current + 1)
      if (modalOwner.current === targetOwner) {
        modalOwner.current = null
        setDeactivationTarget(null)
      }
    } catch (error) {
      if (!isCurrent()) return
      if (isInvalidAdminSession(error)) {
        navigate('/login')
        return
      }
      if (modalOwner.current === targetOwner) {
        setDeactivationError(error instanceof AdminApiError && error.status === 404
          ? '물류사를 찾을 수 없습니다.'
          : '물류사 비활성화 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
      } else {
        // Closing the dialog does not cancel the server operation.
        loadOwner.current = null
        setRefresh((current) => current + 1)
      }
    } finally {
      submitting.current = false
    }
  }

  return (
    <section className="data-page settlement-page" aria-labelledby="logistics-settlement-title">
      <DataPageHeader title="물류사 정산 관리" titleId="logistics-settlement-title">
        <SearchFilter
          label="사업자명 검색"
          onChange={setBusinessNameQuery}
          placeholder="사업자명으로 검색해주세요."
          value={businessNameQuery}
        />
        <MonthFilter onChange={setSelectedMonth} value={selectedMonth} disabled={fileBusy} />
      </DataPageHeader>
      <DataTable
        columns={getColumns((company) => { modalOwner.current = {}; setDeactivationError(''); setDeactivationTarget(company) })}
        emptyMessage={loadState === 'failed' ? undefined : loadState === 'loading' ? '물류사 데이터를 불러오는 중입니다.' : '물류사 데이터가 없습니다.'}
        getRowKey={(row) => row.id}
        rows={filteredCompanies}
      />

      {!deactivationTarget && (fileError || loadError) && <NoticeDialog
        message={fileError || loadError}
        onClose={() => { if (fileError) setFileError(''); else setLoadError('') }}
        onRetry={fileError ? undefined : () => setRefresh(current => current + 1)}
      />}

      <div className="settlement-floating-actions">
        <label className="floating-action">
          <input accept=".xlsx,.xls" className="sr-only" type="file" disabled={fileBusy} onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) void handleFile(file)
          }} />
          <img src={packageIcon} alt="" />
          이체 내역 엑셀 업로드
        </label>
        <button className="floating-action" type="button" disabled={fileBusy} onClick={() => void handleFile()}>
          <img src={packageIcon} alt="" />
          대량이체 엑셀 다운로드
        </button>
        <a className="floating-action" href="/settlements/new">
          <img src={packageIcon} alt="" />
          물류사 데이터 추가
        </a>
      </div>

      {deactivationTarget ? (
        <ConfirmationDialog
          actionLabel="비활성화"
          description={deactivationError || '물류사와 소속 기사·마일리지 기록은 보존되며, 소속 기사의 로그인과 기존 세션 이용이 차단됩니다.'}
          onCancel={() => { modalOwner.current = null; setDeactivationTarget(null) }}
          onConfirm={handleDeactivate}
          title="물류사를 비활성화하시겠습니까?"
        />
      ) : null}
    </section>
  )
}

import { navigate } from '../navigation'
import { useEffect, useRef, useState } from 'react'
import { ConfirmationDialog, NoticeDialog } from '../components/ConfirmationDialog'
import { DataPageHeader } from '../components/DataPageHeader'
import { DataTable, type DataTableColumn } from '../components/DataTable'
import { DateRangeFilter, SearchFilter } from '../components/PageFilters'
import { AdminApiError, isInvalidAdminSession } from '../adminAuth'
import { getStations, getStationValues, deleteStation, STATIONS_LOAD_ERROR, type Station } from '../stations'
import { getDefaultDateRange } from '../utils/dateRange'
import packageIcon from '../assets/package.svg'

function formatDate(value: string) {
  const date = new Date(value)
  return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}`
}

type InfrastructureData = ReturnType<typeof getStationValues> & { id: string; registeredAt: string }

function getColumns(
  onDelete: (infrastructure: InfrastructureData) => void,
): readonly DataTableColumn<InfrastructureData>[] {
  return [
    { key: 'station', label: '주유소 이름', render: (row) => row.station },
    { key: 'pole', label: 'Pole', render: (row) => row.pole },
    {
      key: 'model',
      label: '모델명',
      render: (row) => <span className="infrastructure-data__model">{row.model || '-'}</span>,
    },
    { key: 'capacity', label: '용량', render: (row) => row.capacity || '-' },
    { key: 'address', label: '주소', render: (row) => row.address },
    { key: 'note', label: '비고', render: (row) => row.note || '-' },
    { key: 'latitude', label: '위도', render: (row) => row.latitude || '-' },
    { key: 'longitude', label: '경도', render: (row) => row.longitude || '-' },
    { key: 'registeredAt', label: '등록일자', render: (row) => formatDate(row.registeredAt) },
    {
      key: 'actions',
      label: '관리',
      render: (row) => (
        <span className="table-actions">
          <a
            aria-label={`${row.station} 수정`}
            className="table-action table-action--brand"
            href={`/infrastructure/edit/${encodeURIComponent(row.id)}`}
          >
            수정
          </a>
          <button
            aria-label={`${row.station} 삭제`}
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

export function InfrastructureDataPage() {
  const [stations, setStations] = useState<Station[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'failed'>('loading')
  const [deleteError, setDeleteError] = useState('')
  const [dateRange, setDateRange] = useState(getDefaultDateRange)
  const [stationQuery, setStationQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<InfrastructureData | null>(null)
  const [refresh, setRefresh] = useState(0)
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
    const generation = ++queryGeneration.current
    setLoadState('loading')
    setLoadError('')
    void getStations(dateRange, stationQuery).then((loaded) => {
      if (!active || queryGeneration.current !== generation) return
      setStations(loaded)
      setLoadState('loaded')
    }).catch((error: unknown) => {
      if (!active || queryGeneration.current !== generation) return
      if (isInvalidAdminSession(error)) navigate('/login')
      else { setLoadError(STATIONS_LOAD_ERROR); setLoadState('failed') }
    })
    return () => { active = false }
  }, [dateRange, stationQuery, refresh])
  const rows = (stations ?? []).map((station) => ({
    ...getStationValues(station), id: station.id, registeredAt: station.createdAt,
  }))

  async function handleDelete() {
    if (!deleteTarget || submitting.current || !lifetime.current) return
    const owner = lifetime.current
    const targetOwner = modalOwner.current
    const targetId = deleteTarget.id
    const generation = queryGeneration.current
    const routePath = window.location.pathname
    const isCurrent = () => lifetime.current === owner && window.location.pathname === routePath
    submitting.current = true
    setDeleteError('')
    try {
      await deleteStation(targetId)
      if (!isCurrent()) return
      if (generation === queryGeneration.current) {
        setStations((current) => current?.filter(({ id }) => id !== targetId) ?? null)
      }
      ++queryGeneration.current
      setRefresh((current) => current + 1)
      if (modalOwner.current === targetOwner) {
        modalOwner.current = null
        setDeleteTarget(null)
      }
    } catch (error) {
      if (!isCurrent()) return
      if (isInvalidAdminSession(error)) {
        navigate('/login')
        return
      }
      if (modalOwner.current === targetOwner) {
        setDeleteError(error instanceof AdminApiError && error.status === 404
          ? '주유소를 찾을 수 없습니다.'
          : '인프라 데이터 삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
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
    <section className="data-page infrastructure-data-page" aria-labelledby="infrastructure-data-title">
      <DataPageHeader title="인프라 데이터 목록" titleId="infrastructure-data-title">
        <DateRangeFilter {...dateRange} onChange={setDateRange} />
        <SearchFilter
          label="주유소 이름 검색"
          onChange={setStationQuery}
          placeholder="주유소 이름으로 검색해주세요."
          value={stationQuery}
        />
      </DataPageHeader>
      <DataTable
        columns={getColumns((row) => { modalOwner.current = {}; setDeleteError(''); setDeleteTarget(row) })}
        emptyMessage={loadState === 'failed' ? undefined : loadState === 'loading' ? '인프라 데이터를 불러오는 중입니다.' : '조회 조건에 맞는 인프라 데이터가 없습니다.'}
        rows={rows}
        getRowKey={(row) => row.id}
      />
      {!deleteTarget && loadError && <NoticeDialog message={loadError}
        onClose={() => setLoadError('')} onRetry={() => setRefresh(current => current + 1)} />}
      <a className="floating-action" href="/infrastructure/new">
        <img src={packageIcon} alt="" />
        인프라 데이터 추가
      </a>
      {deleteTarget ? (
        <ConfirmationDialog
          actionLabel="삭제"
          description={deleteError || '삭제한 인프라 데이터는 다시 복구할 수 없습니다.'}
          onCancel={() => { modalOwner.current = null; setDeleteTarget(null) }}
          onConfirm={handleDelete}
          title="인프라 데이터를 삭제하시겠습니까?"
        />
      ) : null}
    </section>
  )
}

import { useEffect, useState } from 'react'
import { ConfirmationDialog } from '../components/ConfirmationDialog'
import { DataPageHeader } from '../components/DataPageHeader'
import { DataTable, type DataTableColumn } from '../components/DataTable'
import { DateRangeFilter, SearchFilter } from '../components/PageFilters'
import { isInvalidAdminSession } from '../adminAuth'
import { getStations, getStationValues, STATIONS_LOAD_ERROR, type Station } from '../stations'
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
    { key: 'model', label: '모델명', render: (row) => row.model || '-' },
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
            href={`#/infrastructure/edit/${encodeURIComponent(row.id)}`}
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
  const [deleteError, setDeleteError] = useState('')
  const [dateRange, setDateRange] = useState(getDefaultDateRange)
  const [stationQuery, setStationQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<InfrastructureData | null>(null)
  useEffect(() => {
    let active = true
    setStations(null)
    setLoadError('')
    void getStations(dateRange, stationQuery).then((loaded) => {
      if (active) setStations(loaded)
    }).catch((error: unknown) => {
      if (!active) return
      if (isInvalidAdminSession(error)) window.location.hash = '/login'
      else setLoadError(STATIONS_LOAD_ERROR)
    })
    return () => { active = false }
  }, [dateRange, stationQuery])
  const rows = (stations ?? []).map((station) => ({
    ...getStationValues(station), id: station.id, registeredAt: station.createdAt,
  }))

  function handleDelete() {
    setDeleteError('인프라 데이터 삭제 서버 연동이 필요합니다.')
  }

  return (
    <section className="data-page" aria-labelledby="infrastructure-data-title">
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
        columns={getColumns((row) => { setDeleteError(''); setDeleteTarget(row) })}
        emptyMessage={loadError || (stations === null ? '인프라 데이터를 불러오는 중입니다.' : '조회 조건에 맞는 인프라 데이터가 없습니다.')}
        rows={rows}
        getRowKey={(row) => row.id}
      />
      <a className="floating-action" href="#/infrastructure/new">
        <img src={packageIcon} alt="" />
        인프라 데이터 추가
      </a>
      {deleteTarget ? (
        <ConfirmationDialog
          actionLabel="삭제"
          description={deleteError || '삭제한 인프라 데이터는 다시 복구할 수 없습니다.'}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="인프라 데이터를 삭제하시겠습니까?"
        />
      ) : null}
    </section>
  )
}

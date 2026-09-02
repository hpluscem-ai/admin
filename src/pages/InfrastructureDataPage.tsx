import { useState } from 'react'
import { ConfirmationDialog } from '../components/ConfirmationDialog'
import { DataPageHeader } from '../components/DataPageHeader'
import { DataTable, type DataTableColumn } from '../components/DataTable'
import { DateRangeFilter, SearchFilter } from '../components/PageFilters'
import {
  createInfrastructureMockData,
  type InfrastructureData,
} from '../data/infrastructureMockData'
import { getDefaultDateRange, type DateRange } from '../utils/dateRange'
import packageIcon from '../assets/package.svg'

function formatDate(value: string) {
  return value.split('-').join('. ')
}

function getColumns(
  onDelete: (infrastructure: InfrastructureData) => void,
): readonly DataTableColumn<InfrastructureData>[] {
  return [
    { key: 'station', label: '주유소 이름', render: (row) => row.station },
    { key: 'pole', label: 'Pole', render: (row) => row.pole },
    { key: 'model', label: '모델명', render: (row) => row.model },
    { key: 'capacity', label: '용량', render: (row) => row.capacity },
    { key: 'address', label: '주소', render: (row) => row.address },
    { key: 'note', label: '비고', render: (row) => row.note },
    { key: 'latitude', label: '위도', render: (row) => row.latitude },
    { key: 'longitude', label: '경도', render: (row) => row.longitude },
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

type InfrastructureFilterCriteria = {
  dateRange: DateRange
  stationQuery: string
}

function getFilteredInfrastructureData(
  infrastructureData: readonly InfrastructureData[],
  { dateRange, stationQuery }: InfrastructureFilterCriteria,
) {
  const normalizedStationQuery = stationQuery.trim().toLocaleLowerCase('ko-KR')
  const filteredInfrastructureData: InfrastructureData[] = []

  for (const infrastructure of infrastructureData) {
    if (
      infrastructure.registeredAt < dateRange.start ||
      infrastructure.registeredAt > dateRange.end
    ) {
      continue
    }
    if (
      normalizedStationQuery &&
      !infrastructure.station.toLocaleLowerCase('ko-KR').includes(normalizedStationQuery)
    ) {
      continue
    }

    filteredInfrastructureData.push(infrastructure)
  }

  return filteredInfrastructureData
}

export function InfrastructureDataPage() {
  const [infrastructureData, setInfrastructureData] = useState(createInfrastructureMockData)
  const [dateRange, setDateRange] = useState(getDefaultDateRange)
  const [stationQuery, setStationQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<InfrastructureData | null>(null)
  const filteredInfrastructureData = getFilteredInfrastructureData(infrastructureData, {
    dateRange,
    stationQuery,
  })

  function handleDelete() {
    if (!deleteTarget) return

    setInfrastructureData((currentInfrastructureData) => (
      currentInfrastructureData.filter((infrastructure) => infrastructure.id !== deleteTarget.id)
    ))
    setDeleteTarget(null)
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
        columns={getColumns(setDeleteTarget)}
        emptyMessage="조회 조건에 맞는 인프라 데이터가 없습니다."
        rows={filteredInfrastructureData}
        getRowKey={(row) => row.id}
      />
      <a className="floating-action" href="#/infrastructure/new">
        <img src={packageIcon} alt="" />
        인프라 데이터 추가
      </a>
      {deleteTarget ? (
        <ConfirmationDialog
          actionLabel="삭제"
          description="삭제한 인프라 데이터는 다시 복구할 수 없습니다."
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="인프라 데이터를 삭제하시겠습니까?"
        />
      ) : null}
    </section>
  )
}

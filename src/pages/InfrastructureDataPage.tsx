import { DataPageHeader } from '../components/DataPageHeader'
import { DataTable, type DataTableColumn } from '../components/DataTable'
import { DateRangeFilter, SearchFilter } from '../components/PageFilters'
import packageIcon from '../assets/package.svg'

type InfrastructureRow = {
  address: string
  capacity: string
  latitude: string
  longitude: string
  model: string
  note: string
  pole: string
  registeredAt: string
  station: string
}

const rows: readonly InfrastructureRow[] = [
  { station: '고산주유소', pole: '알뜰', model: 'HG1000S', capacity: '1,500L', address: '전남 순천시 서면 사단4길 3', note: '셀프', latitude: '34.9507', longitude: '127.4872', registeredAt: '2025. 03. 12' },
  { station: '역삼주유소', pole: 'GS칼텍스', model: 'HG500S', capacity: '2,000L', address: '서울 강남구 역삼로 134', note: '셀프', latitude: '37.5012', longitude: '127.0365', registeredAt: '2025. 05. 08' },
  { station: '판교주유소', pole: 'SK에너지', model: 'HEUD-SELF-05', capacity: '2,500L', address: '경기 성남시 분당구 판교로 15', note: '-', latitude: '37.3947', longitude: '127.1112', registeredAt: '2025. 07. 21' },
  { station: '마포주유소', pole: 'S-OIL', model: 'HG1000S', capacity: '1,800L', address: '서울 마포구 월드컵북로 32', note: '일반', latitude: '37.5565', longitude: '126.9082', registeredAt: '2025. 01. 15' },
  { station: '인천주유소', pole: '현대오일뱅크', model: 'HEUD-SELF-05', capacity: '3,000L', address: '인천 남동구 소래로 88', note: '셀프', latitude: '37.3941', longitude: '126.7314', registeredAt: '2024. 11. 30' },
  { station: '송파주유소', pole: '알뜰', model: 'HG500S', capacity: '1,200L', address: '서울 송파구 올림픽로 120', note: '-', latitude: '37.5145', longitude: '127.1058', registeredAt: '2025. 09. 04' },
  { station: '수원주유소', pole: 'GS칼텍스', model: 'HG1000S', capacity: '2,200L', address: '경기 수원시 팔달구 효원로 51', note: '셀프', latitude: '37.2636', longitude: '127.0286', registeredAt: '2025. 06. 18' },
  { station: '부산주유소', pole: 'SK에너지', model: 'HEUD-SELF-05', capacity: '2,500L', address: '부산 해운대구 센텀중앙로 97', note: '일반', latitude: '35.1696', longitude: '129.1314', registeredAt: '2024. 08. 22' },
  { station: '대전주유소', pole: 'S-OIL', model: 'HG500S', capacity: '1,500L', address: '대전 유성구 대학로 99', note: '셀프', latitude: '36.3627', longitude: '127.3564', registeredAt: '2025. 04. 10' },
  { station: '광주주유소', pole: '현대오일뱅크', model: 'HG1000S', capacity: '2,000L', address: '광주 북구 용봉로 77', note: '-', latitude: '35.1756', longitude: '126.9121', registeredAt: '2025. 02. 27' },
]

const columns: readonly DataTableColumn<InfrastructureRow>[] = [
  { key: 'station', label: '주유소 이름', render: (row) => row.station },
  { key: 'pole', label: 'Pole', render: (row) => row.pole },
  { key: 'model', label: '모델명', render: (row) => row.model },
  { key: 'capacity', label: '용량', render: (row) => row.capacity },
  { key: 'address', label: '주소', render: (row) => row.address },
  { key: 'note', label: '비고', render: (row) => row.note },
  { key: 'latitude', label: '위도', render: (row) => row.latitude },
  { key: 'longitude', label: '경도', render: (row) => <span className="brand-text">{row.longitude}</span> },
  { key: 'registeredAt', label: '등록일자', render: (row) => <span className="brand-text">{row.registeredAt}</span> },
  {
    key: 'actions',
    label: '관리',
    render: () => (
      <span className="table-actions">
        <a className="table-action" href="#/infrastructure/edit">수정</a>
        <button className="table-action" type="button">삭제</button>
      </span>
    ),
  },
]

export function InfrastructureDataPage() {
  return (
    <section className="data-page" aria-labelledby="infrastructure-data-title">
      <DataPageHeader title="인프라 데이터 목록" titleId="infrastructure-data-title">
        <DateRangeFilter />
        <SearchFilter />
      </DataPageHeader>
      <DataTable columns={columns} rows={rows} getRowKey={(row) => row.station} />
      <a className="floating-action" href="#/infrastructure/new">
        <img src={packageIcon} alt="" />
        인프라 데이터 추가
      </a>
    </section>
  )
}

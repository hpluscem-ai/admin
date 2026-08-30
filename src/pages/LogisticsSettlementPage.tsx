import { DataPageHeader } from '../components/DataPageHeader'
import { SearchFilter } from '../components/PageFilters'

export function LogisticsSettlementPage() {
  return (
    <section className="settlement-page" aria-labelledby="logistics-settlement-title">
      <DataPageHeader title="물류사 정산 관리" titleId="logistics-settlement-title">
        <SearchFilter />
      </DataPageHeader>
    </section>
  )
}

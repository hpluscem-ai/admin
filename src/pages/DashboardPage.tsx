import { navigate } from '../navigation'
import { useEffect, useState } from 'react'
import { DataPageHeader } from '../components/DataPageHeader'
import { NoticeDialog } from '../components/ConfirmationDialog'
import {
  AffiliationFilter,
  DateRangeFilter,
} from '../components/PageFilters'
import { getDashboard, type DashboardData, type DashboardReceipt } from '../dashboard'
import { isInvalidAdminSession } from '../adminAuth'
import { getDefaultDateRange, type DateRange } from '../utils/dateRange'

const numberFormatter = new Intl.NumberFormat('ko-KR')
const chartWidth = 1000
const chartHeight = 240
const chartStrokeInset = 1
const chartMinimumWidth = 760
const maximumDateLabelCount = 12

type SummaryCardProps = {
  helper?: string
  label: string
  linkHref?: string
  unit: string
  value: string
}

function SummaryCard({ helper, label, linkHref, unit, value }: SummaryCardProps) {
  return (
    <article className="summary-card">
      <div className="summary-card__top">
        <p>{label}</p>
        {linkHref ? <a href={linkHref}>데이터 확인하기 →</a> : null}
      </div>
      <div>
        {helper ? <p className="summary-card__helper">{helper}</p> : null}
        <p className="summary-card__value">{value}<span>{unit}</span></p>
      </div>
    </article>
  )
}

function toDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseDateValue(value: string) {
  return new Date(`${value}T00:00:00`)
}

function formatDate(value: string) {
  return value.split('-').join('. ')
}

function formatShortDate(value: string) {
  const [, month, day] = value.split('-')
  return `${month}. ${day}`
}

function getDateValues(range: DateRange) {
  const dates: string[] = []
  if ((Date.parse(range.end) - Date.parse(range.start)) / 86400000 > 10000) return dates
  const cursor = parseDateValue(range.start)
  const endDate = parseDateValue(range.end)

  while (cursor <= endDate) {
    dates.push(toDateValue(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

type RecentReceiptCardProps = {
  receipts: readonly DashboardReceipt[]
  message?: string
}

function RecentReceiptCard({ receipts, message }: RecentReceiptCardProps) {
  const recentReceipts = receipts.slice(0, 5)

  return (
    <article className="recent-card">
      <div className="recent-card__header">
        <p className="recent-card__title">최근 영수 내역</p>
        <a className="recent-card__link" href="/receipts">전체 내역 보기 →</a>
      </div>
      {recentReceipts.length === 0 ? (
        message !== '' && <p className="recent-card__empty">{message ?? '선택한 기간의 영수 내역이 없습니다.'}</p>
      ) : recentReceipts.map((receipt) => (
        <div className="recent-card__row" key={receipt.id}>
          <div>
            <p className="recent-card__mileage">{receipt.status === '적립'
              ? receipt.mileage === null ? '-' : `+${numberFormatter.format(receipt.mileage)}`
              : '0'}마일</p>
            <p className="recent-card__detail">
              {receipt.driverName} 기사님 · {formatDate(receipt.date)}
            </p>
          </div>
          <span className="recent-card__status" data-status={receipt.status}>{receipt.status}</span>
        </div>
      ))}
    </article>
  )
}

type ChartData = {
  affiliationValues: readonly number[]
  commonValues: readonly number[]
  dates: readonly string[]
  ticks: readonly number[]
  yMaximum: number
}

function getChartData(
  points: DashboardData['chart'],
  range: DateRange,
  loaded: boolean,
): ChartData {
  const dates = getDateValues(range)
  const byDate = new Map(points.map(point => [point.date, point]))
  const commonValues = loaded ? dates.map(date => byDate.get(date)?.common ?? 0) : []
  const affiliationValues = loaded ? dates.map(date => byDate.get(date)?.affiliation ?? 0) : []

  const maximumValue = Math.max(0, ...commonValues, ...affiliationValues)
  const tickStep = Math.max(500, Math.ceil(maximumValue / 6 / 500) * 500)
  const yMaximum = tickStep * 6
  const ticks = Array.from({ length: 7 }, (_, index) => yMaximum - tickStep * index)

  return { affiliationValues, commonValues, dates, ticks, yMaximum }
}

type ChartSeries = {
  path: string
  singlePoint?: { x: number; y: number }
}

function getCurvedPath(coordinates: readonly { x: number; y: number }[]) {
  if (coordinates.length === 0) return ''

  return coordinates.slice(1).reduce((path, point, index) => {
    const previousPoint = coordinates[index]
    const controlX = (previousPoint.x + point.x) / 2

    return `${path} C ${controlX},${previousPoint.y} ${controlX},${point.y} ${point.x},${point.y}`
  }, `M ${coordinates[0].x},${coordinates[0].y}`)
}

function getChartSeries(values: readonly number[], yMaximum: number): ChartSeries {
  const drawableHeight = chartHeight - chartStrokeInset * 2
  const coordinates = values.map((value, index) => ({
    x: values.length === 1 ? chartWidth / 2 : index / (values.length - 1) * chartWidth,
    y: chartHeight - chartStrokeInset - value / yMaximum * drawableHeight,
  }))

  return {
    path: getCurvedPath(coordinates),
    singlePoint: coordinates.length === 1 ? coordinates[0] : undefined,
  }
}

function getVisibleDateIndexes(dateCount: number) {
  const visibleCount = Math.min(dateCount, maximumDateLabelCount)

  if (visibleCount <= 1) return new Set([0])

  return new Set(
    Array.from({ length: visibleCount }, (_, index) => (
      Math.round(index * (dateCount - 1) / (visibleCount - 1))
    )),
  )
}

type MileageChartProps = {
  affiliations: DashboardData['affiliations']
  dateRange: DateRange
  points: DashboardData['chart']
  loaded: boolean
  selectedAffiliation: string
  chartAffiliation: string
  onAffiliationChange: (value: string) => void
}

function MileageChart({ affiliations, dateRange, points, loaded, selectedAffiliation, chartAffiliation, onAffiliationChange }: MileageChartProps) {
  const chart = getChartData(points, dateRange, loaded)
  const commonSeries = getChartSeries(chart.commonValues, chart.yMaximum)
  const affiliationSeries = getChartSeries(chart.affiliationValues, chart.yMaximum)
  const visibleDateIndexes = getVisibleDateIndexes(chart.dates.length)
  const chartDescription = `${formatDate(dateRange.start)}부터 ${formatDate(dateRange.end)}까지 일별 마일리지 적립 추이`

  return (
    <section className="dashboard-chart" aria-labelledby="mileage-chart-title">
      <h2 id="mileage-chart-title">마일리지 누적 데이터</h2>
      <div className="dashboard-chart__content">
        <div className="dashboard-chart__toolbar">
          <div className="dashboard-chart__legends" aria-label="차트 범례">
            <p className="dashboard-chart__legend" data-series="common">
              <span aria-hidden="true" />공통 신규 적립 마일리지
            </p>
            {chartAffiliation ? (
              <p className="dashboard-chart__legend" data-series="affiliation">
                <span aria-hidden="true" />{affiliations.find(option => option.value === chartAffiliation)?.label}
              </p>
            ) : null}
          </div>
          <AffiliationFilter options={affiliations} value={selectedAffiliation} onChange={onAffiliationChange} />
        </div>
        <div className="dashboard-chart__body">
          <div
            aria-label={chartDescription}
            className="dashboard-chart__plot"
            role="img"
            style={{ minWidth: `${chartMinimumWidth}px` }}
          >
            <div className="dashboard-chart__grid">
              {chart.ticks.map((value) => (
                <div className="dashboard-chart__grid-row" key={value}>
                  <span>{numberFormatter.format(value)}</span>
                  <i />
                </div>
              ))}
            </div>
            <svg
              aria-hidden="true"
              className="dashboard-chart__line"
              preserveAspectRatio="none"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            >
              <defs>
                <clipPath id="mileage-chart-clip">
                  <rect
                    height={chartHeight + 20}
                    width={chartWidth + 40}
                    x="-20"
                    y="-20"
                  />
                </clipPath>
              </defs>
              <g clipPath="url(#mileage-chart-clip)">
                <path className="dashboard-chart__series dashboard-chart__series--common" d={commonSeries.path} />
                {commonSeries.singlePoint ? (
                  <circle
                    className="dashboard-chart__point dashboard-chart__point--common"
                    cx={commonSeries.singlePoint.x}
                    cy={commonSeries.singlePoint.y}
                    r="4"
                  />
                ) : null}
                {chartAffiliation ? (
                  <>
                    <path className="dashboard-chart__series dashboard-chart__series--affiliation" d={affiliationSeries.path} />
                    {affiliationSeries.singlePoint ? (
                      <circle
                        className="dashboard-chart__point dashboard-chart__point--affiliation"
                        cx={affiliationSeries.singlePoint.x}
                        cy={affiliationSeries.singlePoint.y}
                        r="4"
                      />
                    ) : null}
                  </>
                ) : null}
              </g>
            </svg>
            <div
              className="dashboard-chart__dates"
              style={{ gridTemplateColumns: `repeat(${chart.dates.length}, minmax(0, 1fr))` }}
            >
              {chart.dates.map((date, index) => (
                <span key={date}>
                  {visibleDateIndexes.has(index) ? formatShortDate(date) : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function DashboardPage() {
  const [dateRange, setDateRange] = useState(getDefaultDateRange)
  const [selectedAffiliation, setSelectedAffiliation] = useState('')
  const [dashboardView, setDashboardView] = useState<DashboardData | null>(null)
  const [affiliations, setAffiliations] = useState<DashboardData['affiliations']>([])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [chartQuery, setChartQuery] = useState({ dateRange, affiliation: selectedAffiliation })
  useEffect(() => {
    let current = true
    const routePath = window.location.pathname
    setLoading(true)
    setLoadError('')
    void getDashboard(dateRange, selectedAffiliation).then(data => {
      if (!current || window.location.pathname !== routePath) return
      setDashboardView(data)
      setAffiliations(data.affiliations)
      setChartQuery({ dateRange, affiliation: selectedAffiliation })
      setLoading(false)
    }).catch((error: unknown) => {
      if (!current || window.location.pathname !== routePath) return
      if (isInvalidAdminSession(error)) { navigate('/login'); return }
      setLoadError('데이터를 불러오지 못했습니다. 조회 기간을 다시 선택해주세요.')
      setLoading(false)
    })
    return () => { current = false }
  }, [dateRange, selectedAffiliation, refresh])
  const value = (key: 'accumulatedMileage' | 'settlementMileage' | 'approvedCount' | 'rejectedCount') =>
    dashboardView ? numberFormatter.format(dashboardView[key]) : '-'

  return (
    <section className="dashboard-page" aria-labelledby="dashboard-title">
      <DataPageHeader title="통합 대시보드" titleId="dashboard-title">
        <DateRangeFilter {...dateRange} onChange={setDateRange} />
      </DataPageHeader>
      <div className="dashboard-overview">
        <div className="summary-grid">
          <SummaryCard
            label="누적 적립 마일리지"
            unit="마일"
            value={value('accumulatedMileage')}
          />
          <SummaryCard
            label="정산 예정 마일리지"
            linkHref="/settlements"
            unit="마일"
            value={value('settlementMileage')}
          />
          <SummaryCard
            label="승인 영수 데이터"
            unit="건"
            value={value('approvedCount')}
          />
          <SummaryCard
            label="반려 영수 데이터"
            linkHref="/receipts"
            unit="건"
            value={value('rejectedCount')}
          />
        </div>
        <RecentReceiptCard receipts={dashboardView?.receipts ?? []} message={dashboardView ? undefined : loading ? '데이터를 불러오는 중입니다.' : ''} />
      </div>
      <MileageChart
        affiliations={affiliations}
        dateRange={chartQuery.dateRange}
        points={dashboardView?.chart ?? []}
        loaded={dashboardView !== null}
        selectedAffiliation={selectedAffiliation}
        chartAffiliation={chartQuery.affiliation}
        onAffiliationChange={setSelectedAffiliation}
      />
      {loadError && <NoticeDialog message={loadError}
        onClose={() => setLoadError('')} onRetry={() => setRefresh(current => current + 1)} />}
    </section>
  )
}

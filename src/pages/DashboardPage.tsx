import { useState } from 'react'
import { DataPageHeader } from '../components/DataPageHeader'
import {
  AffiliationFilter,
  DateRangeFilter,
} from '../components/PageFilters'
import {
  createDashboardMockData,
  type DashboardData,
  type DashboardReceipt,
} from '../data/dashboardMockData'
import { getDefaultDateRange, type DateRange } from '../utils/dateRange'

const numberFormatter = new Intl.NumberFormat('ko-KR')
const weekdays = ['일', '월', '화', '수', '목', '금', '토'] as const
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

function formatSettlementDate(value: string) {
  const date = parseDateValue(value)
  return `${formatDate(value)}. (${weekdays[date.getDay()]}) 정산 필요`
}

function getDateValues(range: DateRange) {
  const dates: string[] = []
  const cursor = parseDateValue(range.start)
  const endDate = parseDateValue(range.end)

  while (cursor <= endDate) {
    dates.push(toDateValue(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

function getDashboardView(data: DashboardData, range: DateRange) {
  const receipts: DashboardReceipt[] = []
  let accumulatedMileage = 0
  let settlementMileage = 0
  let matchedCount = 0
  let mismatchedCount = 0

  for (const receipt of data.receipts) {
    if (receipt.date < range.start || receipt.date > range.end) continue

    receipts.push(receipt)

    if (receipt.status === '적립') accumulatedMileage += receipt.mileage
    if (receipt.settlementEligible) settlementMileage += receipt.mileage
    if (receipt.isMatch) matchedCount += 1
    else mismatchedCount += 1
  }

  receipts.sort((left, right) => right.date.localeCompare(left.date))

  return {
    accumulatedMileage,
    matchedCount,
    mismatchedCount,
    receipts,
    settlementMileage,
  }
}

type RecentReceiptCardProps = {
  receipts: readonly DashboardReceipt[]
}

function RecentReceiptCard({ receipts }: RecentReceiptCardProps) {
  const recentReceipts = receipts.slice(0, 5)

  return (
    <article className="recent-card">
      <div className="recent-card__header">
        <p className="recent-card__title">최근 영수 내역</p>
        <a className="recent-card__link" href="#/receipts">전체 내역 보기 →</a>
      </div>
      {recentReceipts.length === 0 ? (
        <p className="recent-card__empty">선택한 기간의 영수 내역이 없습니다.</p>
      ) : recentReceipts.map((receipt) => (
        <div className="recent-card__row" key={receipt.id}>
          <div>
            <p className="recent-card__mileage">+{numberFormatter.format(receipt.mileage)}마일</p>
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
  receipts: readonly DashboardReceipt[],
  range: DateRange,
  selectedAffiliation: string,
): ChartData {
  const dates = getDateValues(range)
  const dateIndexes = new Map(dates.map((date, index) => [date, index]))
  const commonValues = dates.map(() => 0)
  const affiliationValues = dates.map(() => 0)

  for (const receipt of receipts) {
    if (receipt.status !== '적립') continue

    const index = dateIndexes.get(receipt.date)
    if (index === undefined) continue

    commonValues[index] += receipt.mileage
    if (receipt.affiliation === selectedAffiliation) {
      affiliationValues[index] += receipt.mileage
    }
  }

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
  affiliations: readonly string[]
  dateRange: DateRange
  receipts: readonly DashboardReceipt[]
}

function MileageChart({ affiliations, dateRange, receipts }: MileageChartProps) {
  const [selectedAffiliation, setSelectedAffiliation] = useState('')
  const chart = getChartData(receipts, dateRange, selectedAffiliation)
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
            {selectedAffiliation ? (
              <p className="dashboard-chart__legend" data-series="affiliation">
                <span aria-hidden="true" />{selectedAffiliation}
              </p>
            ) : null}
          </div>
          <AffiliationFilter options={affiliations} onChange={setSelectedAffiliation} />
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
                {selectedAffiliation ? (
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
  const [dashboardData] = useState(() => createDashboardMockData())
  const [dateRange, setDateRange] = useState(getDefaultDateRange)
  const dashboardView = getDashboardView(dashboardData, dateRange)
  const affiliations = Array.from(new Set(dashboardData.receipts.map((receipt) => receipt.affiliation)))

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
            value={numberFormatter.format(dashboardView.accumulatedMileage)}
          />
          <SummaryCard
            helper={formatSettlementDate(dashboardData.settlementDate)}
            label="정산 예정 마일리지"
            linkHref="#/settlements"
            unit="마일"
            value={numberFormatter.format(dashboardView.settlementMileage)}
          />
          <SummaryCard
            label="일치 영수 데이터"
            unit="건"
            value={numberFormatter.format(dashboardView.matchedCount)}
          />
          <SummaryCard
            label="미일치 영수 데이터"
            linkHref="#/receipts"
            unit="건"
            value={numberFormatter.format(dashboardView.mismatchedCount)}
          />
        </div>
        <RecentReceiptCard receipts={dashboardView.receipts} />
      </div>
      <MileageChart
        affiliations={affiliations}
        dateRange={dateRange}
        receipts={dashboardView.receipts}
      />
    </section>
  )
}

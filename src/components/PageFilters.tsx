import { useState } from 'react'
import calendarIcon from '../assets/calendar.svg'
import chevronDownIcon from '../assets/chevron-down.svg'
import searchIcon from '../assets/search.svg'

type SearchFilterProps = {
  placeholder?: string
}

export function SearchFilter({
  placeholder = '기사님 성함으로 검색해주세요.',
}: SearchFilterProps) {
  return (
    <label className="filter-control">
      <span className="sr-only">기사 검색</span>
      <img className="filter-control__icon filter-control__icon--search" src={searchIcon} alt="" />
      <input className="filter-control__input" type="search" placeholder={placeholder} />
    </label>
  )
}

export type DateRange = {
  end: string
  start: string
}

type DateRangeFilterProps = Partial<DateRange> & {
  onChange?: (range: DateRange) => void
}

function formatDate(date: string) {
  return date.split('-').join('. ')
}

export function DateRangeFilter({ start, end, onChange }: DateRangeFilterProps) {
  const [internalRange, setInternalRange] = useState<DateRange>(() => ({
    start: start ?? '2026-08-01',
    end: end ?? '2026-08-10',
  }))
  const isControlled = start !== undefined && end !== undefined
  const range = isControlled ? { start, end } : internalRange

  function updateRange(nextRange: DateRange) {
    if (!isControlled) setInternalRange(nextRange)
    onChange?.(nextRange)
  }

  function handleStartChange(nextStart: string) {
    if (!nextStart) return

    updateRange({
      start: nextStart,
      end: nextStart > range.end ? nextStart : range.end,
    })
  }

  function handleEndChange(nextEnd: string) {
    if (!nextEnd) return

    updateRange({
      start: nextEnd < range.start ? nextEnd : range.start,
      end: nextEnd,
    })
  }

  return (
    <div className="date-range-filter" role="group" aria-label="조회 기간">
      <label className="date-filter">
        <img className="filter-control__icon" src={calendarIcon} alt="" />
        <span aria-hidden="true">{formatDate(range.start)}</span>
        <input
          aria-label="조회 시작일"
          className="date-filter__picker"
          max={range.end}
          onChange={(event) => handleStartChange(event.target.value)}
          type="date"
          value={range.start}
        />
      </label>
      <span aria-hidden="true">~</span>
      <label className="date-filter">
        <img className="filter-control__icon" src={calendarIcon} alt="" />
        <span aria-hidden="true">{formatDate(range.end)}</span>
        <input
          aria-label="조회 종료일"
          className="date-filter__picker"
          min={range.start}
          onChange={(event) => handleEndChange(event.target.value)}
          type="date"
          value={range.end}
        />
      </label>
    </div>
  )
}

type AffiliationFilterProps = {
  onChange?: (affiliation: string) => void
  options?: readonly string[]
}

const defaultAffiliations = ['에이치플러스주유소', '하나에너지', '성북주유소'] as const

export function AffiliationFilter({
  onChange,
  options = defaultAffiliations,
}: AffiliationFilterProps = {}) {
  return (
    <label className="filter-control filter-control--select">
      <span className="sr-only">소속 선택</span>
      <select
        className="filter-control__select"
        defaultValue=""
        onChange={(event) => onChange?.(event.target.value)}
      >
        <option value="">소속을 선택해주세요.</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <img className="filter-control__icon filter-control__icon--chevron" src={chevronDownIcon} alt="" />
    </label>
  )
}

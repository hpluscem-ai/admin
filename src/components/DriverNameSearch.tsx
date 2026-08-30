import searchIcon from '../assets/search.svg'

type DriverNameSearchProps = {
  onChange: (value: string) => void
  value: string
}

export function DriverNameSearch({ onChange, value }: DriverNameSearchProps) {
  return (
    <label className="filter-control">
      <span className="sr-only">기사 이름 검색</span>
      <img
        className="filter-control__icon filter-control__icon--search"
        src={searchIcon}
        alt=""
      />
      <input
        aria-label="기사 이름 검색"
        className="filter-control__input"
        type="search"
        placeholder="기사님 성함으로 검색해주세요."
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

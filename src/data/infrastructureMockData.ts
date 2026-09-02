export type InfrastructureData = {
  address: string
  capacity: string
  id: string
  latitude: string
  longitude: string
  model: string
  note: string
  pole: string
  registeredAt: string
  station: string
}

const yeoksamInfrastructureSeed = {
  station: '역삼주유소',
  pole: 'GS칼텍스',
  model: 'HG500S',
  capacity: '2,000L',
  address: '서울 강남구 역삼로 134',
  latitude: '37.5012',
  longitude: '127.0365',
  note: '셀프',
} as const satisfies Omit<InfrastructureData, 'id' | 'registeredAt'>

const infrastructureSeeds = [
  { station: '고산주유소', pole: '알뜰', model: 'HG1000S', capacity: '1,500L', address: '전남 순천시 서면 사단4길 3', note: '셀프', latitude: '34.9507', longitude: '127.4872', daysAgo: 2 },
  { ...yeoksamInfrastructureSeed, daysAgo: 4 },
  { station: '판교주유소', pole: 'SK에너지', model: 'HEUD-SELF-05', capacity: '2,500L', address: '경기 성남시 분당구 판교로 15', note: '-', latitude: '37.3947', longitude: '127.1112', daysAgo: 6 },
  { station: '마포주유소', pole: 'S-OIL', model: 'HG1000S', capacity: '1,800L', address: '서울 마포구 월드컵북로 32', note: '일반', latitude: '37.5565', longitude: '126.9082', daysAgo: 9 },
  { station: '인천주유소', pole: '현대오일뱅크', model: 'HEUD-SELF-05', capacity: '3,000L', address: '인천 남동구 소래로 88', note: '셀프', latitude: '37.3941', longitude: '126.7314', daysAgo: 12 },
  { station: '송파주유소', pole: '알뜰', model: 'HG500S', capacity: '1,200L', address: '서울 송파구 올림픽로 120', note: '-', latitude: '37.5145', longitude: '127.1058', daysAgo: 15 },
  { station: '수원주유소', pole: 'GS칼텍스', model: 'HG1000S', capacity: '2,200L', address: '경기 수원시 팔달구 효원로 51', note: '셀프', latitude: '37.2636', longitude: '127.0286', daysAgo: 18 },
  { station: '부산주유소', pole: 'SK에너지', model: 'HEUD-SELF-05', capacity: '2,500L', address: '부산 해운대구 센텀중앙로 97', note: '일반', latitude: '35.1696', longitude: '129.1314', daysAgo: 21 },
  { station: '대전주유소', pole: 'S-OIL', model: 'HG500S', capacity: '1,500L', address: '대전 유성구 대학로 99', note: '셀프', latitude: '36.3627', longitude: '127.3564', daysAgo: 24 },
  { station: '광주주유소', pole: '현대오일뱅크', model: 'HG1000S', capacity: '2,000L', address: '광주 북구 용봉로 77', note: '-', latitude: '35.1756', longitude: '126.9121', daysAgo: 28 },
] as const satisfies readonly (Omit<InfrastructureData, 'id' | 'registeredAt'> & {
  daysAgo: number
})[]

function toDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * 서버 인프라 목록 API가 준비되기 전까지만 사용하는 임시 데이터다.
 * 목록 연동 시 infrastructureSeeds와 InfrastructureDataPage의 호출을 제거하면 된다.
 */
export function createInfrastructureMockData(
  referenceDate = new Date(),
): readonly InfrastructureData[] {
  const anchorDate = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  )

  return infrastructureSeeds.map(({ daysAgo, ...infrastructure }, index) => {
    const registeredAt = new Date(anchorDate)
    registeredAt.setDate(anchorDate.getDate() - daysAgo)

    return {
      ...infrastructure,
      id: `infrastructure-mock-${index}`,
      registeredAt: toDateValue(registeredAt),
    }
  })
}

export function getInfrastructureMockDataById(id: string) {
  return createInfrastructureMockData().find((infrastructure) => infrastructure.id === id)
}

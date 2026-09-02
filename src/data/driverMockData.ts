export type DriverData = {
  affiliation: string
  email: string
  id: string
  joinedAt: string
  mileage: number
  name: string
  phone: string
  totalAmount: number
}

const driverSeeds = [
  { affiliation: '하나에너지', name: '김도윤', phone: '010-3847-2951', email: 'doyun.kim@hanaenergy.kr', totalAmount: 52_300, mileage: 523, daysAgo: 2 },
  { affiliation: '성북주유소', name: '이수빈', phone: '010-7263-4108', email: 'subin.lee@sbgas.co.kr', totalAmount: 38_750, mileage: 387, daysAgo: 5 },
  { affiliation: '푸른에너지', name: '박현우', phone: '010-5521-8734', email: 'hw.park@pureun.kr', totalAmount: 0, mileage: 0, daysAgo: 8 },
  { affiliation: '동작주유소', name: '최예진', phone: '010-9184-3260', email: 'yejin.choi@djgas.kr', totalAmount: 61_200, mileage: 612, daysAgo: 12 },
  { affiliation: '하나에너지', name: '정민석', phone: '010-4432-7891', email: 'ms.jung@hanaenergy.kr', totalAmount: 15_800, mileage: 158, daysAgo: 16 },
  { affiliation: '영등포에너지', name: '강서윤', phone: '010-6178-5042', email: 'sy.kang@ydpenergy.kr', totalAmount: 0, mileage: 0, daysAgo: 20 },
  { affiliation: '마포주유소', name: '오태민', phone: '010-2395-6817', email: 'tm.oh@mapogas.kr', totalAmount: 43_600, mileage: 436, daysAgo: 24 },
  { affiliation: '강서에너지', name: '신유나', phone: '010-8056-1423', email: 'yuna.shin@gsenergy.kr', totalAmount: 31_950, mileage: 319, daysAgo: 28 },
  { affiliation: '관악주유소', name: '임하준', phone: '010-1749-8365', email: 'hj.lim@gwanakgas.kr', totalAmount: 0, mileage: 0, daysAgo: 45 },
  { affiliation: '서초에너지', name: '배지호', phone: '010-6924-3570', email: 'jiho.bae@scenergy.kr', totalAmount: 24_850, mileage: 248, daysAgo: 90 },
] as const satisfies readonly (Omit<DriverData, 'id' | 'joinedAt'> & {
  daysAgo: number
})[]

function toDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * 서버 기사 목록 API가 준비되기 전까지만 사용하는 임시 데이터다.
 * 연동 시 이 파일과 DriverDataPage의 createDriverMockData 호출만 제거하면 된다.
 */
export function createDriverMockData(referenceDate = new Date()): readonly DriverData[] {
  const anchorDate = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  )

  return driverSeeds.map(({ daysAgo, ...driver }, index) => {
    const joinedAt = new Date(anchorDate)
    joinedAt.setDate(anchorDate.getDate() - daysAgo)

    return {
      ...driver,
      id: `driver-mock-${index}`,
      joinedAt: toDateValue(joinedAt),
    }
  })
}

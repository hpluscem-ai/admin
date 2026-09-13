import { useSyncExternalStore } from 'react'
import './App.css'
import { AdminLayout } from './components/AdminLayout'
import { getInfrastructureMockDataById } from './data/infrastructureMockData'
import { getLogisticsSettlementMockDataById } from './data/logisticsSettlementMockData'
import { DashboardPage } from './pages/DashboardPage'
import { DriverDataPage } from './pages/DriverDataPage'
import { ErdPage } from './pages/ErdPage'
import { InfrastructureDataPage } from './pages/InfrastructureDataPage'
import { InfrastructureCreatePage, InfrastructureEditPage } from './pages/InfrastructureFormPage'
import { LoginPage } from './pages/LoginPage'
import { LogisticsCreatePage, LogisticsEditPage } from './pages/LogisticsFormPage'
import { LogisticsSettlementPage } from './pages/LogisticsSettlementPage'
import { ReceiptDataPage } from './pages/ReceiptDataPage'

const routes = {
  '/dashboard': { activeMenu: '대시보드', Page: DashboardPage },
  '/drivers': { activeMenu: '소속 기사 데이터 목록', Page: DriverDataPage },
  '/erd': { activeMenu: '통합 DB 구조', Page: ErdPage },
  '/infrastructure': { activeMenu: '인프라 데이터 목록', Page: InfrastructureDataPage },
  '/infrastructure/new': { activeMenu: '인프라 데이터 목록', Page: InfrastructureCreatePage },
  '/receipts': { activeMenu: '영수 데이터 목록', Page: ReceiptDataPage },
  '/settlements': { activeMenu: '물류사 정산 관리', Page: LogisticsSettlementPage },
  '/settlements/new': { activeMenu: '물류사 정산 관리', Page: LogisticsCreatePage },
} as const

const infrastructureEditRoutePrefix = '/infrastructure/edit/'
const logisticsEditRoutePrefix = '/settlements/edit/'

function subscribeToRoute(callback: () => void) {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

function getRoute() {
  return window.location.hash.slice(1)
}

function getRouteId(path: string, routePrefix: string) {
  if (!path.startsWith(routePrefix)) return undefined

  const encodedId = path.slice(routePrefix.length)

  if (!encodedId) return ''

  try {
    return decodeURIComponent(encodedId)
  } catch {
    return ''
  }
}

function App() {
  const path = useSyncExternalStore(subscribeToRoute, getRoute, getRoute)

  if (!path || path === '/login') return <LoginPage />

  const infrastructureEditId = getRouteId(path, infrastructureEditRoutePrefix)

  if (infrastructureEditId !== undefined) {
    const initialValues = getInfrastructureMockDataById(infrastructureEditId)

    return (
      <AdminLayout activeMenu="인프라 데이터 목록">
        {initialValues ? (
          <InfrastructureEditPage key={infrastructureEditId} initialValues={initialValues} />
        ) : (
          <InfrastructureDataPage />
        )}
      </AdminLayout>
    )
  }

  const logisticsEditId = getRouteId(path, logisticsEditRoutePrefix)

  if (logisticsEditId !== undefined) {
    const initialValues = getLogisticsSettlementMockDataById(logisticsEditId)

    return (
      <AdminLayout activeMenu="물류사 정산 관리">
        {initialValues ? (
          <LogisticsEditPage key={logisticsEditId} initialValues={initialValues} />
        ) : (
          <LogisticsSettlementPage />
        )}
      </AdminLayout>
    )
  }

  const route = routes[path as keyof typeof routes] ?? routes['/dashboard']
  const Page = route.Page

  return (
    <AdminLayout activeMenu={route.activeMenu}>
      <Page />
    </AdminLayout>
  )
}

export default App

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AdminApiError, getCurrentAdmin, isInvalidAdminSession, loginAdmin } from './adminAuth'
import './App.css'
import { AdminLayout } from './components/AdminLayout'
import { DashboardPage } from './pages/DashboardPage'
import { DriverDataPage } from './pages/DriverDataPage'
import { ErdPage } from './pages/ErdPage'
import { InfrastructureDataPage } from './pages/InfrastructureDataPage'
import { InfrastructureCreatePage, InfrastructureEditPage } from './pages/InfrastructureFormPage'
import { LoginPage, type AdminLoginCredentials } from './pages/LoginPage'
import { LogisticsCreatePage, LogisticsEditPage } from './pages/LogisticsFormPage'
import { LogisticsSettlementPage } from './pages/LogisticsSettlementPage'
import { ReceiptDataPage } from './pages/ReceiptDataPage'
import { navigate } from './navigation'

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
  window.addEventListener('popstate', callback)
  return () => window.removeEventListener('popstate', callback)
}

function getRoute() {
  return window.location.pathname
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

  const activeRequest = useRef<object | null>(null)
  const [session, setSession] = useState<{
    path: string
    status: 'signedIn' | 'signedOut' | 'error'
  } | null>(null)

  useEffect(() => {
    const current = {}
    activeRequest.current = current
    setSession(null)
    void getCurrentAdmin().then(() => {
      if (activeRequest.current !== current) return
      setSession({ path, status: 'signedIn' })
      if (path === '/' || path === '/login') navigate('/dashboard')
    }).catch((error: unknown) => {
      if (activeRequest.current !== current) return
      const invalid = isInvalidAdminSession(error)
      setSession({ path, status: invalid ? 'signedOut' : 'error' })
    })
    return () => { activeRequest.current = null }
  }, [path])

  async function authenticate(credentials: AdminLoginCredentials) {
    const current = {}
    activeRequest.current = current
    try {
      await loginAdmin(credentials)
      if (activeRequest.current !== current) return { ok: false } as const
      setSession({ path, status: 'signedIn' })
      return { ok: true } as const
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401 && error.code === 'INVALID_CREDENTIALS') {
        return { ok: false } as const
      }
      throw error
    }
  }

  if (!session || session.path !== path) return null
  if (session.status !== 'signedIn') {
    return <LoginPage key={`${path}:${session.status}`} authenticate={authenticate} requestFailed={session.status === 'error'} />
  }

  const infrastructureEditId = getRouteId(path, infrastructureEditRoutePrefix)

  if (infrastructureEditId !== undefined) {
    return (
      <AdminLayout activeMenu="인프라 데이터 목록">
        <InfrastructureEditPage key={infrastructureEditId} id={infrastructureEditId} />
      </AdminLayout>
    )
  }

  const logisticsEditId = getRouteId(path, logisticsEditRoutePrefix)

  if (logisticsEditId !== undefined) {
    return (
      <AdminLayout activeMenu="물류사 정산 관리">
        <LogisticsEditPage key={logisticsEditId} id={logisticsEditId} />
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

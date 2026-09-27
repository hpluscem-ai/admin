import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const authSource = compile('../src/adminAuth.ts')
const appSource = compile('../src/App.tsx')
const tick = () => new Promise((resolve) => setImmediate(resolve))
const admin = { id: 'admin-id', email: 'admin@example.test', name: '관리자' }
const credentials = { email: ' admin@example.test ', password: ' Password!1 ' }

function mount(path = '/drivers') {
  const calls = [], slots = [], effects = []
  const window = { location: { pathname: path } }
  const fetch = (url, options) => {
    const pending = Promise.withResolvers()
    calls.push({ url, options, ...pending })
    return pending.promise
  }
  const auth = {}
  new Function('exports', 'fetch', authSource)(auth, fetch)
  let index = 0
  const slot = (initial) => {
    const key = index++
    if (!(key in slots)) slots[key] = initial
    return key
  }
  const react = {
    useRef(initial) { return slots[slot({ current: initial })] },
    useState(initial) {
      const key = slot(initial)
      return [slots[key], (value) => { slots[key] = typeof value === 'function' ? value(slots[key]) : value }]
    },
    useEffect(effect, deps) {
      const key = slot(null), previous = slots[key]
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
        effects.push(() => { previous?.cleanup?.(); slots[key] = { deps, cleanup: effect() } })
      }
    },
    useSyncExternalStore: (_, snapshot) => snapshot(),
  }
  const jsx = (type, props) => ({ type, props })
  const imports = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, './App.css': {}, './adminAuth': auth,
    './components/AdminLayout': { AdminLayout: 'AdminLayout' },
    './data/infrastructureMockData': { getInfrastructureMockDataById: () => null },
    './data/logisticsSettlementMockData': { getLogisticsSettlementMockDataById: () => null },
    './pages/InfrastructureFormPage': { InfrastructureCreatePage: 'InfrastructureCreatePage', InfrastructureEditPage: 'InfrastructureEditPage' },
    './pages/LogisticsFormPage': { LogisticsCreatePage: 'LogisticsCreatePage', LogisticsEditPage: 'LogisticsEditPage' },
  }
  for (const name of ['DashboardPage', 'DriverDataPage', 'InfrastructureDataPage',
    'LoginPage', 'LogisticsSettlementPage', 'ReceiptDataPage']) imports[`./pages/${name}`] = { [name]: name }
  const exports = {}
  new Function('require', 'exports', 'window', appSource)((name) => {
    if (name.endsWith('/navigation')) return { navigate: (path) => { window.location.pathname = path } }
    assert.ok(name in imports, `Unexpected import ${name}`)
    return imports[name]
  }, exports, window)
  const page = {
    calls, auth,
    render() { index = 0; const tree = exports.default(); effects.splice(0).forEach((effect) => effect()); return tree },
    navigate(path) { window.location.pathname = path; return page.render() },
    async respond(index, status = 200, data = admin) {
      calls[index].resolve(Response.json(data, { status }))
      await tick()
    },
  }
  page.render()
  return page
}

test('direct protected routes wait for a real administrator session and reject anonymous access', async () => {
  for (const path of ['/dashboard', '/drivers', '/infrastructure/edit/example', '/settlements/edit/example', '/receipts']) {
    const page = mount(path)
    assert.equal(page.render(), null)
    assert.equal(page.calls[0].url, '/api/v1/admin/auth/me')
    await page.respond(0, 401, { code: 'INVALID_ADMIN_SESSION' })
    assert.equal(page.render().type, 'LoginPage')
    assert.equal(page.render().props.requestFailed, false)
  }
})

test('restored sessions show the selected page and recheck expiry on navigation', async () => {
  const page = mount('/drivers')
  await page.respond(0)
  assert.equal(page.render().type, 'AdminLayout')
  assert.equal(page.render().props.children.type, 'DriverDataPage')
  const pending = page.navigate('/receipts')
  assert.equal(pending.type, 'AdminLayout')
  assert.equal(pending.props.children, null)
  assert.equal(page.render().props.children, null)
  assert.equal(page.calls[1].url, '/api/v1/admin/auth/me')
  await page.respond(1, 401, { code: 'INVALID_ADMIN_SESSION' })
  assert.equal(page.render().type, 'LoginPage')
})

test('page changes retain the layout and wait for authentication before mounting each destination', async () => {
  const page = mount('/drivers')
  await page.respond(0)
  const layout = page.render().type
  const destinations = [
    ['/dashboard', 'DashboardPage', '대시보드'],
    ['/infrastructure', 'InfrastructureDataPage', '인프라 데이터 목록'],
    ['/infrastructure/new', 'InfrastructureCreatePage', '인프라 데이터 목록'],
    ['/infrastructure/edit/station-id', 'InfrastructureEditPage', '인프라 데이터 목록'],
    ['/receipts', 'ReceiptDataPage', '영수 데이터 목록'],
    ['/settlements', 'LogisticsSettlementPage', '물류사 정산 관리'],
    ['/settlements/new', 'LogisticsCreatePage', '물류사 정산 관리'],
    ['/settlements/edit/company-id', 'LogisticsEditPage', '물류사 정산 관리'],
    ['/drivers', 'DriverDataPage', '소속 기사 데이터 목록'],
  ]
  for (const [path, component, menu] of destinations) {
    for (const pending of [page.navigate(path), page.render()]) {
      assert.equal(pending.type, layout)
      assert.equal(pending.props.activeMenu, menu)
      assert.equal(pending.props.children, null)
    }
    await page.respond(page.calls.length - 1)
    const loaded = page.render()
    assert.equal(loaded.type, layout)
    assert.equal(loaded.props.children.type, component)
  }
})

test('returning to the last authenticated route waits for its new check and ignores stale success', async () => {
  const page = mount('/drivers')
  await page.respond(0)
  page.navigate('/receipts')
  assert.equal(page.navigate('/drivers').props.children, null)
  await page.respond(2, 401, { code: 'INVALID_ADMIN_SESSION' })
  await page.respond(1)
  assert.equal(page.render().type, 'LoginPage')
  assert.equal(page.navigate('/receipts'), null)
})

test('a failed session recheck hides the layout and keeps the existing login error', async () => {
  const page = mount('/drivers')
  await page.respond(0)
  assert.equal(page.navigate('/receipts').type, 'AdminLayout')
  await page.respond(1, 500, { code: 'INTERNAL_SERVER_ERROR' })
  assert.equal(page.render().type, 'LoginPage')
  assert.equal(page.render().props.requestFailed, true)
})

test('retryable restoration errors use the existing login error and successful login verifies me', async () => {
  const page = mount('/login')
  await page.respond(0, 500, { code: 'INTERNAL_SERVER_ERROR' })
  assert.equal(page.render().props.requestFailed, true)
  const pending = page.render().props.authenticate(credentials)
  assert.equal(page.calls[1].url, '/api/v1/admin/auth/web/login')
  assert.deepEqual(JSON.parse(page.calls[1].options.body), { email: credentials.email.trim(), password: credentials.password })
  await page.respond(1, 200, { expiresAt: '2099-01-01T00:00:00Z' })
  assert.equal(page.calls[2].url, '/api/v1/admin/auth/me')
  assert.equal(page.render().type, 'LoginPage')
  await page.respond(2)
  assert.deepEqual(await pending, { ok: true })
  assert.equal(page.render().type, 'AdminLayout')
  for (const { options } of page.calls) {
    assert.equal(options.credentials, 'include')
    assert.equal(options.cache, 'no-store')
    assert.equal(options.headers?.Authorization, undefined)
    assert.ok(options.signal instanceof AbortSignal)
  }
})

test('bad credentials and failed post-login session confirmation cannot unlock routes', async () => {
  const page = mount()
  await page.respond(0, 401, { code: 'INVALID_ADMIN_SESSION' })
  const login = page.render().props.authenticate
  const bad = login(credentials)
  await page.respond(1, 401, { code: 'INVALID_CREDENTIALS' })
  assert.deepEqual(await bad, { ok: false })
  const pending = login(credentials)
  const rejected = assert.rejects(pending, { code: 'INVALID_ADMIN_SESSION' })
  await page.respond(2, 200, { expiresAt: '2099-01-01T00:00:00Z' })
  await page.respond(3, 401, { code: 'INVALID_ADMIN_SESSION' })
  await rejected
  assert.equal(page.render().type, 'LoginPage')
})

test('a stale session response cannot override a newer route check', async () => {
  const page = mount('/drivers')
  page.navigate('/receipts')
  await page.respond(1)
  await page.respond(0, 401, { code: 'INVALID_ADMIN_SESSION' })
  assert.equal(page.render().props.children.type, 'ReceiptDataPage')
})

test('the removed ERD route uses the existing dashboard fallback', async () => {
  const page = mount('/erd')
  assert.equal(page.render(), null)
  await page.respond(0)
  assert.equal(page.render().props.children.type, 'DashboardPage')
  assert.equal(page.render().props.activeMenu, '대시보드')
})

test('malformed administrator data and network failure are errors rather than authenticated state', async () => {
  const page = mount()
  await page.respond(0, 200, { id: 'admin-id' })
  assert.equal(page.render().props.requestFailed, true)
  const pending = page.render().props.authenticate(credentials)
  const rejected = assert.rejects(pending, TypeError)
  page.calls[1].reject(new TypeError('offline'))
  await rejected
  assert.equal(page.render().type, 'LoginPage')
})

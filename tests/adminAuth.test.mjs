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
      return [slots[key], (value) => { slots[key] = value }]
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
  for (const name of ['DashboardPage', 'DriverDataPage', 'ErdPage', 'InfrastructureDataPage',
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
  for (const path of ['/dashboard', '/drivers', '/infrastructure/edit/example', '/settlements/edit/example', '/erd']) {
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
  assert.equal(page.navigate('/erd'), null)
  await page.respond(1, 401, { code: 'INVALID_ADMIN_SESSION' })
  assert.equal(page.render().type, 'LoginPage')
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
  page.navigate('/erd')
  await page.respond(1)
  await page.respond(0, 401, { code: 'INVALID_ADMIN_SESSION' })
  assert.equal(page.render().props.children.type, 'ErdPage')
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

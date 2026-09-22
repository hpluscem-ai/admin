import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const sources = Object.fromEntries(['adminAuth.ts', 'receipts.ts', 'pages/ReceiptDataPage.tsx'].map((path) => [path,
  ts.transpileModule(readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText]))
const jsx = (type, props) => ({ type, props })
const tick = () => new Promise((resolve) => setImmediate(resolve))
const row = (id, company = 'company-a') => ({ id, userId: 'user-' + id, logisticsCompanyId: company,
  logisticsCompanyName: '같은 회사명', name: '기사 ' + id, phone: '010-1234-5678', receiptAmount: null,
  meterAmount: null, finalAmount: null, mileageAmount: null, receiptAt: null, status: 'pending',
  matchStatus: 'pending', photos: { receipt: `/api/v1/admin/mileage/applications/${id}/photos/receipt`, meter: null } })
function find(node, type) {
  if (!node || typeof node !== 'object') return undefined
  if (node.type === type) return node
  return [node.props?.children].flat(Infinity).map((child) => find(child, type)).find(Boolean)
}
function mount() {
  const calls = [], slots = [], effects = []
  const window = { location: { hash: '#/receipts' } }
  let index = 0
  const react = {
    useRef(initial) { const key = index++; if (!(key in slots)) slots[key] = { current: initial }; return slots[key] },
    useState(initial) {
      const key = index++
      if (!(key in slots)) slots[key] = initial
      return [slots[key], (value) => { slots[key] = typeof value === 'function' ? value(slots[key]) : value }]
    },
    useEffect(effect, deps) {
      const key = index++, previous = slots[key]
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
        effects.push(() => { previous?.cleanup?.(); slots[key] = { deps, cleanup: effect() } })
      }
    },
  }
  const imports = { react, 'react/jsx-runtime': { jsx, jsxs: jsx } }
  const fetch = (url, options) => {
    const pending = Promise.withResolvers()
    calls.push({ url, options, ...pending })
    return pending.promise
  }
  const load = (path) => {
    const exports = {}
    new Function('require', 'exports', 'fetch', 'window', sources[path])((name) => {
      if (name.endsWith('.svg')) return { default: name }
      assert.ok(name in imports, `Unexpected import ${name}`)
      return imports[name]
    }, exports, fetch, window)
    return exports
  }
  imports['./adminAuth'] = imports['../adminAuth'] = load('adminAuth.ts')
  imports['../receipts'] = load('receipts.ts')
  imports['../components/PageFilters'] = { AffiliationFilter: 'AffiliationFilter', SearchFilter: 'SearchFilter' }
  for (const name of ['DataPageHeader', 'DataTable']) imports[`../components/${name}`] = { [name]: name }
  const { ReceiptDataPage } = load('pages/ReceiptDataPage.tsx')
  const page = {
    calls, window, api: imports['../receipts'],
    render() { index = 0; const tree = ReceiptDataPage(); effects.splice(0).forEach((effect) => effect()); return tree },
    table() { return find(page.render(), 'DataTable').props },
    change(type, value) { find(page.render(), type).props.onChange(value); page.render() },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()) },
    async respond(index, status, data) { calls[index].resolve(Response.json(data, { status })); await tick() },
  }
  page.render()
  return page
}

test('receipt data uses admin cookies and keeps unknown amounts and OCR states distinct from zero and mismatch', async () => {
  const page = mount()
  assert.equal(page.calls.length, 1)
  assert.equal(page.calls[0].url, '/api/v1/admin/mileage/applications')
  assert.equal(page.calls[0].options.credentials, 'include')
  assert.equal(page.calls[0].options.cache, 'no-store')
  assert.match(page.table().emptyMessage, /불러오는 중/)
  await page.respond(0, 200, [row('a'), row('b', 'company-b')])
  const options = find(page.render(), 'AffiliationFilter').props.options
  assert.deepEqual(options, [{ value: 'company-a', label: '같은 회사명' }, { value: 'company-b', label: '같은 회사명' }])
  const columns = page.table().columns
  for (const key of ['receiptAmount', 'meterAmount', 'finalAmount', 'mileage', 'receiptDate']) {
    assert.equal(columns.find((column) => column.key === key).render(row('a')), '-')
  }
  const match = columns.find((column) => column.key === 'match').render(row('a'))
  assert.equal(match.props.children, '-')
  assert.equal(match.props['data-match'], undefined)
  assert.equal(columns.find((column) => column.key === 'mileage').render({ ...row('a'), mileageAmount: 0 }), '0')
  assert.equal(columns.find((column) => column.key === 'finalAmount').render({ ...row('a'), finalAmount: 12345 }), '12,345')
})

test('filters send encoded names and company IDs while stale results cannot replace the latest query', async () => {
  const page = mount()
  await page.respond(0, 200, [row('a')])
  page.change('SearchFilter', '  김 & %_  ')
  page.change('AffiliationFilter', 'company-b')
  const params = new URL(page.calls[4].url, 'http://localhost').searchParams
  assert.equal(params.get('nameQuery'), '김 & %_')
  assert.equal(params.get('logisticsCompanyId'), 'company-b')
  await page.respond(3, 200, [row('a'), row('b', 'company-b')])
  await page.respond(4, 200, [row('b', 'company-b')])
  await page.respond(1, 200, [row('a')])
  await page.respond(2, 401, { code: 'INVALID_ADMIN_SESSION' })
  assert.deepEqual(page.table().rows, [row('b', 'company-b')])
  assert.equal(page.window.location.hash, '#/receipts')
})

test('empty, failed and malformed results are distinct and changing the query retries failed discovery', async () => {
  const empty = mount()
  await empty.respond(0, 200, [])
  assert.equal(empty.table().emptyMessage, '조회 조건에 맞는 영수 데이터가 없습니다.')
  for (const [status, value] of [[500, {}], [200, {}], [200, [{ ...row('a'), receiptAmount: -1 }]],
    [200, [{ ...row('a'), receiptAmount: 1.5 }]], [200, [{ ...row('a'), receiptAmount: Number.MAX_SAFE_INTEGER + 1 }]], [200, [{ ...row('a'), status: 'unexpected' }]],
    [200, [{ ...row('a'), photos: { receipt: 'https://external.test/private.jpg', meter: null } }]]]) {
    const page = mount()
    await page.respond(0, status, value)
    assert.match(page.table().emptyMessage, /불러오지 못했습니다/)
    assert.deepEqual(page.table().rows, [])
    page.change('SearchFilter', 'retry')
    await page.respond(1, 200, [row('a')])
    await page.respond(2, 200, [row('a')])
    assert.deepEqual(page.table().rows, [row('a')])
  }
})

test('current invalid session redirects while post-navigation responses have no effects', async () => {
  const current = mount()
  await current.respond(0, 401, { code: 'INVALID_ADMIN_SESSION' })
  assert.equal(current.window.location.hash, '/login')
  for (const [status, value] of [[200, [row('a')]], [401, { code: 'INVALID_ADMIN_SESSION' }]]) {
    const page = mount()
    page.unmount()
    page.window.location.hash = '#/settlements'
    await page.respond(0, status, value)
    assert.equal(page.window.location.hash, '#/settlements')
  }
})

test('photo retrieval uses a protected same-origin route and refuses missing, external or non-image results', async () => {
  const page = mount()
  const path = '/api/v1/admin/mileage/applications/12345678-1234-4234-8234-123456789abc/photos/receipt'
  for (const value of [null, 'https://outside.test/image.jpg', '/api/v1/auth/me']) {
    await assert.rejects(page.api.getReceiptPhoto(value))
  }
  const photo = page.api.getReceiptPhoto(path)
  assert.equal(page.calls[1].url, path)
  assert.equal(page.calls[1].options.credentials, 'include')
  assert.equal(page.calls[1].options.cache, 'no-store')
  page.calls[1].resolve(new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { 'Content-Type': 'image/jpeg' } }))
  assert.equal((await photo).size, 3)
  const failure = page.api.getReceiptPhoto(path)
  page.calls[2].resolve(Response.json({ code: 'INVALID_ADMIN_SESSION' }, { status: 401 }))
  await assert.rejects(failure, (error) => error.code === 'INVALID_ADMIN_SESSION')
  const invalid = page.api.getReceiptPhoto(path)
  page.calls[3].resolve(Response.json({}))
  await assert.rejects(invalid)
})

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const sources = Object.fromEntries(['adminAuth.ts', 'drivers.ts', 'utils/dateRange.ts',
  'pages/DriverDataPage.tsx', 'components/PageFilters.tsx'].map((path) => [path,
  ts.transpileModule(readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText]))
const jsx = (type, props) => ({ type, props })
const tick = () => new Promise((resolve) => setImmediate(resolve))
const driver = (id, companyId = 'company-a') => ({ id, logisticsCompanyId: companyId,
  logisticsCompanyName: '같은 회사명', name: `기사 ${id}`, phone: '010-1234-5678',
  email: `${id}@example.test`, joinedAt: '2026-09-13T18:00:00Z' })
function find(node, type) {
  if (!node || typeof node !== 'object') return undefined
  if (node.type === type) return node
  return [node.props?.children].flat(Infinity).map((child) => find(child, type)).find(Boolean)
}
function mount() {
  const calls = [], slots = [], effects = []
  const window = { location: { pathname: '/drivers' } }
  let index = 0
  const react = {
    useRef(initial) { const key = index++; if (!(key in slots)) slots[key] = { current: initial }; return slots[key] },
    useState(initial) {
      const key = index++
      if (!(key in slots)) slots[key] = typeof initial === 'function' ? initial() : initial
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
      if (name.endsWith('/navigation')) return { navigate: (path) => { window.location.pathname = path } }
      assert.ok(name in imports, `Unexpected import ${name}`)
      return imports[name]
    }, exports, fetch, window)
    return exports
  }
  imports['./adminAuth'] = imports['../adminAuth'] = load('adminAuth.ts')
  imports['./utils/dateRange'] = imports['../utils/dateRange'] = load('utils/dateRange.ts')
  imports['../drivers'] = load('drivers.ts')
  const filters = load('components/PageFilters.tsx')
  imports['../components/PageFilters'] = { AffiliationFilter: 'AffiliationFilter', SearchFilter: 'SearchFilter', DateRangeFilter: 'DateRangeFilter' }
  for (const name of ['ConfirmationDialog', 'DataPageHeader', 'DataTable']) imports[`../components/${name}`] = { [name]: name }
  imports['../components/ConfirmationDialog'].NoticeDialog = 'NoticeDialog'
  imports['./ConfirmationDialog'] = imports['../components/ConfirmationDialog']
  const { DriverDataPage } = load('pages/DriverDataPage.tsx')
  const page = {
    calls, window, filters,
    render() { index = 0; const tree = DriverDataPage(); effects.splice(0).forEach((effect) => effect()); return tree },
    table() { return find(page.render(), 'DataTable').props },
    change(type, value) { find(page.render(), type).props.onChange(value); page.render() },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()) },
    async respond(index, status, data) { calls[index].resolve(status === 204 ? new Response(null, { status }) : Response.json(data, { status })); await tick() },
  }
  page.render()
  return page
}

test('all-driver affiliation discovery preserves equal names with distinct IDs; filtered rows use server values', async () => {
  const page = mount()
  assert.equal(page.calls[0].url, '/api/v1/admin/drivers')
  assert.match(page.table().emptyMessage, /불러오는 중/)
  await page.respond(0, 200, [driver('outside-range'), driver('inactive-company-driver', 'company-b')])
  await page.respond(1, 200, [driver('current')])
  const affiliation = find(page.render(), 'AffiliationFilter')
  assert.deepEqual(affiliation.props.options, [
    { value: 'company-a', label: '같은 회사명' }, { value: 'company-b', label: '같은 회사명' },
  ])
  assert.deepEqual(page.table().rows, [driver('current')])
  for (const key of ['mileage', 'totalAmount']) assert.equal(page.table().columns.find((column) => column.key === key).render(driver('current')), '-')
  const date = new Date(driver('current').joinedAt)
  assert.equal(page.table().columns.find((column) => column.key === 'joinedAt').render(driver('current')),
    `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}`)
  page.change('AffiliationFilter', 'company-b')
  assert.equal(new URL(page.calls[2].url, 'http://localhost').searchParams.get('logisticsCompanyId'), 'company-b')
  assert.equal(find(page.render(), 'AffiliationFilter').props.options.length, 2)
  assert.equal(page.calls.filter(({ url }) => url === '/api/v1/admin/drivers').length, 1)
})

test('date filters include both local calendar days; names and IDs are encoded as independent API parameters', async () => {
  const page = mount()
  page.change('DateRangeFilter', { start: '2026-03-08', end: '2026-03-08' })
  page.change('SearchFilter', '  김 & + %  ')
  page.change('AffiliationFilter', 'company-b')
  const params = new URL(page.calls.at(-1).url, 'http://localhost').searchParams
  assert.equal(params.get('createdFrom'), new Date(2026, 2, 8).toISOString())
  assert.equal(params.get('createdBefore'), new Date(2026, 2, 9).toISOString())
  assert.equal(params.get('nameQuery'), '김 & + %')
  assert.equal(params.get('logisticsCompanyId'), 'company-b')
  assert.equal(page.calls.at(-1).options.method, 'GET')
  assert.equal(page.calls.at(-1).options.credentials, 'include')
})

test('late filtered data or 401 cannot replace a newer successful query', async () => {
  for (const status of [200, 401]) {
    const page = mount()
    await page.respond(0, 200, [driver('a')])
    page.change('SearchFilter', 'new')
    await page.respond(2, 200, [driver('new')])
    await page.respond(1, status, status === 200 ? [driver('old')] : { code: 'INVALID_ADMIN_SESSION' })
    assert.deepEqual(page.table().rows, [driver('new')])
    assert.equal(page.window.location.pathname, '/drivers')
  }
})

test('empty success differs from API, malformed and affiliation-discovery failures', async () => {
  const empty = mount()
  await empty.respond(0, 200, [])
  await empty.respond(1, 200, [])
  assert.equal(empty.table().emptyMessage, '조회 조건에 맞는 기사 데이터가 없습니다.')
  for (const [failedRequest, status, data] of [[1, 500, {}], [1, 200, {}],
    [1, 200, [{ ...driver('a'), joinedAt: 'invalid' }]], [0, 500, {}]]) {
    const page = mount()
    await page.respond(1 - failedRequest, 200, [driver('a')])
    await page.respond(failedRequest, status, data)
    assert.match(find(page.render(), 'NoticeDialog').props.message, /불러오지 못했습니다/)
    assert.doesNotMatch(page.table().emptyMessage ?? '', /불러오지 못했습니다/)
    assert.deepEqual(page.table().rows, failedRequest === 0 ? [driver('a')] : [])
    assert.equal(page.window.location.pathname, '/drivers')
  }
  const offline = mount()
  await offline.respond(0, 200, [])
  offline.calls[1].reject(new TypeError('offline'))
  await tick()
  assert.match(find(offline.render(), 'NoticeDialog').props.message, /불러오지 못했습니다/)
  offline.change('SearchFilter', 'retry')
  await offline.respond(2, 200, [])
  assert.equal(offline.table().emptyMessage, '조회 조건에 맞는 기사 데이터가 없습니다.')
})

test('current 401 redirects, but responses after leaving the page do not', async () => {
  for (const request of [0, 1]) {
    const active = mount()
    await active.respond(request, 401, { code: 'INVALID_ADMIN_SESSION' })
    assert.equal(active.window.location.pathname, '/login')
    const stale = mount()
    stale.unmount()
    stale.window.location.pathname = '/settlements'
    await stale.respond(request, 401, { code: 'INVALID_ADMIN_SESSION' })
    assert.equal(stale.window.location.pathname, '/settlements')
  }
})

test('affiliation select supports IDs and labels while preserving legacy string options', () => {
  const { filters } = mount()
  const select = find(filters.AffiliationFilter({ options: [{ value: 'a', label: '같은 회사명' }, { value: 'b', label: '같은 회사명' }], value: 'b' }), 'select')
  assert.equal(select.props.value, 'b')
  assert.equal(select.props.children[1][1].props.value, 'b')
  assert.equal(select.props.children[1][1].props.children, '같은 회사명')
  const legacy = find(filters.AffiliationFilter({ options: ['기존 옵션'] }), 'select')
  assert.equal(legacy.props.defaultValue, '')
  assert.equal(legacy.props.children[1][0].props.value, '기존 옵션')
  assert.equal(legacy.props.children[1][0].props.children, '기존 옵션')
})


async function loadedPage() {
  const page = mount()
  await page.respond(0, 200, [driver('a'), driver('b')])
  await page.respond(1, 200, [driver('a'), driver('b')])
  return page
}
function openWithdrawal(page, id = 'a') {
  page.table().columns.find((column) => column.key === 'actions').render(driver(id)).props.onClick()
  return find(page.render(), 'ConfirmationDialog').props
}

test('withdraw waits for a bodyless 204, locks duplicate confirmation, then refreshes current rows', async () => {
  const page = await loadedPage()
  const dialog = openWithdrawal(page)
  const pending = dialog.onConfirm()
  await dialog.onConfirm()
  assert.equal(page.calls.length, 3)
  assert.equal(page.calls[2].url, '/api/v1/admin/drivers/a')
  assert.equal(page.calls[2].options.method, 'DELETE')
  assert.equal(page.calls[2].options.body, undefined)
  assert.equal(page.calls[2].options.credentials, 'include')
  assert.equal(page.table().rows.length, 2)
  assert.ok(find(page.render(), 'ConfirmationDialog'))
  await page.respond(2, 204)
  await pending
  assert.equal(find(page.render(), 'ConfirmationDialog'), undefined)
  assert.equal(page.calls[3].options.method, 'GET')
  await page.respond(3, 200, [driver('b')])
  assert.deepEqual(page.table().rows, [driver('b')])
})

test('withdraw failure preserves rows and uses the same dialog for retry', async () => {
  for (const [status, data] of [[404, { code: 'DRIVER_NOT_FOUND' }], [500, {}], [200, {}]]) {
    const page = await loadedPage()
    const pending = openWithdrawal(page).onConfirm()
    await page.respond(2, status, data)
    await pending
    assert.equal(page.table().rows.length, 2)
    assert.match(find(page.render(), 'ConfirmationDialog').props.description,
      status === 404 ? /찾을 수 없습니다/ : /오류가 발생했습니다/)
    const retry = find(page.render(), 'ConfirmationDialog').props.onConfirm()
    assert.equal(page.calls.length, 4)
    await page.respond(3, 204)
    await retry
    assert.equal(find(page.render(), 'ConfirmationDialog'), undefined)
  }
  const offline = await loadedPage()
  const pending = openWithdrawal(offline).onConfirm()
  offline.calls[2].reject(new TypeError('offline'))
  await pending
  assert.equal(offline.table().rows.length, 2)
  assert.match(find(offline.render(), 'ConfirmationDialog').props.description, /오류가 발생했습니다/)
})

test('cancelled withdrawal completion refreshes server state without closing a new target dialog', async () => {
  for (const status of [204, 500]) {
    const page = await loadedPage()
    const dialog = openWithdrawal(page)
    const pending = dialog.onConfirm()
    dialog.onCancel()
    const next = openWithdrawal(page, 'b')
    await next.onConfirm()
    assert.equal(page.calls.length, 3)
    await page.respond(2, status, status === 500 ? {} : undefined)
    await pending
    assert.equal(find(page.render(), 'ConfirmationDialog').props.description, '탈퇴한 회원 정보는 다시 복구할 수 없습니다.')
    assert.equal(page.calls[3].options.method, 'GET')
    await page.respond(3, 200, status === 204 ? [driver('b')] : [driver('a'), driver('b')])
    const nextPending = find(page.render(), 'ConfirmationDialog').props.onConfirm()
    assert.equal(page.calls[4].url, '/api/v1/admin/drivers/b')
    await page.respond(4, 204)
    await nextPending
  }
})

test('withdrawal invalidates an earlier search request and refreshes the latest query', async () => {
  const page = await loadedPage()
  const pending = openWithdrawal(page).onConfirm()
  page.change('SearchFilter', '기사 b')
  assert.equal(page.calls.length, 4)
  await page.respond(2, 204)
  await pending
  page.render()
  assert.equal(new URL(page.calls[4].url, 'http://localhost').searchParams.get('nameQuery'), '기사 b')
  await page.respond(4, 200, [driver('b')])
  await page.respond(3, 200, [driver('a'), driver('b')])
  assert.deepEqual(page.table().rows, [driver('b')])
})

test('late withdrawal success or 401 after navigation has no effect on the new screen', async () => {
  for (const status of [204, 401]) {
    const page = await loadedPage()
    const pending = openWithdrawal(page).onConfirm()
    page.unmount()
    page.window.location.pathname = '/settlements'
    await page.respond(2, status, status === 401 ? { code: 'INVALID_ADMIN_SESSION' } : undefined)
    await pending
    assert.equal(page.window.location.pathname, '/settlements')
    assert.equal(page.calls.length, 3)
  }
  const current = await loadedPage()
  const pending = openWithdrawal(current).onConfirm()
  await current.respond(2, 401, { code: 'INVALID_ADMIN_SESSION' })
  await pending
  assert.equal(current.window.location.pathname, '/login')
  assert.equal(current.table().rows.length, 2)
})


test('calendar ranges retain 23-hour and 25-hour DST days regardless of the host timezone', () => {
  const result = execFileSync(process.execPath, ['-e', `
    const api = {};
    new Function('exports', require('node:fs').readFileSync(0, 'utf8'))(api);
    process.stdout.write(JSON.stringify(['2026-03-08', '2026-11-01'].map((day) =>
      Object.fromEntries(api.getDateRangeParams({ start: day, end: day })))));
  `], { env: { ...process.env, TZ: 'America/New_York' }, input: sources['utils/dateRange.ts'], encoding: 'utf8' })
  const ranges = JSON.parse(result)
  assert.deepEqual(ranges, [
    { createdFrom: '2026-03-08T05:00:00.000Z', createdBefore: '2026-03-09T04:00:00.000Z' },
    { createdFrom: '2026-11-01T04:00:00.000Z', createdBefore: '2026-11-02T05:00:00.000Z' },
  ])
  assert.deepEqual(ranges.map(({ createdFrom, createdBefore }) =>
    (Date.parse(createdBefore) - Date.parse(createdFrom)) / 3_600_000), [23, 25])
})

test('driver query failures keep visible rows while the popup retries the failed request', async () => {
 const page=await loadedPage();const before=page.table().rows
 page.change('SearchFilter','new');assert.deepEqual(page.table().rows,before)
 await page.respond(2,500,{})
 assert.deepEqual(page.table().rows,before);assert.equal(page.table().emptyMessage,undefined)
 find(page.render(),'NoticeDialog').props.onRetry();page.render()
 assert.deepEqual(page.table().rows,before);await page.respond(3,200,[driver('new')])
 assert.deepEqual(page.table().rows,[driver('new')]);assert.equal(find(page.render(),'NoticeDialog'),undefined)
})

test('affiliation discovery failure keeps successful driver rows and retries discovery independently', async () => {
 const page=mount();await page.respond(1,200,[driver('a')]);await page.respond(0,500,{})
 assert.deepEqual(page.table().rows,[driver('a')])
 find(page.render(),'NoticeDialog').props.onRetry();page.render()
 assert.equal(page.calls[2].url,'/api/v1/admin/drivers')
 await page.respond(2,200,[driver('a')]);assert.equal(page.calls.length,3)
 assert.equal(find(page.render(),'AffiliationFilter').props.options.length,1)
})

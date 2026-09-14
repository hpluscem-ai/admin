import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const sources = Object.fromEntries(['adminAuth.ts', 'stations.ts', 'utils/dateRange.ts',
  'pages/InfrastructureDataPage.tsx', 'pages/InfrastructureFormPage.tsx', 'components/InfrastructureForm.tsx'].map((path) => [path,
  ts.transpileModule(readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText]))
const jsx = (type, props) => ({ type, props })
const tick = () => new Promise((resolve) => setImmediate(resolve))
const station = (id = 'a', coords = [-35.5, -127.25]) => ({ id, businessName: `주유소 ${id}`, pole: 'Pole',
  roadAddress: '서울시 강남구', note: null, latitude: coords[0], longitude: coords[1], createdAt: '2026-09-13T18:00:00Z',
  devices: [{ id: 'one', model: '모델 A', capacityLiters: 1000, active: true },
    { id: 'two', model: '모델 B', capacityLiters: 2000, active: false }] })
function find(node, type) {
  if (!node || typeof node !== 'object') return undefined
  if (node.type === type) return node
  return [node.props?.children].flat(Infinity).map((child) => find(child, type)).find(Boolean)
}
function all(node, type) {
  if (!node || typeof node !== 'object') return []
  return [...(node.type === type ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap((child) => all(child, type))]
}
function mount(kind = 'list', id = 'a') {
  const calls = [], slots = [], effects = []
  const window = { location: { hash: '#/infrastructure' } }
  let index = 0, props = { id }
  const react = {
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
  function load(path) {
    const exports = {}
    new Function('require', 'exports', 'fetch', 'window', sources[path])((name) => {
      if (name.endsWith('.svg')) return { default: name }
      assert.ok(name in imports, `Unexpected import ${name}`)
      return imports[name]
    }, exports, fetch, window)
    return exports
  }
  imports['./adminAuth'] = imports['../adminAuth'] = load('adminAuth.ts')
  imports['./utils/dateRange'] = imports['../utils/dateRange'] = load('utils/dateRange.ts')
  const api = load('stations.ts')
  imports['../stations'] = api
  imports['../components/PageFilters'] = { SearchFilter: 'SearchFilter', DateRangeFilter: 'DateRangeFilter' }
  for (const name of ['ConfirmationDialog', 'DataPageHeader', 'DataTable', 'InfrastructureForm']) imports[`../components/${name}`] = { [name]: name }
  imports['./FormControls'] = { PrimaryButton: 'PrimaryButton', TextField: 'TextField' }
  const component = kind === 'list' ? load('pages/InfrastructureDataPage.tsx').InfrastructureDataPage
    : load('pages/InfrastructureFormPage.tsx').InfrastructureEditPage
  const page = {
    calls, window, api,
    render() {
      index = 0
      let tree = component(props)
      effects.splice(0).forEach((effect) => effect())
      if (typeof tree?.type === 'function') tree = tree.type(tree.props)
      return tree
    },
    table() { return find(page.render(), 'DataTable').props },
    change(type, value) { find(page.render(), type).props.onChange(value); page.render() },
    changeId(id) { props = { id }; page.render() },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()) },
    form(initialValues) {
      const formSlots = [], formReact = { useState(initial) { const key = index++; if (!(key in formSlots)) formSlots[key] = typeof initial === 'function' ? initial() : initial; return [formSlots[key], (value) => { formSlots[key] = typeof value === 'function' ? value(formSlots[key]) : value }] } }
      imports.react = formReact
      const { InfrastructureForm } = load('components/InfrastructureForm.tsx')
      return () => { index = 0; return InfrastructureForm({ initialValues, actionLabel: '수정' }) }
    },
    async respond(index, status, data) { calls[index].resolve(Response.json(data, { status })); await tick() },
  }
  page.render()
  return page
}

test('all device models and capacities, negative coordinates and real IDs reach the existing list', async () => {
  const page = mount()
  assert.match(page.table().emptyMessage, /불러오는 중/)
  await page.respond(0, 200, [station()])
  const { rows, columns } = page.table()
  assert.equal(rows[0].model, '모델 A / 모델 B')
  assert.equal(rows[0].capacity, '1,000L / 2,000L')
  assert.equal(rows[0].latitude, '-35.5')
  assert.equal(rows[0].longitude, '-127.25')
  assert.equal(columns.find(({ key }) => key === 'note').render(rows[0]), '-')
  assert.equal(find(columns.find(({ key }) => key === 'actions').render(rows[0]), 'a').props.href, '#/infrastructure/edit/a')
  const date = new Date(station().createdAt)
  assert.equal(columns.find(({ key }) => key === 'registeredAt').render(rows[0]), `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}`)
})

test('detail preserves every device and initial form values without concatenating capacities or stripping minus signs', async () => {
  const page = mount('detail')
  assert.equal(page.render(), null)
  await page.respond(0, 200, station())
  assert.equal(page.calls[0].url, '/api/v1/admin/stations/a')
  const form = find(page.render(), 'InfrastructureForm').props
  assert.equal(form.save, undefined)
  const render = page.form(form.initialValues)
  const inputs = Object.fromEntries(all(render(), 'TextField').map(({ props }) => [props.name, props.value]))
  assert.equal(inputs.capacity, '1,000L / 2,000L')
  assert.equal(inputs.model, '모델 A / 모델 B')
  assert.equal(inputs.latitude, '-35.5')
  assert.equal(inputs.longitude, '-127.25')
  const pending = page.api.getStation('all-devices')
  await page.respond(1, 200, station())
  assert.deepEqual((await pending).devices, station().devices)
})

test('null coordinates stay blank in the form and unavailable in table, while real zero stays zero', async () => {
  const page = mount()
  await page.respond(0, 200, [station('none', [null, null]), station('zero', [0, 0])])
  const { rows, columns } = page.table()
  for (const key of ['latitude', 'longitude']) {
    assert.equal(columns.find((column) => column.key === key).render(rows[0]), '-')
    assert.equal(columns.find((column) => column.key === key).render(rows[1]), '0')
    assert.equal(page.api.getStationValues(station('none', [null, null]))[key], '')
  }
})

test('stationQuery and inclusive calendar dates use the actual query contract including DST boundaries', () => {
  const page = mount()
  page.change('DateRangeFilter', { start: '2026-03-08', end: '2026-03-08' })
  page.change('SearchFilter', '  주유소 & + %  ')
  const params = new URL(page.calls.at(-1).url, 'http://localhost').searchParams
  assert.equal(params.get('stationQuery'), '주유소 & + %')
  assert.equal(params.get('createdFrom'), new Date(2026, 2, 8).toISOString())
  assert.equal(params.get('createdBefore'), new Date(2026, 2, 9).toISOString())
  assert.equal(page.calls.at(-1).options.method, 'GET')
})

test('empty list, malformed response and load failure are distinct; missing details cannot expose an empty form', async () => {
  const empty = mount()
  await empty.respond(0, 200, [])
  assert.equal(empty.table().emptyMessage, '조회 조건에 맞는 인프라 데이터가 없습니다.')
  for (const data of [{}, [{ ...station(), latitude: 91 }], [{ ...station(), devices: [{ id: 'a', model: 'a', capacityLiters: 0, active: true }] }]]) {
    const page = mount()
    await page.respond(0, 200, data)
    assert.equal(page.table().emptyMessage, page.api.STATIONS_LOAD_ERROR)
  }
  const detail = mount('detail')
  await detail.respond(0, 404, { code: 'STATION_NOT_FOUND' })
  assert.equal(find(detail.render(), 'InfrastructureForm'), undefined)
  assert.equal(find(detail.render(), 'p').props.children, '주유소를 찾을 수 없습니다.')
  const failed = mount()
  failed.calls[0].reject(new TypeError('offline'))
  await tick()
  assert.equal(failed.table().emptyMessage, failed.api.STATIONS_LOAD_ERROR)
  failed.change('SearchFilter', 'retry')
  await failed.respond(1, 200, [])
  assert.equal(failed.table().emptyMessage, '조회 조건에 맞는 인프라 데이터가 없습니다.')
})

test('late list/detail responses and departed-page 401 cannot overwrite current state', async () => {
  for (const kind of ['list', 'detail']) {
    const page = mount(kind)
    if (kind === 'list') page.change('SearchFilter', 'b')
    else page.changeId('b')
    await page.respond(1, 200, kind === 'list' ? [station('b')] : station('b'))
    await page.respond(0, 401, { code: 'INVALID_ADMIN_SESSION' })
    assert.equal(page.window.location.hash, '#/infrastructure')
    assert.equal(kind === 'list' ? page.table().rows[0].station : find(page.render(), 'InfrastructureForm').props.initialValues.station, '주유소 b')
    const departed = mount(kind)
    departed.unmount()
    await departed.respond(0, 401, { code: 'INVALID_ADMIN_SESSION' })
    assert.equal(departed.window.location.hash, '#/infrastructure')
    const current = mount(kind)
    await current.respond(0, 401, { code: 'INVALID_ADMIN_SESSION' })
    assert.equal(current.window.location.hash, '/login')
  }
})

test('deleting and saving remain pending and cannot mutate real API data', async () => {
  const page = mount()
  await page.respond(0, 200, [station()])
  find(page.table().columns.find(({ key }) => key === 'actions').render(page.table().rows[0]), 'button').props.onClick()
  find(page.render(), 'ConfirmationDialog').props.onConfirm()
  assert.match(find(page.render(), 'ConfirmationDialog').props.description, /서버 연동이 필요/)
  assert.equal(page.table().rows.length, 1)
  const render = page.form(page.api.getStationValues(station('positive', [35.5, 127.25])))
  await render().props.onSubmit({ preventDefault() {} })
  assert.match(find(render(), 'p').props.children, /저장 서버 연동이 필요/)
  assert.equal(page.calls.length, 1)
})

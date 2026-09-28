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
const station = (id = 'a', coords = [-35.5, -127.25]) => ({ id, version: `version-${id}`, businessName: `주유소 ${id}`, pole: 'Pole',
  roadAddress: '서울시 강남구', note: null, latitude: coords[0], longitude: coords[1], createdAt: '2026-09-13T18:00:00Z',
  devices: [{ id: 'one', model: '모델 A', capacityLiters: 1000, active: true },
    { id: 'two', model: '모델 B', capacityLiters: 2000, active: false }] })
const oneDeviceStation = (id = 'a', coords) => {
  const item = station(id, coords)
  return { ...item, devices: [item.devices[0]] }
}
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
  const window = { location: { pathname: '/infrastructure' } }
  let index = 0, props = { id }
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
  function load(path) {
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
  const api = load('stations.ts')
  imports['../stations'] = api
  imports['../components/PageFilters'] = { SearchFilter: 'SearchFilter', DateRangeFilter: 'DateRangeFilter' }
  for (const name of ['ConfirmationDialog', 'DataPageHeader', 'DataTable', 'InfrastructureForm']) imports[`../components/${name}`] = { [name]: name }
  imports['./FormControls'] = { PrimaryButton: 'PrimaryButton', TextField: 'TextField' }
  imports['../components/ConfirmationDialog'].NoticeDialog = 'NoticeDialog'
  imports['./ConfirmationDialog'] = imports['../components/ConfirmationDialog']
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
    form(initialValues, save) {
      const formSlots = [], formEffects = []
      const formReact = {
        useState(initial) { const key = index++; if (!(key in formSlots)) formSlots[key] = typeof initial === 'function' ? initial() : initial; return [formSlots[key], (value) => { formSlots[key] = typeof value === 'function' ? value(formSlots[key]) : value }] },
        useRef(initial) { const key = index++; if (!(key in formSlots)) formSlots[key] = { current: initial }; return formSlots[key] },
        useEffect(effect, deps) { const key = index++; if (!(key in formSlots)) formEffects.push(() => { formSlots[key] = { cleanup: effect(), deps } }) },
      }
      imports.react = formReact
      const { InfrastructureForm } = load('components/InfrastructureForm.tsx')
      const render = () => {
        index = 0
        const tree = InfrastructureForm({ initialValues, actionLabel: '수정', save })
        formEffects.splice(0).forEach((effect) => effect())
        return tree
      }
      render.unmount = () => formSlots.forEach((slot) => slot?.cleanup?.())
      return render
    },
    async respond(index, status, data) { calls[index].resolve(status === 204 ? new Response(null, { status }) : Response.json(data, { status })); await tick() },
  }
  page.render()
  return page
}

test('infrastructure list keeps one row per device and distinct same-name stations', async () => {
  const page = mount()
  assert.match(page.table().emptyMessage, /불러오는 중/)
  const jinju = {
    ...station('jinju', [35.1878882400229, 128.056854392858]),
    businessName: '사등주유소', roadAddress: '경상남도 진주시 서장대로 181',
    devices: [{ id: 'jinju-device', model: 'ST2140S', capacityLiters: 1400, active: true }],
  }
  const geoje = {
    ...station('geoje', [34.9099107772403, 128.545338908377]),
    businessName: '사등주유소', roadAddress: '경남 거제시 사등면 거제대로 5486',
    devices: [
      { id: 'geoje-first', model: 'HEUD-SELF-05', capacityLiters: 2500, active: true },
      { id: 'geoje-second', model: 'HG1000S', capacityLiters: 1000, active: true },
    ],
  }
  const withoutDevice = { ...station('empty'), businessName: '기기 없는 주유소', devices: [] }
  await page.respond(0, 200, [jinju, geoje, withoutDevice])
  const { rows, columns, getRowKey } = page.table()
  assert.deepEqual(rows.map(({ id, station, address, model, capacity }) => ({ id, station, address, model, capacity })), [
    { id: 'jinju', station: '사등주유소', address: '경상남도 진주시 서장대로 181', model: 'ST2140S', capacity: '1,400L' },
    { id: 'geoje', station: '사등주유소', address: '경남 거제시 사등면 거제대로 5486', model: 'HEUD-SELF-05', capacity: '2,500L' },
    { id: 'geoje', station: '사등주유소', address: '경남 거제시 사등면 거제대로 5486', model: 'HG1000S', capacity: '1,000L' },
    { id: 'empty', station: '기기 없는 주유소', address: '서울시 강남구', model: '', capacity: '' },
  ])
  assert.equal(columns.find(({ key }) => key === 'model').render(rows[3]).props.children, '-')
  assert.equal(columns.find(({ key }) => key === 'capacity').render(rows[3]), '-')
  assert.deepEqual(rows.slice(1, 3).map(getRowKey), ['geoje:geoje-first', 'geoje:geoje-second'])
  const editLinks = rows.map((row) => find(columns.find(({ key }) => key === 'actions').render(row), 'a').props.href)
  assert.deepEqual(editLinks, ['/infrastructure/edit/jinju', '/infrastructure/edit/geoje', '/infrastructure/edit/geoje', '/infrastructure/edit/empty'])
})

test('detail preserves every device and initial form values without concatenating capacities or stripping minus signs', async () => {
  const page = mount('detail')
  assert.equal(page.render(), null)
  await page.respond(0, 200, station())
  assert.equal(page.calls[0].url, '/api/v1/admin/stations/a')
  const form = find(page.render(), 'InfrastructureForm').props
  assert.equal(typeof form.save, 'function')
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
  await page.respond(0, 200, [oneDeviceStation('none', [null, null]), oneDeviceStation('zero', [0, 0])])
  const { rows, columns } = page.table()
  for (const key of ['latitude', 'longitude']) {
    assert.equal(columns.find((column) => column.key === key).render(rows[0]), '-')
    assert.equal(columns.find((column) => column.key === key).render(rows[1]), '0')
    assert.equal(page.api.getStationValues(station('none', [null, null]))[key], '')
  }
})

test('coordinates display four decimals without rounding and unrelated edits preserve raw precision', async () => {
  const item = { ...singleStation(), latitude: 35.99999, longitude: -127.1234999 }
  const list = mount()
  await list.respond(0, 200, [item])
  const values = list.api.getStationValues(item)
  assert.equal(values.latitude, '35.9999')
  assert.equal(values.longitude, '-127.1234')
  assert.equal(list.table().rows[0].latitude, values.latitude)

  const page = mount('detail')
  await page.respond(0, 200, item)
  const form = find(page.render(), 'InfrastructureForm').props
  assert.equal(form.initialValues.latitude, String(item.latitude))
  const render = page.form(form.initialValues, form.save)
  const inputs = Object.fromEntries(all(render(), 'TextField').map(({ props }) => [props.name, props]))
  assert.equal(inputs.latitude.value, values.latitude)
  assert.equal(inputs.longitude.value, values.longitude)
  assert.equal(inputs.latitude.maxLength, 8)
  assert.equal(inputs.longitude.maxLength, 9)
  changeInput(render, 'station', '수정한 주유소')
  const saving = render().props.onSubmit({ preventDefault() {} })
  const body = JSON.parse(page.calls[1].options.body)
  assert.equal(body.latitude, item.latitude)
  assert.equal(body.longitude, item.longitude)
  await page.respond(1, 200, item)
  await saving

  const edited = mount('detail')
  await edited.respond(0, 200, item)
  const editedForm = find(edited.render(), 'InfrastructureForm').props
  const editedRender = edited.form(editedForm.initialValues, editedForm.save)
  changeInput(editedRender, 'latitude', '35.9999')
  changeInput(editedRender, 'longitude', '-127.123456')
  assert.equal(all(editedRender(), 'TextField').find(({ props }) => props.name === 'longitude').props.value, '-127.1234')
  assert.equal(find(editedRender(), 'PrimaryButton').props.disabled, false)
  const updating = editedRender().props.onSubmit({ preventDefault() {} })
  assert.equal(JSON.parse(edited.calls[1].options.body).latitude, 35.9999)
  assert.equal(JSON.parse(edited.calls[1].options.body).longitude, -127.1234)
  await edited.respond(1, 200, item)
  await updating
})

test('tiny coordinates display as zero without changing their stored values', async () => {
  const item = { ...singleStation(), latitude: 1e-7, longitude: -1e-7 }
  const page = mount('detail')
  await page.respond(0, 200, item)
  const form = find(page.render(), 'InfrastructureForm').props
  const render = page.form(form.initialValues, form.save)
  const inputs = Object.fromEntries(all(render(), 'TextField').map(({ props }) => [props.name, props.value]))
  assert.equal(inputs.latitude, '0.0000')
  assert.equal(inputs.longitude, '-0.0000')
  changeInput(render, 'station', '수정한 주유소')
  const saving = render().props.onSubmit({ preventDefault() {} })
  const body = JSON.parse(page.calls[1].options.body)
  assert.equal(body.latitude, item.latitude)
  assert.equal(body.longitude, item.longitude)
  await page.respond(1, 200, item)
  await saving
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
    assert.equal(find(page.render(), 'NoticeDialog').props.message, page.api.STATIONS_LOAD_ERROR)
    assert.equal(page.table().emptyMessage, undefined)
  }
  const detail = mount('detail')
  await detail.respond(0, 404, { code: 'STATION_NOT_FOUND' })
  assert.equal(find(detail.render(), 'InfrastructureForm'), undefined)
  assert.equal(find(detail.render(), 'NoticeDialog').props.message, '주유소를 찾을 수 없습니다.')
  const failed = mount()
  failed.calls[0].reject(new TypeError('offline'))
  await tick()
  assert.equal(find(failed.render(), 'NoticeDialog').props.message, failed.api.STATIONS_LOAD_ERROR)
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
    assert.equal(page.window.location.pathname, '/infrastructure')
    assert.equal(kind === 'list' ? page.table().rows[0].station : find(page.render(), 'InfrastructureForm').props.initialValues.station, '주유소 b')
    const departed = mount(kind)
    departed.unmount()
    await departed.respond(0, 401, { code: 'INVALID_ADMIN_SESSION' })
    assert.equal(departed.window.location.pathname, '/infrastructure')
    const current = mount(kind)
    await current.respond(0, 401, { code: 'INVALID_ADMIN_SESSION' })
    assert.equal(current.window.location.pathname, '/login')
  }
})

test('a form without a save callback does not fabricate success', async () => {
  const page = mount()
  await page.respond(0, 200, [station()])
  const render = page.form(page.api.getStationValues(station('positive', [35.5, 127.25])))
  await render().props.onSubmit({ preventDefault() {} })
  assert.match(find(render(), 'NoticeDialog').props.message, /저장 서버 연동이 필요/)
  assert.equal(page.calls.length, 1)
})


async function loadedPage() {
  const page = mount()
  await page.respond(0, 200, [oneDeviceStation('a'), oneDeviceStation('b')])
  return page
}
function openDelete(page, id = 'a', model) {
  const row = page.table().rows.find((row) => row.id === id && (model === undefined || row.model === model))
  assert.ok(row, `Missing delete row: ${id}${model === undefined ? '' : ` / ${model}`}`)
  find(page.table().columns.find(({ key }) => key === 'actions').render(row), 'button').props.onClick()
  return find(page.render(), 'ConfirmationDialog').props
}

test('station delete waits for bodyless 204 and prevents duplicate confirmations before refreshing', async () => {
  const page = await loadedPage()
  const dialog = openDelete(page)
  assert.match(`${dialog.title} ${dialog.description}`, /주유소/)
  assert.match(`${dialog.title} ${dialog.description}`, /주입기/)
  const pending = dialog.onConfirm()
  await dialog.onConfirm()
  assert.equal(page.calls.length, 2)
  assert.equal(page.calls[1].url, '/api/v1/admin/stations/a')
  assert.equal(page.calls[1].options.method, 'GET')
  assert.equal(page.calls[1].options.credentials, 'include')
  await page.respond(1, 200, oneDeviceStation('a'))
  assert.equal(page.calls[2].url, '/api/v1/admin/stations/a?expectedVersion=version-a')
  assert.equal(page.calls[2].options.method, 'DELETE')
  assert.equal(page.calls[2].options.body, undefined)
  assert.equal(page.calls[2].options.credentials, 'include')
  await page.respond(2, 204)
  await pending
  assert.equal(find(page.render(), 'ConfirmationDialog'), undefined)
  assert.equal(page.calls[3].options.method, 'GET')
  await page.respond(3, 200, [oneDeviceStation('b')])
  assert.deepEqual(page.table().rows.map(({ id }) => id), ['b'])
})

test('deleting one device verifies the latest station then updates it with its sibling', async () => {
  const page = mount()
  const item = station()
  await page.respond(0, 200, [item])

  const dialog = openDelete(page, 'a', '모델 A')
  assert.match(`${dialog.title} ${dialog.description}`, /주입기/)
  const pending = dialog.onConfirm()

  assert.equal(page.calls.length, 2)
  assert.equal(page.calls[1].url, '/api/v1/admin/stations/a')
  assert.equal(page.calls[1].options.method, 'GET')
  assert.equal(page.calls[1].options.credentials, 'include')
  await page.respond(1, 200, item)
  assert.equal(page.calls[2].url, '/api/v1/admin/stations/a')
  assert.equal(page.calls[2].options.method, 'PUT')
  assert.equal(page.calls[2].options.credentials, 'include')
  assert.deepEqual(JSON.parse(page.calls[2].options.body), {
    businessName: item.businessName,
    pole: item.pole,
    roadAddress: item.roadAddress,
    latitude: item.latitude,
    longitude: item.longitude,
    devices: [{ id: 'two', model: '모델 B', capacityLiters: 2000 }],
    expectedVersion: item.version,
  })

  const remaining = { ...item, devices: [item.devices[1]] }
  await page.respond(2, 200, remaining)
  await pending
  assert.equal(find(page.render(), 'ConfirmationDialog'), undefined)
  assert.equal(page.calls[3].options.method, 'GET')
  await page.respond(3, 200, [remaining])
  assert.deepEqual(page.table().rows.map(({ id, model, capacity }) => ({ id, model, capacity })), [
    { id: 'a', model: '모델 B', capacity: '2,000L' },
  ])
})

test('device deletion keeps its retry and latest-search protections', async () => {
  const page = mount()
  const item = station('a')
  await page.respond(0, 200, [item])

  const first = openDelete(page, 'a', '모델 A').onConfirm()
  await page.respond(1, 404, { code: 'STATION_NOT_FOUND' })
  await first
  assert.deepEqual(page.table().rows.map(({ model }) => model), ['모델 A', '모델 B'])
  assert.match(find(page.render(), 'ConfirmationDialog').props.description, /찾을 수 없습니다/)

  const retry = find(page.render(), 'ConfirmationDialog').props.onConfirm()
  assert.equal(page.calls[2].options.method, 'GET')
  page.change('SearchFilter', '다른 검색어')
  await page.respond(2, 200, item)
  assert.equal(page.calls[4].options.method, 'PUT')
  await page.respond(4, 200, { ...item, devices: [item.devices[1]] })
  await retry
  page.render()
  assert.equal(new URL(page.calls[5].url, 'http://localhost').searchParams.get('stationQuery'), '다른 검색어')
  await page.respond(5, 200, [])
  await page.respond(3, 200, [item])
  assert.deepEqual(page.table().rows, [])
})

test('delete errors preserve data and allow retry inside the existing confirmation dialog', async () => {
  for (const status of [404, 500, 200]) {
    const page = await loadedPage()
    const pending = openDelete(page).onConfirm()
    await page.respond(1, 200, oneDeviceStation('a'))
    assert.equal(page.calls[2].options.method, 'DELETE')
    await page.respond(2, status, status === 404 ? { code: 'STATION_NOT_FOUND' } : {})
    await pending
    assert.equal(page.table().rows.length, 2)
    assert.match(find(page.render(), 'ConfirmationDialog').props.description,
      status === 404 ? /찾을 수 없습니다/ : /삭제 중 오류/)
    const retry = find(page.render(), 'ConfirmationDialog').props.onConfirm()
    await page.respond(3, 200, oneDeviceStation('a'))
    await page.respond(4, 204)
    await retry
    assert.equal(find(page.render(), 'ConfirmationDialog'), undefined)
  }
  const offline = await loadedPage()
  const pending = openDelete(offline).onConfirm()
  await offline.respond(1, 200, oneDeviceStation('a'))
  offline.calls[2].reject(new TypeError('offline'))
  await pending
  assert.equal(offline.table().rows.length, 2)
  assert.match(find(offline.render(), 'ConfirmationDialog').props.description, /삭제 중 오류/)
})

test('cancel does not send DELETE; cancelling in flight refreshes without affecting a new modal target', async () => {
  const cancelled = await loadedPage()
  openDelete(cancelled).onCancel()
  assert.equal(cancelled.calls.length, 1)
  assert.equal(cancelled.table().rows.length, 2)
  for (const status of [204, 500]) {
    const page = await loadedPage()
    const dialog = openDelete(page)
    const pending = dialog.onConfirm()
    dialog.onCancel()
    const next = openDelete(page, 'b')
    await next.onConfirm()
    assert.equal(page.calls.length, 2)
    await page.respond(1, 200, oneDeviceStation('a'))
    assert.equal(page.calls[2].options.method, 'DELETE')
    await page.respond(2, status, status === 500 ? {} : undefined)
    await pending
    assert.equal(find(page.render(), 'ConfirmationDialog').props.description, '주유소와 연결된 모든 주입기가 삭제되며 복구할 수 없습니다.')
    await page.respond(3, 200, status === 204 ? [oneDeviceStation('b')] : [oneDeviceStation('a'), oneDeviceStation('b')])
    const nextPending = find(page.render(), 'ConfirmationDialog').props.onConfirm()
    assert.equal(page.calls[4].url, '/api/v1/admin/stations/b')
    assert.equal(page.calls[4].options.method, 'GET')
    await page.respond(4, 200, oneDeviceStation('b'))
    assert.equal(page.calls[5].url, '/api/v1/admin/stations/b?expectedVersion=version-b')
    assert.equal(page.calls[5].options.method, 'DELETE')
    await page.respond(5, 204)
    await nextPending
  }
})

test('completed deletion invalidates older results and reloads the latest search', async () => {
  const page = await loadedPage()
  const pending = openDelete(page).onConfirm()
  page.change('SearchFilter', '주유소 b')
  await page.respond(1, 200, oneDeviceStation('a'))
  assert.equal(page.calls[3].options.method, 'DELETE')
  await page.respond(3, 204)
  await pending
  page.render()
  assert.equal(new URL(page.calls[4].url, 'http://localhost').searchParams.get('stationQuery'), '주유소 b')
  await page.respond(4, 200, [oneDeviceStation('b')])
  await page.respond(2, 200, [oneDeviceStation('a'), oneDeviceStation('b')])
  assert.deepEqual(page.table().rows.map(({ id }) => id), ['b'])
})

test('departed-page delete responses cannot refresh or redirect the new screen; current 401 still redirects', async () => {
  for (const status of [204, 401, 500]) {
    const page = await loadedPage()
    const pending = openDelete(page).onConfirm()
    await page.respond(1, 200, oneDeviceStation('a'))
    page.unmount()
    page.window.location.pathname = '/drivers'
    await page.respond(2, status, status === 204 ? undefined : { code: 'INVALID_ADMIN_SESSION' })
    await pending
    assert.equal(page.window.location.pathname, '/drivers')
    assert.equal(page.calls.length, 3)
  }
  const current = await loadedPage()
  const pending = openDelete(current).onConfirm()
  await current.respond(1, 401, { code: 'INVALID_ADMIN_SESSION' })
  await pending
  assert.equal(current.window.location.pathname, '/login')
  assert.equal(current.table().rows.length, 2)
})


const singleStation = () => ({ ...station('one-station'), devices: [station().devices[0]] })
const valuesFor = (page, item = singleStation()) => page.api.getStationValues(item)

function changeInput(render, name, value) {
  all(render(), 'TextField').find((field) => field.props.name === name).props.onChange({ target: { value } })
}

test('create sends only the address contract, credentials and normalized numbers and requires 201', async () => {
  for (const status of [201, 200]) {
    const page = mount()
    const values = { ...valuesFor(page), note: '  셀프  ' }
    const saving = page.api.saveStation(values)
    const call = page.calls[1]
    assert.equal(call.url, '/api/v1/admin/stations')
    assert.equal(call.options.method, 'POST')
    assert.equal(call.options.credentials, 'include')
    assert.deepEqual(JSON.parse(call.options.body), {
      businessName: values.station, pole: values.pole, roadAddress: values.address,
      note: '셀프', latitude: -35.5, longitude: -127.25,
      devices: [{ model: '모델 A', capacityLiters: 1000 }],
    })
    const checked = status === 201 ? saving : assert.rejects(saving)
    await page.respond(1, status, singleStation())
    if (status === 201) assert.deepEqual(await checked, { ok: true })
    else await checked
  }
})

test('update preserves every existing device ID and only changes the single device explicitly edited', async () => {
  for (const item of [singleStation(), station()]) {
    const page = mount()
    const values = { ...valuesFor(page, item), station: '수정한 주유소' }
    if (item.devices.length === 1) { values.model = '변경 모델'; values.capacity = '2,500L' }
    const pending = page.api.saveStation(values, item)
    assert.equal(page.calls[1].options.method, 'PUT')
    const body = JSON.parse(page.calls[1].options.body)
    assert.equal(body.businessName, '수정한 주유소')
    assert.equal(body.expectedVersion, item.version)
    assert.ok(!('note' in body))
    assert.deepEqual(body.devices, item.devices.length === 1
      ? [{ id: item.devices[0].id, model: '변경 모델', capacityLiters: 2500 }]
      : item.devices.map(({ id, model, capacityLiters }) => ({ id, model, capacityLiters })))
    await page.respond(1, 200, item)
    assert.deepEqual(await pending, { ok: true })
  }
})

test('ambiguous multi-device edits and invalid numbers never issue a save request', async () => {
  const page = mount()
  const multi = station()
  for (const changes of [{ model: '한 개로 덮어쓰기' }, { capacity: '10002000L' }]) {
    assert.equal((await page.api.saveStation({ ...valuesFor(page, multi), ...changes }, multi)).ok, false)
  }
  for (const changes of [{ latitude: '' }, { longitude: '181' }, { latitude: '-91' },
    { latitude: 'NaN' }, { capacity: '0L' }, { capacity: '9,007,199,254,740,992L' }, { capacity: '1,00L' }]) {
    assert.equal((await page.api.saveStation({ ...valuesFor(page), ...changes })).ok, false)
  }
  assert.equal(page.calls.length, 1)
})

test('save errors do not succeed and retain a retry path', async () => {
  for (const [status, code] of [[400, 'VALIDATION_ERROR'], [404, 'STATION_NOT_FOUND'],
    [409, 'UNKNOWN_DEVICE'], [409, 'DUPLICATE_DEVICE_ID'], [409, 'STATION_VERSION_CONFLICT']]) {
    const page = mount()
    const pending = page.api.saveStation(valuesFor(page), singleStation())
    await page.respond(1, status, { code })
    const result = await pending
    assert.equal(result.ok, false)
    if (code === 'STATION_VERSION_CONFLICT') assert.match(result.message, /새로 열어|다시 확인/)
    const retry = page.api.saveStation(valuesFor(page), singleStation())
    await page.respond(2, 200, singleStation())
    assert.deepEqual(await retry, { ok: true })
  }
})

test('form blocks duplicate submits and input loss with the existing shared submission lock', async () => {
  const page = mount()
  const item = singleStation()
  const render = page.form(valuesFor(page), (values) => page.api.saveStation(values, item))
  changeInput(render, 'station', '저장할 이름')
  changeInput(render, 'latitude', '-12.5')
  const pending = render().props.onSubmit({ preventDefault() {} })
  await render().props.onSubmit({ preventDefault() {} })
  assert.equal(page.calls.length, 2)
  assert.equal(JSON.parse(page.calls[1].options.body).latitude, -12.5)
  assert.ok(all(render(), 'TextField').every(({ props }) => props.disabled))
  changeInput(render, 'station', '저장 중 유실될 입력')
  assert.equal(all(render(), 'TextField').find(({ props }) => props.name === 'station').props.value, '저장할 이름')
  await page.respond(1, 500, { code: 'INTERNAL_SERVER_ERROR' })
  await pending
  assert.equal(page.window.location.pathname, '/infrastructure')
  assert.match(find(render(), 'NoticeDialog').props.message, /저장 중 오류/)
  assert.ok(all(render(), 'TextField').every(({ props }) => !props.disabled))
  const retry = render().props.onSubmit({ preventDefault() {} })
  await page.respond(2, 200, item)
  await retry
  assert.equal(page.window.location.pathname, '/infrastructure')
})

test('late save responses cannot redirect another page; only current expired sessions redirect', async () => {
  for (const departed of [false, true]) {
    for (const status of [200, 401]) {
      const page = mount()
      const item = singleStation()
      const render = page.form(valuesFor(page), (values) => page.api.saveStation(values, item))
      const pending = render().props.onSubmit({ preventDefault() {} })
      if (departed) { render.unmount(); page.window.location.pathname = '/drivers' }
      await page.respond(1, status, status === 200 ? item : { code: 'INVALID_ADMIN_SESSION' })
      await pending
      assert.equal(page.window.location.pathname, departed ? '/drivers' : status === 200 ? '/infrastructure' : '/login')
    }
  }
})

test('failed station refresh and dismiss keep previous rows; the next successful query can replace them', async () => {
 const page=mount();await page.respond(0,200,[station('a')]);const before=page.table().rows
 page.change('SearchFilter','new');assert.deepEqual(page.table().rows,before)
 await page.respond(1,500,{});assert.deepEqual(page.table().rows,before)
 const notice=find(page.render(),'NoticeDialog').props;notice.onClose()
 assert.equal(find(page.render(),'NoticeDialog'),undefined);assert.deepEqual(page.table().rows,before)
 page.change('SearchFilter','next');await page.respond(2,200,[])
 assert.deepEqual(page.table().rows,[]);assert.match(page.table().emptyMessage,/없습니다/)
})

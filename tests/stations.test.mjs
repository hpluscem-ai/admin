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

test('a form without a save callback does not fabricate success', async () => {
  const page = mount()
  await page.respond(0, 200, [station()])
  const render = page.form(page.api.getStationValues(station('positive', [35.5, 127.25])))
  await render().props.onSubmit({ preventDefault() {} })
  assert.match(find(render(), 'p').props.children, /저장 서버 연동이 필요/)
  assert.equal(page.calls.length, 1)
})


async function loadedPage() {
  const page = mount()
  await page.respond(0, 200, [station('a'), station('b')])
  return page
}
function openDelete(page, id = 'a') {
  const row = page.table().rows.find((row) => row.id === id)
  find(page.table().columns.find(({ key }) => key === 'actions').render(row), 'button').props.onClick()
  return find(page.render(), 'ConfirmationDialog').props
}

test('station delete waits for bodyless 204 and prevents duplicate confirmations before refreshing', async () => {
  const page = await loadedPage()
  const dialog = openDelete(page)
  const pending = dialog.onConfirm()
  await dialog.onConfirm()
  assert.equal(page.calls.length, 2)
  assert.equal(page.calls[1].url, '/api/v1/admin/stations/a')
  assert.equal(page.calls[1].options.method, 'DELETE')
  assert.equal(page.calls[1].options.body, undefined)
  assert.equal(page.calls[1].options.credentials, 'include')
  assert.equal(page.table().rows.length, 2)
  assert.ok(find(page.render(), 'ConfirmationDialog'))
  await page.respond(1, 204)
  await pending
  assert.equal(find(page.render(), 'ConfirmationDialog'), undefined)
  assert.equal(page.calls[2].options.method, 'GET')
  await page.respond(2, 200, [station('b')])
  assert.deepEqual(page.table().rows.map(({ id }) => id), ['b'])
})

test('delete errors preserve data and allow retry inside the existing confirmation dialog', async () => {
  for (const status of [404, 500, 200]) {
    const page = await loadedPage()
    const pending = openDelete(page).onConfirm()
    await page.respond(1, status, status === 404 ? { code: 'STATION_NOT_FOUND' } : {})
    await pending
    assert.equal(page.table().rows.length, 2)
    assert.match(find(page.render(), 'ConfirmationDialog').props.description,
      status === 404 ? /찾을 수 없습니다/ : /삭제 중 오류/)
    const retry = find(page.render(), 'ConfirmationDialog').props.onConfirm()
    await page.respond(2, 204)
    await retry
    assert.equal(find(page.render(), 'ConfirmationDialog'), undefined)
  }
  const offline = await loadedPage()
  const pending = openDelete(offline).onConfirm()
  offline.calls[1].reject(new TypeError('offline'))
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
    await page.respond(1, status, status === 500 ? {} : undefined)
    await pending
    assert.equal(find(page.render(), 'ConfirmationDialog').props.description, '삭제한 인프라 데이터는 다시 복구할 수 없습니다.')
    await page.respond(2, 200, status === 204 ? [station('b')] : [station('a'), station('b')])
    const nextPending = find(page.render(), 'ConfirmationDialog').props.onConfirm()
    assert.equal(page.calls[3].url, '/api/v1/admin/stations/b')
    await page.respond(3, 204)
    await nextPending
  }
})

test('completed deletion invalidates older results and reloads the latest search', async () => {
  const page = await loadedPage()
  const pending = openDelete(page).onConfirm()
  page.change('SearchFilter', '주유소 b')
  await page.respond(1, 204)
  await pending
  page.render()
  assert.equal(new URL(page.calls[3].url, 'http://localhost').searchParams.get('stationQuery'), '주유소 b')
  await page.respond(3, 200, [station('b')])
  await page.respond(2, 200, [station('a'), station('b')])
  assert.deepEqual(page.table().rows.map(({ id }) => id), ['b'])
})

test('departed-page delete responses cannot refresh or redirect the new screen; current 401 still redirects', async () => {
  for (const status of [204, 401, 500]) {
    const page = await loadedPage()
    const pending = openDelete(page).onConfirm()
    page.unmount()
    page.window.location.hash = '#/drivers'
    await page.respond(1, status, status === 204 ? undefined : { code: 'INVALID_ADMIN_SESSION' })
    await pending
    assert.equal(page.window.location.hash, '#/drivers')
    assert.equal(page.calls.length, 2)
  }
  const current = await loadedPage()
  const pending = openDelete(current).onConfirm()
  await current.respond(1, 401, { code: 'INVALID_ADMIN_SESSION' })
  await pending
  assert.equal(current.window.location.hash, '/login')
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
    [409, 'UNKNOWN_DEVICE'], [409, 'DUPLICATE_DEVICE_ID']]) {
    const page = mount()
    const pending = page.api.saveStation(valuesFor(page), singleStation())
    await page.respond(1, status, { code })
    assert.equal((await pending).ok, false)
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
  assert.equal(page.window.location.hash, '#/infrastructure')
  assert.match(find(render(), 'p').props.children, /저장 중 오류/)
  assert.ok(all(render(), 'TextField').every(({ props }) => !props.disabled))
  const retry = render().props.onSubmit({ preventDefault() {} })
  await page.respond(2, 200, item)
  await retry
  assert.equal(page.window.location.hash, '/infrastructure')
})

test('late save responses cannot redirect another page; only current expired sessions redirect', async () => {
  for (const departed of [false, true]) {
    for (const status of [200, 401]) {
      const page = mount()
      const item = singleStation()
      const render = page.form(valuesFor(page), (values) => page.api.saveStation(values, item))
      const pending = render().props.onSubmit({ preventDefault() {} })
      if (departed) { render.unmount(); page.window.location.hash = '#/drivers' }
      await page.respond(1, status, status === 200 ? item : { code: 'INVALID_ADMIN_SESSION' })
      await pending
      assert.equal(page.window.location.hash, departed ? '#/drivers' : status === 200 ? '/infrastructure' : '/login')
    }
  }
})

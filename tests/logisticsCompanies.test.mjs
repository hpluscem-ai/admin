import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const sources = Object.fromEntries(['adminAuth.ts', 'logisticsCompanies.ts', 'settlements.ts', 'data/bankCodeOptions.ts',
  'pages/LogisticsSettlementPage.tsx', 'pages/LogisticsFormPage.tsx', 'components/LogisticsForm.tsx'].map((path) => [path, compile(`../src/${path}`)]))
const company = (id, businessName = id) => ({ id, businessName, businessNumber: '123-45-67890',
  corporateRegistrationNumber: '123456-1234567', businessAddress: '서울시', managerName: '담당자',
  managerPhone: '01012345678', bankCode: '4', accountNumber: '1234567890', accountHolder: '예금주',
  active: true, mileage: 0, transferStatus: null, createdAt: '2020-01-01T00:00:00Z', updatedAt: '2020-01-01T00:00:00Z' })
const tick = () => new Promise((resolve) => setImmediate(resolve))
const jsx = (type, props) => ({ type, props })
function find(node, type) {
  if (!node || typeof node !== 'object') return undefined
  if (node.type === type) return node
  return [node.props?.children].flat(Infinity).map((child) => find(child, type)).find(Boolean)
}
function mount(kind = 'list', id = 'a') {
  const calls = [], slots = [], effects = []
  const window = { location: { hash: '#/settlements' } }
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
  const auth = load('adminAuth.ts')
  imports['./adminAuth'] = imports['../adminAuth'] = auth
  imports['./data/bankCodeOptions'] = imports['../data/bankCodeOptions'] = load('data/bankCodeOptions.ts')
  imports['./FormControls'] = { PrimaryButton: 'PrimaryButton', TextField: 'TextField' }
  const api = load('logisticsCompanies.ts')
  imports['../logisticsCompanies'] = api
  imports['../settlements'] = load('settlements.ts')
  for (const name of ['ConfirmationDialog', 'DataPageHeader', 'DataTable', 'LogisticsForm']) {
    imports[`../components/${name}`] = { [name]: name }
  }
  imports['../components/PageFilters'] = { SearchFilter: 'SearchFilter' }
  if (kind === 'form') props = { initialValues: { ...company('a'), bank: 'KB국민은행' },
    save: (values) => api.saveLogisticsCompany(values, id ?? undefined), actionLabel: '저장' }
  const component = kind === 'form' ? load('components/LogisticsForm.tsx').LogisticsForm : kind === 'list' ? load('pages/LogisticsSettlementPage.tsx').LogisticsSettlementPage
    : load('pages/LogisticsFormPage.tsx').LogisticsEditPage
  const page = {
    calls, window, api,
    render() {
      index = 0
      let tree = component(props)
      effects.splice(0).forEach((effect) => effect())
      if (typeof tree?.type === 'function') tree = tree.type(tree.props)
      return tree
    },
    changeId(id) { props = { id }; return page.render() },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()) },
    async respond(index, status, data) { calls[index].resolve(status === 204 ? new Response(null, { status }) : Response.json(data, { status })); await tick() },
  }
  page.render()
  return page
}

test('real settlement list fields, bank names and zero mileage replace samples', async () => {
  const page = mount()
  assert.match(find(page.render(), 'DataTable').props.emptyMessage, /불러오는 중/)
  await page.respond(0, 200, [company('a', 'Alpha 물류'), company('b', 'Beta 물류')])
  const table = find(page.render(), 'DataTable').props
  assert.equal(table.rows.length, 2)
  assert.equal(table.rows[0].bank, 'KB국민은행')
  assert.equal(table.getRowKey(table.rows[0]), 'a')
  assert.equal(table.columns.find(column => column.key === 'mileage').render(table.rows[0]), '0')
  assert.equal(table.columns.find(column => column.key === 'transferStatus').render(table.rows[0]), '-')
  assert.equal(find(table.columns.find((column) => column.key === 'actions').render(table.rows[0]), 'a').props.href, '#/settlements/edit/a')
  find(page.render(), 'SearchFilter').props.onChange(' ALPHA ')
  assert.deepEqual(find(page.render(), 'DataTable').props.rows.map(({ id }) => id), ['a'])
  const month = find(page.render(), 'DataPageHeader').props.children[1]
  find(month.type(month.props), 'input').props.onChange({ target: { value: '2030-12' } })
  page.render()
  assert.equal(page.calls.length, 2)
  assert.match(page.calls[1].url, /settlements\?month=2030-12/)
  await page.respond(1, 200, [company('a', 'Alpha 물류')])
  assert.deepEqual(find(page.render(), 'DataTable').props.rows.map(({ id }) => id), ['a'])
  assert.match(page.calls[0].url, /\/api\/v1\/admin\/settlements\?month=/)
  assert.equal(page.calls[0].options.method, 'GET')
  assert.equal(page.calls[0].options.credentials, 'include')
})

test('empty success, server failure, network failure and malformed data stay distinct', async () => {
  const empty = mount()
  await empty.respond(0, 200, [])
  assert.equal(find(empty.render(), 'DataTable').props.emptyMessage, '물류사 데이터가 없습니다.')
  for (const data of [{}, [company('a', '')], [{ ...company('a'), bankCode: 'unknown' }]]) {
    const page = mount()
    await page.respond(0, 200, data)
    assert.equal(find(page.render(), 'DataTable').props.emptyMessage, page.api.LOGISTICS_LOAD_ERROR)
  }
  const failed = mount()
  await failed.respond(0, 500, { code: 'INTERNAL_SERVER_ERROR' })
  assert.equal(find(failed.render(), 'DataTable').props.emptyMessage, failed.api.LOGISTICS_LOAD_ERROR)
  assert.equal(failed.window.location.hash, '#/settlements')
  const offline = mount()
  offline.calls[0].reject(new TypeError('offline'))
  await tick()
  assert.equal(find(offline.render(), 'DataTable').props.emptyMessage, offline.api.LOGISTICS_LOAD_ERROR)
})

test('only a current invalid-session response redirects to login', async () => {
  for (const kind of ['list', 'detail']) {
    const active = mount(kind)
    await active.respond(0, 401, { code: 'INVALID_ADMIN_SESSION' })
    assert.equal(active.window.location.hash, '/login')
    const stale = mount(kind)
    stale.unmount()
    await stale.respond(0, 401, { code: 'INVALID_ADMIN_SESSION' })
    assert.equal(stale.window.location.hash, '#/settlements')
  }
})

test('detail loads all real form fields and defers writing until submit', async () => {
  const page = mount('detail', 'a')
  assert.equal(page.render(), null)
  await page.respond(0, 200, company('a'))
  const form = find(page.render(), 'LogisticsForm').props
  const { active: _active, mileage: _mileage, transferStatus: _transferStatus, createdAt: _createdAt, updatedAt: _updatedAt, ...fields } = company('a')
  assert.deepEqual(form.initialValues, { ...fields, bank: 'KB국민은행' })
  assert.equal(typeof form.save, 'function')
  assert.equal(page.calls[0].url, '/api/v1/admin/logistics-companies/a')
  assert.equal(page.calls[0].options.method, 'GET')
  assert.equal(page.calls.length, 1)
})

test('detail failures never expose an empty editable form and a new visit can recover', async () => {
  const page = mount('detail')
  await page.respond(0, 404, { code: 'LOGISTICS_COMPANY_NOT_FOUND' })
  assert.equal(find(page.render(), 'LogisticsForm'), undefined)
  assert.equal(find(page.render(), 'p').props.children, '물류사를 찾을 수 없습니다.')
  page.changeId('b')
  await page.respond(1, 500, { code: 'INTERNAL_SERVER_ERROR' })
  assert.equal(find(page.render(), 'p').props.children, page.api.LOGISTICS_LOAD_ERROR)
  page.changeId('c')
  await page.respond(2, 200, company('c'))
  assert.equal(find(page.render(), 'LogisticsForm').props.initialValues.id, 'c')
})

test('a late detail response cannot replace the current company or invalidate its session', async () => {
  for (const status of [200, 401]) {
    const page = mount('detail', 'a')
    page.changeId('b')
    await page.respond(1, 200, company('b'))
    await page.respond(0, status, status === 200 ? company('a') : { code: 'INVALID_ADMIN_SESSION' })
    assert.equal(find(page.render(), 'LogisticsForm').props.initialValues.id, 'b')
    assert.equal(page.window.location.hash, '#/settlements')
  }
})


function submit(page) {
  return find(page.render(), 'form').props.onSubmit({ preventDefault() {} })
}

test('create and update submit exactly nine DTO fields and navigate only after valid server success', async () => {
  for (const id of [null, 'a']) {
    const page = mount('form', id)
    find(page.render(), 'TextField').props.onChange({ target: { value: '수정 사업자' } })
    const pending = submit(page)
    assert.equal(page.window.location.hash, '#/settlements')
    const request = page.calls[0]
    assert.equal(request.url, `/api/v1/admin/logistics-companies${id ? '/a' : ''}`)
    assert.equal(request.options.method, id ? 'PUT' : 'POST')
    assert.deepEqual(JSON.parse(request.options.body), {
      businessName: '수정 사업자', businessNumber: '123-45-67890',
      corporateRegistrationNumber: '123456-1234567', businessAddress: '서울시',
      managerName: '담당자', managerPhone: '010-1234-5678', bankCode: '4',
      accountNumber: '1234567890', accountHolder: '예금주',
    })
    assert.equal(request.options.credentials, 'include')
    assert.equal(find(page.render(), 'PrimaryButton').props.disabled, true)
    await submit(page)
    assert.equal(page.calls.length, 1)
    await page.respond(0, id ? 200 : 201, company(id ?? 'new'))
    await pending
    assert.equal(page.window.location.hash, '/settlements')
  }
})

test('save errors remain in the existing form error and allow retry', async () => {
  for (const [status, code, message] of [
    [400, 'VALIDATION_ERROR', '입력한 물류사 정보를 확인해주세요.'],
    [409, 'LOGISTICS_COMPANY_DUPLICATE', '이미 등록된 사업자 정보입니다.'],
    [404, 'LOGISTICS_COMPANY_NOT_FOUND', '물류사를 찾을 수 없습니다.'],
    [500, 'INTERNAL_SERVER_ERROR', '물류사 데이터 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'],
  ]) {
    const page = mount('form')
    const pending = submit(page)
    await page.respond(0, status, { code })
    await pending
    assert.equal(find(page.render(), 'p').props.children, message)
    assert.equal(page.window.location.hash, '#/settlements')
    const retry = submit(page)
    assert.equal(page.calls.length, 2)
    await page.respond(1, 200, company('a'))
    await retry
    assert.equal(page.window.location.hash, '/settlements')
  }
})

test('network and malformed success cannot claim that the company was saved', async () => {
  for (const failure of ['network', 'malformed', 'wrong-status']) {
    const page = mount('form')
    const pending = submit(page)
    if (failure === 'network') page.calls[0].reject(new TypeError('offline'))
    else await page.respond(0, failure === 'wrong-status' ? 201 : 200, failure === 'malformed' ? {} : company('a'))
    await pending
    assert.equal(page.window.location.hash, '#/settlements')
    assert.match(find(page.render(), 'p').props.children, /저장 중 오류/)
  }
})

test('only current saves can redirect after success or session expiry', async () => {
  for (const status of [200, 401]) {
    for (const leave of ['unmount', 'hash']) {
      const page = mount('form')
      const pending = submit(page)
      if (leave === 'unmount') page.unmount()
      page.window.location.hash = '#/drivers'
      await page.respond(0, status, status === 200 ? company('a') : { code: 'INVALID_ADMIN_SESSION' })
      await pending
      assert.equal(page.window.location.hash, '#/drivers')
      assert.equal(find(page.render(), 'p'), undefined)
    }
  }
  const active = mount('form')
  const pending = submit(active)
  await active.respond(0, 401, { code: 'INVALID_ADMIN_SESSION' })
  await pending
  assert.equal(active.window.location.hash, '/login')
})

test('existing field validation prevents invalid input from reaching the write API', async () => {
  const page = mount('form')
  find(page.render(), 'TextField').props.onChange({ target: { value: '' } })
  await submit(page)
  assert.equal(page.calls.length, 0)
  assert.equal(find(page.render(), 'p').props.children, '사업자명을 입력해주세요.')
})


async function loadedCompanies() {
  const page = mount()
  await page.respond(0, 200, [company('a', 'Alpha'), company('b', 'Beta')])
  return page
}
function table(page) { return find(page.render(), 'DataTable').props }
function openDeactivate(page, id = 'a') {
  const row = table(page).rows.find((row) => row.id === id)
  find(table(page).columns.find(({ key }) => key === 'actions').render(row), 'button').props.onClick()
  return find(page.render(), 'ConfirmationDialog').props
}

test('deactivation explains preserved records, supports cancel, and waits for 204 with duplicate protection', async () => {
  const page = await loadedCompanies()
  const cancelled = openDeactivate(page)
  assert.equal(cancelled.actionLabel, '비활성화')
  assert.equal(cancelled.title, '물류사를 비활성화하시겠습니까?')
  assert.match(cancelled.description, /기록은 보존/)
  assert.match(cancelled.description, /로그인과 기존 세션 이용이 차단/)
  cancelled.onCancel()
  assert.equal(page.calls.length, 1)
  const dialog = openDeactivate(page)
  const pending = dialog.onConfirm()
  await dialog.onConfirm()
  assert.equal(page.calls.length, 2)
  assert.equal(page.calls[1].url, '/api/v1/admin/logistics-companies/a')
  assert.equal(page.calls[1].options.method, 'DELETE')
  assert.equal(page.calls[1].options.body, undefined)
  assert.equal(page.calls[1].options.credentials, 'include')
  assert.equal(table(page).rows.length, 2)
  find(page.render(), 'SearchFilter').props.onChange('Beta')
  await page.respond(1, 204)
  await pending
  assert.equal(find(page.render(), 'ConfirmationDialog'), undefined)
  assert.equal(find(page.render(), 'SearchFilter').props.value, 'Beta')
  assert.match(page.calls[2].url, /\/api\/v1\/admin\/settlements\?month=/)
  await page.respond(2, 200, [company('b', 'Beta')])
  assert.deepEqual(table(page).rows.map(({ id }) => id), ['b'])
})

test('failed deactivation keeps real rows and offers retry in the existing modal', async () => {
  for (const status of [404, 500, 200]) {
    const page = await loadedCompanies()
    const pending = openDeactivate(page).onConfirm()
    await page.respond(1, status, status === 404 ? { code: 'LOGISTICS_COMPANY_NOT_FOUND' } : {})
    await pending
    assert.equal(table(page).rows.length, 2)
    assert.match(find(page.render(), 'ConfirmationDialog').props.description,
      status === 404 ? /찾을 수 없습니다/ : /비활성화 중 오류/)
    const retry = find(page.render(), 'ConfirmationDialog').props.onConfirm()
    await page.respond(2, 204)
    await retry
    assert.equal(find(page.render(), 'ConfirmationDialog'), undefined)
  }
  const offline = await loadedCompanies()
  const pending = openDeactivate(offline).onConfirm()
  offline.calls[1].reject(new TypeError('offline'))
  await pending
  assert.equal(table(offline).rows.length, 2)
  assert.match(find(offline.render(), 'ConfirmationDialog').props.description, /비활성화 중 오류/)
})

test('cancelled requests refresh without overwriting the next target and stale refreshes cannot restore inactive rows', async () => {
  const page = await loadedCompanies()
  const first = openDeactivate(page)
  const pending = first.onConfirm()
  first.onCancel()
  const next = openDeactivate(page, 'b')
  await next.onConfirm()
  assert.equal(page.calls.length, 2)
  await page.respond(1, 204)
  await pending
  assert.match(find(page.render(), 'ConfirmationDialog').props.description, /기록은 보존/)
  assert.equal(page.calls[2].options.method, 'GET')
  const secondPending = find(page.render(), 'ConfirmationDialog').props.onConfirm()
  assert.equal(page.calls[3].url, '/api/v1/admin/logistics-companies/b')
  await page.respond(3, 204)
  await secondPending
  page.render()
  await page.respond(4, 200, [])
  await page.respond(2, 200, [company('b', 'Beta')])
  assert.deepEqual(table(page).rows, [])
  assert.equal(find(page.render(), 'ConfirmationDialog'), undefined)
})

test('cancelled deactivation failure refreshes uncertain server state without showing an old error', async () => {
  const page = await loadedCompanies()
  const dialog = openDeactivate(page)
  const pending = dialog.onConfirm()
  dialog.onCancel()
  openDeactivate(page, 'b')
  page.calls[1].reject(new TypeError('connection lost'))
  await pending
  assert.match(find(page.render(), 'ConfirmationDialog').props.description, /기록은 보존/)
  assert.equal(page.calls[2].options.method, 'GET')
  await page.respond(2, 200, [company('a'), company('b')])
  assert.equal(table(page).rows.length, 2)
})

test('late deactivation responses after leaving cannot refresh or redirect; current 401 still redirects', async () => {
  for (const status of [204, 401, 500]) {
    const page = await loadedCompanies()
    const pending = openDeactivate(page).onConfirm()
    page.unmount()
    page.window.location.hash = '#/drivers'
    await page.respond(1, status, status === 204 ? undefined : { code: 'INVALID_ADMIN_SESSION' })
    await pending
    assert.equal(page.window.location.hash, '#/drivers')
    assert.equal(page.calls.length, 2)
  }
  const current = await loadedCompanies()
  const pending = openDeactivate(current).onConfirm()
  await current.respond(1, 401, { code: 'INVALID_ADMIN_SESSION' })
  await pending
  assert.equal(current.window.location.hash, '/login')
  assert.equal(table(current).rows.length, 2)
})


test('pending saves keep visible text and bank equal to the payload; failure unlocks both fields', async () => {
  for (const id of [null, 'a']) {
    const page = mount('form', id)
    const pending = submit(page)
    const sent = JSON.parse(page.calls[0].options.body)
    find(page.render(), 'TextField').props.onChange({ target: { value: '늦은 변경' } })
    find(page.render(), 'select').props.onChange({ target: { value: '11' } })
    assert.equal(find(page.render(), 'TextField').props.value, sent.businessName)
    assert.equal(find(page.render(), 'select').props.value, sent.bankCode)
    await submit(page)
    assert.equal(page.calls.length, 1)
    await page.respond(0, 409, { code: 'LOGISTICS_COMPANY_DUPLICATE' })
    await pending
    find(page.render(), 'TextField').props.onChange({ target: { value: '재시도 사업자' } })
    find(page.render(), 'select').props.onChange({ target: { value: '11' } })
    assert.equal(find(page.render(), 'TextField').props.value, '재시도 사업자')
    assert.equal(find(page.render(), 'select').props.value, '11')
    const retry = submit(page)
    assert.equal(JSON.parse(page.calls[1].options.body).businessName, '재시도 사업자')
    assert.equal(JSON.parse(page.calls[1].options.body).bankCode, '11')
    await page.respond(1, id ? 200 : 201, { ...company(id ?? 'new', '재시도 사업자'), bankCode: '11' })
    await retry
    assert.equal(page.window.location.hash, '/settlements')
    assert.equal(page.calls.length, 2)
  }
})

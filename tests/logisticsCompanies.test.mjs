import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const sources = Object.fromEntries(['adminAuth.ts', 'logisticsCompanies.ts', 'data/bankCodeOptions.ts',
  'pages/LogisticsSettlementPage.tsx', 'pages/LogisticsFormPage.tsx', 'components/LogisticsForm.tsx'].map((path) => [path, compile(`../src/${path}`)]))
const company = (id, businessName = id) => ({ id, businessName, businessNumber: '123-45-67890',
  corporateRegistrationNumber: '123456-1234567', businessAddress: '서울시', managerName: '담당자',
  managerPhone: '01012345678', bankCode: '4', accountNumber: '1234567890', accountHolder: '예금주',
  active: true, createdAt: '2020-01-01T00:00:00Z', updatedAt: '2020-01-01T00:00:00Z' })
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
    async respond(index, status, data) { calls[index].resolve(Response.json(data, { status })); await tick() },
  }
  page.render()
  return page
}

test('real list fields and bank names replace samples; missing aggregates remain unavailable', async () => {
  const page = mount()
  assert.match(find(page.render(), 'DataTable').props.emptyMessage, /불러오는 중/)
  await page.respond(0, 200, [company('a', 'Alpha 물류'), company('b', 'Beta 물류')])
  const table = find(page.render(), 'DataTable').props
  assert.equal(table.rows.length, 2)
  assert.equal(table.rows[0].bank, 'KB국민은행')
  assert.equal(table.getRowKey(table.rows[0]), 'a')
  for (const key of ['mileage', 'transferStatus']) assert.equal(table.columns.find((column) => column.key === key).render(table.rows[0]), '-')
  assert.equal(find(table.columns.find((column) => column.key === 'actions').render(table.rows[0]), 'a').props.href, '#/settlements/edit/a')
  find(page.render(), 'SearchFilter').props.onChange(' ALPHA ')
  assert.deepEqual(find(page.render(), 'DataTable').props.rows.map(({ id }) => id), ['a'])
  const month = find(page.render(), 'DataPageHeader').props.children[1]
  find(month.type(month.props), 'input').props.onChange({ target: { value: '2030-12' } })
  assert.deepEqual(find(page.render(), 'DataTable').props.rows.map(({ id }) => id), ['a'])
  assert.equal(page.calls.length, 1)
  assert.equal(page.calls[0].url, '/api/v1/admin/logistics-companies')
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
  const { active: _active, createdAt: _createdAt, updatedAt: _updatedAt, ...fields } = company('a')
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

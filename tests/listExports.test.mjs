import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const jsx = (type, props) => ({ type, props })
const tick = () => new Promise(resolve => setImmediate(resolve))
function find(node, type) {
  if (!node || typeof node !== 'object') return undefined
  if (node.type === type) return node
  return [node.props?.children].flat(Infinity).map(child => find(child, type)).find(Boolean)
}
const driver = id => ({ id, logisticsCompanyId: id, logisticsCompanyName: id, name: id, phone: '01012345678', email: `${id}@example.test`, joinedAt: '2020-01-01', totalAmount: 200000, mileage: 3000 })
const station = (id, pole) => ({ id, businessName: id, pole, roadAddress: '서울', note: null, latitude: 37.5, longitude: 127.1, createdAt: '2020-01-01', devices: [{ id: 'one', model: '모델', capacityLiters: 1000, active: true }] })
const receipt = id => ({ id, reviewVersion: 'a'.repeat(64), settlementId: null, userId: id, logisticsCompanyId: id, logisticsCompanyName: id, name: id, phone: '01012345678', receiptAmount: 200000, meterAmount: 200000, finalAmount: 200000, liters: '100', mileageAmount: 3000, receiptAt: '2020-01-01', matchStatus: 'matched', ocrErrorCode: null, status: 'approved', rejectionReason: null, photos: { receipt: null, meter: null } })
const company = month => ({ id: month, month, businessName: month, businessNumber: '00123', corporateRegistrationNumber: '456', businessAddress: '서울', managerName: '담당자', managerPhone: '01012345678', bankCode: '4', accountNumber: '001234567890', accountHolder: '예금주', active: true, mileage: 3000, registeredMileage: 3000, additionalUnpaidMileage: 0, transferStatus: 'pending' })
const datasets = { drivers: [driver('visible'), driver('hidden')], stations: [station('visible', 'GS'), station('hidden', '농협')], 'mileage/applications': [receipt('visible'), receipt('hidden')], 'settlements/all': [company('2026-08'), company('2026-09')] }

function mount(page, overrides = {}) {
  const calls = [], downloads = [], slots = [], effects = [], window = { location: { pathname: '/test' } }
  let index = 0
  const react = {
    useRef(initial) { const key = index++; return slots[key] ??= { current: initial } },
    useState(initial) { const key = index++; if (!(key in slots)) slots[key] = typeof initial === 'function' ? initial() : initial; return [slots[key], value => { slots[key] = typeof value === 'function' ? value(slots[key]) : value }] },
    useEffect(effect, deps) { const key = index++, old = slots[key]; if (!old || deps.some((d, i) => d !== old.deps[i])) effects.push(() => { old?.cleanup?.(); slots[key] = { deps, cleanup: effect() } }) },
  }
  const imports = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    '../navigation': { navigate: path => { window.location.pathname = path } },
    './adminAuth': { isInvalidAdminSession: () => false, requestAdmin: async path => { calls.push(path); return overrides.request ? overrides.request(path) : datasets[path] ?? (path.startsWith('settlements?') ? [company('2026-10')] : datasets[path.split('?')[0]]?.slice(0, 1)) } },
    '../utils/tableExport': { downloadTableWorkbook: (...args) => downloads.push(args) },
  }
  imports['../adminAuth'] = imports['./adminAuth']
  for (const name of ['DataPageHeader', 'DataTable', 'ConfirmationDialog', 'FormControls', 'StatusSelect']) imports[`../components/${name}`] = { [name]: name, NoticeDialog: 'NoticeDialog', TextField: 'TextField' }
  imports['../components/PageFilters'] = { SearchFilter: 'SearchFilter', AffiliationFilter: 'AffiliationFilter', DateRangeFilter: 'DateRangeFilter' }
  function load(path) {
    const code = ts.transpileModule(readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
    const exports = {}
    new Function('require', 'exports', 'window', code)(name => { if (name.endsWith('.svg')) return { default: name }; assert.ok(name in imports, name); return imports[name] }, exports, window)
    return exports
  }
  imports['./data/bankCodeOptions'] = load('data/bankCodeOptions.ts')
  imports['./utils/dateRange'] = imports['../utils/dateRange'] = load('utils/dateRange.ts')
  for (const api of ['drivers', 'stations', 'receipts', 'logisticsCompanies', 'settlements']) imports[`../${api}`] = load(`${api}.ts`)
  const Component = load(page === 'DataPageHeader' ? 'components/DataPageHeader.tsx' : `pages/${page}.tsx`)[page]
  const h = { calls, downloads, window, api: imports['../settlements'], render(props = {}) { index = 0; const tree = Component(props); effects.splice(0).forEach(effect => effect()); return tree }, unmount() { slots.forEach(slot => slot?.cleanup?.()) } }
  h.render()
  return h
}

for (const [page, endpoint] of [['DriverDataPage', 'drivers'], ['InfrastructureDataPage', 'stations'], ['ReceiptDataPage', 'mileage/applications']]) {
  test(`${page} exports every server row independently of current filters`, async () => {
    const h = mount(page)
    await tick()
    find(h.render(), 'SearchFilter').props.onChange('visible')
    const filter = find(h.render(), 'AffiliationFilter')
    filter.props.onChange(page === 'InfrastructureDataPage' ? 'GS' : 'visible')
    h.render(); await tick()
    const rows = await find(h.render(), 'DataPageHeader').props.onExport()
    assert.equal(h.calls.at(-1), endpoint)
    assert.equal(rows.length, 3)
    assert.ok(rows[2].includes('hidden'))
    assert.ok(rows.flat().every(value => typeof value === 'string'))
    h.unmount()
  })
}

test('Pole choices come from all stations and filter the displayed device rows only', async () => {
  const h = mount('InfrastructureDataPage')
  await tick()
  const pole = find(h.render(), 'AffiliationFilter').props
  assert.equal(pole.placeholder, 'Pole 전체')
  assert.deepEqual(pole.options, ['GS', '농협'])
  pole.onChange('농협')
  assert.deepEqual(find(h.render(), 'DataTable').props.rows, [])
  pole.onChange('GS')
  assert.equal(find(h.render(), 'DataTable').props.rows[0].pole, 'GS')
  h.unmount()
})

test('settlement export reads every month without invoking bank export or mutating requests', async () => {
  const h = mount('LogisticsSettlementPage')
  await tick()
  find(h.render(), 'SearchFilter').props.onChange('no match')
  const rows = await find(h.render(), 'DataPageHeader').props.onExport()
  assert.equal(h.calls.at(-1), 'settlements/all')
  assert.deepEqual(rows.map(row => row[0]), ['정산 월', '2026-08', '2026-09'])
  assert.equal(rows[1][5], '001234567890')
  assert.equal(rows[1][6], 'KB국민은행')
  assert.equal(h.calls.some(path => path.includes('/export')), false)
  h.unmount()
})

test('all-month parser rejects invalid months, amounts and bank data', async () => {
  for (const bad of [{ month: '2026-13' }, { mileage: -1 }, { bankCode: 'unknown' }]) {
    const h = mount('DataPageHeader', { request: () => [{ ...company('2026-08'), ...bad }] })
    await assert.rejects(h.api.getAllSettlements())
    h.unmount()
  }
})

test('export prevents duplicate downloads and ignores late responses after navigation or unmount', async () => {
  for (const leave of ['navigate', 'unmount', 'stay']) {
    const h = mount('DataPageHeader'), pending = Promise.withResolvers(), failures = []
    let count = 0
    const props = { title: '목록', titleId: 'title', onExport: () => { count++; return pending.promise }, onExportError: error => failures.push(error) }
    const button = find(h.render(props), 'button')
    const first = button.props.onClick()
    await button.props.onClick()
    assert.equal(count, 1)
    if (leave === 'navigate') h.window.location.pathname = '/other'
    if (leave === 'unmount') h.unmount()
    pending.resolve([['이름'], ['기사']]); await first
    assert.equal(h.downloads.length, leave === 'stay' ? 1 : 0)
    assert.deepEqual(failures, [])
    h.unmount()
  }
  const h = mount('DataPageHeader'), errors = []
  await find(h.render({ title: '목록', titleId: 'title', onExport: async () => { throw new Error('failed') }, onExportError: error => errors.push(error) }), 'button').props.onClick()
  assert.equal(errors.length, 1)
  assert.equal(h.downloads.length, 0)
  assert.equal(find(h.render({ title: '대시보드', titleId: 'title' }), 'button'), undefined)
  h.unmount()
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const sources = Object.fromEntries(['adminAuth.ts', 'receipts.ts', 'components/StatusSelect.tsx', 'pages/ReceiptDataPage.tsx'].map((path) => [path,
  ts.transpileModule(readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText]))
const jsx = (type, props) => ({ type, props })
const tick = () => new Promise((resolve) => setImmediate(resolve))
const row = (id, company = 'company-a') => ({ id, userId: 'user-' + id, logisticsCompanyId: company,
  reviewVersion: 'a'.repeat(64), settlementId: null,
  logisticsCompanyName: '같은 회사명', name: '기사 ' + id, phone: '010-1234-5678', receiptAmount: null,
  meterAmount: null, finalAmount: null, liters: null, mileageAmount: null, receiptAt: null, status: 'pending',
  rejectionReason: null,
  matchStatus: 'pending', photos: { receipt: `/api/v1/admin/mileage/applications/${id}/photos/receipt`, meter: null } })
function find(node, type, predicate = () => true) {
  if (!node || typeof node !== 'object') return undefined
  if (node.type === type && predicate(node)) return node
  return [node.props?.children].flat(Infinity).map((child) => find(child, type, predicate)).find(Boolean)
}
function mount() {
  const calls = [], slots = [], effects = []
  const window = { location: { pathname: '/receipts' } }
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
      if (name.endsWith('/navigation')) return { navigate: (path) => { window.location.pathname = path } }
      assert.ok(name in imports, `Unexpected import ${name}`)
      return imports[name]
    }, exports, fetch, window)
    return exports
  }
  imports['./adminAuth'] = imports['../adminAuth'] = load('adminAuth.ts')
  imports['../receipts'] = load('receipts.ts')
  imports['../components/StatusSelect'] = load('components/StatusSelect.tsx')
  imports['../components/PageFilters'] = { AffiliationFilter: 'AffiliationFilter', SearchFilter: 'SearchFilter' }
  imports['../components/FormControls'] = { TextField: 'TextField' }
  for (const name of ['DataPageHeader', 'DataTable', 'ConfirmationDialog']) imports[`../components/${name}`] = { [name]: name }
  imports['../components/ConfirmationDialog'].NoticeDialog = 'NoticeDialog'
  imports['./ConfirmationDialog'] = imports['../components/ConfirmationDialog']
  const { ReceiptDataPage } = load('pages/ReceiptDataPage.tsx')
  const page = {
    calls, window, api: imports['../receipts'],
    render() { index = 0; const tree = ReceiptDataPage(); effects.splice(0).forEach((effect) => effect()); return tree },
    table() { return find(page.render(), 'DataTable').props },
    modal() { return find(page.render(), 'ConfirmationDialog')?.props },
    field(name) { return find(page.render(), 'TextField', (node) => node.props.name === name)?.props },
    reason(value) {
      const field = find(page.render(), 'textarea').props
      if (value !== undefined) field.onChange({ currentTarget: { value } })
      return find(page.render(), 'textarea').props
    },
    input(name, value, selectionStart = value.length) {
      const input = {
        get value() { return value },
        set value(next) { value = next; input.selectionStart = next.length },
        selectionStart,
        setSelectionRange(start) { input.selectionStart = start },
      }
      page.field(name).onChange({ target: input, currentTarget: input })
      const formatted = page.field(name).value
      if (input.value !== formatted) input.value = formatted
      return input
    },
    approval(finalAmount = '1234', liters = '5.125') {
      for (const [name, value] of [['finalAmount', finalAmount], ['liters', liters]]) {
        page.input(name, value)
      }
    },
    status(receipt) {
      const node = page.table().columns.find(column => column.key === 'status').render(receipt)
      return typeof node.type === 'function' ? node.type(node.props) : node
    },
    review(receipt, action) {
      const select = find(page.status(receipt), 'select')
      if (!select || select.props.disabled) return false
      select.props.onChange({ target: { value: action } })
      return true
    },
    change(type, value) { find(page.render(), type).props.onChange(value); page.render() },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()) },
    async respond(index, status, data) { calls[index].resolve(Response.json(data, { status })); await tick() },
  }
  page.render()
  return page
}

test('receipt data uses admin cookies and shows pending or rejected mileage as zero', async () => {
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
  for (const key of ['receiptAmount', 'meterAmount', 'finalAmount', 'receiptDate']) {
    assert.equal(columns.find((column) => column.key === key).render(row('a')), '-')
  }
  assert.equal(columns.find((column) => column.key === 'mileage').render(row('a')), '0')
  assert.equal(columns.find((column) => column.key === 'mileage').render({ ...row('a'), status: 'rejected' }), '0')
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
  assert.equal(page.window.location.pathname, '/receipts')
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
    assert.match(find(page.render(), 'NoticeDialog').props.message, /불러오지 못했습니다/)
    assert.equal(page.table().emptyMessage, undefined)
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
  assert.equal(current.window.location.pathname, '/login')
  for (const [status, value] of [[200, [row('a')]], [401, { code: 'INVALID_ADMIN_SESSION' }]]) {
    const page = mount()
    page.unmount()
    page.window.location.pathname = '/settlements'
    await page.respond(0, status, value)
    assert.equal(page.window.location.pathname, '/settlements')
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

test('dropdown preserves the current status on cancel and locks settlement-attached rows', async () => {
  const page = mount()
  await page.respond(0, 200, [row('a')])
  const select = () => find(page.status(row('a')), 'select').props
  assert.equal(select().value, '대기')
  assert.equal(select()['aria-label'], '기사 a 승인 여부')
  assert.deepEqual(select().children.filter(option => !option.props.disabled && !option.props.hidden)
    .map(option => option.props.value), ['승인', '반려'])
  assert.equal(find(page.status(row('a')), 'button'), undefined)
  for (const action of ['승인', '승인', '반려']) {
    page.review(row('a'), action)
    assert.equal(page.modal().title, `${action}하시겠습니까?`)
    assert.equal(select().value, '대기')
    assert.equal(select().disabled, true)
    assert.equal(page.calls.length, 1)
    page.modal().onCancel()
    assert.equal(select().value, '대기')
    assert.equal(select().disabled, false)
  }
  for (const [status, label] of [['approved', '승인'], ['rejected', '반려'], ['pending', '대기']]) {
    const receipt = { ...row('a'), status }
    assert.equal(find(page.status(receipt), 'select').props.value, label)
    page.review(receipt, label)
    assert.equal(page.modal(), undefined)
    const actions = ['승인', '대기', '반려'].filter(action => action !== label)
    assert.deepEqual(find(page.status(receipt), 'select').props.children
      .filter(option => !option.props.disabled && !option.props.hidden).map(option => option.props.value), actions)
    for (const action of actions) {
      page.review(receipt, action)
      const modal = page.modal()
      assert.equal(modal.title, action === '대기' ? '대기 상태로 변경하시겠습니까?' : `${action}하시겠습니까?`)
      modal.onCancel()
      await modal.onConfirm()
      assert.equal(page.calls.length, 1)
      assert.equal(find(page.status(receipt), 'select').props.value, label)
    }
  }
  for (const status of ['pending', 'approved', 'rejected']) {
    const receipt = { ...row('a'), status, settlementId: 'settled' }
    assert.equal(find(page.status(receipt), 'select'), undefined)
    assert.equal(page.review(receipt, '승인'), false)
  }
})

test('returning approved or rejected receipts to pending requires confirmation and preserves rows on failure', async () => {
  for (const status of ['approved', 'rejected']) {
    const page = mount()
    const receipt = { ...row('a'), status, finalAmount: status === 'approved' ? 10000 : null,
      mileageAmount: status === 'approved' ? 100 : null, rejectionReason: status === 'rejected' ? '금액 확인' : null }
    await page.respond(0, 200, [receipt])
    page.review(receipt, '대기')
    assert.equal(page.calls.length, 1)
    assert.equal(page.field('finalAmount'), undefined)
    assert.equal(find(page.render(), 'textarea'), undefined)
    assert.equal(page.modal().actionLabel, '확인')
    const confirm = page.modal().onConfirm
    confirm(); confirm()
    assert.equal(page.calls.length, 2)
    assert.equal(page.calls[1].url, '/api/v1/admin/mileage/applications/a/pending')
    assert.equal(page.calls[1].options.method, 'POST')
    assert.deepEqual(JSON.parse(page.calls[1].options.body), { reviewVersion: receipt.reviewVersion })
    assert.deepEqual(page.table().rows, [receipt])
    await page.respond(1, 500, {})
    assert.deepEqual(page.table().rows, [receipt])
    page.modal().onConfirm()
    const pending = { ...row('a'), reviewVersion: 'b'.repeat(64) }
    await page.respond(2, 200, pending)
    assert.equal(page.modal(), undefined)
    assert.deepEqual(page.table().rows, [pending])
    await page.respond(3, 200, [pending])
    page.unmount()
  }
})

test('pending refuses responses that retain a final amount, mileage or rejection reason', async () => {
  for (const extra of [{ finalAmount: 10000 }, { mileageAmount: 100 }, { rejectionReason: '기존 사유' }]) {
    const page = mount()
    const result = assert.rejects(page.api.reviewReceipt(row('a'), 'pending'))
    await page.respond(1, 200, { ...row('a'), ...extra })
    await result
    page.unmount()
  }
})

test('approval sends confirmed amount and decimal liters, locks edits and updates only after server success', async () => {
  const page = mount()
  await page.respond(0, 200, [row('a')])
  assert.equal(page.review(row('a'), '승인'), true)
  assert.equal(page.field('finalAmount').value, '')
  assert.equal(page.field('liters').value, '')
  page.approval()
  const modal = page.modal()
  assert.equal(modal.title, '승인하시겠습니까?')
  modal.onConfirm(); modal.onConfirm()
  assert.equal(page.calls.length, 2)
  assert.equal(page.calls[1].url, '/api/v1/admin/mileage/applications/a/approve')
  assert.equal(page.calls[1].options.method, 'POST')
  assert.deepEqual(JSON.parse(page.calls[1].options.body), { reviewVersion: 'a'.repeat(64), finalAmount: 1234, liters: '5.125' })
  assert.equal(page.field('finalAmount').disabled, true)
  assert.equal(page.field('liters').disabled, true)
  assert.equal(page.table().rows[0].status, 'pending')
  const approved = { ...row('a'), reviewVersion: 'b'.repeat(64), status: 'approved', finalAmount: 1234, liters: '5.125', mileageAmount: 103 }
  await page.respond(1, 200, approved)
  assert.equal(page.modal(), undefined)
  await page.respond(2, 200, [approved])
  assert.deepEqual(page.table().rows, [approved])
  page.review(approved, '승인')
  assert.equal(page.modal(), undefined)
  assert.equal(page.review({ ...row('a'), settlementId: 'settled' }, '반려'), false)
})

test('approved and rejected receipts can reverse using the latest version without optimistic changes', async () => {
  const page = mount()
  const approved = { ...row('a'), status: 'approved', finalAmount: 1234, liters: '5.125', mileageAmount: 103 }
  const rejected = { ...row('a'), reviewVersion: 'b'.repeat(64), status: 'rejected', rejectionReason: '금액 재확인' }
  await page.respond(0, 200, [approved])
  page.review(approved, '반려')
  page.reason(rejected.rejectionReason)
  page.modal().onConfirm()
  await page.respond(1, 500, {})
  assert.equal(page.table().rows[0].status, 'approved')
  page.modal().onConfirm()
  assert.equal(JSON.parse(page.calls[2].options.body).reviewVersion, approved.reviewVersion)
  await page.respond(2, 200, rejected)
  assert.equal(page.modal(), undefined)
  await page.respond(3, 200, [rejected])
  page.review(rejected, '승인')
  page.approval('2000', '10')
  page.modal().onConfirm()
  assert.equal(page.table().rows[0].status, 'rejected')
  assert.equal(JSON.parse(page.calls[4].options.body).reviewVersion, rejected.reviewVersion)
  const reapproved = { ...approved, reviewVersion: 'c'.repeat(64), finalAmount: 2000, liters: '10', mileageAmount: 200 }
  await page.respond(4, 200, reapproved)
  assert.equal(page.modal(), undefined)
  await page.respond(5, 200, [reapproved])
  assert.deepEqual(page.table().rows, [reapproved])
})

test('review failure preserves pending state and retries the entered rejection reason', async () => {
  const page = mount()
  await page.respond(0, 200, [row('a')])
  page.review(row('a'), '반려')
  page.reason('사진을 다시 확인해주세요.')
  assert.equal(page.field('finalAmount'), undefined)
  page.modal().onConfirm()
  await page.respond(1, 500, {})
  assert.equal(page.table().rows[0].status, 'pending')
  assert.match(page.modal().description, /다시 시도/)
  page.modal().onConfirm()
  assert.equal(page.calls[2].url, '/api/v1/admin/mileage/applications/a/reject')
  assert.deepEqual(JSON.parse(page.calls[2].options.body), { reviewVersion: row('a').reviewVersion, rejectionReason: '사진을 다시 확인해주세요.' })
  assert.equal(page.reason().value, '사진을 다시 확인해주세요.')
  await page.respond(2, 200, { ...row('a'), status: 'rejected', rejectionReason: '사진을 다시 확인해주세요.' })
  assert.equal(page.modal(), undefined)
})

test('conflict reloads current data and never retries review with an unseen version', async () => {
  const page = mount()
  await page.respond(0, 200, [row('a')])
  page.review(row('a'), '반려')
  page.reason('사진을 다시 확인해주세요.')
  const confirm = page.modal().onConfirm
  confirm()
  await page.respond(1, 409, { code: 'MILEAGE_REVIEW_CONFLICT' })
  assert.equal(page.modal().actionLabel, '확인')
  await page.respond(2, 200, [{ ...row('a'), status: 'approved' }])
  confirm()
  assert.equal(page.modal(), undefined)
  assert.equal(page.calls.length, 3)
})

test('review callbacks after navigation cannot change the next screen or redirect it', async () => {
  for (const status of [200, 401]) {
    const page = mount()
    await page.respond(0, 200, [row('a')])
    page.review(row('a'), '승인')
    page.approval()
    const stale = page.modal().onConfirm
    stale()
    page.unmount()
    page.window.location.pathname = '/settlements'
    await page.respond(1, status, status === 200 ? { ...row('a'), status: 'approved' } : { code: 'INVALID_ADMIN_SESSION' })
    stale()
    assert.equal(page.calls.length, 2)
    assert.equal(page.window.location.pathname, '/settlements')
  }
})

test('review rejects malformed responses and does not report success for another application', async () => {
  for (const value of [{ ...row('a'), reviewVersion: '' }, { ...row('a'), settlementId: undefined },
    { ...row('b'), status: 'approved' }, { ...row('a'), status: 'approved' },
    { ...row('a'), status: 'approved', finalAmount: 9999, mileageAmount: 103 }, row('a')]) {
    const page = mount()
    const operation = page.api.reviewReceipt(row('a'), 'approve', { finalAmount: 1234, liters: '5.125' })
    const result = assert.rejects(operation)
    await page.respond(1, 200, value)
    await result
  }
})

test('review completion refreshes the latest filter without inserting an old row', async () => {
  const page = mount()
  await page.respond(0, 200, [row('a')])
  page.review(row('a'), '승인')
  page.approval('10', '1')
  page.modal().onConfirm()
  page.change('SearchFilter', '기사 b')
  await page.respond(2, 200, [row('a'), row('b')])
  await page.respond(3, 200, [row('b')])
  await page.respond(1, 200, { ...row('a'), status: 'approved', finalAmount: 10, liters: '1', mileageAmount: 20 })
  page.render()
  assert.match(page.calls[5].url, /nameQuery=/)
  await page.respond(4, 200, [row('a'), row('b')])
  await page.respond(5, 200, [row('b')])
  assert.deepEqual(page.table().rows, [row('b')])
})

test('approval validates both inputs before sending and retains entered values across a failed request', async () => {
  const page = mount()
  await page.respond(0, 200, [row('a')])
  page.review(row('a'), '승인')
  for (const [amount, liters] of [['', '1'], ['9007199254740992', '1'],
    ['1', ''], ['1', '1.2345'], ['1', '100000']]) {
    page.approval(amount, liters)
    page.modal().onConfirm()
    assert.equal(page.calls.length, 1)
    assert.match(page.modal().description, /입력/)
  }
  page.approval('0', '0')
  page.modal().onConfirm()
  assert.deepEqual(JSON.parse(page.calls[1].options.body), { reviewVersion: row('a').reviewVersion, finalAmount: 0, liters: '0' })
  await page.respond(1, 500, {})
  assert.equal(page.field('finalAmount').value, '0')
  assert.equal(page.field('liters').value, '0')
  assert.equal(page.field('liters').disabled, false)
  page.modal().onConfirm()
  assert.deepEqual(page.calls[2].options.body, page.calls[1].options.body)
  await page.respond(2, 200, { ...row('a'), status: 'approved', finalAmount: 0, liters: '0', mileageAmount: 0 })
  assert.equal(page.modal(), undefined)
  page.review(row('b'), '승인')
  assert.equal(page.field('finalAmount').value, '')
  assert.equal(page.field('liters').value, '')
})

test('approval filters nonnumeric input, groups thousands and sends exact values without commas', async () => {
  const page = mount()
  await page.respond(0, 200, [row('a')])
  page.review(row('a'), '승인')
  for (const [amount, liters, displayedAmount, displayedLiters] of [
    ['abc12,345원!', '주유 1,234.125L', '12,345', '1,234.125'],
    ['1.5', '1..234', '15', '1.234'],
    ['9007199254740991', '9,999.000', '9,007,199,254,740,991', '9,999.000'],
    ['', '0.', '', '0.'],
    ['삭제', '삭제', '', ''],
  ]) {
    page.approval(amount, liters)
    assert.equal(page.field('finalAmount').value, displayedAmount)
    assert.equal(page.field('liters').value, displayedLiters)
  }
  page.approval('12,345', '1,234.125')
  page.modal().onConfirm()
  assert.deepEqual(JSON.parse(page.calls[1].options.body), {
    reviewVersion: row('a').reviewVersion, finalAmount: 12345, liters: '1234.125',
  })
  await page.respond(1, 500, {})
  assert.equal(page.field('finalAmount').value, '12,345')
  assert.equal(page.field('liters').value, '1,234.125')
  page.modal().onConfirm()
  assert.equal(page.calls[2].options.body, page.calls[1].options.body)
  await page.respond(2, 200, { ...row('a'), status: 'approved', finalAmount: 12345, liters: '1234.125', mileageAmount: 24683 })
  assert.equal(page.modal(), undefined)
})

test('approval keeps the cursor beside the edited digits when separators change', async () => {
  const page = mount()
  await page.respond(0, 200, [row('a')])
  page.review(row('a'), '승인')
  for (const [name, raw, cursor, formatted, expectedCursor] of [
    ['finalAmount', '1923,456', 2, '1,923,456', 3],
    ['finalAmount', '1,9823,456', 4, '19,823,456', 4],
    ['finalAmount', '1234', 1, '1,234', 1],
    ['finalAmount', '12x,345', 3, '12,345', 2],
    ['liters', '1923.125', 2, '1,923.125', 3],
    ['liters', '1,234.1x25', 8, '1,234.125', 7],
    ['liters', '1,234..125', 7, '1,234.125', 6],
    ['liters', '0.', 2, '0.', 2],
  ]) {
    const input = page.input(name, raw, cursor)
    assert.equal(input.value, formatted)
    assert.equal(input.selectionStart, expectedCursor)
  }
})

test('cancelled confirmation cannot submit and current review authentication failure redirects', async () => {
  const page = mount()
  await page.respond(0, 200, [row('a')])
  page.review(row('a'), '반려')
  const modal = page.modal()
  modal.onCancel(); modal.onConfirm()
  assert.equal(page.calls.length, 1)
  page.review(row('a'), '반려')
  page.reason('사진 확인 필요')
  page.modal().onConfirm()
  await page.respond(1, 401, { code: 'INVALID_ADMIN_SESSION' })
  assert.equal(page.window.location.pathname, '/login')
})

test('rejection requires a reason, replaces it from chips, caps length and clears it for the next application', async () => {
  const page = mount()
  await page.respond(0, 200, [row('a'), row('b')])
  page.review(row('a'), '반려')
  assert.equal(page.reason().maxLength, 150)
  assert.equal(page.reason().required, true)
  for (const reason of ['', ' \n ', '가'.repeat(151)]) {
    page.reason(reason)
    await page.modal().onConfirm()
    assert.equal(page.calls.length, 1)
    assert.match(page.modal().description, /150자/)
  }
  const chip = label => find(page.render(), 'button', node => node.props.children === label).props
  chip('금액 불일치').onClick()
  assert.equal(page.reason().value, '영수증 금액과 계기판 금액이 일치하지 않습니다. 다시 확인 후, 등록해주세요.')
  chip('중복 신청').onClick()
  assert.equal(page.reason().value, '이미 등록된 거래와 중복된 신청입니다. 신청 내역을 확인해주세요.')
  const reason = '가'.repeat(148) + '\n나'
  page.reason(reason)
  const confirm = page.modal().onConfirm
  confirm(); confirm()
  assert.equal(page.calls.length, 2)
  assert.equal(page.reason().disabled, true)
  assert.equal(chip('중복 신청').disabled, true)
  assert.equal(JSON.parse(page.calls[1].options.body).rejectionReason, reason)
  await page.respond(1, 200, { ...row('a'), status: 'rejected', rejectionReason: reason })
  assert.equal(page.modal(), undefined)
  page.review(row('b'), '반려')
  assert.equal(page.reason().value, '')
  page.unmount()
})

test('rejection sends trimmed text and refuses a successful response with a different reason', async () => {
  const page = mount()
  for (const rejectionReason of ['', ' \n ', '가'.repeat(151)]) {
    await assert.rejects(page.api.reviewReceipt(row('a'), 'reject', { rejectionReason }))
  }
  assert.equal(page.calls.length, 1)
  const result = page.api.reviewReceipt(row('a'), 'reject', { rejectionReason: '  사진 확인\n재등록 요청  ' })
  const rejected = assert.rejects(result)
  assert.deepEqual(JSON.parse(page.calls[1].options.body), {
    reviewVersion: row('a').reviewVersion, rejectionReason: '사진 확인\n재등록 요청',
  })
  await page.respond(1, 200, { ...row('a'), status: 'rejected', rejectionReason: null })
  await rejected
  page.unmount()
})

test('failed receipt refresh preserves rows and affiliation filters until a successful retry', async () => {
 const page=mount();await page.respond(0,200,[row('a')]);const before=page.table().rows
 page.change('SearchFilter','new');assert.deepEqual(page.table().rows,before)
 await page.respond(1,500,{});await page.respond(2,200,[row('new')])
 assert.deepEqual(page.table().rows,before);assert.equal(page.table().emptyMessage,undefined)
 find(page.render(),'NoticeDialog').props.onRetry();page.render()
 await page.respond(3,200,[row('new')]);await page.respond(4,200,[row('new')])
 assert.deepEqual(page.table().rows,[row('new')]);assert.equal(find(page.render(),'NoticeDialog'),undefined)
})

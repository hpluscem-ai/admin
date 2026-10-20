import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import * as xlsx from 'xlsx'

const source = ts.transpileModule(readFileSync(new URL('../src/utils/tableExport.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText
const api = {}
new Function('require', 'exports', source)((name) => {
  assert.equal(name, 'xlsx')
  return xlsx
}, api)

test('XLSX preserves displayed values, Korean headers, column order and every row as text', () => {
  const values = [
    ['이름', '연락처', '계좌번호', '최종 금액', '상태'],
    ['기사 가', '010-1234-5678', '00123456789012345678', '12,345', '대기'],
    ['=1+1', '-', '0000', '0', '등록 1,000\n이체 대상 500'],
  ]
  const bytes = api.createTableWorkbook(values)
  const workbook = xlsx.read(bytes, { type: 'array' })
  assert.deepEqual(workbook.SheetNames, ['목록'])
  assert.deepEqual(xlsx.utils.sheet_to_json(workbook.Sheets['목록'], { header: 1 }), values)
  assert.equal(workbook.Sheets['목록'].A3.t, 's')
  assert.equal(workbook.Sheets['목록'].A3.f, undefined)
  assert.equal(workbook.Sheets['목록'].C2.t, 's')
})

test('an empty result exports only its column headers', () => {
  const workbook = xlsx.read(api.createTableWorkbook([['주유소 이름', 'Pole']]), { type: 'array' })
  assert.deepEqual(xlsx.utils.sheet_to_json(workbook.Sheets['목록'], { header: 1 }), [['주유소 이름', 'Pole']])
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import ts from 'typescript'

function load(path, imports = {}) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const exports = {}
  new Function('require', 'exports', code)((name) => {
    assert.ok(name in imports, `Unexpected import ${name}`)
    return imports[name]
  }, exports)
  return exports
}

const data = load('../src/data/databaseErdData.ts')
const { erdTables, erdRelations } = data
const database = new DatabaseSync(':memory:')
const sql = (file) => readFileSync(new URL(`../../hpluseco-server/src/database/${file}`, import.meta.url), 'utf8')
for (const file of ['schema.sql', '002-auth-sessions.sql', '003-admin-sessions.sql', '004-phone-verification-owner.sql']) {
  database.exec(sql(file))
}
// Match DatabaseService's v5 transaction and preservation of existing user indexes.
const indexes = database.prepare("SELECT sql FROM sqlite_schema WHERE tbl_name = 'users' AND type IN ('index', 'trigger') AND sql IS NOT NULL").all()
database.exec('PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE;')
database.exec(sql('005-driver-withdrawal.sql'))
for (const { sql } of indexes) database.exec(sql)
database.exec('COMMIT; PRAGMA foreign_keys = ON;')
assert.equal(database.prepare('PRAGMA user_version').get().user_version, 5)
// The existing ERD documents v5; only the approved station field removal changes this UI.
// Mileage v6's additional table/columns remain outside this desktop UI change.
database.exec(sql('007-station-address-only.sql'))
assert.equal(database.prepare('PRAGMA user_version').get().user_version, 7)
assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), [])

const tables = database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()
const columns = Object.fromEntries(tables.map(({ name }) => [name,
  database.prepare('SELECT * FROM pragma_table_info(?)').all(name)]))
const relations = tables.flatMap(({ name }) => {
  const groups = new Map()
  for (const row of database.prepare('SELECT * FROM pragma_foreign_key_list(?) ORDER BY id, seq').all(name)) {
    if (!groups.has(row.id)) groups.set(row.id, {
      sourceTableId: row.table, sourceFields: [], targetTableId: name, targetFields: [], onDelete: row.on_delete,
    })
    groups.get(row.id).sourceFields.push(row.to)
    groups.get(row.id).targetFields.push(row.from)
  }
  return [...groups.values()]
})
const partialIndexes = database.prepare("SELECT sql FROM sqlite_schema WHERE type = 'index' AND name IN ('users_registered_email_idx', 'users_registered_phone_idx')").all()
database.close()

test('ERD preserves its documented tables and applies the station address-only migration', () => {
  assert.deepEqual(erdTables.map(({ id }) => id).sort(), tables.map(({ name }) => name).sort())
  for (const table of erdTables) {
    assert.deepEqual(table.fields.map(({ name }) => name).sort(), columns[table.id].map(({ name }) => name).sort(), table.id)
  }
  for (const id of ['auth_sessions', 'admin_sessions']) {
    for (const column of columns[id]) {
      const field = erdTables.find((table) => table.id === id).fields.find((field) => field.name === column.name)
      assert.equal(field.type, column.type)
      assert.equal(field.keys?.includes('PK') ?? false, Boolean(column.pk))
    }
  }
})

test('ERD foreign keys and delete actions match the migrated database', () => {
  const serialize = (items) => items.map((item) => JSON.stringify(item)).sort()
  assert.deepEqual(serialize(erdRelations.map(({ id: _, ...relation }) => relation)), serialize(relations))
  for (const relation of relations) {
    const table = erdTables.find((table) => table.id === relation.targetTableId)
    for (const name of relation.targetFields) {
      const field = table.fields.find((field) => field.name === name)
      assert.ok(field.keys?.includes('FK'), `${table.id}.${name}`)
    }
  }
})

test('user contact uniqueness is described with the real partial-index condition', () => {
  const users = erdTables.find((table) => table.id === 'users')
  assert.equal(partialIndexes.length, 2)
  for (const { sql } of partialIndexes) {
    const name = sql.includes('users(email)') ? 'email' : 'phone'
    const field = users.fields.find((field) => field.name === name)
    assert.ok(!field.keys?.includes('UQ'), `${name} must not claim unconditional uniqueness`)
    assert.ok(field.description.includes(sql.split(/\bWHERE\b/i)[1].trim().replace(/;$/, '')), name)
  }
})

test('new session cards occupy the next existing grid row without moving other cards', () => {
  const jsx = (type, props) => ({ type, props })
  const { ErdPage } = load('../src/pages/ErdPage.tsx', {
    react: { useCallback: (fn) => fn, useEffect() {}, useMemo: (fn) => fn(), useState: () => [null, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@xyflow/react': { BackgroundVariant: { Dots: 'dots' }, MarkerType: { ArrowClosed: 'arrow' },
      ReactFlow: 'ReactFlow', ReactFlowProvider: 'ReactFlowProvider', useReactFlow: () => ({ fitView() {} }) },
    '@xyflow/react/dist/style.css': {},
    '../components/DataPageHeader': { DataPageHeader: 'DataPageHeader' },
    '../data/databaseErdData': data,
  })
  const nodes = (tree) => !tree || typeof tree !== 'object' ? [] :
    [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]
  const flow = nodes(ErdPage()).find((node) => node.type === 'ReactFlowProvider').props.children
  const positions = Object.fromEntries(flow.type(flow.props).props.nodes.map(({ id, position }) => [id, position]))
  assert.deepEqual(positions, {
    logistics_companies: { x: 0, y: 0 }, users: { x: 600, y: 0 }, password_reset_tokens: { x: 1200, y: 0 },
    settlements: { x: 0, y: 850 }, mileage_applications: { x: 600, y: 850 }, mileage_application_photos: { x: 1200, y: 850 },
    installation_sites: { x: 0, y: 1700 }, installation_site_devices: { x: 600, y: 1700 }, phone_verifications: { x: 1200, y: 1700 },
    auth_sessions: { x: 0, y: 2550 }, admin_sessions: { x: 600, y: 2550 },
  })
})

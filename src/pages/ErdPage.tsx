import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { DataPageHeader } from '../components/DataPageHeader'
import {
  erdCategoryLabels,
  erdRelations,
  erdTables,
  type ErdField,
  type ErdTable,
} from '../data/databaseErdData'

type ErdNodeData = {
  table: ErdTable
  isFocused: boolean
  isDimmed: boolean
}

type ErdTableNode = Node<ErdNodeData, 'erdTable'>

const tableLayout: Record<string, { column: number; row: number }> = {
  logistics_companies: { column: 0, row: 0 },
  users: { column: 1, row: 0 },
  password_reset_tokens: { column: 2, row: 0 },
  settlements: { column: 0, row: 1 },
  mileage_applications: { column: 1, row: 1 },
  mileage_application_photos: { column: 2, row: 1 },
  installation_sites: { column: 0, row: 2 },
  installation_site_devices: { column: 1, row: 2 },
  phone_verifications: { column: 2, row: 2 },
  auth_sessions: { column: 0, row: 3 },
  admin_sessions: { column: 1, row: 3 },
}

function getTablePosition(tableId: string) {
  const layout = tableLayout[tableId] ?? { column: 0, row: 0 }

  return { x: layout.column * 600, y: layout.row * 850 }
}

const tableById = new Map(erdTables.map((table) => [table.id, table]))

function FieldKey({ keyName }: { keyName: NonNullable<ErdField['keys']>[number] }) {
  return <span className="erd-node__field-key">{keyName}</span>
}

function DatabaseTableNode({ data }: NodeProps<ErdTableNode>) {
  const { table, isFocused, isDimmed } = data

  return (
    <article
      className="erd-node"
      data-category={table.category}
      data-dimmed={isDimmed || undefined}
      data-focused={isFocused || undefined}
    >
      <Handle id="top-target" type="target" position={Position.Top} />
      <Handle id="left-target" type="target" position={Position.Left} />
      <button
        aria-label={`${table.label} 테이블에 포커스`}
        aria-pressed={isFocused}
        className="erd-node__header nodrag nopan"
        type="button"
      >
        <span className="erd-node__category">{erdCategoryLabels[table.category]}</span>
        <strong>{table.label}</strong>
        <span className="erd-node__table-name">{table.id}</span>
      </button>

      <div className="erd-node__fields">
        {table.fields.map((field) => (
          <div className="erd-node__field" key={field.name} title={field.reference}>
            <span className="erd-node__field-name">
              {field.keys?.map((keyName) => <FieldKey key={keyName} keyName={keyName} />)}
              {field.name}
            </span>
            <span className="erd-node__field-type">{field.type}</span>
            <span className="erd-node__field-description">{field.description}</span>
          </div>
        ))}
      </div>

      {table.uniqueConstraints ? (
        <div className="erd-node__constraints">
          {table.uniqueConstraints.map((fields) => (
            <span key={fields.join('-')}>UQ ({fields.join(', ')})</span>
          ))}
        </div>
      ) : null}
      <Handle id="right-source" type="source" position={Position.Right} />
      <Handle id="bottom-source" type="source" position={Position.Bottom} />
    </article>
  )
}

const nodeTypes = { erdTable: DatabaseTableNode }

function ErdFlow({
  focusedTableId,
  onFocus,
}: {
  focusedTableId: string | null
  onFocus: (tableId: string) => void
}) {
  const { fitView } = useReactFlow<ErdTableNode, Edge>()
  const connectedTableIds = useMemo(() => {
    if (!focusedTableId) return new Set<string>()

    const connectedIds = new Set([focusedTableId])

    erdRelations.forEach(({ sourceTableId, targetTableId }) => {
      if (sourceTableId === focusedTableId) connectedIds.add(targetTableId)
      if (targetTableId === focusedTableId) connectedIds.add(sourceTableId)
    })

    return connectedIds
  }, [focusedTableId])

  const nodes = useMemo<ErdTableNode[]>(
    () =>
      erdTables.map((table) => ({
        id: table.id,
        type: 'erdTable',
        position: getTablePosition(table.id),
        data: {
          table,
          isFocused: table.id === focusedTableId,
          isDimmed: focusedTableId !== null && !connectedTableIds.has(table.id),
        },
        zIndex: table.id === focusedTableId ? 2 : 1,
      })),
    [connectedTableIds, focusedTableId],
  )

  const edges = useMemo<Edge[]>(
    () =>
      erdRelations.map((relation) => {
        const isConnected =
          focusedTableId === relation.sourceTableId || focusedTableId === relation.targetTableId
        const isDimmed = focusedTableId !== null && !isConnected
        const isHorizontal =
          tableLayout[relation.sourceTableId]?.row === tableLayout[relation.targetTableId]?.row
        const color = isConnected ? 'var(--color-brand)' : 'var(--color-gray-400)'
        const sourceLabel = tableById.get(relation.sourceTableId)?.label ?? relation.sourceTableId
        const targetLabel = tableById.get(relation.targetTableId)?.label ?? relation.targetTableId

        return {
          id: relation.id,
          ariaLabel: `${sourceLabel} ${relation.sourceFields.join(', ')}에서 ${targetLabel} ${relation.targetFields.join(', ')}로 연결`,
          source: relation.sourceTableId,
          target: relation.targetTableId,
          sourceHandle: isHorizontal ? 'right-source' : 'bottom-source',
          targetHandle: isHorizontal ? 'left-target' : 'top-target',
          type: 'smoothstep',
          label: relation.onDelete === 'CASCADE' ? '1 : N · CASCADE' : '1 : N',
          markerEnd: { type: MarkerType.ArrowClosed, color },
          style: { stroke: color, strokeWidth: isConnected ? 2 : 1.25, opacity: isDimmed ? 0.12 : 1 },
          labelStyle: { fill: 'var(--color-gray-600)', fontSize: 11 },
          labelBgStyle: { fill: 'var(--color-white)', fillOpacity: 0.92 },
          labelBgPadding: [5, 3] as [number, number],
          labelBgBorderRadius: 4,
        }
      }),
    [focusedTableId],
  )

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      void fitView({
        nodes: focusedTableId ? [{ id: focusedTableId }] : undefined,
        padding: focusedTableId ? 0.28 : 0.08,
        maxZoom: focusedTableId ? 1.08 : 0.72,
      })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [fitView, focusedTableId, nodes])

  return (
    <ReactFlow<ErdTableNode, Edge>
      edges={edges}
      edgesFocusable={false}
      elementsSelectable={false}
      fitView
      fitViewOptions={{ padding: 0.08, maxZoom: 0.72 }}
      maxZoom={1.5}
      minZoom={0.25}
      nodes={nodes}
      nodesConnectable={false}
      nodesDraggable={false}
      nodesFocusable={false}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onFocus(node.id)}
      panOnScroll
    >
      <Background color="var(--color-gray-200)" gap={20} size={1} variant={BackgroundVariant.Dots} />
      <Controls aria-label="ERD 확대 및 축소" position="bottom-right" showInteractive={false} />
    </ReactFlow>
  )
}

/** 사용자 앱과 관리자 화면이 공유하는 통합 데이터 구조를 탐색한다. */
export function ErdPage() {
  const [focusedTableId, setFocusedTableId] = useState<string | null>(null)
  const focusedTable = focusedTableId ? tableById.get(focusedTableId) : undefined
  const focusedRelations = focusedTableId
    ? erdRelations.filter(
        ({ sourceTableId, targetTableId }) =>
          sourceTableId === focusedTableId || targetTableId === focusedTableId,
      )
    : []
  const handleFocus = useCallback((tableId: string) => setFocusedTableId(tableId), [])

  return (
    <section aria-labelledby="erd-page-title" className="data-page erd-page">
      <DataPageHeader title="통합 DB 구조" titleId="erd-page-title">
        <div className="erd-toolbar">
          <p aria-live="polite" className="erd-toolbar__status">
            {focusedTable
              ? `${focusedTable.label} 테이블과 직접 연결된 관계를 표시 중입니다.`
              : `${erdTables.length}개 테이블 · ${erdRelations.length}개 관계`}
          </p>
          <button
            className="erd-toolbar__reset"
            disabled={!focusedTableId}
            onClick={() => setFocusedTableId(null)}
            type="button"
          >
            전체 보기
          </button>
        </div>
      </DataPageHeader>

      <p className="erd-page__guide">
        모든 필드는 항상 표시됩니다. 테이블 카드를 선택하면 직접 연결된 관계에 포커스합니다.
      </p>

      {focusedTable ? (
        <ul aria-label={`${focusedTable.label} 테이블 관계`} className="erd-page__relations">
          {focusedRelations.map((relation) => {
            const sourceTable = tableById.get(relation.sourceTableId)
            const targetTable = tableById.get(relation.targetTableId)

            return (
              <li key={relation.id}>
                <span>
                  <strong>{sourceTable?.label ?? relation.sourceTableId}</strong>
                  <code>.{relation.sourceFields.join(' + ')}</code>
                </span>
                <span aria-hidden="true">→</span>
                <span>
                  <strong>{targetTable?.label ?? relation.targetTableId}</strong>
                  <code>.{relation.targetFields.join(' + ')}</code>
                </span>
                <small>1 : N · ON DELETE {relation.onDelete}</small>
              </li>
            )
          })}
        </ul>
      ) : null}

      <div className="erd-canvas" role="region" aria-label="통합 데이터베이스 관계도">
        <ReactFlowProvider>
          <ErdFlow focusedTableId={focusedTableId} onFocus={handleFocus} />
        </ReactFlowProvider>
      </div>
    </section>
  )
}

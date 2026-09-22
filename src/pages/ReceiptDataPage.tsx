import { useEffect, useRef, useState } from 'react'
import chevronDownIcon from '../assets/chevron-down.svg'
import { DataPageHeader } from '../components/DataPageHeader'
import { DataTable, type DataTableColumn } from '../components/DataTable'
import { AffiliationFilter, SearchFilter } from '../components/PageFilters'
import { isInvalidAdminSession } from '../adminAuth'
import { getReceiptPhoto, getReceipts, RECEIPTS_LOAD_ERROR, type Receipt } from '../receipts'

const statusNames = { approved: '승인', pending: '대기', rejected: '반려' } as const
const amount = (value: number | null) => value === null ? '-' : value.toLocaleString('ko-KR')

function ApprovalStatusDisplay({ name, status }: Pick<Receipt, 'name' | 'status'>) {
  const label = statusNames[status]
  return (
    <span className="approval-status" data-status={label} aria-label={`${name} 승인 여부: ${label}`}>
      <span>{label}</span>
      <span className="approval-status__icon" aria-hidden="true">
        <img src={chevronDownIcon} alt="" />
      </span>
    </span>
  )
}

function receiptDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}`
}

type PhotoTarget = { path: string | null; label: string }

function getColumns(onPhoto: (target: PhotoTarget) => void): readonly DataTableColumn<Receipt>[] {
  const photoButton = (row: Receipt, kind: 'receipt' | 'meter') => <button className="text-button" type="button"
    aria-label={`${row.name} ${kind === 'receipt' ? '영수증' : '계기판'} 사진 보기`}
    onClick={() => onPhoto({ path: row.photos[kind], label: `${row.name} ${kind === 'receipt' ? '영수증' : '계기판'} 사진` })}>보기</button>
  return [
    { key: 'affiliation', label: '소속', render: (row) => row.logisticsCompanyName },
    { key: 'name', label: '이름', render: (row) => row.name },
    { key: 'phone', label: '연락처', render: (row) => row.phone ?? '-' },
    { key: 'receiptPhoto', label: '영수증 사진', render: (row) => photoButton(row, 'receipt') },
    { key: 'receiptAmount', label: '영수증 금액', render: (row) => amount(row.receiptAmount) },
    { key: 'meterPhoto', label: '계기판 사진', render: (row) => photoButton(row, 'meter') },
    { key: 'meterAmount', label: '계기판 금액', render: (row) => amount(row.meterAmount) },
    { key: 'match', label: '일치여부', render: (row) => <span className="match-result" data-match={row.matchStatus === 'matched' ? true : row.matchStatus === 'mismatched' ? false : undefined}>{row.matchStatus === 'matched' ? '일치' : row.matchStatus === 'mismatched' ? '불일치' : '-'}</span> },
    { key: 'finalAmount', label: '최종 금액', render: (row) => amount(row.finalAmount) },
    { key: 'mileage', label: '적립 마일리지', render: (row) => amount(row.mileageAmount) },
    { key: 'receiptDate', label: '영수일시', render: (row) => receiptDate(row.receiptAt) },
    { key: 'status', label: '승인여부', render: (row) => <ApprovalStatusDisplay name={row.name} status={row.status} /> },
  ]
}

export function ReceiptDataPage() {
  const [query, setQuery] = useState('')
  const [affiliation, setAffiliation] = useState('')
  const [rows, setRows] = useState<Receipt[] | null>(null)
  const [affiliations, setAffiliations] = useState<{ value: string; label: string }[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [photo, setPhoto] = useState<PhotoTarget | null>(null)

  useEffect(() => {
    let active = true
    setRows(null)
    setLoadError('')
    const all = getReceipts()
    const filtered = query.trim() || affiliation
      ? getReceipts({ nameQuery: query, logisticsCompanyId: affiliation }) : all
    void Promise.all([all, filtered]).then(([allRows, matchingRows]) => {
      if (!active) return
      setAffiliations([...new Map(allRows.map((row) => [row.logisticsCompanyId,
        { value: row.logisticsCompanyId, label: row.logisticsCompanyName }])).values()])
      setRows(matchingRows)
    }).catch((error: unknown) => {
      if (!active) return
      if (isInvalidAdminSession(error)) window.location.hash = '/login'
      else setLoadError(RECEIPTS_LOAD_ERROR)
    })
    return () => { active = false }
  }, [query, affiliation])

  return (
    <section className="data-page receipt-data-page" aria-labelledby="receipt-data-title">
      <DataPageHeader title="영수 데이터 목록" titleId="receipt-data-title">
        <SearchFilter onChange={setQuery} value={query} />
        <AffiliationFilter onChange={setAffiliation} value={affiliation} options={affiliations ?? []} />
      </DataPageHeader>
      <DataTable columns={getColumns(setPhoto)} rows={rows ?? []} getRowKey={(row) => row.id}
        emptyMessage={loadError || (rows === null || affiliations === null
          ? '영수 데이터를 불러오는 중입니다.' : '조회 조건에 맞는 영수 데이터가 없습니다.')} />
      {photo && <ReceiptPhotoDialog target={photo} onClose={() => setPhoto(null)} />}
    </section>
  )
}

function ReceiptPhotoDialog({ target, onClose }: { target: PhotoTarget; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const element = dialog.current
    const opener = document.activeElement
    element?.showModal()
    return () => {
      element?.close()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])
  useEffect(() => {
    let active = true
    let objectUrl: string | undefined
    setUrl(null)
    setError('')
    void getReceiptPhoto(target.path).then((blob) => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }).catch((failure: unknown) => {
      if (!active) return
      if (isInvalidAdminSession(failure)) window.location.hash = '/login'
      else setError('사진을 불러오지 못했습니다. 다시 시도해주세요.')
    })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [target.path, retry])
  return <dialog ref={dialog} aria-label={target.label} className="confirmation-dialog receipt-photo-dialog" onCancel={onClose}>
    {error || !url
      ? <div className="confirmation-dialog__message"><p role={error ? 'alert' : 'status'}>{error || '사진을 불러오는 중입니다.'}</p></div>
      : <img src={url} alt={target.label} onError={() => setError('사진을 표시하지 못했습니다. 다시 시도해주세요.')} />}
    <div className="confirmation-dialog__actions">
      {error && <button className="confirmation-dialog__action confirmation-dialog__action--confirm" type="button" onClick={() => setRetry((value) => value + 1)}>다시 시도</button>}
      <button className="confirmation-dialog__action confirmation-dialog__action--cancel" type="button" onClick={onClose}>닫기</button>
    </div>
  </dialog>
}

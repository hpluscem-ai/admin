import { navigate } from '../navigation'
import { useEffect, useRef, useState } from 'react'
import chevronDownIcon from '../assets/chevron-down.svg'
import { ConfirmationDialog } from '../components/ConfirmationDialog'
import { DataPageHeader } from '../components/DataPageHeader'
import { DataTable, type DataTableColumn } from '../components/DataTable'
import { AffiliationFilter, SearchFilter } from '../components/PageFilters'
import { AdminApiError, isInvalidAdminSession } from '../adminAuth'
import { getReceiptPhoto, getReceipts, reviewReceipt, RECEIPTS_LOAD_ERROR, type Receipt } from '../receipts'

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
type ReviewTarget = { receipt: Receipt; action: 'approve' | 'reject' }

function getColumns(onPhoto: (target: PhotoTarget) => void, onReview: (target: ReviewTarget) => void): readonly DataTableColumn<Receipt>[] {
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
    { key: 'status', label: '승인여부', render: (row) => row.status === 'pending' && row.settlementId === null
      ? <span className="approval-status"><span>대기</span><span className="table-actions">
        <button className="text-button" type="button" aria-label={`${row.name} 승인`} onClick={() => onReview({ receipt: row, action: 'approve' })}>승인</button>
        <button className="text-button" type="button" aria-label={`${row.name} 반려`} onClick={() => onReview({ receipt: row, action: 'reject' })}>반려</button>
      </span></span>
      : <ApprovalStatusDisplay name={row.name} status={row.status} /> },
  ]
}

export function ReceiptDataPage() {
  const [query, setQuery] = useState('')
  const [affiliation, setAffiliation] = useState('')
  const [rows, setRows] = useState<Receipt[] | null>(null)
  const [affiliations, setAffiliations] = useState<{ value: string; label: string }[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [photo, setPhoto] = useState<PhotoTarget | null>(null)
  const [review, setReview] = useState<ReviewTarget | null>(null)
  const [reviewError, setReviewError] = useState('')
  const [reviewConflict, setReviewConflict] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const lifetime = useRef<object | null>(null)
  const modalOwner = useRef<ReviewTarget | null>(null)
  const conflictedReview = useRef<ReviewTarget | null>(null)
  const submitting = useRef(false)
  const queryGeneration = useRef(0)

  useEffect(() => {
    lifetime.current = {}
    return () => { lifetime.current = null }
  }, [])
  useEffect(() => {
    let active = true
    const generation = ++queryGeneration.current
    setRows(null)
    setLoadError('')
    const all = getReceipts()
    const filtered = query.trim() || affiliation
      ? getReceipts({ nameQuery: query, logisticsCompanyId: affiliation }) : all
    void Promise.all([all, filtered]).then(([allRows, matchingRows]) => {
      if (!active || generation !== queryGeneration.current) return
      setAffiliations([...new Map(allRows.map((row) => [row.logisticsCompanyId,
        { value: row.logisticsCompanyId, label: row.logisticsCompanyName }])).values()])
      setRows(matchingRows)
    }).catch((error: unknown) => {
      if (!active || generation !== queryGeneration.current) return
      if (isInvalidAdminSession(error)) navigate('/login')
      else setLoadError(RECEIPTS_LOAD_ERROR)
    })
    return () => { active = false }
  }, [query, affiliation, refresh])

  function closeReview() {
    modalOwner.current = null
    setReview(null)
  }

  async function handleReview() {
    if (!review || modalOwner.current !== review || submitting.current || !lifetime.current) return
    if (conflictedReview.current === review) { closeReview(); return }
    const owner = lifetime.current
    const routePath = window.location.pathname
    const generation = queryGeneration.current
    const isCurrent = () => lifetime.current === owner && window.location.pathname === routePath
    const reload = () => { ++queryGeneration.current; setRefresh((value) => value + 1) }
    submitting.current = true
    setReviewError('')
    try {
      const updated = await reviewReceipt(review.receipt, review.action)
      if (!isCurrent()) return
      if (generation === queryGeneration.current) setRows((current) => current?.map((row) => row.id === updated.id ? updated : row) ?? null)
      reload()
      if (modalOwner.current === review) closeReview()
    } catch (error) {
      if (!isCurrent()) return
      if (isInvalidAdminSession(error)) { navigate('/login'); return }
      const conflict = error instanceof AdminApiError && (error.status === 409 || error.status === 404)
      if (modalOwner.current === review) {
        if (conflict) conflictedReview.current = review
        setReviewConflict(conflict)
        setReviewError(conflict ? '신청 또는 심사 상태가 변경되었습니다. 갱신된 목록을 확인해주세요.'
          : '심사 결과를 확인하지 못했습니다. 다시 시도해주세요.')
      }
      if (conflict || modalOwner.current !== review) reload()
    } finally {
      submitting.current = false
    }
  }

  return (
    <section className="data-page receipt-data-page" aria-labelledby="receipt-data-title">
      <DataPageHeader title="영수 데이터 목록" titleId="receipt-data-title">
        <SearchFilter onChange={setQuery} value={query} />
        <AffiliationFilter onChange={setAffiliation} value={affiliation} options={affiliations ?? []} />
      </DataPageHeader>
      <DataTable columns={getColumns(setPhoto, (target) => {
        if (submitting.current) return
        modalOwner.current = target; setReviewError(''); setReviewConflict(false); setReview(target)
      })} rows={rows ?? []} getRowKey={(row) => row.id}
        emptyMessage={loadError || (rows === null || affiliations === null
          ? '영수 데이터를 불러오는 중입니다.' : '조회 조건에 맞는 영수 데이터가 없습니다.')} />
      {photo && <ReceiptPhotoDialog target={photo} onClose={() => setPhoto(null)} />}
      {review && <ConfirmationDialog
        title={`${review.action === 'approve' ? '승인' : '반려'}하시겠습니까?`}
        description={reviewError || `선택한 신청을 ${review.action === 'approve' ? '승인' : '반려'}합니다.`}
        actionLabel={reviewConflict ? '확인' : review.action === 'approve' ? '승인' : '반려'}
        onCancel={closeReview} onConfirm={handleReview} />}
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
      if (isInvalidAdminSession(failure)) navigate('/login')
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

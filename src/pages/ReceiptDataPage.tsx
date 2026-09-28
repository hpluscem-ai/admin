import { navigate } from '../navigation'
import { useEffect, useRef, useState } from 'react'
import chevronDownIcon from '../assets/chevron-down.svg'
import { ConfirmationDialog, NoticeDialog } from '../components/ConfirmationDialog'
import { DataPageHeader } from '../components/DataPageHeader'
import { DataTable, type DataTableColumn } from '../components/DataTable'
import { TextField } from '../components/FormControls'
import { AffiliationFilter, SearchFilter } from '../components/PageFilters'
import { StatusSelect } from '../components/StatusSelect'
import { AdminApiError, isInvalidAdminSession } from '../adminAuth'
import { getReceiptPhoto, getReceipts, reviewReceipt, RECEIPTS_LOAD_ERROR, type Receipt } from '../receipts'

const statusNames = { approved: '승인', pending: '대기', rejected: '반려' } as const
const amount = (value: number | null) => value === null ? '-' : value.toLocaleString('ko-KR')
const APPROVAL_AMOUNT_ERROR = '확정 금액은 0 이상의 정수로 입력해주세요.'
const APPROVAL_LITERS_ERROR = '주유량은 정수 5자리, 소수점 3자리 이내의 숫자로 입력해주세요.'
const REJECTION_REASON_ERROR = '반려 사유를 150자 이내로 입력해주세요.'
const rejectionPresets = [
  { label: '금액 불일치', reason: '영수증 금액과 계기판 금액이 일치하지 않습니다. 다시 확인 후, 등록해주세요.' },
  { label: '사진 판독 불가', reason: '사진이 흐리거나 반사되어 내용을 확인하기 어렵습니다. 선명하게 촬영해 다시 등록해주세요.' },
  { label: '중복 신청', reason: '이미 등록된 거래와 중복된 신청입니다. 신청 내역을 확인해주세요.' },
  { label: '필수 사진 누락', reason: '영수증 또는 계기판 내용이 보이지 않습니다. 두 내용이 모두 보이도록 다시 등록해주세요.' },
]

function formatApprovalInput(value: string, decimal = false) {
  const [integer, ...fraction] = value.replace(decimal ? /[^\d.]/g : /\D/g, '').split('.')
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    + (decimal && fraction.length ? `.${fraction.join('')}` : '')
}

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

function getColumns(onPhoto: (target: PhotoTarget) => void, onReview: (target: ReviewTarget) => void, reviewDisabled: boolean): readonly DataTableColumn<Receipt>[] {
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
    { key: 'status', label: '승인여부', render: (row) => row.settlementId === null
      ? <StatusSelect label={row.name} status={statusNames[row.status]} disabled={reviewDisabled}
        onChange={(status) => onReview({ receipt: row, action: status === '승인' ? 'approve' : 'reject' })} />
      : <ApprovalStatusDisplay name={row.name} status={row.status} /> },
  ]
}

export function ReceiptDataPage() {
  const [query, setQuery] = useState('')
  const [affiliation, setAffiliation] = useState('')
  const [rows, setRows] = useState<Receipt[] | null>(null)
  const [affiliations, setAffiliations] = useState<{ value: string; label: string }[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'failed'>('loading')
  const [photo, setPhoto] = useState<PhotoTarget | null>(null)
  const [review, setReview] = useState<ReviewTarget | null>(null)
  const [reviewError, setReviewError] = useState('')
  const [reviewConflict, setReviewConflict] = useState(false)
  const [approvalValues, setApprovalValues] = useState({ finalAmount: '', liters: '' })
  const [rejectionReason, setRejectionReason] = useState('')
  const rejectionInput = useRef<HTMLTextAreaElement>(null)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const lifetime = useRef<object | null>(null)
  const modalOwner = useRef<ReviewTarget | null>(null)
  const conflictedReview = useRef<ReviewTarget | null>(null)
  const submitting = useRef(false)
  const queryGeneration = useRef(0)

  useEffect(() => {
    const input = rejectionInput.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${input.scrollHeight}px`
  }, [rejectionReason, review])

  useEffect(() => {
    lifetime.current = {}
    return () => { lifetime.current = null }
  }, [])
  useEffect(() => {
    let active = true
    const generation = ++queryGeneration.current
    setLoadState('loading')
    setLoadError('')
    const all = getReceipts()
    const filtered = query.trim() || affiliation
      ? getReceipts({ nameQuery: query, logisticsCompanyId: affiliation }) : all
    void Promise.all([all, filtered]).then(([allRows, matchingRows]) => {
      if (!active || generation !== queryGeneration.current) return
      setAffiliations([...new Map(allRows.map((row) => [row.logisticsCompanyId,
        { value: row.logisticsCompanyId, label: row.logisticsCompanyName }])).values()])
      setRows(matchingRows)
      setLoadState('loaded')
    }).catch((error: unknown) => {
      if (!active || generation !== queryGeneration.current) return
      if (isInvalidAdminSession(error)) navigate('/login')
      else { setLoadError(RECEIPTS_LOAD_ERROR); setLoadState('failed') }
    })
    return () => { active = false }
  }, [query, affiliation, refresh])

  function closeReview() {
    modalOwner.current = null
    setReview(null)
  }

  function handleApprovalInput(input: HTMLInputElement, name: keyof typeof approvalValues) {
    const decimal = name === 'liters'
    const value = formatApprovalInput(input.value, decimal)
    let remaining = formatApprovalInput(input.value.slice(0, input.selectionStart ?? input.value.length), decimal).replaceAll(',', '').length
    let cursor = 0
    while (cursor < value.length && remaining > 0) {
      if (value[cursor] !== ',') --remaining
      ++cursor
    }
    input.value = value
    input.setSelectionRange(cursor, cursor)
    setReviewError('')
    setApprovalValues((values) => ({ ...values, [name]: value }))
  }

  async function handleReview() {
    if (!review || modalOwner.current !== review || submitting.current || !lifetime.current) return
    if (conflictedReview.current === review) { closeReview(); return }
    const amountInput = approvalValues.finalAmount.replaceAll(',', '')
    const liters = approvalValues.liters.replaceAll(',', '')
    const finalAmount = Number(amountInput)
    if (review.action === 'approve') {
      if (!/^\d+$/.test(amountInput) || !Number.isSafeInteger(finalAmount)) {
        setReviewError(APPROVAL_AMOUNT_ERROR); return
      }
      if (!/^\d{1,5}(?:\.\d{1,3})?$/.test(liters)) {
        setReviewError(APPROVAL_LITERS_ERROR); return
      }
    } else if (!rejectionReason.trim() || rejectionReason.trim().length > 150) {
      setReviewError(REJECTION_REASON_ERROR); return
    }
    const owner = lifetime.current
    const routePath = window.location.pathname
    const generation = queryGeneration.current
    const isCurrent = () => lifetime.current === owner && window.location.pathname === routePath
    const reload = () => { ++queryGeneration.current; setRefresh((value) => value + 1) }
    submitting.current = true
    setReviewSubmitting(true)
    setReviewError('')
    try {
      const updated = await reviewReceipt(review.receipt, review.action,
        review.action === 'approve' ? { finalAmount, liters } : { rejectionReason })
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
      if (isCurrent()) setReviewSubmitting(false)
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
        setApprovalValues({ finalAmount: '', liters: '' })
        setRejectionReason('')
        modalOwner.current = target; setReviewError(''); setReviewConflict(false); setReview(target)
      }, review !== null || reviewSubmitting)} rows={rows ?? []} getRowKey={(row) => row.id}
        emptyMessage={loadState === 'failed' ? undefined : loadState === 'loading' ? '영수 데이터를 불러오는 중입니다.' : '조회 조건에 맞는 영수 데이터가 없습니다.'} />
      {!review && !photo && loadError && <NoticeDialog message={loadError}
        onClose={() => setLoadError('')} onRetry={() => setRefresh(current => current + 1)} />}
      {photo && <ReceiptPhotoDialog target={photo} onClose={() => setPhoto(null)} />}
      {review && <ConfirmationDialog
        title={`${review.action === 'approve' ? '승인' : '반려'}하시겠습니까?`}
        description={reviewError || `선택한 신청을 ${review.action === 'approve' ? '승인' : '반려'}합니다.`}
        actionLabel={reviewConflict ? '확인' : review.action === 'approve' ? '승인' : '반려'}
        disabled={reviewSubmitting}
        onCancel={closeReview} onConfirm={handleReview}>
        {review.action === 'approve' && <div className="form-fields">
          <div className="form-control">
            <label className="form-field-label" htmlFor="receipt-approval-final-amount">확정 금액(원)</label>
            <TextField id="receipt-approval-final-amount" name="finalAmount" inputMode="numeric" required
              placeholder="확정 금액을 입력해주세요"
              disabled={reviewSubmitting || reviewConflict} value={approvalValues.finalAmount}
              aria-invalid={reviewError === APPROVAL_AMOUNT_ERROR}
              onChange={(event) => handleApprovalInput(event.currentTarget, 'finalAmount')} />
          </div>
          <div className="form-control">
            <label className="form-field-label" htmlFor="receipt-approval-liters">주유량(L)</label>
            <TextField id="receipt-approval-liters" name="liters" inputMode="decimal" required
              placeholder="주유량을 입력해주세요"
              disabled={reviewSubmitting || reviewConflict} value={approvalValues.liters}
              aria-invalid={reviewError === APPROVAL_LITERS_ERROR}
              onChange={(event) => handleApprovalInput(event.currentTarget, 'liters')} />
          </div>
        </div>}
        {review.action === 'reject' && <div className="form-fields receipt-rejection-fields">
          <div className="receipt-rejection-chips">
            {rejectionPresets.map(preset => <button key={preset.label} type="button"
              className="receipt-rejection-chip" disabled={reviewSubmitting || reviewConflict}
              onClick={() => { setRejectionReason(preset.reason); setReviewError('') }}>
              {preset.label}
            </button>)}
          </div>
          <div className="form-control">
            <label className="form-field-label" htmlFor="receipt-rejection-reason">반려 사유 · 최대 150자</label>
            <textarea ref={rejectionInput} id="receipt-rejection-reason" name="rejectionReason"
              className="form-field receipt-rejection-reason" rows={3} maxLength={150} required
              disabled={reviewSubmitting || reviewConflict} value={rejectionReason}
              aria-invalid={reviewError === REJECTION_REASON_ERROR}
              onChange={event => { setRejectionReason(event.currentTarget.value); setReviewError('') }} />
          </div>
        </div>}
      </ConfirmationDialog>}
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

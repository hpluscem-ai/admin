import chevronDownIcon from '../assets/chevron-down.svg'

export type ApprovalStatus = '승인' | '대기' | '반려'

type StatusSelectProps = {
  disabled?: boolean
  label: string
  onChange: (status: '승인' | '반려') => void
  status: ApprovalStatus
}

export function StatusSelect({ disabled = false, label, onChange, status }: StatusSelectProps) {
  return (
    <span className="approval-status approval-status--select" data-status={status}>
      <span aria-hidden="true">{status}</span>
      <select
        disabled={disabled}
        value={status}
        onChange={(event) => {
          const nextStatus = event.target.value
          if (nextStatus === '승인' || nextStatus === '반려') onChange(nextStatus)
        }}
        aria-label={`${label} 승인 여부`}
      >
        <option value="대기" disabled hidden>대기</option>
        <option value="승인">승인</option>
        <option value="반려">반려</option>
      </select>
      <span className="approval-status__icon" aria-hidden="true">
        <img src={chevronDownIcon} alt="" />
      </span>
    </span>
  )
}

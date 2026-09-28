import chevronDownIcon from '../assets/chevron-down.svg'

export type ApprovalStatus = '승인' | '대기' | '반려'

type StatusSelectProps = {
  disabled?: boolean
  label: string
  onChange: (status: ApprovalStatus) => void
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
          if (nextStatus !== status && (nextStatus === '승인' || nextStatus === '대기' || nextStatus === '반려')) onChange(nextStatus)
        }}
        aria-label={`${label} 승인 여부`}
      >
        {(['승인', '대기', '반려'] as const).map(option =>
          <option key={option} value={option} disabled={option === status} hidden={option === status}>{option}</option>)}
      </select>
      <span className="approval-status__icon" aria-hidden="true">
        <img src={chevronDownIcon} alt="" />
      </span>
    </span>
  )
}

import { useState } from 'react'
import chevronDownIcon from '../assets/chevron-down.svg'

export type ApprovalStatus = '승인' | '대기' | '반려'

type StatusSelectProps = {
  label: string
  status: ApprovalStatus
}

export function StatusSelect({ label, status }: StatusSelectProps) {
  const [selectedStatus, setSelectedStatus] = useState(status)

  return (
    <span className="approval-status" data-status={selectedStatus}>
      <select
        value={selectedStatus}
        onChange={(event) => setSelectedStatus(event.target.value as ApprovalStatus)}
        aria-label={`${label} 승인 여부`}
      >
        <option value="승인">승인</option>
        <option value="대기">대기</option>
        <option value="반려">반려</option>
      </select>
      <span className="approval-status__icon" aria-hidden="true">
        <img src={chevronDownIcon} alt="" />
      </span>
    </span>
  )
}

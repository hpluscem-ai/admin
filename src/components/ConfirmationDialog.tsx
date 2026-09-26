import { useId, type ReactNode } from 'react'

type ConfirmationDialogProps = {
  actionLabel: string
  children?: ReactNode
  description: string
  disabled?: boolean
  onCancel: () => void
  onConfirm: () => void
  title: string
}

/** 관리자 화면에서 공통으로 사용하는 확인 팝업이다. */
export function ConfirmationDialog({
  actionLabel,
  children,
  description,
  disabled = false,
  onCancel,
  onConfirm,
  title,
}: ConfirmationDialogProps) {
  const titleId = useId()
  const descriptionId = useId()

  return (
    <div className="confirmation-dialog-overlay">
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="confirmation-dialog"
        role="dialog"
      >
        <div className="confirmation-dialog__message">
          <p id={titleId}>{title}</p>
          <p id={descriptionId}>{description}</p>
        </div>
        {children}
        <div className="confirmation-dialog__actions">
          <button
            className="confirmation-dialog__action confirmation-dialog__action--confirm"
            disabled={disabled}
            onClick={onConfirm}
            type="button"
          >
            {actionLabel}
          </button>
          <button
            className="confirmation-dialog__action confirmation-dialog__action--cancel"
            disabled={disabled}
            onClick={onCancel}
            type="button"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

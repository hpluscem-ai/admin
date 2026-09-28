import { useEffect, useId, useRef, type ReactNode } from 'react'

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

export function NoticeDialog({ message, onClose, onRetry }: {
  message: string
  onClose: () => void
  onRetry?: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const messageId = useId()
  useEffect(() => {
    const element = dialog.current
    const opener = document.activeElement
    element?.showModal()
    return () => {
      element?.close()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])
  return <dialog ref={dialog} aria-label="안내" aria-describedby={messageId}
    className="confirmation-dialog notice-dialog" onCancel={onClose}>
    <div className="confirmation-dialog__message"><p id={messageId}>{message}</p></div>
    <div className="confirmation-dialog__actions">
      <button className="confirmation-dialog__action confirmation-dialog__action--confirm"
        type="button" onClick={onRetry ?? onClose}>{onRetry ? '다시 시도' : '확인'}</button>
      {onRetry && <button className="confirmation-dialog__action confirmation-dialog__action--cancel"
        type="button" onClick={onClose}>닫기</button>}
    </div>
  </dialog>
}

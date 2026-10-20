import { useEffect, useRef, type ReactNode } from 'react'

type DataPageHeaderProps = {
  children?: ReactNode
  title: string
  titleId: string
  onExport?: () => Promise<readonly (readonly string[])[]>
  onExportError?: (error: unknown) => void
}

/** 관리자 페이지가 공유하는 제목과 필터 영역을 표시한다. */
export function DataPageHeader({ children, title, titleId, onExport, onExportError }: DataPageHeaderProps) {
  const lifetime = useRef<object | null>(null)
  const exporting = useRef(false)
  useEffect(() => {
    lifetime.current = {}
    return () => { lifetime.current = null }
  }, [])

  async function handleExport() {
    if (!onExport || exporting.current || !lifetime.current) return
    const owner = lifetime.current
    const path = window.location.pathname
    const isCurrent = () => lifetime.current === owner && window.location.pathname === path
    exporting.current = true
    try {
      const values = await onExport()
      if (!isCurrent()) return
      const { downloadTableWorkbook } = await import('../utils/tableExport')
      if (isCurrent()) downloadTableWorkbook(title, values)
    } catch (error) {
      if (isCurrent()) onExportError?.(error)
    } finally {
      exporting.current = false
    }
  }

  return (
    <header className="data-view__header">
      <h1 className="data-view__title" id={titleId}>
        {title}
      </h1>
      {children || onExport ? <div className="data-view__filters">
        {children}
        {onExport && <button className="floating-action data-view__export" onClick={handleExport} type="button">엑셀 저장</button>}
      </div> : null}
    </header>
  )
}

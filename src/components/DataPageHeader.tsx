import type { ReactNode } from 'react'

type DataPageHeaderProps = {
  children?: ReactNode
  title: string
  titleId: string
}

/** 관리자 페이지가 공유하는 제목과 필터 영역을 표시한다. */
export function DataPageHeader({ children, title, titleId }: DataPageHeaderProps) {
  return (
    <header className="data-view__header">
      <h1 className="data-view__title" id={titleId}>
        {title}
      </h1>
      {children ? <div className="data-view__filters">{children}</div> : null}
    </header>
  )
}

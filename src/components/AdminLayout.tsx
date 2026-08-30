import type { ReactNode } from 'react'
import { Footer } from './Footer'
import { Sidebar, type AdminMenuItem } from './Sidebar'

type AdminLayoutProps = {
  activeMenu: AdminMenuItem
  children: ReactNode
}

/** 모든 관리자 페이지가 공유하는 사이드바와 푸터를 배치한다. */
export function AdminLayout({ activeMenu, children }: AdminLayoutProps) {
  return (
    <div className="admin-page">
      <div className="admin-layout">
        <Sidebar activeMenu={activeMenu} />
        <main className="admin-content">{children}</main>
      </div>
      <Footer />
    </div>
  )
}

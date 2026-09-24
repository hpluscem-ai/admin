import logo from '../assets/hayan100-logo.png'

const menuItems = [
  { href: '/dashboard', label: '대시보드' },
  { href: '/drivers', label: '소속 기사 데이터 목록' },
  { href: '/infrastructure', label: '인프라 데이터 목록' },
  { href: '/receipts', label: '영수 데이터 목록' },
  { href: '/settlements', label: '물류사 정산 관리' },
  { href: '/erd', label: '통합 DB 구조' },
] as const

export type AdminMenuItem = (typeof menuItems)[number]['label']

type SidebarProps = {
  activeMenu: AdminMenuItem
}

/** 관리자 메뉴의 고정 사이드바를 표시한다. */
export function Sidebar({ activeMenu }: SidebarProps) {
  return (
    <aside className="sidebar">
      <a href="/dashboard" aria-label="통합 대시보드로 이동">
        <img className="brand-logo" src={logo} alt="HAYAN100" />
      </a>
      <nav aria-label="관리자 메뉴">
        <ul className="sidebar__menu">
          {menuItems.map(({ href, label }) => (
            <li key={label}>
              <a
                className="sidebar__item"
                href={href}
                aria-current={label === activeMenu ? 'page' : undefined}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}

import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Calendar, Briefcase } from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  const navItems = [
    { path: '/', label: '활동 타임라인', icon: Calendar },
    { path: '/deals', label: '딜 요약', icon: Briefcase },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">SL</span>
            </div>
            <span className="font-bold text-gray-900 text-lg">시큐레터 HubSpot 대시보드</span>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1 ml-6">
            {navItems.map(item => {
              const isActive = location.pathname === item.path
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="text-sm text-gray-500">
          HubSpot 계정: 243367573
        </div>
      </header>

      {/* Page content */}
      <main className="p-6">{children}</main>
    </div>
  )
}

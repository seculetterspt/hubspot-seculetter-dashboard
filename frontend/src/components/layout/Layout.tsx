import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Calendar, Briefcase, PenSquare } from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  const navItems = [
    { path: '/', label: '타임라인', mobileLabel: '타임라인', icon: Calendar },
    { path: '/meeting/new', label: '미팅 기록', mobileLabel: '기록', icon: PenSquare, isAction: true },
    { path: '/deals', label: '딜 요약', mobileLabel: '딜 요약', icon: Briefcase },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 h-14 lg:h-16 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
        <div className="flex items-center gap-4 lg:gap-6">
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="w-7 h-7 lg:w-8 lg:h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs lg:text-sm">SL</span>
            </div>
            <span className="font-bold text-gray-900 text-base lg:text-lg hidden sm:block">
              시큐레터 HubSpot 대시보드
            </span>
            <span className="font-bold text-gray-900 text-base sm:hidden">
              시큐레터
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 ml-6">
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

        <div className="text-xs lg:text-sm text-gray-500 hidden sm:block">
          HubSpot 계정: 243367573
        </div>
      </header>

      {/* Page content - bottom padding for mobile nav */}
      <main className="p-4 lg:p-6 pb-24 lg:pb-6">{children}</main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {navItems.map(item => {
            const isActive = location.pathname === item.path
            const Icon = item.icon

            if (item.isAction) {
              // Raised action button for meeting log
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex flex-col items-center justify-center -mt-5"
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-colors ${
                    isActive
                      ? 'bg-primary-700'
                      : 'bg-primary-600'
                  }`}>
                    <Icon size={24} className="text-white" />
                  </div>
                  <span className="text-xs font-medium text-primary-600 mt-1">
                    {item.mobileLabel}
                  </span>
                </Link>
              )
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[48px] rounded-xl transition-colors ${
                  isActive
                    ? 'text-primary-600'
                    : 'text-gray-400'
                }`}
              >
                <Icon size={22} />
                <span className="text-xs font-medium">{item.mobileLabel}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

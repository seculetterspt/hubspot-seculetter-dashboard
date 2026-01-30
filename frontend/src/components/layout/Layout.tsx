import { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">SL</span>
          </div>
          <span className="font-bold text-gray-900 text-lg">시큐레터 HubSpot 대시보드</span>
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

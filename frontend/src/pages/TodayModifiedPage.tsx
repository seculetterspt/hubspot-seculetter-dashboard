import { useEffect, useState } from 'react'
import { RefreshCw, Users, Building2, Handshake, Ticket, Calendar, Phone, FileText } from 'lucide-react'
import { api } from '../services/api'

interface Contact {
  id: string
  name: string
  email: string
  company: string
  lifecycleStage: string
  source: string
  modifiedAt: string
  createdAt: string
}

interface Company {
  id: string
  name: string
  domain: string
  industry: string
  employees: string
  modifiedAt: string
  createdAt: string
}

interface Deal {
  id: string
  name: string
  amount: number
  stage: string
  pipeline: string
  closeDate: string
  modifiedAt: string
  createdAt: string
}

interface TicketItem {
  id: string
  subject: string
  priority: string
  status: string
  modifiedAt: string
  createdAt: string
}

interface Meeting {
  id: string
  title: string
  startTime: string
  endTime: string
  outcome: string
}

interface Call {
  id: string
  title: string
  duration: string
  status: string
  timestamp: string
}

interface Note {
  id: string
  body: string
  timestamp: string
}

interface TodayData {
  date: string
  contacts: { count: number; items: Contact[] }
  companies: { count: number; items: Company[] }
  deals: { count: number; items: Deal[] }
  tickets: { count: number; items: TicketItem[] }
  activities: {
    meetings: { count: number; items: Meeting[] }
    calls: { count: number; items: Call[] }
    notes: { count: number; items: Note[] }
  }
}

type TabType = 'contacts' | 'companies' | 'deals' | 'tickets' | 'meetings' | 'calls' | 'notes'

export default function TodayModifiedPage() {
  const [data, setData] = useState<TodayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('contacts')

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await api.get('/analytics/today-modified')
      setData(res.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const formatDateTime = (dateStr: string) => {
    if (!dateStr || dateStr === '-') return '-'
    const date = new Date(dateStr)
    return date.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (value: number) => {
    if (!value) return '-'
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(value)
  }

  const tabs = [
    { id: 'contacts' as TabType, label: '연락처', icon: Users, count: data?.contacts.count || 0 },
    { id: 'companies' as TabType, label: '회사', icon: Building2, count: data?.companies.count || 0 },
    { id: 'deals' as TabType, label: '거래', icon: Handshake, count: data?.deals.count || 0 },
    { id: 'tickets' as TabType, label: '티켓', icon: Ticket, count: data?.tickets.count || 0 },
    { id: 'meetings' as TabType, label: '미팅', icon: Calendar, count: data?.activities.meetings.count || 0 },
    { id: 'calls' as TabType, label: '통화', icon: Phone, count: data?.activities.calls.count || 0 },
    { id: 'notes' as TabType, label: '메모', icon: FileText, count: data?.activities.notes.count || 0 },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">오늘 수정된 데이터</h1>
          <p className="text-gray-500 mt-1">{data?.date} 기준</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <RefreshCw size={18} />
          새로고침
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex overflow-x-auto border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={18} />
                {tab.label}
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Table Content */}
        <div className="p-4 overflow-x-auto">
          {activeTab === 'contacts' && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">이름</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">이메일</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">회사</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">단계</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">유입경로</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">수정일시</th>
                </tr>
              </thead>
              <tbody>
                {data?.contacts.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                    <td className="py-3 px-4 text-gray-600">{item.email}</td>
                    <td className="py-3 px-4 text-gray-600">{item.company}</td>
                    <td className="py-3 px-4"><span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">{item.lifecycleStage}</span></td>
                    <td className="py-3 px-4 text-gray-600">{item.source}</td>
                    <td className="py-3 px-4 text-gray-500 text-sm">{formatDateTime(item.modifiedAt)}</td>
                  </tr>
                ))}
                {data?.contacts.items.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-500">오늘 수정된 연락처가 없습니다</td></tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'companies' && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">회사명</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">도메인</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">업종</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">직원수</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">수정일시</th>
                </tr>
              </thead>
              <tbody>
                {data?.companies.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                    <td className="py-3 px-4 text-gray-600">{item.domain}</td>
                    <td className="py-3 px-4 text-gray-600">{item.industry}</td>
                    <td className="py-3 px-4 text-gray-600">{item.employees}</td>
                    <td className="py-3 px-4 text-gray-500 text-sm">{formatDateTime(item.modifiedAt)}</td>
                  </tr>
                ))}
                {data?.companies.items.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-500">오늘 수정된 회사가 없습니다</td></tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'deals' && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">거래명</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">금액</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">단계</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">마감예정</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">수정일시</th>
                </tr>
              </thead>
              <tbody>
                {data?.deals.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">{formatCurrency(item.amount)}</td>
                    <td className="py-3 px-4"><span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">{item.stage}</span></td>
                    <td className="py-3 px-4 text-gray-600">{item.closeDate ? item.closeDate.split('T')[0] : '-'}</td>
                    <td className="py-3 px-4 text-gray-500 text-sm">{formatDateTime(item.modifiedAt)}</td>
                  </tr>
                ))}
                {data?.deals.items.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-500">오늘 수정된 거래가 없습니다</td></tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'tickets' && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">제목</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">우선순위</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">상태</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">수정일시</th>
                </tr>
              </thead>
              <tbody>
                {data?.tickets.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{item.subject}</td>
                    <td className="py-3 px-4"><span className={`px-2 py-1 rounded text-xs ${item.priority === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{item.priority}</span></td>
                    <td className="py-3 px-4 text-gray-600">{item.status}</td>
                    <td className="py-3 px-4 text-gray-500 text-sm">{formatDateTime(item.modifiedAt)}</td>
                  </tr>
                ))}
                {data?.tickets.items.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-500">오늘 수정된 티켓이 없습니다</td></tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'meetings' && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">제목</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">시작</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">종료</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">결과</th>
                </tr>
              </thead>
              <tbody>
                {data?.activities.meetings.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{item.title}</td>
                    <td className="py-3 px-4 text-gray-600">{formatDateTime(item.startTime)}</td>
                    <td className="py-3 px-4 text-gray-600">{formatDateTime(item.endTime)}</td>
                    <td className="py-3 px-4 text-gray-600">{item.outcome}</td>
                  </tr>
                ))}
                {data?.activities.meetings.items.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-500">미팅 기록이 없습니다</td></tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'calls' && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">제목</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">통화시간</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">상태</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">일시</th>
                </tr>
              </thead>
              <tbody>
                {data?.activities.calls.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{item.title}</td>
                    <td className="py-3 px-4 text-gray-600">{item.duration}초</td>
                    <td className="py-3 px-4 text-gray-600">{item.status}</td>
                    <td className="py-3 px-4 text-gray-500 text-sm">{formatDateTime(item.timestamp)}</td>
                  </tr>
                ))}
                {data?.activities.calls.items.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-500">통화 기록이 없습니다</td></tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'notes' && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">내용</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">작성일시</th>
                </tr>
              </thead>
              <tbody>
                {data?.activities.notes.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">{item.body}</td>
                    <td className="py-3 px-4 text-gray-500 text-sm">{formatDateTime(item.timestamp)}</td>
                  </tr>
                ))}
                {data?.activities.notes.items.length === 0 && (
                  <tr><td colSpan={2} className="py-8 text-center text-gray-500">메모 기록이 없습니다</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

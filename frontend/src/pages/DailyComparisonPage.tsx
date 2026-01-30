import { useEffect, useState } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Minus, Users, Building2, Handshake, Ticket, Plus, X } from 'lucide-react'
import { api } from '../services/api'

interface ComparisonData {
  dates: {
    today: string
    yesterday: string
  }
  isYesterdayRealData: boolean
  dataSource: string
  summary: {
    contacts: { today: number; yesterday: number; change: number; changePercent: string }
    companies: { today: number; yesterday: number; change: number; changePercent: string }
    deals: { today: number; yesterday: number; change: number; changePercent: string; todayValue: number; yesterdayValue: number }
    tickets: { today: number; yesterday: number; change: number; changePercent: string }
  }
  details: {
    contacts: { added: number; removed: number; modified: number; unchanged: number; addedItems: any[]; removedItems: any[]; modifiedItems?: any[] }
    companies: { added: number; removed: number; modified: number; unchanged: number; addedItems: any[]; removedItems: any[]; modifiedItems?: any[] }
    deals: { added: number; removed: number; modified: number; unchanged: number; addedItems: any[]; removedItems: any[]; modifiedItems?: any[] }
    tickets: { added: number; removed: number; modified: number; unchanged: number; addedItems: any[]; removedItems: any[]; modifiedItems?: any[] }
  }
  data: {
    today: { contacts: any[]; companies: any[]; deals: any[]; tickets: any[] }
    yesterday: { contacts: any[]; companies: any[]; deals: any[]; tickets: any[] }
  }
}

type ObjectType = 'contacts' | 'companies' | 'deals' | 'tickets'

export default function DailyComparisonPage() {
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedObject, setSelectedObject] = useState<ObjectType>('contacts')
  const [viewMode, setViewMode] = useState<'summary' | 'added' | 'today' | 'yesterday'>('summary')

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await api.get('/analytics/daily-comparison')
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

  const formatCurrency = (value: number) => {
    if (!value) return '₩0'
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(value)
  }

  const objectConfig = {
    contacts: { label: '연락처', icon: Users, color: 'blue' },
    companies: { label: '회사', icon: Building2, color: 'purple' },
    deals: { label: '거래', icon: Handshake, color: 'green' },
    tickets: { label: '티켓', icon: Ticket, color: 'orange' }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!data) {
    return <div className="text-center text-gray-500">데이터를 불러올 수 없습니다</div>
  }

  const ChangeIndicator = ({ change, percent }: { change: number; percent: string }) => {
    if (change > 0) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp size={16} />
          <span>+{change} ({percent}%)</span>
        </div>
      )
    } else if (change < 0) {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <TrendingDown size={16} />
          <span>{change} ({percent}%)</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1 text-gray-500">
        <Minus size={16} />
        <span>변화 없음</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">일별 데이터 비교</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-gray-500">
              {data.dates.yesterday} vs {data.dates.today}
            </p>
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              data.isYesterdayRealData
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {data.dataSource}
            </span>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <RefreshCw size={18} />
          새로고침
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(objectConfig) as ObjectType[]).map((key) => {
          const config = objectConfig[key]
          const summary = data.summary[key]
          const Icon = config.icon
          const isSelected = selectedObject === key

          return (
            <button
              key={key}
              onClick={() => setSelectedObject(key)}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                isSelected
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg bg-${config.color}-100`}>
                  <Icon className={`text-${config.color}-600`} size={20} />
                </div>
                <ChangeIndicator change={summary.change} percent={summary.changePercent} />
              </div>
              <p className="text-sm text-gray-500">{config.label}</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-gray-900">{summary.today}</span>
                <span className="text-sm text-gray-400">← {summary.yesterday}</span>
              </div>
              {key === 'deals' && 'todayValue' in summary && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500">파이프라인 가치</p>
                  <p className="text-sm font-medium">{formatCurrency((summary as any).todayValue)}</p>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Detail Section */}
      <div className="bg-white rounded-xl border border-gray-200">
        {/* Detail Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {objectConfig[selectedObject].label} 상세 변화
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('summary')}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  viewMode === 'summary' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                요약
              </button>
              <button
                onClick={() => setViewMode('added')}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  viewMode === 'added' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                신규 추가
              </button>
              <button
                onClick={() => setViewMode('today')}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  viewMode === 'today' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                오늘 전체
              </button>
              <button
                onClick={() => setViewMode('yesterday')}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  viewMode === 'yesterday' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                어제 전체
              </button>
            </div>
          </div>
        </div>

        {/* Detail Content */}
        <div className="p-4">
          {viewMode === 'summary' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <Plus size={18} />
                  <span className="font-medium">신규 추가</span>
                </div>
                <p className="text-3xl font-bold text-green-700">{data.details[selectedObject].added}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 text-red-700 mb-2">
                  <X size={18} />
                  <span className="font-medium">삭제됨</span>
                </div>
                <p className="text-3xl font-bold text-red-700">{data.details[selectedObject].removed}</p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2 text-yellow-700 mb-2">
                  <RefreshCw size={18} />
                  <span className="font-medium">수정됨</span>
                </div>
                <p className="text-3xl font-bold text-yellow-700">{data.details[selectedObject].modified}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-700 mb-2">
                  <Minus size={18} />
                  <span className="font-medium">변화 없음</span>
                </div>
                <p className="text-3xl font-bold text-gray-700">{data.details[selectedObject].unchanged}</p>
              </div>
            </div>
          )}

          {viewMode === 'added' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    {selectedObject === 'contacts' && (
                      <>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">이름</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">이메일</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">회사</th>
                      </>
                    )}
                    {selectedObject === 'companies' && (
                      <>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">회사명</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">도메인</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">업종</th>
                      </>
                    )}
                    {selectedObject === 'deals' && (
                      <>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">거래명</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">금액</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">단계</th>
                      </>
                    )}
                    {selectedObject === 'tickets' && (
                      <>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">제목</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">우선순위</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">상태</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.details[selectedObject].addedItems.map((item: any) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-green-50">
                      {selectedObject === 'contacts' && (
                        <>
                          <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                          <td className="py-3 px-4 text-gray-600">{item.email}</td>
                          <td className="py-3 px-4 text-gray-600">{item.company}</td>
                        </>
                      )}
                      {selectedObject === 'companies' && (
                        <>
                          <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                          <td className="py-3 px-4 text-gray-600">{item.domain}</td>
                          <td className="py-3 px-4 text-gray-600">{item.industry}</td>
                        </>
                      )}
                      {selectedObject === 'deals' && (
                        <>
                          <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                          <td className="py-3 px-4 text-right font-medium">{formatCurrency(item.amount)}</td>
                          <td className="py-3 px-4">{item.stage}</td>
                        </>
                      )}
                      {selectedObject === 'tickets' && (
                        <>
                          <td className="py-3 px-4 font-medium text-gray-900">{item.subject}</td>
                          <td className="py-3 px-4">{item.priority}</td>
                          <td className="py-3 px-4">{item.status}</td>
                        </>
                      )}
                    </tr>
                  ))}
                  {data.details[selectedObject].addedItems.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-gray-500">
                        신규 추가된 항목이 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {(viewMode === 'today' || viewMode === 'yesterday') && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    {selectedObject === 'contacts' && (
                      <>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">이름</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">이메일</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">회사</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">단계</th>
                      </>
                    )}
                    {selectedObject === 'companies' && (
                      <>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">회사명</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">도메인</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">업종</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">직원수</th>
                      </>
                    )}
                    {selectedObject === 'deals' && (
                      <>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">거래명</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">금액</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">단계</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">마감예정</th>
                      </>
                    )}
                    {selectedObject === 'tickets' && (
                      <>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">제목</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">우선순위</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">상태</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.data[viewMode][selectedObject].map((item: any) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      {selectedObject === 'contacts' && (
                        <>
                          <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                          <td className="py-3 px-4 text-gray-600">{item.email}</td>
                          <td className="py-3 px-4 text-gray-600">{item.company}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">{item.lifecycleStage}</span>
                          </td>
                        </>
                      )}
                      {selectedObject === 'companies' && (
                        <>
                          <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                          <td className="py-3 px-4 text-gray-600">{item.domain}</td>
                          <td className="py-3 px-4 text-gray-600">{item.industry}</td>
                          <td className="py-3 px-4 text-gray-600">{item.employees}</td>
                        </>
                      )}
                      {selectedObject === 'deals' && (
                        <>
                          <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                          <td className="py-3 px-4 text-right font-medium">{formatCurrency(item.amount)}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">{item.stage}</span>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{item.closeDate?.split('T')[0] || '-'}</td>
                        </>
                      )}
                      {selectedObject === 'tickets' && (
                        <>
                          <td className="py-3 px-4 font-medium text-gray-900">{item.subject}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs ${
                              item.priority === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>{item.priority}</span>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{item.status}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

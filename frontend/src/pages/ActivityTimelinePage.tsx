import { useEffect, useState, useMemo } from 'react'
import { RefreshCw, Phone, FileText, Calendar, Mail, Sparkles, Building2, User, Briefcase } from 'lucide-react'
import { api } from '../services/api'

interface Association {
  id: string
  name: string
}

interface Activity {
  id: string
  type: 'call' | 'note' | 'meeting' | 'email'
  title: string
  body: string
  timestamp: string
  date: string
  associations: {
    companies: Association[]
    contacts: Association[]
    deals: Association[]
  }
  aiSummary?: string
}

interface TimelineData {
  dateRange: {
    from: string
    to: string
  }
  totalCount: number
  dates: string[]
  activitiesByDate: Record<string, Activity[]>
}

export default function ActivityTimelinePage() {
  const [data, setData] = useState<TimelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [summariesLoading, setSummariesLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // 현재 날짜 기준 2주 전/후
  const today = useMemo(() => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  }, [])

  const dateRange = useMemo(() => {
    const now = new Date()
    const from = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000))
    const to = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000))
    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0]
    }
  }, [])

  const fetchData = async (withSummaries = false) => {
    if (withSummaries) {
      setSummariesLoading(true)
    } else {
      setLoading(true)
    }
    try {
      const url = `/analytics/activity-timeline?from=${dateRange.from}&to=${dateRange.to}${withSummaries ? '&generateSummaries=true' : ''}`
      const res = await api.get(url)
      setData(res.data)

      // 오늘 날짜가 있으면 선택, 없으면 가장 가까운 날짜 선택
      if (res.data.dates.length > 0) {
        if (res.data.dates.includes(today)) {
          setSelectedDate(today)
        } else {
          // 오늘과 가장 가까운 날짜 찾기
          const sorted = [...res.data.dates].sort((a, b) => {
            const diffA = Math.abs(new Date(a).getTime() - new Date(today).getTime())
            const diffB = Math.abs(new Date(b).getTime() - new Date(today).getTime())
            return diffA - diffB
          })
          setSelectedDate(sorted[0])
        }
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
      setSummariesLoading(false)
    }
  }

  useEffect(() => {
    fetchData(false)
  }, [])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    const dayName = dayNames[date.getDay()]
    return { month, day, dayName, full: `${month}월 ${day}일 (${dayName})` }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    // KST 변환
    const kst = new Date(date.getTime() + (9 * 60 * 60 * 1000))
    const hours = String(kst.getUTCHours()).padStart(2, '0')
    const minutes = String(kst.getUTCMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone size={16} className="text-blue-600" />
      case 'note': return <FileText size={16} className="text-green-600" />
      case 'meeting': return <Calendar size={16} className="text-purple-600" />
      case 'email': return <Mail size={16} className="text-orange-600" />
      default: return null
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'call': return '전화'
      case 'note': return '메모'
      case 'meeting': return '미팅'
      case 'email': return '이메일'
      default: return type
    }
  }

  const getTypeBg = (type: string) => {
    switch (type) {
      case 'call': return 'bg-blue-50 border-blue-200'
      case 'note': return 'bg-green-50 border-green-200'
      case 'meeting': return 'bg-purple-50 border-purple-200'
      case 'email': return 'bg-orange-50 border-orange-200'
      default: return 'bg-gray-50 border-gray-200'
    }
  }

  const isDateInFuture = (dateStr: string) => {
    return new Date(dateStr) > new Date(today)
  }

  const selectedActivities = selectedDate && data?.activitiesByDate[selectedDate] || []

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
          <h1 className="text-2xl font-bold text-gray-900">활동 타임라인</h1>
          <p className="text-gray-500 mt-1">
            {dateRange.from} ~ {dateRange.to} | 총 {data?.totalCount || 0}건의 활동
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchData(true)}
            disabled={summariesLoading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {summariesLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                AI 요약 생성 중...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                AI 요약 생성
              </>
            )}
          </button>
          <button
            onClick={() => fetchData(false)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <RefreshCw size={18} />
            새로고침
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 날짜 목록 (좌측) */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-4">날짜별 활동</h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {data?.dates.map(dateStr => {
                const { month, day, dayName } = formatDate(dateStr)
                const count = data.activitiesByDate[dateStr]?.length || 0
                const isSelected = selectedDate === dateStr
                const isFuture = isDateInFuture(dateStr)
                const isToday = dateStr === today

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-primary-50 border-primary-300 ring-2 ring-primary-200'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`text-lg font-bold ${isSelected ? 'text-primary-700' : 'text-gray-900'}`}>
                          {month}/{day}
                        </span>
                        <span className={`ml-2 text-sm ${isSelected ? 'text-primary-600' : 'text-gray-500'}`}>
                          ({dayName})
                        </span>
                        {isToday && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">오늘</span>
                        )}
                        {isFuture && !isToday && (
                          <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">예정</span>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        isSelected ? 'bg-primary-200 text-primary-800' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {count}건
                      </span>
                    </div>
                  </button>
                )
              })}
              {(!data?.dates || data.dates.length === 0) && (
                <p className="text-center text-gray-500 py-8">활동이 없습니다</p>
              )}
            </div>
          </div>
        </div>

        {/* 선택된 날짜의 활동 목록 (우측) */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {selectedDate ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    {formatDate(selectedDate).full}
                  </h2>
                  <span className="text-gray-500">{selectedActivities.length}건의 활동</span>
                </div>

                <div className="space-y-4">
                  {selectedActivities.map(activity => {
                    const companyName = activity.associations.companies[0]?.name
                    const contactName = activity.associations.contacts[0]?.name
                    const dealName = activity.associations.deals[0]?.name

                    // 표시 이름: 회사명 우선, 없으면 담당자명, 없으면 기존 제목
                    const displayName = companyName || contactName || activity.title

                    return (
                      <div
                        key={activity.id}
                        className={`p-4 rounded-xl border-2 ${getTypeBg(activity.type)}`}
                      >
                        {/* 헤더: 회사명/담당자명 (활동유형: 날짜) */}
                        <div className="flex items-start gap-3 mb-3">
                          <div className="p-2 bg-white rounded-lg shadow-sm">
                            {getTypeIcon(activity.type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-gray-900">{displayName}</span>
                              <span className="text-gray-500">
                                ({getTypeLabel(activity.type)}: {activity.date})
                              </span>
                            </div>

                            {/* 연결 정보 - 회사/담당자/거래 */}
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                              {companyName && (
                                <span className="flex items-center gap-1">
                                  <Building2 size={14} className="text-blue-500" />
                                  {companyName}
                                </span>
                              )}
                              {contactName && (
                                <span className="flex items-center gap-1">
                                  <User size={14} className="text-green-500" />
                                  {contactName}
                                </span>
                              )}
                              {dealName && (
                                <span className="flex items-center gap-1">
                                  <Briefcase size={14} className="text-purple-500" />
                                  {dealName}
                                </span>
                              )}
                              <span className="text-gray-400">{formatTimestamp(activity.timestamp)}</span>
                            </div>
                          </div>
                        </div>

                        {/* 내용 표시 */}
                        {activity.body && (
                          <div className="bg-white/50 rounded-lg p-3 text-sm text-gray-700 mb-3">
                            <div
                              dangerouslySetInnerHTML={{
                                __html: activity.body.substring(0, 500) + (activity.body.length > 500 ? '...' : '')
                              }}
                              className="prose prose-sm max-w-none"
                            />
                          </div>
                        )}

                        {/* AI 인사이트 */}
                        {activity.aiSummary && (
                          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
                            <div className="flex items-center gap-1 text-xs text-purple-600 mb-2">
                              <Sparkles size={12} />
                              <span className="font-medium">AI 인사이트</span>
                            </div>
                            <p className="text-gray-800 leading-relaxed">{activity.aiSummary}</p>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {selectedActivities.length === 0 && (
                    <p className="text-center text-gray-500 py-12">
                      이 날짜에 기록된 활동이 없습니다
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                <p>좌측에서 날짜를 선택하세요</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

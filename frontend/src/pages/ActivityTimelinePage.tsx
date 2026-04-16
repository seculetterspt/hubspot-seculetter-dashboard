import { useEffect, useState, useRef } from 'react'
import { RefreshCw, Phone, FileText, Calendar, Mail, Sparkles, Building2, User, Briefcase, ExternalLink, MessageSquare, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'

// HubSpot Portal ID
const HUBSPOT_PORTAL_ID = '243367573'

// HubSpot URL 생성 함수
const getHubspotUrl = (type: 'company' | 'contact' | 'deal', id: string) => {
  return `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/${type}/${id}`
}

// KST 기준 오늘 날짜 (YYYY-MM-DD)
const getKSTToday = () => {
  const now = new Date()
  const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000))
  return kst.toISOString().split('T')[0]
}

// KST 기준 날짜 범위 (앞뒤 2주)
const getKSTDateRange = () => {
  const now = new Date()
  const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000))

  const from = new Date(kstNow.getTime() - (14 * 24 * 60 * 60 * 1000))
  const to = new Date(kstNow.getTime() + (14 * 24 * 60 * 60 * 1000))

  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0]
  }
}

// 범위 내 모든 날짜 생성
const generateAllDatesInRange = (from: string, to: string): string[] => {
  const dates: string[] = []
  const startDate = new Date(from)
  const endDate = new Date(to)

  const current = new Date(startDate)
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }

  return dates
}

interface Association {
  id: string
  name: string
}

interface Comment {
  id: string
  body: string
  timestamp: string
}

interface Activity {
  id: string
  type: 'call' | 'note' | 'meeting' | 'email'
  title: string
  body: string
  timestamp: string
  date: string
  ownerName?: string
  associations: {
    companies: Association[]
    contacts: Association[]
    deals: Association[]
  }
  comments?: Comment[]
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
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const loadedDatesRef = useRef<Set<string>>(new Set())
  const dateStripRef = useRef<HTMLDivElement>(null)
  const desktopDateListRef = useRef<HTMLDivElement>(null)

  const today = getKSTToday()
  const dateRange = getKSTDateRange()

  // 초기 로딩
  const fetchData = async () => {
    setLoading(true)
    try {
      const url = `/analytics/activity-timeline?from=${dateRange.from}&to=${dateRange.to}`
      const res = await api.get(url)
      setData(res.data)
      setSelectedDate(today)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // 선택된 날짜의 상세 정보 로딩
  const fetchDateDetails = async (dateStr: string) => {
    if (loadedDatesRef.current.has(dateStr)) return

    setDetailLoading(true)
    try {
      const url = `/analytics/activity-timeline?from=${dateStr}&to=${dateStr}&includeAssociations=true&generateSummaries=true`
      const res = await api.get(url)

      if (res.data.activitiesByDate[dateStr]) {
        setData(prev => prev ? {
          ...prev,
          activitiesByDate: {
            ...prev.activitiesByDate,
            [dateStr]: res.data.activitiesByDate[dateStr]
          }
        } : prev)
        loadedDatesRef.current.add(dateStr)
      }
    } catch (error) {
      console.error('Error fetching date details:', error)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedDate && data) {
      fetchDateDetails(selectedDate)
    }
  }, [selectedDate, data])

  // Auto-scroll date strip to today
  useEffect(() => {
    if (!loading) {
      // Mobile date strip
      if (dateStripRef.current) {
        const todayEl = dateStripRef.current.querySelector('[data-today="true"]')
        if (todayEl) {
          todayEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
        }
      }
      // Desktop date list
      if (desktopDateListRef.current) {
        const todayEl = desktopDateListRef.current.querySelector('[data-today="true"]')
        if (todayEl) {
          todayEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    }
  }, [loading])

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
    return dateStr > today
  }

  const allDates = generateAllDatesInRange(dateRange.from, dateRange.to)
  const selectedActivities = selectedDate && data?.activitiesByDate[selectedDate] || []

  // Desktop date styles
  const getDateStyle = (dateStr: string, isSelected: boolean) => {
    const isToday = dateStr === today
    const isFuture = isDateInFuture(dateStr)
    const hasActivity = (data?.activitiesByDate[dateStr]?.length || 0) > 0

    if (isSelected) {
      return 'bg-primary-100 border-primary-400 ring-2 ring-primary-200'
    }
    if (isToday) {
      return 'bg-blue-50 border-blue-300 hover:bg-blue-100'
    }
    if (isFuture) {
      return hasActivity
        ? 'bg-purple-50 border-purple-200 hover:bg-purple-100'
        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
    }
    return hasActivity
      ? 'bg-gray-50 border-gray-200 hover:bg-gray-100'
      : 'bg-gray-50/50 border-gray-100 hover:bg-gray-100/50'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // Shared activity card renderer
  const renderActivityCard = (activity: Activity, isMobile: boolean) => {
    const companyName = activity.associations.companies[0]?.name
    const contactName = activity.associations.contacts[0]?.name
    const dealName = activity.associations.deals[0]?.name
    const displayName = companyName || contactName || activity.title
    const isExpanded = !isMobile || expandedCards.has(activity.id)

    return (
      <div
        key={activity.id}
        className={`rounded-xl border-2 ${getTypeBg(activity.type)} ${isMobile ? 'overflow-hidden' : 'p-4'}`}
      >
        {/* Card header - always visible */}
        <button
          onClick={() => isMobile && toggleCard(activity.id)}
          className={`w-full text-left ${isMobile ? 'p-3.5' : 'cursor-default'}`}
        >
          <div className="flex items-start gap-3">
            <div className="p-1.5 lg:p-2 bg-white rounded-lg shadow-sm flex-shrink-0">
              {getTypeIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-gray-900 text-sm lg:text-base truncate">{displayName}</span>
                <span className="text-xs lg:text-sm text-gray-500 flex-shrink-0">
                  {getTypeLabel(activity.type)} {formatTimestamp(activity.timestamp)}
                </span>
                {activity.ownerName && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs flex-shrink-0">
                    <User size={10} />
                    {activity.type === 'meeting' ? `주최: ${activity.ownerName}` : activity.ownerName}
                  </span>
                )}
              </div>

              {/* AI Summary preview - always visible */}
              {activity.aiSummary && (
                <p className="text-xs lg:text-sm text-gray-600 mt-1 line-clamp-2">
                  {activity.aiSummary}
                </p>
              )}
            </div>

            {/* Mobile expand/collapse indicator */}
            {isMobile && (
              <div className="flex-shrink-0 pt-0.5">
                {isExpanded
                  ? <ChevronUp size={18} className="text-gray-400" />
                  : <ChevronDown size={18} className="text-gray-400" />
                }
              </div>
            )}
          </div>
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className={`${isMobile ? 'px-3.5 pb-3.5' : 'mt-3'} space-y-3`}>
            {/* Association links */}
            {(activity.associations.companies[0] || activity.associations.contacts[0] || activity.associations.deals[0]) && (
              <div className="flex items-center gap-3 lg:gap-4 text-sm text-gray-600 flex-wrap">
                {activity.associations.companies[0] && (
                  <a
                    href={getHubspotUrl('company', activity.associations.companies[0].id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 active:text-blue-600 transition-colors"
                  >
                    <Building2 size={14} className="text-blue-500" />
                    <span className="truncate max-w-[120px] lg:max-w-none">{companyName}</span>
                    <ExternalLink size={12} className="text-gray-400 flex-shrink-0" />
                  </a>
                )}
                {activity.associations.contacts[0] && (
                  <a
                    href={getHubspotUrl('contact', activity.associations.contacts[0].id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 active:text-green-600 transition-colors"
                  >
                    <User size={14} className="text-green-500" />
                    <span className="truncate max-w-[120px] lg:max-w-none">{contactName}</span>
                    <ExternalLink size={12} className="text-gray-400 flex-shrink-0" />
                  </a>
                )}
                {activity.associations.deals[0] && (
                  <a
                    href={getHubspotUrl('deal', activity.associations.deals[0].id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 active:text-purple-600 transition-colors"
                  >
                    <Briefcase size={14} className="text-purple-500" />
                    <span className="truncate max-w-[120px] lg:max-w-none">{dealName}</span>
                    <ExternalLink size={12} className="text-gray-400 flex-shrink-0" />
                  </a>
                )}
              </div>
            )}

            {/* Body content */}
            {activity.body && (
              <div className="bg-white/50 rounded-lg p-3 text-sm text-gray-700">
                <div
                  dangerouslySetInnerHTML={{
                    __html: activity.body.substring(0, 500) + (activity.body.length > 500 ? '...' : '')
                  }}
                  className="prose prose-sm max-w-none"
                />
              </div>
            )}

            {/* Comments */}
            {activity.comments && activity.comments.length > 0 && (
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                <div className="flex items-center gap-1 text-xs text-amber-700 mb-2">
                  <MessageSquare size={12} />
                  <span className="font-medium">댓글 ({activity.comments.length})</span>
                </div>
                <div className="space-y-2">
                  {activity.comments.map((comment, idx) => (
                    <div key={comment.id || idx} className="text-sm text-gray-700 pl-3 border-l-2 border-amber-300">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: comment.body.substring(0, 300) + (comment.body.length > 300 ? '...' : '')
                        }}
                        className="prose prose-sm max-w-none"
                      />
                      <span className="text-xs text-gray-400 mt-1 block">
                        {formatTimestamp(comment.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Insight - full version */}
            {activity.aiSummary && (
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-3 lg:p-4 border border-purple-200">
                <div className="flex items-center gap-1 text-xs text-purple-600 mb-2">
                  <Sparkles size={12} />
                  <span className="font-medium">AI 인사이트</span>
                </div>
                <p className="text-sm text-gray-800 leading-relaxed">{activity.aiSummary}</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg lg:text-2xl font-bold text-gray-900">활동 타임라인</h1>
          <p className="text-xs lg:text-sm text-gray-500 mt-0.5 lg:mt-1">
            <span className="hidden lg:inline">{dateRange.from} ~ {dateRange.to} | </span>
            총 {data?.totalCount || 0}건의 활동
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/meeting/records"
            className="flex items-center gap-1.5 px-3 py-2 lg:px-4 lg:py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:bg-gray-100 text-sm"
          >
            <ClipboardList size={16} />
            <span className="hidden sm:inline">기록 관리</span>
          </Link>
          <button
            onClick={() => {
              loadedDatesRef.current.clear()
              fetchData()
            }}
            className="flex items-center gap-1.5 px-3 py-2 lg:px-4 lg:py-2 bg-primary-600 text-white rounded-lg active:bg-primary-700 hover:bg-primary-700 text-sm"
          >
            <RefreshCw size={16} />
            <span className="hidden sm:inline">새로고침</span>
          </button>
        </div>
      </div>

      {/* ===== MOBILE: Horizontal Date Strip + Activity List ===== */}
      <div className="lg:hidden">
        {/* Horizontal scrollable date strip */}
        <div
          ref={dateStripRef}
          className="flex gap-1.5 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide"
        >
          {allDates.map(dateStr => {
            const { day, dayName } = formatDate(dateStr)
            const count = data?.activitiesByDate[dateStr]?.length || 0
            const isSelected = selectedDate === dateStr
            const isToday = dateStr === today
            const isFuture = isDateInFuture(dateStr)
            const isWeekend = dayName === '토' || dayName === '일'

            return (
              <button
                key={dateStr}
                data-today={isToday ? 'true' : undefined}
                onClick={() => setSelectedDate(dateStr)}
                className={`flex-shrink-0 flex flex-col items-center min-w-[48px] py-2 px-1 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50'
                    : isToday
                      ? 'border-blue-400 bg-blue-50'
                      : isFuture && count > 0
                        ? 'border-purple-200 bg-purple-50/50'
                        : 'border-transparent bg-white'
                }`}
              >
                <span className={`text-[10px] font-medium ${
                  isSelected ? 'text-primary-600'
                    : isToday ? 'text-blue-600'
                    : isWeekend ? 'text-red-400'
                    : 'text-gray-400'
                }`}>
                  {dayName}
                </span>
                <span className={`text-lg font-bold leading-tight ${
                  isSelected ? 'text-primary-700'
                    : isToday ? 'text-blue-700'
                    : count > 0 ? 'text-gray-900'
                    : 'text-gray-300'
                }`}>
                  {day}
                </span>
                {count > 0 ? (
                  <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                    isSelected ? 'bg-primary-500'
                      : isToday ? 'bg-blue-500'
                      : isFuture ? 'bg-purple-400'
                      : 'bg-gray-400'
                  }`} />
                ) : (
                  <div className="w-1.5 h-1.5 mt-0.5" />
                )}
              </button>
            )
          })}
        </div>

        {/* Selected date header */}
        {selectedDate && (
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">
              {formatDate(selectedDate).full}
            </h2>
            <div className="flex items-center gap-2">
              {detailLoading && (
                <div className="flex items-center gap-1.5 text-purple-600">
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-purple-600"></div>
                  <span className="text-xs">AI 분석 중...</span>
                </div>
              )}
              <span className="text-xs text-gray-500">{selectedActivities.length}건</span>
            </div>
          </div>
        )}

        {/* Mobile activity cards - collapsible */}
        <div className="space-y-2.5">
          {selectedActivities.map(activity => renderActivityCard(activity, true))}

          {selectedDate && selectedActivities.length === 0 && (
            <div className="text-center text-gray-400 py-12">
              <Calendar size={36} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">이 날짜에 기록된 활동이 없습니다</p>
            </div>
          )}
        </div>
      </div>

      {/* ===== DESKTOP: Original 2-column grid layout ===== */}
      <div className="hidden lg:grid lg:grid-cols-4 gap-6">
        {/* 날짜 목록 (좌측) */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-4">날짜별 활동</h2>
            <div ref={desktopDateListRef} className="space-y-1 max-h-[600px] overflow-y-auto">
              {allDates.map(dateStr => {
                const { month, day, dayName } = formatDate(dateStr)
                const count = data?.activitiesByDate[dateStr]?.length || 0
                const isSelected = selectedDate === dateStr
                const isFuture = isDateInFuture(dateStr)
                const isToday = dateStr === today

                return (
                  <button
                    key={dateStr}
                    data-today={isToday ? 'true' : undefined}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all ${getDateStyle(dateStr, isSelected)}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-base font-bold ${
                          isSelected ? 'text-primary-700' :
                          isToday ? 'text-blue-700' :
                          isFuture ? 'text-purple-700' :
                          count > 0 ? 'text-gray-900' : 'text-gray-400'
                        }`}>
                          {month}/{day}
                        </span>
                        <span className={`text-sm ${
                          isSelected ? 'text-primary-600' :
                          isToday ? 'text-blue-600' :
                          isFuture ? 'text-purple-500' :
                          count > 0 ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          ({dayName})
                        </span>
                        {isToday && (
                          <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded font-medium">오늘</span>
                        )}
                      </div>
                      {count > 0 ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          isSelected ? 'bg-primary-200 text-primary-800' :
                          isToday ? 'bg-blue-200 text-blue-800' :
                          isFuture ? 'bg-purple-200 text-purple-800' :
                          'bg-gray-200 text-gray-700'
                        }`}>
                          {count}건
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </div>
                  </button>
                )
              })}
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
                  <div className="flex items-center gap-3">
                    {detailLoading && (
                      <div className="flex items-center gap-2 text-purple-600">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                        <span className="text-sm">AI 분석 중...</span>
                      </div>
                    )}
                    <span className="text-gray-500">{selectedActivities.length}건의 활동</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedActivities.map(activity => renderActivityCard(activity, false))}

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

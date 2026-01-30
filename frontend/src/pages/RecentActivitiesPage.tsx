import { useEffect, useState } from 'react'
import { RefreshCw, Phone, FileText, Calendar, Mail, Clock } from 'lucide-react'
import { api } from '../services/api'

interface Call {
  id: string
  title: string
  body: string
  duration: number
  status: string
  direction: string
  disposition: string
  timestamp: string
  kstTimestamp: string
}

interface Note {
  id: string
  body: string
  timestamp: string
  kstTimestamp: string
}

interface Meeting {
  id: string
  title: string
  body: string
  startTime: string
  endTime: string
  kstStartTime: string
  kstEndTime: string
  outcome: string
  location: string
}

interface Email {
  id: string
  subject: string
  body: string
  direction: string
  status: string
  timestamp: string
  kstTimestamp: string
}

interface ActivitiesData {
  timeRange: {
    from: string
    to: string
    timezone: string
  }
  summary: {
    calls: number
    notes: number
    meetings: number
    emails: number
    total: number
  }
  activities: {
    calls: Call[]
    notes: Note[]
    meetings: Meeting[]
    emails: Email[]
  }
}

type TabType = 'all' | 'calls' | 'notes' | 'meetings' | 'emails'

export default function RecentActivitiesPage() {
  const [data, setData] = useState<ActivitiesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('all')

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await api.get('/analytics/recent-activities')
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

  const formatKstTime = (kstTimestamp: string | undefined) => {
    if (!kstTimestamp) return '-'
    const date = new Date(kstTimestamp)
    return date.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`
  }

  const tabs = [
    { id: 'all' as TabType, label: '전체', icon: Clock, count: data?.summary.total || 0 },
    { id: 'calls' as TabType, label: '전화', icon: Phone, count: data?.summary.calls || 0 },
    { id: 'notes' as TabType, label: '메모', icon: FileText, count: data?.summary.notes || 0 },
    { id: 'meetings' as TabType, label: '미팅', icon: Calendar, count: data?.summary.meetings || 0 },
    { id: 'emails' as TabType, label: '이메일', icon: Mail, count: data?.summary.emails || 0 },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // 전체 타임라인용 병합 및 정렬
  const getAllActivities = () => {
    if (!data) return []

    const all = [
      ...data.activities.calls.map(c => ({ ...c, type: 'call' as const })),
      ...data.activities.notes.map(n => ({ ...n, type: 'note' as const })),
      ...data.activities.meetings.map(m => ({ ...m, type: 'meeting' as const, kstTimestamp: m.kstStartTime })),
      ...data.activities.emails.map(e => ({ ...e, type: 'email' as const })),
    ]

    return all.sort((a, b) => {
      const timeA = a.kstTimestamp ? new Date(a.kstTimestamp).getTime() : 0
      const timeB = b.kstTimestamp ? new Date(b.kstTimestamp).getTime() : 0
      return timeB - timeA
    })
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone size={16} className="text-blue-600" />
      case 'note': return <FileText size={16} className="text-green-600" />
      case 'meeting': return <Calendar size={16} className="text-purple-600" />
      case 'email': return <Mail size={16} className="text-orange-600" />
      default: return null
    }
  }

  const getActivityBg = (type: string) => {
    switch (type) {
      case 'call': return 'bg-blue-50 border-blue-200'
      case 'note': return 'bg-green-50 border-green-200'
      case 'meeting': return 'bg-purple-50 border-purple-200'
      case 'email': return 'bg-orange-50 border-orange-200'
      default: return 'bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">최근 활동 내역</h1>
          <p className="text-gray-500 mt-1">
            최근 24시간 ({data?.timeRange.timezone}) | 총 {data?.summary.total || 0}건
          </p>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Phone className="text-blue-600" size={20} />
            <span className="text-sm text-blue-700">전화</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">{data?.summary.calls || 0}건</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="text-green-600" size={20} />
            <span className="text-sm text-green-700">메모</span>
          </div>
          <p className="text-2xl font-bold text-green-900">{data?.summary.notes || 0}건</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="text-purple-600" size={20} />
            <span className="text-sm text-purple-700">미팅</span>
          </div>
          <p className="text-2xl font-bold text-purple-900">{data?.summary.meetings || 0}건</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="text-orange-600" size={20} />
            <span className="text-sm text-orange-700">이메일</span>
          </div>
          <p className="text-2xl font-bold text-orange-900">{data?.summary.emails || 0}건</p>
        </div>
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

        {/* Content */}
        <div className="p-4">
          {/* All Activities Timeline */}
          {activeTab === 'all' && (
            <div className="space-y-3">
              {getAllActivities().length === 0 ? (
                <p className="text-center text-gray-500 py-8">최근 24시간 내 활동이 없습니다</p>
              ) : (
                getAllActivities().map((activity: any) => (
                  <div key={`${activity.type}-${activity.id}`} className={`p-4 rounded-lg border ${getActivityBg(activity.type)}`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getActivityIcon(activity.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-gray-900 truncate">
                            {activity.type === 'call' && activity.title}
                            {activity.type === 'note' && '메모'}
                            {activity.type === 'meeting' && activity.title}
                            {activity.type === 'email' && activity.subject}
                          </span>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {formatKstTime(activity.kstTimestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {activity.type === 'call' && `통화시간: ${formatDuration(activity.duration)} | ${activity.status}`}
                          {activity.type === 'note' && activity.body?.substring(0, 100)}
                          {activity.type === 'meeting' && `${activity.outcome} | ${activity.location}`}
                          {activity.type === 'email' && activity.body?.substring(0, 100)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Calls */}
          {activeTab === 'calls' && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">제목</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">통화시간</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">상태</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">방향</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">일시(KST)</th>
                </tr>
              </thead>
              <tbody>
                {data?.activities.calls.map((call) => (
                  <tr key={call.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{call.title}</td>
                    <td className="py-3 px-4 text-gray-600">{formatDuration(call.duration)}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">{call.status}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{call.direction === 'INBOUND' ? '수신' : call.direction === 'OUTBOUND' ? '발신' : call.direction}</td>
                    <td className="py-3 px-4 text-gray-500 text-sm">{formatKstTime(call.kstTimestamp)}</td>
                  </tr>
                ))}
                {data?.activities.calls.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-500">최근 24시간 내 전화 기록이 없습니다</td></tr>
                )}
              </tbody>
            </table>
          )}

          {/* Notes */}
          {activeTab === 'notes' && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">내용</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 w-40">작성일시(KST)</th>
                </tr>
              </thead>
              <tbody>
                {data?.activities.notes.map((note) => (
                  <tr key={note.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">
                      <div dangerouslySetInnerHTML={{ __html: note.body.substring(0, 300) }} className="prose prose-sm max-w-none" />
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-sm">{formatKstTime(note.kstTimestamp)}</td>
                  </tr>
                ))}
                {data?.activities.notes.length === 0 && (
                  <tr><td colSpan={2} className="py-8 text-center text-gray-500">최근 24시간 내 메모가 없습니다</td></tr>
                )}
              </tbody>
            </table>
          )}

          {/* Meetings */}
          {activeTab === 'meetings' && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">제목</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">시간(KST)</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">장소</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">결과</th>
                </tr>
              </thead>
              <tbody>
                {data?.activities.meetings.map((meeting) => (
                  <tr key={meeting.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{meeting.title}</td>
                    <td className="py-3 px-4 text-gray-600 text-sm">
                      {formatKstTime(meeting.kstStartTime)} ~ {formatKstTime(meeting.kstEndTime)}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{meeting.location}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">{meeting.outcome}</span>
                    </td>
                  </tr>
                ))}
                {data?.activities.meetings.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-500">최근 24시간 내 미팅이 없습니다</td></tr>
                )}
              </tbody>
            </table>
          )}

          {/* Emails */}
          {activeTab === 'emails' && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">제목</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">방향</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">상태</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">일시(KST)</th>
                </tr>
              </thead>
              <tbody>
                {data?.activities.emails.map((email) => (
                  <tr key={email.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{email.subject}</td>
                    <td className="py-3 px-4 text-gray-600">{email.direction === 'INCOMING_EMAIL' ? '수신' : email.direction === 'FORWARDED_EMAIL' ? '전달' : '발신'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">{email.status}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-sm">{formatKstTime(email.kstTimestamp)}</td>
                  </tr>
                ))}
                {data?.activities.emails.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-500">최근 24시간 내 이메일이 없습니다</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { ChevronLeft, Loader2, Calendar, Building2, Briefcase, User, FileText } from 'lucide-react'
import { api } from '../../services/api'

interface Meeting {
  id: string
  title: string
  startTime: string
  endTime?: string
  outcome?: string
  location?: string
  body?: string
  associations: {
    companies: { id: string; name: string }[]
    contacts: { id: string; name: string }[]
    deals: { id: string; name: string }[]
  }
}

interface Props {
  ownerId: string
  onSelect: (meeting: Meeting, associations: Meeting['associations']) => void
  onSkip: () => void
  onBack: () => void
}

export default function MeetingSelectStep({ ownerId, onSelect, onSkip, onBack }: Props) {
  const [meetings, setMeetings] = useState<Record<string, Meeting[]>>({})
  const [loading, setLoading] = useState(true)
  const [myOnly, setMyOnly] = useState(false)

  useEffect(() => {
    const fetchMeetings = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ days: '3' })
        if (ownerId) params.set('ownerId', ownerId)
        if (myOnly) params.set('myOnly', 'true')
        const res = await api.get(`/meetings/scheduled?${params.toString()}`)
        setMeetings(res.data.meetings || {})
      } catch {
        // 미팅 로드 실패 시 빈 상태 유지
      } finally {
        setLoading(false)
      }
    }
    fetchMeetings()
  }, [ownerId, myOnly])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const yesterday = new Date(today.getTime() - 86400000).toISOString().split('T')[0]
    const tomorrow = new Date(today.getTime() + 86400000).toISOString().split('T')[0]

    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    const dayName = dayNames[date.getDay()]
    const month = date.getMonth() + 1
    const day = date.getDate()

    if (dateStr === todayStr) return `오늘 (${month}/${day} ${dayName})`
    if (dateStr === yesterday) return `어제 (${month}/${day} ${dayName})`
    if (dateStr === tomorrow) return `내일 (${month}/${day} ${dayName})`
    return `${month}/${day} (${dayName})`
  }

  const formatTime = (isoStr: string) => {
    const d = new Date(isoStr)
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  const sortedDates = Object.keys(meetings).sort((a, b) => b.localeCompare(a))

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 size={32} className="animate-spin text-primary-600 mb-3" />
        <p className="text-gray-500">미팅 목록 불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-4 pt-2">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ChevronLeft size={24} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">미팅 선택</h1>
        <button
          onClick={() => setMyOnly(!myOnly)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
            myOnly
              ? 'bg-primary-100 text-primary-700 border border-primary-300'
              : 'bg-gray-100 text-gray-500 border border-gray-200'
          }`}
        >
          내 미팅만
        </button>
      </div>

      <div className="space-y-6 px-1">
        {sortedDates.length === 0 ? (
          <div className="text-center py-8">
            <Calendar size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">최근 예정된 미팅이 없습니다</p>
          </div>
        ) : (
          sortedDates.map((dateStr) => (
            <div key={dateStr}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2 px-1">
                {formatDate(dateStr)}
              </h3>
              <div className="space-y-2">
                {meetings[dateStr].map((meeting) => (
                  <button
                    key={meeting.id}
                    onClick={() => onSelect(meeting, meeting.associations)}
                    className="w-full text-left px-4 py-4 bg-white rounded-2xl border-2 border-gray-200 hover:border-primary-400 active:bg-primary-50 transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-semibold text-gray-900 text-base leading-tight pr-2">
                        {meeting.title}
                      </span>
                      <span className="text-sm text-primary-600 font-medium flex-shrink-0">
                        {formatTime(meeting.startTime)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {meeting.associations.companies.map((c) => (
                        <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">
                          <Building2 size={12} /> {c.name}
                        </span>
                      ))}
                      {meeting.associations.deals.map((d) => (
                        <span key={d.id} className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-lg">
                          <Briefcase size={12} /> {d.name}
                        </span>
                      ))}
                      {meeting.associations.contacts.map((c) => (
                        <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg">
                          <User size={12} /> {c.name}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}

        {/* 미팅 없이 기록 */}
        <button
          onClick={onSkip}
          className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-all"
        >
          <FileText size={20} />
          <span className="font-medium">미팅 없이 기록하기</span>
        </button>
      </div>
    </div>
  )
}

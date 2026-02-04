import { ChevronLeft, Building2, Briefcase, User, Clock, MapPin } from 'lucide-react'

interface Props {
  meeting: {
    id: string
    title: string
    startTime: string
    endTime?: string
    location?: string
  }
  associations: {
    companies: { id: string; name: string }[]
    contacts: { id: string; name: string }[]
    deals: { id: string; name: string }[]
  }
  onConfirm: () => void
  onBack: () => void
}

export default function MeetingDetailStep({ meeting, associations, onConfirm, onBack }: Props) {
  const formatDateTime = (isoStr: string) => {
    const d = new Date(isoStr)
    return d.toLocaleString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6 pt-2">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ChevronLeft size={24} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">미팅 확인</h1>
      </div>

      {/* 미팅 정보 카드 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
        <h2 className="text-lg font-bold text-gray-900 mb-3">{meeting.title}</h2>

        <div className="space-y-2.5 text-sm">
          <div className="flex items-center gap-2.5 text-gray-600">
            <Clock size={16} className="text-gray-400 flex-shrink-0" />
            <span>{formatDateTime(meeting.startTime)}</span>
          </div>
          {meeting.location && (
            <div className="flex items-center gap-2.5 text-gray-600">
              <MapPin size={16} className="text-gray-400 flex-shrink-0" />
              <span>{meeting.location}</span>
            </div>
          )}
        </div>
      </div>

      {/* 연결된 정보 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-8">
        <h3 className="text-sm font-semibold text-gray-500 mb-3">연결된 정보</h3>

        <div className="space-y-3">
          {associations.companies.length > 0 ? (
            associations.companies.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 bg-blue-50 rounded-xl">
                <Building2 size={18} className="text-blue-600" />
                <span className="font-medium text-gray-900">{c.name}</span>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl">
              <Building2 size={18} className="text-gray-400" />
              <span className="text-gray-400">연결된 회사 없음</span>
            </div>
          )}

          {associations.deals.length > 0 ? (
            associations.deals.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-3 py-2.5 bg-purple-50 rounded-xl">
                <Briefcase size={18} className="text-purple-600" />
                <span className="font-medium text-gray-900">{d.name}</span>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl">
              <Briefcase size={18} className="text-gray-400" />
              <span className="text-gray-400">연결된 거래 없음</span>
            </div>
          )}

          {associations.contacts.length > 0 ? (
            associations.contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 bg-green-50 rounded-xl">
                <User size={18} className="text-green-600" />
                <span className="font-medium text-gray-900">{c.name}</span>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl">
              <User size={18} className="text-gray-400" />
              <span className="text-gray-400">연결된 연락처 없음</span>
            </div>
          )}
        </div>
      </div>

      {/* 녹음 진행 버튼 */}
      <button
        onClick={onConfirm}
        className="w-full py-4 bg-primary-600 text-white font-bold text-lg rounded-2xl hover:bg-primary-700 active:bg-primary-800 transition-colors shadow-lg"
      >
        녹음 시작하기
      </button>
    </div>
  )
}

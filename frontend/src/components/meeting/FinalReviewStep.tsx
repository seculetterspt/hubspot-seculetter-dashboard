import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronDown, ChevronUp, Building2, Briefcase, User,
  CheckCircle2, Loader2, Target, ListTodo, ArrowRight
} from 'lucide-react'
import { api } from '../../services/api'

interface Props {
  data: {
    owner: { id: string; name: string } | null
    selectedMeeting: { id: string; title: string; startTime: string } | null
    structuredContent: any
    finalAssociations: {
      companies: { id: string; name: string }[]
      contacts: { id: string; name: string }[]
      deals: { id: string; name: string }[]
    }
  }
  onBack: () => void
}

export default function FinalReviewStep({ data, onBack }: Props) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)

  const sc = data.structuredContent

  const handleSave = async () => {
    if (saving || saved) return // 중복 저장 방지
    setSaving(true)
    setError('')

    try {
      const result = await api.post('/meetings/save', {
        structuredContent: sc,
        associations: data.finalAssociations,
        meetingId: data.selectedMeeting?.id || undefined,
        ownerId: data.owner?.id || undefined,
      })
      setSaved(true)
      if (result.data.associationErrors?.length > 0) {
        console.warn('Association errors:', result.data.associationErrors)
      }
      setTimeout(() => navigate('/'), 2500)
    } catch (err: any) {
      setError(err.response?.data?.error || '저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  // 저장 완료 화면
  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={56} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">CRM 기록 완료!</h2>
        <p className="text-gray-500 text-center">
          미팅 기록이 HubSpot에 저장되었습니다.
          <br />
          잠시 후 타임라인으로 이동합니다.
        </p>
      </div>
    )
  }

  const formatDateTime = (isoStr: string) => {
    const d = new Date(isoStr)
    return d.toLocaleString('ko-KR', {
      month: 'long', day: 'numeric', weekday: 'short',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
  }

  return (
    <div className="max-w-lg mx-auto pb-6">
      <div className="flex items-center gap-3 mb-6 pt-2">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ChevronLeft size={24} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">최종 확인</h1>
      </div>

      {/* 미팅 요약 헤더 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-1">{sc.summary_one_liner}</h2>
        {data.selectedMeeting && (
          <p className="text-sm text-gray-500 mb-3">
            {data.selectedMeeting.title} - {formatDateTime(data.selectedMeeting.startTime)}
          </p>
        )}
        {/* 연결 뱃지 */}
        <div className="flex flex-wrap gap-1.5">
          {data.finalAssociations.companies.map(c => (
            <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">
              <Building2 size={11} /> {c.name}
            </span>
          ))}
          {data.finalAssociations.deals.map(d => (
            <span key={d.id} className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-lg">
              <Briefcase size={11} /> {d.name}
            </span>
          ))}
          {data.finalAssociations.contacts.map(c => (
            <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg">
              <User size={11} /> {c.name}
            </span>
          ))}
        </div>
      </div>

      {/* 상세 내용 접기/펼치기 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl mb-4 text-sm font-medium text-gray-600"
      >
        <span>전체 내용 보기</span>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="space-y-2 mb-4">
          {sc.meeting_purpose && (
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Target size={14} className="text-blue-600" />
                <span className="text-xs font-semibold text-gray-500">미팅 목적</span>
              </div>
              <p className="text-sm text-gray-800">{sc.meeting_purpose}</p>
            </div>
          )}
          {sc.decisions && (
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle2 size={14} className="text-green-600" />
                <span className="text-xs font-semibold text-gray-500">결정 사항</span>
              </div>
              <p className="text-sm text-gray-800">{sc.decisions}</p>
            </div>
          )}
          {sc.action_items?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ListTodo size={14} className="text-purple-600" />
                <span className="text-xs font-semibold text-gray-500">액션 아이템</span>
              </div>
              {sc.action_items.map((item: any, i: number) => (
                <p key={i} className="text-sm text-gray-800">
                  - {item.task} ({item.assignee} / {item.deadline})
                </p>
              ))}
            </div>
          )}
          {sc.next_steps && (
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowRight size={14} className="text-teal-600" />
                <span className="text-xs font-semibold text-gray-500">다음 단계</span>
              </div>
              <p className="text-sm text-gray-800">{sc.next_steps}</p>
            </div>
          )}
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">
          {error}
        </div>
      )}

      {/* 저장 버튼 */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-4 bg-primary-600 text-white font-bold text-lg rounded-2xl hover:bg-primary-700 disabled:bg-gray-400 transition-colors shadow-lg flex items-center justify-center gap-2"
      >
        {saving ? (
          <><Loader2 size={22} className="animate-spin" /> 저장 중...</>
        ) : (
          'HubSpot에 저장'
        )}
      </button>
    </div>
  )
}

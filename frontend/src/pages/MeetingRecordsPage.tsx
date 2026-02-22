import { useEffect, useState } from 'react'
import { Trash2, Loader2, CheckCircle2, AlertTriangle, ExternalLink, Building2, Briefcase, User, RefreshCw } from 'lucide-react'
import { api } from '../services/api'

const HUBSPOT_PORTAL_ID = '243367573'

interface MeetingRecord {
  id: number
  owner_id: string | null
  owner_name: string | null
  hubspot_meeting_id: string | null
  is_new_meeting: boolean
  summary: string
  associations: {
    companies?: { id: string; name: string }[]
    contacts?: { id: string; name: string }[]
    deals?: { id: string; name: string }[]
  }
  hubspot_status: 'saved' | 'failed' | 'pending'
  hubspot_error: string | null
  association_errors: string[]
  created_at: string
}

export default function MeetingRecordsPage() {
  const [records, setRecords] = useState<MeetingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const res = await api.get('/meetings/records')
      setRecords(res.data.records || [])
    } catch {
      // 실패 시 빈 상태 유지
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecords()
  }, [])

  const handleDelete = async (id: number) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }

    setDeletingId(id)
    try {
      await api.delete(`/meetings/records/${id}`)
      setRecords(prev => prev.filter(r => r.id !== id))
    } catch {
      // 삭제 실패
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr)
    return d.toLocaleString('ko-KR', {
      month: 'short', day: 'numeric', weekday: 'short',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
  }

  const statusBadge = (status: string, associationErrors: string[]) => {
    const hasAssocErr = associationErrors && associationErrors.length > 0
    if (status === 'saved' && !hasAssocErr) {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
          <CheckCircle2 size={12} /> 저장 완료
        </span>
      )
    }
    if (status === 'saved' && hasAssocErr) {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle size={12} /> 일부 연결 실패
        </span>
      )
    }
    if (status === 'failed') {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
          <AlertTriangle size={12} /> 저장 실패
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
        대기 중
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg lg:text-2xl font-bold text-gray-900">미팅 기록 관리</h1>
          <p className="text-xs lg:text-sm text-gray-500 mt-0.5">
            음성 녹음으로 저장된 미팅 기록 {records.length}건
          </p>
        </div>
        <button
          onClick={fetchRecords}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm active:bg-primary-700 hover:bg-primary-700"
        >
          <RefreshCw size={16} />
          <span className="hidden sm:inline">새로고침</span>
        </button>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400">아직 기록된 미팅이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(record => (
            <div
              key={record.id}
              className="bg-white rounded-2xl border border-gray-200 p-4"
            >
              {/* 헤더: 요약 + 상태 */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm lg:text-base truncate">
                    {record.summary || '(요약 없음)'}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-gray-500">
                      {formatDate(record.created_at)}
                    </span>
                    {record.owner_name && (
                      <span className="text-xs text-gray-400">
                        · {record.owner_name}
                      </span>
                    )}
                    {record.is_new_meeting ? (
                      <span className="text-xs text-blue-500">새 미팅</span>
                    ) : (
                      <span className="text-xs text-gray-400">기존 미팅 업데이트</span>
                    )}
                  </div>
                </div>
                {statusBadge(record.hubspot_status, record.association_errors || [])}
              </div>

              {/* 연결된 객체 뱃지 */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(record.associations?.companies || []).map((c: any) => (
                  <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">
                    <Building2 size={11} /> {c.name}
                  </span>
                ))}
                {(record.associations?.deals || []).map((d: any) => (
                  <span key={d.id} className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-lg">
                    <Briefcase size={11} /> {d.name}
                  </span>
                ))}
                {(record.associations?.contacts || []).map((c: any) => (
                  <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg">
                    <User size={11} /> {c.name}
                  </span>
                ))}
              </div>

              {/* Association 에러 표시 */}
              {record.association_errors && record.association_errors.length > 0 && (
                <div className="bg-amber-50 rounded-lg px-3 py-2 mb-3 border border-amber-200">
                  <p className="text-xs text-amber-700 font-medium mb-1">연결 오류:</p>
                  {record.association_errors.map((err, i) => (
                    <p key={i} className="text-xs text-amber-600">· {err}</p>
                  ))}
                </div>
              )}

              {/* 하단: HubSpot 링크 + 삭제 */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                {record.hubspot_meeting_id ? (
                  <a
                    href={`https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-47/${record.hubspot_meeting_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                  >
                    <ExternalLink size={12} />
                    HubSpot에서 보기
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">HubSpot 미연결</span>
                )}

                <button
                  onClick={() => handleDelete(record.id)}
                  disabled={deletingId === record.id}
                  className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-all ${
                    confirmDeleteId === record.id
                      ? 'bg-red-600 text-white'
                      : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                  }`}
                >
                  {deletingId === record.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                  {confirmDeleteId === record.id ? '삭제 확인' : '삭제'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Search, X, Check,
  AlertCircle, Star, Clock, Users, Video, Phone,
  Briefcase, Save, Trash2, CheckCircle2
} from 'lucide-react'
import { api } from '../services/api'

const DRAFT_KEY = 'meeting-log-draft'

interface MeetingDraft {
  companyName: string
  companyId: string
  dealId: string
  dealName: string
  meetingType: 'in_person' | 'video' | 'phone' | ''
  outcome: 'positive' | 'neutral' | 'negative' | ''
  notes: string
  nextSteps: string
  isImportant: boolean
  needsFollowUp: boolean
  updatedAt: string
}

const emptyDraft: MeetingDraft = {
  companyName: '',
  companyId: '',
  dealId: '',
  dealName: '',
  meetingType: '',
  outcome: '',
  notes: '',
  nextSteps: '',
  isImportant: false,
  needsFollowUp: false,
  updatedAt: ''
}

interface SearchResult {
  companies: { id: string; name: string }[]
  deals: { id: string; name: string; companyName?: string }[]
}

export default function MeetingLogPage() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<MeetingDraft>(emptyDraft)
  const [hasSavedDraft, setHasSavedDraft] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY)
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft)
        if (parsed.companyName || parsed.notes || parsed.nextSteps) {
          setDraft(parsed)
          setHasSavedDraft(true)
        }
      } catch {
        // ignore parse errors
      }
    }
  }, [])

  // Auto-save draft on every change
  useEffect(() => {
    if (draft.companyName || draft.notes || draft.nextSteps) {
      const toSave = { ...draft, updatedAt: new Date().toISOString() }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(toSave))
    }
  }, [draft])

  // Debounced search for companies/deals
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (query.length < 2) {
      setSearchResults(null)
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await api.get(`/meetings/search?q=${encodeURIComponent(query)}`)
        setSearchResults(res.data)
      } catch {
        setSearchResults(null)
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [])

  const selectCompany = (id: string, name: string) => {
    setDraft(prev => ({ ...prev, companyId: id, companyName: name }))
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults(null)
  }

  const selectDeal = (id: string, name: string, companyName?: string) => {
    setDraft(prev => ({
      ...prev,
      dealId: id,
      dealName: name,
      companyName: companyName || prev.companyName
    }))
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults(null)
  }

  const updateDraft = (updates: Partial<MeetingDraft>) => {
    setDraft(prev => ({ ...prev, ...updates }))
  }

  const clearDraft = () => {
    setDraft(emptyDraft)
    localStorage.removeItem(DRAFT_KEY)
    setHasSavedDraft(false)
  }

  const handleSave = async () => {
    if (!draft.companyName && !draft.dealName) {
      setError('회사명 또는 거래를 선택해주세요')
      return
    }
    if (!draft.notes) {
      setError('미팅 내용을 입력해주세요')
      return
    }

    setSaving(true)
    setError('')

    try {
      await api.post('/meetings/log', {
        companyName: draft.companyName,
        companyId: draft.companyId || undefined,
        dealId: draft.dealId || undefined,
        meetingType: draft.meetingType || 'in_person',
        outcome: draft.outcome || 'neutral',
        notes: draft.notes,
        nextSteps: draft.nextSteps,
        isImportant: draft.isImportant,
        needsFollowUp: draft.needsFollowUp,
      })

      localStorage.removeItem(DRAFT_KEY)
      setSaved(true)

      setTimeout(() => {
        navigate('/')
      }, 2000)
    } catch (err: any) {
      setError(err.response?.data?.error || '저장 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  // Success state
  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={48} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">CRM 기록 완료!</h2>
        <p className="text-gray-500 text-center">
          미팅 기록이 HubSpot에 저장되었습니다.
          <br />잠시 후 타임라인으로 이동합니다.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">미팅 기록</h1>
        {hasSavedDraft && (
          <button
            onClick={clearDraft}
            className="flex items-center gap-1 text-sm text-red-500 active:text-red-700"
          >
            <Trash2 size={14} />
            초기화
          </button>
        )}
      </div>

      {/* Draft indicator */}
      {hasSavedDraft && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <Save size={14} />
          <span>임시저장된 기록이 있습니다</span>
          <span className="text-amber-500 text-xs ml-auto">
            {draft.updatedAt && new Date(draft.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}

      {/* Company/Deal Selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="text-sm font-semibold text-gray-700 mb-3 block">회사 / 거래</label>

        {draft.companyName || draft.dealName ? (
          <div className="space-y-2">
            {draft.companyName && (
              <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-blue-600" />
                  <span className="font-medium text-gray-900">{draft.companyName}</span>
                </div>
                <button onClick={() => updateDraft({ companyName: '', companyId: '' })} className="p-1.5 -mr-1">
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
            )}
            {draft.dealName && (
              <div className="flex items-center justify-between bg-purple-50 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Briefcase size={16} className="text-purple-600" />
                  <span className="font-medium text-gray-900">{draft.dealName}</span>
                </div>
                <button onClick={() => updateDraft({ dealId: '', dealName: '' })} className="p-1.5 -mr-1">
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
            )}
            <button
              onClick={() => setShowSearch(true)}
              className="text-sm text-primary-600 active:text-primary-700 font-medium"
            >
              + 변경하기
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 active:border-primary-300 active:text-primary-600 transition-colors"
          >
            <Search size={20} />
            <span>회사 또는 거래 검색</span>
          </button>
        )}

        {/* Search Bottom Sheet */}
        {showSearch && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center justify-center">
            <div className="bg-white w-full lg:max-w-md rounded-t-2xl lg:rounded-2xl max-h-[80vh] flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">회사/거래 검색</h3>
                  <button onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults(null) }} className="p-2 -mr-2">
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="회사명 또는 거래명 입력..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-base"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[200px]">
                {searching && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                  </div>
                )}

                {/* Manual entry option */}
                {searchQuery.length >= 2 && !searching && (
                  <button
                    onClick={() => selectCompany('', searchQuery)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl active:bg-gray-100 transition-colors text-left"
                  >
                    <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building2 size={16} className="text-gray-500" />
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">"{searchQuery}" 직접 입력</span>
                      <span className="text-xs text-gray-500 block">CRM에 등록되지 않은 회사</span>
                    </div>
                  </button>
                )}

                {searchResults?.companies && searchResults.companies.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">회사</h4>
                    {searchResults.companies.map(c => (
                      <button
                        key={c.id}
                        onClick={() => selectCompany(c.id, c.name)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl active:bg-blue-50 transition-colors text-left"
                      >
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 size={16} className="text-blue-600" />
                        </div>
                        <span className="font-medium text-gray-900">{c.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults?.deals && searchResults.deals.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">거래</h4>
                    {searchResults.deals.map(d => (
                      <button
                        key={d.id}
                        onClick={() => selectDeal(d.id, d.name, d.companyName)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl active:bg-purple-50 transition-colors text-left"
                      >
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Briefcase size={16} className="text-purple-600" />
                        </div>
                        <div>
                          <span className="font-medium text-gray-900 block">{d.name}</span>
                          {d.companyName && (
                            <span className="text-xs text-gray-500">{d.companyName}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 && !searching &&
                  (!searchResults?.companies?.length && !searchResults?.deals?.length) && (
                    <p className="text-center text-gray-400 py-4 text-sm">
                      검색 결과가 없습니다
                    </p>
                  )}

                {searchQuery.length < 2 && !searching && (
                  <p className="text-center text-gray-400 py-8 text-sm">
                    2글자 이상 입력하세요
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Meeting Type */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="text-sm font-semibold text-gray-700 mb-3 block">미팅 유형</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'in_person' as const, label: '대면', icon: Users },
            { value: 'video' as const, label: '화상', icon: Video },
            { value: 'phone' as const, label: '전화', icon: Phone },
          ].map(type => (
            <button
              key={type.value}
              onClick={() => updateDraft({ meetingType: type.value })}
              className={`flex flex-col items-center gap-1.5 py-3.5 rounded-xl border-2 transition-all ${
                draft.meetingType === type.value
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-500 active:border-gray-300'
              }`}
            >
              <type.icon size={22} />
              <span className="text-sm font-medium">{type.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Meeting Outcome */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="text-sm font-semibold text-gray-700 mb-3 block">미팅 결과</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'positive' as const, label: '긍정적', activeClasses: 'border-green-500 bg-green-50 text-green-700' },
            { value: 'neutral' as const, label: '보통', activeClasses: 'border-yellow-500 bg-yellow-50 text-yellow-700' },
            { value: 'negative' as const, label: '부정적', activeClasses: 'border-red-500 bg-red-50 text-red-700' },
          ].map(o => (
            <button
              key={o.value}
              onClick={() => updateDraft({ outcome: o.value })}
              className={`py-3.5 rounded-xl border-2 font-medium text-sm transition-all ${
                draft.outcome === o.value
                  ? o.activeClasses
                  : 'border-gray-200 text-gray-500 active:border-gray-300'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="text-sm font-semibold text-gray-700 mb-3 block">
          미팅 내용 <span className="text-red-400">*</span>
        </label>
        <textarea
          value={draft.notes}
          onChange={(e) => updateDraft({ notes: e.target.value })}
          placeholder="주요 논의 사항, 고객 반응, 의사결정 내용 등..."
          rows={4}
          className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-base resize-none"
        />
      </div>

      {/* Next Steps */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="text-sm font-semibold text-gray-700 mb-3 block">후속 조치</label>
        <textarea
          value={draft.nextSteps}
          onChange={(e) => updateDraft({ nextSteps: e.target.value })}
          placeholder="다음 단계, 후속 미팅 일정, 전달할 자료 등..."
          rows={3}
          className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-base resize-none"
        />
      </div>

      {/* Flags */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <button
          onClick={() => updateDraft({ isImportant: !draft.isImportant })}
          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all ${
            draft.isImportant
              ? 'border-amber-400 bg-amber-50'
              : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <Star size={20} className={draft.isImportant ? 'text-amber-500 fill-amber-500' : 'text-gray-400'} />
            <span className={`font-medium ${draft.isImportant ? 'text-amber-700' : 'text-gray-600'}`}>
              중요 미팅
            </span>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors relative ${draft.isImportant ? 'bg-amber-500' : 'bg-gray-300'}`}>
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${draft.isImportant ? 'left-[22px]' : 'left-0.5'}`} />
          </div>
        </button>

        <button
          onClick={() => updateDraft({ needsFollowUp: !draft.needsFollowUp })}
          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all ${
            draft.needsFollowUp
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <Clock size={20} className={draft.needsFollowUp ? 'text-blue-500' : 'text-gray-400'} />
            <span className={`font-medium ${draft.needsFollowUp ? 'text-blue-700' : 'text-gray-600'}`}>
              후속조치 필요
            </span>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors relative ${draft.needsFollowUp ? 'bg-blue-500' : 'bg-gray-300'}`}>
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${draft.needsFollowUp ? 'left-[22px]' : 'left-0.5'}`} />
          </div>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-4 bg-primary-600 text-white font-bold text-lg rounded-xl active:bg-primary-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2 shadow-lg"
      >
        {saving ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            저장 중...
          </>
        ) : (
          <>
            <Check size={22} />
            HubSpot에 저장
          </>
        )}
      </button>

      {/* Auto-save indicator */}
      <p className="text-center text-xs text-gray-400 pb-8">
        변경사항은 자동으로 임시저장됩니다
      </p>
    </div>
  )
}

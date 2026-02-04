import { useState } from 'react'
import { ChevronLeft, Building2, Briefcase, User, Clock, MapPin, Plus, X } from 'lucide-react'
import AssociationSearch from './AssociationSearch'

interface Association {
  companies: { id: string; name: string }[]
  contacts: { id: string; name: string }[]
  deals: { id: string; name: string }[]
}

interface Props {
  meeting: {
    id: string
    title: string
    startTime: string
    endTime?: string
    location?: string
  }
  associations: Association
  onConfirm: (updatedAssociations: Association) => void
  onBack: () => void
}

export default function MeetingDetailStep({ meeting, associations, onConfirm, onBack }: Props) {
  const [localAssoc, setLocalAssoc] = useState<Association>({
    companies: [...associations.companies],
    contacts: [...associations.contacts],
    deals: [...associations.deals],
  })
  const [showSearch, setShowSearch] = useState(false)

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

  const existingIds = new Set([
    ...localAssoc.companies.map(c => c.id),
    ...localAssoc.contacts.map(c => c.id),
    ...localAssoc.deals.map(d => d.id),
  ])

  const handleAdd = (type: 'company' | 'contact' | 'deal', item: { id: string; name: string }) => {
    setLocalAssoc(prev => {
      if (type === 'company' && !prev.companies.find(c => c.id === item.id)) {
        return { ...prev, companies: [...prev.companies, item] }
      }
      if (type === 'contact' && !prev.contacts.find(c => c.id === item.id)) {
        return { ...prev, contacts: [...prev.contacts, item] }
      }
      if (type === 'deal' && !prev.deals.find(d => d.id === item.id)) {
        return { ...prev, deals: [...prev.deals, item] }
      }
      return prev
    })
  }

  const handleRemove = (type: 'company' | 'contact' | 'deal', id: string) => {
    setLocalAssoc(prev => {
      if (type === 'company') return { ...prev, companies: prev.companies.filter(c => c.id !== id) }
      if (type === 'contact') return { ...prev, contacts: prev.contacts.filter(c => c.id !== id) }
      if (type === 'deal') return { ...prev, deals: prev.deals.filter(d => d.id !== id) }
      return prev
    })
  }

  // Check if an item was from the original meeting (not manually added)
  const isOriginal = (type: 'company' | 'contact' | 'deal', id: string) => {
    if (type === 'company') return associations.companies.some(c => c.id === id)
    if (type === 'contact') return associations.contacts.some(c => c.id === id)
    if (type === 'deal') return associations.deals.some(d => d.id === id)
    return false
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
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-500">연결된 정보</h3>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="flex items-center gap-1 text-xs text-primary-600 font-medium px-2 py-1 rounded-lg hover:bg-primary-50"
          >
            <Plus size={14} />
            수동 추가
          </button>
        </div>

        <div className="space-y-2">
          {localAssoc.companies.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 bg-blue-50 rounded-xl">
              <Building2 size={18} className="text-blue-600 flex-shrink-0" />
              <span className="font-medium text-gray-900 flex-1 truncate">{c.name}</span>
              {!isOriginal('company', c.id) && (
                <button onClick={() => handleRemove('company', c.id)} className="p-1 rounded-lg hover:bg-blue-100">
                  <X size={14} className="text-gray-400" />
                </button>
              )}
            </div>
          ))}

          {localAssoc.deals.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-3 py-2.5 bg-purple-50 rounded-xl">
              <Briefcase size={18} className="text-purple-600 flex-shrink-0" />
              <span className="font-medium text-gray-900 flex-1 truncate">{d.name}</span>
              {!isOriginal('deal', d.id) && (
                <button onClick={() => handleRemove('deal', d.id)} className="p-1 rounded-lg hover:bg-purple-100">
                  <X size={14} className="text-gray-400" />
                </button>
              )}
            </div>
          ))}

          {localAssoc.contacts.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 bg-green-50 rounded-xl">
              <User size={18} className="text-green-600 flex-shrink-0" />
              <span className="font-medium text-gray-900 flex-1 truncate">{c.name}</span>
              {!isOriginal('contact', c.id) && (
                <button onClick={() => handleRemove('contact', c.id)} className="p-1 rounded-lg hover:bg-green-100">
                  <X size={14} className="text-gray-400" />
                </button>
              )}
            </div>
          ))}

          {localAssoc.companies.length === 0 && localAssoc.deals.length === 0 && localAssoc.contacts.length === 0 && (
            <div className="text-center py-3 text-sm text-gray-400">
              연결된 정보가 없습니다
            </div>
          )}
        </div>

        {/* 수동 검색 */}
        {showSearch && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <AssociationSearch existingIds={existingIds} onAdd={handleAdd} />
          </div>
        )}
      </div>

      {/* 녹음 진행 버튼 */}
      <button
        onClick={() => onConfirm(localAssoc)}
        className="w-full py-4 bg-primary-600 text-white font-bold text-lg rounded-2xl hover:bg-primary-700 active:bg-primary-800 transition-colors shadow-lg"
      >
        녹음 시작하기
      </button>
    </div>
  )
}

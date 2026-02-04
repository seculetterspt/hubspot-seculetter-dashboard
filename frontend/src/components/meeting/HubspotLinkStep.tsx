import { useEffect, useState } from 'react'
import { ChevronLeft, Loader2, Building2, Briefcase, User, Check, Link, Plus } from 'lucide-react'
import { api } from '../../services/api'
import AssociationSearch from './AssociationSearch'

interface Association {
  companies: { id: string; name: string }[]
  contacts: { id: string; name: string }[]
  deals: { id: string; name: string }[]
}

interface Recommendation {
  type: 'company' | 'deal' | 'contact'
  id: string
  name: string
  reason: string
  accepted?: boolean
}

interface Props {
  structuredContent: any
  existingAssociations: Association
  onConfirm: (finalAssociations: Association) => void
  onBack: () => void
}

export default function HubspotLinkStep({ structuredContent, existingAssociations, onConfirm, onBack }: Props) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [manualItems, setManualItems] = useState<Association>({
    companies: [], contacts: [], deals: [],
  })
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const res = await api.post('/meetings/recommend', {
          structuredContent,
          existingAssociations,
        })
        setRecommendations(
          (res.data.recommendations || []).map((r: any) => ({ ...r, accepted: false }))
        )
      } catch {
        // 추천 실패 시 빈 상태 유지
      } finally {
        setLoading(false)
      }
    }
    fetchRecommendations()
  }, [structuredContent, existingAssociations])

  const toggleRecommendation = (index: number) => {
    setRecommendations(prev =>
      prev.map((r, i) => i === index ? { ...r, accepted: !r.accepted } : r)
    )
  }

  // All IDs already in use (existing + accepted recommendations + manual)
  const allExistingIds = new Set([
    ...existingAssociations.companies.map(c => c.id),
    ...existingAssociations.contacts.map(c => c.id),
    ...existingAssociations.deals.map(d => d.id),
    ...recommendations.filter(r => r.accepted).map(r => r.id),
    ...manualItems.companies.map(c => c.id),
    ...manualItems.contacts.map(c => c.id),
    ...manualItems.deals.map(d => d.id),
  ])

  const handleManualAdd = (type: 'company' | 'contact' | 'deal', item: { id: string; name: string }) => {
    // Skip if already in existing or recommendations
    if (allExistingIds.has(item.id)) return

    setManualItems(prev => {
      if (type === 'company') return { ...prev, companies: [...prev.companies, item] }
      if (type === 'contact') return { ...prev, contacts: [...prev.contacts, item] }
      if (type === 'deal') return { ...prev, deals: [...prev.deals, item] }
      return prev
    })
  }

  const handleRemoveManual = (type: 'company' | 'contact' | 'deal', id: string) => {
    setManualItems(prev => {
      if (type === 'company') return { ...prev, companies: prev.companies.filter(c => c.id !== id) }
      if (type === 'contact') return { ...prev, contacts: prev.contacts.filter(c => c.id !== id) }
      if (type === 'deal') return { ...prev, deals: prev.deals.filter(d => d.id !== id) }
      return prev
    })
  }

  const handleConfirm = () => {
    const final: Association = {
      companies: [...existingAssociations.companies],
      contacts: [...existingAssociations.contacts],
      deals: [...existingAssociations.deals],
    }

    // Add accepted AI recommendations
    recommendations.filter(r => r.accepted).forEach(r => {
      if (r.type === 'company' && !final.companies.find(c => c.id === r.id)) {
        final.companies.push({ id: r.id, name: r.name })
      }
      if (r.type === 'deal' && !final.deals.find(d => d.id === r.id)) {
        final.deals.push({ id: r.id, name: r.name })
      }
      if (r.type === 'contact' && !final.contacts.find(c => c.id === r.id)) {
        final.contacts.push({ id: r.id, name: r.name })
      }
    })

    // Add manually added items
    manualItems.companies.forEach(c => {
      if (!final.companies.find(e => e.id === c.id)) final.companies.push(c)
    })
    manualItems.contacts.forEach(c => {
      if (!final.contacts.find(e => e.id === c.id)) final.contacts.push(c)
    })
    manualItems.deals.forEach(d => {
      if (!final.deals.find(e => e.id === d.id)) final.deals.push(d)
    })

    onConfirm(final)
  }

  const iconForType = (type: string) => {
    switch (type) {
      case 'company': return <Building2 size={18} className="text-blue-600" />
      case 'deal': return <Briefcase size={18} className="text-purple-600" />
      case 'contact': return <User size={18} className="text-green-600" />
      default: return <Link size={18} className="text-gray-600" />
    }
  }

  const bgForType = (type: string) => {
    switch (type) {
      case 'company': return 'bg-blue-50'
      case 'deal': return 'bg-purple-50'
      case 'contact': return 'bg-green-50'
      default: return 'bg-gray-50'
    }
  }

  const hasExisting = existingAssociations.companies.length > 0
    || existingAssociations.deals.length > 0
    || existingAssociations.contacts.length > 0

  const hasManual = manualItems.companies.length > 0
    || manualItems.contacts.length > 0
    || manualItems.deals.length > 0

  // Group recommendations by type
  const companyRecs = recommendations.filter(r => r.type === 'company')
  const contactRecs = recommendations.filter(r => r.type === 'contact')
  const dealRecs = recommendations.filter(r => r.type === 'deal')

  const renderRecommendationGroup = (
    title: string,
    icon: React.ReactNode,
    recs: Recommendation[],
  ) => {
    if (recs.length === 0) return null
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2 px-1">
          {icon}
          <span className="text-xs font-semibold text-gray-500">{title}</span>
        </div>
        <div className="space-y-2">
          {recs.map((rec) => {
            const globalIndex = recommendations.indexOf(rec)
            return (
              <div
                key={globalIndex}
                className={`bg-white rounded-2xl border-2 p-4 transition-all ${
                  rec.accepted ? 'border-primary-400 bg-primary-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3 mb-1">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bgForType(rec.type)}`}>
                    {iconForType(rec.type)}
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">{rec.name}</span>
                    <p className="text-xs text-gray-500">{rec.reason}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 ml-12">
                  <button
                    onClick={() => {
                      setRecommendations(prev =>
                        prev.map((r, idx) => idx === globalIndex ? { ...r, accepted: true } : r)
                      )
                    }}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                      rec.accepted
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    추가
                  </button>
                  <button
                    onClick={() => toggleRecommendation(globalIndex)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                      !rec.accepted
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    건너뛰기
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6 pt-2">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ChevronLeft size={24} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">HubSpot 연결</h1>
      </div>

      {/* 기존 연결 */}
      {hasExisting && (
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-gray-500 mb-2 px-1">기존 연결</h3>
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {existingAssociations.companies.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <Building2 size={18} className="text-blue-600" />
                <span className="font-medium text-gray-900 flex-1">{c.name}</span>
                <Check size={18} className="text-green-500" />
              </div>
            ))}
            {existingAssociations.deals.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                <Briefcase size={18} className="text-purple-600" />
                <span className="font-medium text-gray-900 flex-1">{d.name}</span>
                <Check size={18} className="text-green-500" />
              </div>
            ))}
            {existingAssociations.contacts.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <User size={18} className="text-green-600" />
                <span className="font-medium text-gray-900 flex-1">{c.name}</span>
                <Check size={18} className="text-green-500" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI 추천 - grouped by type */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-primary-600 mr-3" />
          <span className="text-gray-500">AI가 연결을 분석 중...</span>
        </div>
      ) : recommendations.length > 0 ? (
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-gray-500 mb-3 px-1">AI 추천 연결</h3>
          {renderRecommendationGroup('회사', <Building2 size={14} className="text-blue-500" />, companyRecs)}
          {renderRecommendationGroup('연락처', <User size={14} className="text-green-500" />, contactRecs)}
          {renderRecommendationGroup('거래', <Briefcase size={14} className="text-purple-500" />, dealRecs)}
        </div>
      ) : (
        <div className="text-center py-6 mb-5">
          <p className="text-gray-400 text-sm">추가 연결 추천이 없습니다</p>
        </div>
      )}

      {/* 수동 추가된 항목 */}
      {hasManual && (
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-gray-500 mb-2 px-1">수동 추가</h3>
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {manualItems.companies.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <Building2 size={18} className="text-blue-600" />
                <span className="font-medium text-gray-900 flex-1">{c.name}</span>
                <button onClick={() => handleRemoveManual('company', c.id)} className="text-gray-400 hover:text-red-500">
                  <Plus size={18} className="rotate-45" />
                </button>
              </div>
            ))}
            {manualItems.contacts.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <User size={18} className="text-green-600" />
                <span className="font-medium text-gray-900 flex-1">{c.name}</span>
                <button onClick={() => handleRemoveManual('contact', c.id)} className="text-gray-400 hover:text-red-500">
                  <Plus size={18} className="rotate-45" />
                </button>
              </div>
            ))}
            {manualItems.deals.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                <Briefcase size={18} className="text-purple-600" />
                <span className="font-medium text-gray-900 flex-1">{d.name}</span>
                <button onClick={() => handleRemoveManual('deal', d.id)} className="text-gray-400 hover:text-red-500">
                  <Plus size={18} className="rotate-45" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 수동 검색 */}
      <div className="mb-6">
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="flex items-center gap-1.5 text-sm text-primary-600 font-medium px-1 mb-2"
        >
          <Plus size={16} />
          수동으로 연결 추가
        </button>
        {showSearch && (
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
            <AssociationSearch existingIds={allExistingIds} onAdd={handleManualAdd} />
          </div>
        )}
      </div>

      <button
        onClick={handleConfirm}
        className="w-full py-4 bg-primary-600 text-white font-bold text-lg rounded-2xl hover:bg-primary-700 active:bg-primary-800 transition-colors shadow-lg"
      >
        다음
      </button>
    </div>
  )
}

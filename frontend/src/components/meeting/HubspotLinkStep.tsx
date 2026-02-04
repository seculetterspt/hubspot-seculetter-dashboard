import { useEffect, useState } from 'react'
import { ChevronLeft, Loader2, Building2, Briefcase, User, Check, X, Link } from 'lucide-react'
import { api } from '../../services/api'

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

  const handleConfirm = () => {
    const final: Association = {
      companies: [...existingAssociations.companies],
      contacts: [...existingAssociations.contacts],
      deals: [...existingAssociations.deals],
    }

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

      {/* AI 추천 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-primary-600 mr-3" />
          <span className="text-gray-500">AI가 추가 연결을 분석 중...</span>
        </div>
      ) : recommendations.length > 0 ? (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-2 px-1">AI 추천 연결</h3>
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <div
                key={i}
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
                        prev.map((r, idx) => idx === i ? { ...r, accepted: true } : r)
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
                    onClick={() => toggleRecommendation(i)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                      !rec.accepted && rec.accepted !== undefined
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    건너뛰기
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 mb-6">
          <p className="text-gray-400 text-sm">추가 연결 추천이 없습니다</p>
        </div>
      )}

      <button
        onClick={handleConfirm}
        className="w-full py-4 bg-primary-600 text-white font-bold text-lg rounded-2xl hover:bg-primary-700 active:bg-primary-800 transition-colors shadow-lg"
      >
        다음
      </button>
    </div>
  )
}

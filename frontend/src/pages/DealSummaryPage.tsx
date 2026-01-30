import { useEffect, useState } from 'react'
import { RefreshCw, ExternalLink, ChevronLeft, ChevronRight, TrendingUp, DollarSign, Target, Calendar, User } from 'lucide-react'
import { analyticsApi } from '../services/api'

// HubSpot Portal ID
const HUBSPOT_PORTAL_ID = '243367573'

// HubSpot URL 생성 함수
const getHubspotDealUrl = (dealId: string) => {
  return `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/deal/${dealId}`
}

interface Deal {
  id: string
  name: string
  amount: number
  weightedAmount: number
  closeDate: string | null
  createDate: string
  lastModified: string
  ownerId: string | null
  ownerName: string
  probability: number
}

interface Stage {
  id: string
  label: string
  displayOrder: number
  probability: number
  deals: Deal[]
  totalAmount: number
  weightedAmount: number
  count: number
}

interface Pipeline {
  id: string
  label: string
  stages: Stage[]
  totals: {
    totalAmount: number
    weightedAmount: number
    totalCount: number
    closedWonAmount: number
    openAmount: number
  }
}

interface DealSummaryData {
  year: number
  pipelines: Pipeline[]
  summary: {
    totalPipelines: number
    totalDeals: number
    totalAmount: number
    totalWeightedAmount: number
  }
}

// 금액 포맷 함수 (억/만원 단위)
const formatAmount = (amount: number): string => {
  if (amount >= 100000000) {
    const billions = amount / 100000000
    return `${billions.toFixed(2)}억`
  } else if (amount >= 10000) {
    const thousands = amount / 10000
    return `${thousands.toFixed(0)}만`
  }
  return `${amount.toLocaleString()}원`
}

// 날짜 포맷 함수
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

// 스테이지 색상 매핑
const getStageColor = (probability: number): string => {
  if (probability === 0) return 'bg-gray-100 border-gray-300'
  if (probability < 30) return 'bg-cyan-50 border-cyan-300'
  if (probability < 50) return 'bg-blue-50 border-blue-300'
  if (probability < 80) return 'bg-indigo-50 border-indigo-300'
  if (probability < 100) return 'bg-purple-50 border-purple-300'
  return 'bg-green-50 border-green-300'
}

const getStageHeaderColor = (probability: number): string => {
  if (probability === 0) return 'bg-gray-200 text-gray-700'
  if (probability < 30) return 'bg-cyan-100 text-cyan-800'
  if (probability < 50) return 'bg-blue-100 text-blue-800'
  if (probability < 80) return 'bg-indigo-100 text-indigo-800'
  if (probability < 100) return 'bg-purple-100 text-purple-800'
  return 'bg-green-100 text-green-800'
}

export default function DealSummaryPage() {
  const [data, setData] = useState<DealSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await analyticsApi.getDealSummary(selectedYear)
      setData(res.data)
      // 첫 번째 파이프라인 자동 선택
      if (res.data.pipelines.length > 0 && !selectedPipeline) {
        setSelectedPipeline(res.data.pipelines[0].id)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedYear])

  const currentPipeline = data?.pipelines.find(p => p.id === selectedPipeline)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">딜 요약</h1>
          <p className="text-gray-500 mt-1">
            파이프라인별 스테이지 현황
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* 연도 선택 */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <button
              onClick={() => setSelectedYear(prev => prev - 1)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="font-semibold text-gray-900 min-w-[60px] text-center">
              {selectedYear}년
            </span>
            <button
              onClick={() => setSelectedYear(prev => prev + 1)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <RefreshCw size={18} />
            새로고침
          </button>
        </div>
      </div>

      {/* 파이프라인 탭 */}
      {data && data.pipelines.length > 1 && (
        <div className="flex gap-2 border-b border-gray-200 pb-2">
          {data.pipelines.map(pipeline => (
            <button
              key={pipeline.id}
              onClick={() => setSelectedPipeline(pipeline.id)}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                selectedPipeline === pipeline.id
                  ? 'bg-primary-100 text-primary-700 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {pipeline.label}
            </button>
          ))}
        </div>
      )}

      {/* 요약 카드 */}
      {currentPipeline && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <DollarSign size={16} />
              <span className="text-sm">총 거래 금액</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              ₩{formatAmount(currentPipeline.totals.totalAmount)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <TrendingUp size={16} />
              <span className="text-sm">가중치 적용 금액</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              ₩{formatAmount(currentPipeline.totals.weightedAmount)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Target size={16} />
              <span className="text-sm">미결 거래 금액</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">
              ₩{formatAmount(currentPipeline.totals.openAmount)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <DollarSign size={16} className="text-green-500" />
              <span className="text-sm">성사된 거래 금액</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              ₩{formatAmount(currentPipeline.totals.closedWonAmount)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Calendar size={16} />
              <span className="text-sm">총 거래 수</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {currentPipeline.totals.totalCount}건
            </p>
          </div>
        </div>
      )}

      {/* 칸반 보드 */}
      {currentPipeline && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {currentPipeline.stages.map(stage => (
              <div
                key={stage.id}
                className={`w-72 flex-shrink-0 rounded-xl border-2 ${getStageColor(stage.probability)}`}
              >
                {/* 스테이지 헤더 */}
                <div className={`p-3 rounded-t-lg ${getStageHeaderColor(stage.probability)}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold truncate">{stage.label}</h3>
                    <span className="text-sm font-medium bg-white/50 px-2 py-0.5 rounded">
                      {stage.count}
                    </span>
                  </div>
                </div>

                {/* 스테이지 요약 */}
                <div className="px-3 py-2 border-b border-gray-200 bg-white/50 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>총 금액</span>
                    <span className="font-medium">₩{formatAmount(stage.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>가중치 금액 ({stage.probability}%)</span>
                    <span className="font-medium">₩{formatAmount(stage.weightedAmount)}</span>
                  </div>
                </div>

                {/* 딜 목록 */}
                <div className="p-2 space-y-2 max-h-[500px] overflow-y-auto">
                  {stage.deals.map(deal => (
                    <div
                      key={deal.id}
                      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* 딜 이름 */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <a
                          href={getHubspotDealUrl(deal.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-gray-900 hover:text-blue-600 flex items-center gap-1 line-clamp-2"
                        >
                          {deal.name}
                          <ExternalLink size={12} className="flex-shrink-0 text-gray-400" />
                        </a>
                      </div>

                      {/* 금액 */}
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-500">금액</span>
                        <span className="font-semibold text-gray-900">
                          ₩{deal.amount ? formatAmount(deal.amount) : '-'}
                        </span>
                      </div>

                      {/* 예상 성사 날짜 */}
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-500">거래 성사 날짜</span>
                        <span className="text-gray-700">{formatDate(deal.closeDate)}</span>
                      </div>

                      {/* 담당자 */}
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <User size={12} />
                        <span>{deal.ownerName}</span>
                      </div>

                      {/* 생성일 */}
                      <div className="text-xs text-gray-400 mt-2">
                        생성 날짜: {formatDate(deal.createDate)}
                      </div>
                    </div>
                  ))}

                  {stage.deals.length === 0 && (
                    <div className="text-center text-gray-400 py-8 text-sm">
                      거래 없음
                    </div>
                  )}
                </div>

                {/* 스테이지 푸터 */}
                <div className="px-3 py-2 border-t border-gray-200 bg-white/30 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>₩{formatAmount(stage.totalAmount)} | 총 금액</span>
                  </div>
                  <div className="flex justify-between text-gray-500 mt-1">
                    <span>₩{formatAmount(stage.weightedAmount)} | 가중치 금액</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 데이터 없음 */}
      {(!data || data.pipelines.length === 0) && (
        <div className="text-center text-gray-500 py-12 bg-white rounded-xl border border-gray-200">
          <Target size={48} className="mx-auto mb-4 opacity-50" />
          <p>거래 데이터가 없습니다</p>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { RefreshCw, ExternalLink, ChevronLeft, ChevronRight, TrendingUp, DollarSign, Target, Calendar, User, Sparkles, Building2, Phone, FileText, Mail, ArrowUpRight, ArrowUp, ArrowDown } from 'lucide-react'
import { analyticsApi, snapshotApi } from '../services/api'

// HubSpot Portal ID
const HUBSPOT_PORTAL_ID = '243367573'

// HubSpot URL 생성 함수
const getHubspotDealUrl = (dealId: string) => {
  return `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/deal/${dealId}`
}

// 목표 달성률 계산 (파이프라인 라벨 기반)
const getTargetProgress = (pipelineLabel: string, currentAmount: number): { target: number; progress: number; label: string } => {
  // 파이프라인 라벨에 "Renewal"이 포함되면 5억, 아니면 10억
  const isRenewal = pipelineLabel.toLowerCase().includes('renewal')
  const target = isRenewal ? 500000000 : 1000000000
  const label = isRenewal ? '5억' : '10억'
  const progress = Math.min((currentAmount / target) * 100, 100)
  return { target, progress, label }
}

interface DealChange {
  type: 'stage' | 'amount'
  previousValue: string
  currentValue: string
  changedAt: string
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
  recentChanges?: DealChange[]
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

interface RecentActivity {
  type: 'call' | 'note' | 'meeting' | 'email'
  title: string
  date: string
}

interface DealRecentActivity {
  dealId: string
  dealName: string
  companyName: string
  stageName: string
  amount: number
  activityCount: number
  latestActivityDate: string
  aiSummary: string
  activities: RecentActivity[]
}

interface DealRecentActivitiesData {
  dateRange: { from: string; to: string }
  totalDeals: number
  deals: DealRecentActivity[]
}

// 주간 비교 데이터
interface WeeklyChanges {
  totalAmount: number
  weightedAmount: number
  openAmount: number
  closedWonAmount: number
  totalCount: number
}

interface WeeklyComparison {
  current: {
    totalAmount: number
    weightedAmount: number
    openAmount: number
    closedWonAmount: number
    totalCount: number
  }
  previous: {
    totalAmount: number
    weightedAmount: number
    openAmount: number
    closedWonAmount: number
    totalCount: number
  } | null
  previousSnapshotDate: string | null
  changes: WeeklyChanges | null
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

// 변경 금액 포맷 (부호 포함)
const formatChange = (change: number): { text: string; isPositive: boolean } => {
  const absAmount = Math.abs(change)
  let text = ''
  if (absAmount >= 100000000) {
    text = `${(absAmount / 100000000).toFixed(2)}억`
  } else if (absAmount >= 10000) {
    text = `${(absAmount / 10000).toFixed(0)}만`
  } else {
    text = `${absAmount.toLocaleString()}원`
  }
  return {
    text: change >= 0 ? `+${text}` : `-${text}`,
    isPositive: change >= 0
  }
}

// 변경 건수 포맷 (부호 포함)
const formatCountChange = (change: number): { text: string; isPositive: boolean } => {
  return {
    text: change >= 0 ? `+${change}건` : `${change}건`,
    isPositive: change >= 0
  }
}

// 스냅샷 날짜 포맷 (M/D 기준)
const formatSnapshotDate = (dateStr: string | null): string => {
  if (!dateStr) return '전주 대비'
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()} 기준`
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

// 최근 변경 여부 확인 (7일 이내)
const isRecentlyModified = (lastModified: string): boolean => {
  if (!lastModified) return false
  const modifiedDate = new Date(lastModified)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  return modifiedDate >= sevenDaysAgo
}

export default function DealSummaryPage() {
  const [data, setData] = useState<DealSummaryData | null>(null)
  const [recentActivities, setRecentActivities] = useState<DealRecentActivitiesData | null>(null)
  const [weeklyComparison, setWeeklyComparison] = useState<WeeklyComparison | null>(null)
  const [loading, setLoading] = useState(true)
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null)

  // 주간 비교 데이터 조회
  const fetchWeeklyComparison = async (pipelineId: string) => {
    try {
      const res = await snapshotApi.getComparison(pipelineId, selectedYear)
      if (res.data.success) {
        setWeeklyComparison(res.data.data)
      }
    } catch (error) {
      console.error('Error fetching weekly comparison:', error)
      setWeeklyComparison(null)
    }
  }

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

  const fetchRecentActivities = async (pipelineId?: string) => {
    setActivitiesLoading(true)
    try {
      // 2주 전/후 날짜 계산
      const now = new Date()
      const from = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000))
      const to = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000))

      console.log('[DealSummary] Fetching with params:', {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
        year: selectedYear,
        pipelineId: pipelineId
      })

      const res = await analyticsApi.getActivityTimelineWithDeals({
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
        year: selectedYear,
        pipelineId: pipelineId,
        includeAssociations: true,
        groupByDeals: true,
        generateSummaries: true
      })

      console.log('[DealSummary] API Response:', res.data)
      console.log('[DealSummary] dealActivities:', res.data.dealActivities)

      // dealActivities 필드에서 데이터 추출
      if (res.data.dealActivities) {
        setRecentActivities({
          dateRange: res.data.dateRange,
          totalDeals: res.data.dealActivities.totalDeals,
          deals: res.data.dealActivities.deals
        })
      } else {
        console.log('[DealSummary] No dealActivities in response')
        setRecentActivities({
          dateRange: res.data.dateRange,
          totalDeals: 0,
          deals: []
        })
      }
    } catch (error) {
      console.error('[DealSummary] Error fetching recent activities:', error)
    } finally {
      setActivitiesLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedYear])

  useEffect(() => {
    if (selectedPipeline) {
      // 파이프라인 변경 시 기존 활동 데이터 초기화 (로딩 표시)
      setRecentActivities(null)
      fetchRecentActivities(selectedPipeline)
      // 주간 비교 데이터 조회
      fetchWeeklyComparison(selectedPipeline)
    }
  }, [selectedPipeline, selectedYear])

  const currentPipeline = data?.pipelines.find(p => p.id === selectedPipeline)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">딜 요약</h1>
          <p className="text-gray-500 text-sm mt-1">
            파이프라인별 스테이지 현황
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {/* 연도 선택 */}
          <div className="flex items-center gap-1 sm:gap-2 bg-white border border-gray-200 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2">
            <button
              onClick={() => setSelectedYear(prev => prev - 1)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-semibold text-gray-900 min-w-[50px] text-center text-sm sm:text-base">
              {selectedYear}년
            </span>
            <button
              onClick={() => setSelectedYear(prev => prev + 1)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm sm:text-base"
          >
            <RefreshCw size={16} />
            <span className="hidden sm:inline">새로고침</span>
          </button>
        </div>
      </div>

      {/* 파이프라인 탭 */}
      {data && data.pipelines.length > 1 && (
        <div className="flex gap-1 sm:gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
          {data.pipelines.map(pipeline => (
            <button
              key={pipeline.id}
              onClick={() => setSelectedPipeline(pipeline.id)}
              className={`px-3 sm:px-4 py-2 rounded-t-lg font-medium transition-colors text-sm sm:text-base whitespace-nowrap ${
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

      {/* 목표액 및 요약 카드 */}
      {currentPipeline && (() => {
        const targetInfo = getTargetProgress(currentPipeline.label, currentPipeline.totals.closedWonAmount)
        return (
          <>
            {/* 목표 달성률 */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 md:p-6 text-white">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <div>
                  <h3 className="text-sm md:text-lg font-semibold opacity-90">목표 달성률</h3>
                  <p className="text-2xl md:text-3xl font-bold mt-1">
                    {targetInfo.progress.toFixed(1)}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs md:text-sm opacity-75">목표</p>
                  <p className="text-xl md:text-2xl font-bold">₩{targetInfo.label}</p>
                </div>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2 md:h-3">
                <div
                  className="bg-white rounded-full h-2 md:h-3 transition-all duration-500"
                  style={{ width: `${targetInfo.progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs md:text-sm opacity-75">
                <span>성사: ₩{formatAmount(currentPipeline.totals.closedWonAmount)}</span>
                <span>남은: ₩{formatAmount(Math.max(0, targetInfo.target - currentPipeline.totals.closedWonAmount))}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4">
                <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                  <DollarSign size={14} />
                  <span className="text-xs md:text-sm">총 거래 금액</span>
                </div>
                <p className="text-lg md:text-2xl font-bold text-gray-900">
                  ₩{formatAmount(currentPipeline.totals.totalAmount)}
                </p>
                {weeklyComparison?.changes && (
                  <div className={`flex items-center gap-1 mt-1 text-xs ${
                    weeklyComparison.changes.totalAmount >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {weeklyComparison.changes.totalAmount >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    <span>{formatChange(weeklyComparison.changes.totalAmount).text}</span>
                    <span className="text-gray-400 text-[10px] ml-0.5">{formatSnapshotDate(weeklyComparison.previousSnapshotDate)}</span>
                  </div>
                )}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4">
                <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                  <TrendingUp size={14} />
                  <span className="text-xs md:text-sm">가중치 적용 금액</span>
                </div>
                <p className="text-lg md:text-2xl font-bold text-blue-600">
                  ₩{formatAmount(currentPipeline.totals.weightedAmount)}
                </p>
                {weeklyComparison?.changes && (
                  <div className={`flex items-center gap-1 mt-1 text-xs ${
                    weeklyComparison.changes.weightedAmount >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {weeklyComparison.changes.weightedAmount >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    <span>{formatChange(weeklyComparison.changes.weightedAmount).text}</span>
                    <span className="text-gray-400 text-[10px] ml-0.5">{formatSnapshotDate(weeklyComparison.previousSnapshotDate)}</span>
                  </div>
                )}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4">
                <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                  <Target size={14} />
                  <span className="text-xs md:text-sm">미결 거래 금액</span>
                </div>
                <p className="text-lg md:text-2xl font-bold text-orange-600">
                  ₩{formatAmount(currentPipeline.totals.openAmount)}
                </p>
                {weeklyComparison?.changes && (
                  <div className={`flex items-center gap-1 mt-1 text-xs ${
                    weeklyComparison.changes.openAmount >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {weeklyComparison.changes.openAmount >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    <span>{formatChange(weeklyComparison.changes.openAmount).text}</span>
                    <span className="text-gray-400 text-[10px] ml-0.5">{formatSnapshotDate(weeklyComparison.previousSnapshotDate)}</span>
                  </div>
                )}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4">
                <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                  <DollarSign size={14} className="text-green-500" />
                  <span className="text-xs md:text-sm">성사된 거래 금액</span>
                </div>
                <p className="text-lg md:text-2xl font-bold text-green-600">
                  ₩{formatAmount(currentPipeline.totals.closedWonAmount)}
                </p>
                {weeklyComparison?.changes && (
                  <div className={`flex items-center gap-1 mt-1 text-xs ${
                    weeklyComparison.changes.closedWonAmount >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {weeklyComparison.changes.closedWonAmount >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    <span>{formatChange(weeklyComparison.changes.closedWonAmount).text}</span>
                    <span className="text-gray-400 text-[10px] ml-0.5">{formatSnapshotDate(weeklyComparison.previousSnapshotDate)}</span>
                  </div>
                )}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4 col-span-2 md:col-span-1">
                <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                  <Calendar size={14} />
                  <span className="text-xs md:text-sm">총 거래 수</span>
                </div>
                <p className="text-lg md:text-2xl font-bold text-gray-900">
                  {currentPipeline.totals.totalCount}건
                </p>
                {weeklyComparison?.changes && (
                  <div className={`flex items-center gap-1 mt-1 text-xs ${
                    weeklyComparison.changes.totalCount >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {weeklyComparison.changes.totalCount >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    <span>{formatCountChange(weeklyComparison.changes.totalCount).text}</span>
                    <span className="text-gray-400 text-[10px] ml-0.5">{formatSnapshotDate(weeklyComparison.previousSnapshotDate)}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )
      })()}

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
                  {stage.deals.map(deal => {
                    const recentlyModified = isRecentlyModified(deal.lastModified)
                    const hasChanges = deal.recentChanges && deal.recentChanges.length > 0

                    return (
                      <div
                        key={deal.id}
                        className={`rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow ${
                          recentlyModified
                            ? 'bg-amber-50 border-2 border-amber-400 ring-2 ring-amber-200'
                            : 'bg-white border border-gray-200'
                        }`}
                      >
                        {/* 최근 변경 표시 */}
                        {recentlyModified && (
                          <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 rounded px-2 py-1 mb-2">
                            <RefreshCw size={10} />
                            <span>최근 업데이트: {formatDate(deal.lastModified)}</span>
                          </div>
                        )}

                        {/* 변경 내역 표시 */}
                        {hasChanges && deal.recentChanges!.map((change, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-1 text-xs rounded px-2 py-1 mb-2 ${
                              change.type === 'stage'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {change.type === 'stage' ? (
                              <>
                                <ArrowUpRight size={10} />
                                <span>스테이지: {change.previousValue} → {change.currentValue}</span>
                              </>
                            ) : (
                              <>
                                <DollarSign size={10} />
                                <span>금액: {change.previousValue} → {change.currentValue}</span>
                              </>
                            )}
                          </div>
                        ))}

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
                    )
                  })}

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

      {/* 최근 2주간 주요 활동 업데이트 */}
      {currentPipeline && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 md:mb-6">
            <div>
              <h2 className="text-base md:text-xl font-bold text-gray-900">
                최근 2주간 주요 활동 업데이트
                <span className="ml-1 md:ml-2 text-sm md:text-base font-normal text-purple-600">
                  ({currentPipeline.label})
                </span>
              </h2>
              <p className="text-xs md:text-sm text-gray-500 mt-1">
                {recentActivities?.dateRange?.from} ~ {recentActivities?.dateRange?.to} |
                {recentActivities?.totalDeals || 0}개 딜에서 활동 발생
              </p>
            </div>
            {activitiesLoading && (
              <div className="flex items-center gap-2 text-purple-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                <span className="text-sm">AI 분석 중...</span>
              </div>
            )}
          </div>

          {recentActivities && recentActivities.deals.length > 0 ? (
            <div className="space-y-3 md:space-y-4">
              {recentActivities.deals.map(deal => (
                <div
                  key={deal.dealId}
                  className="border border-gray-200 rounded-lg p-3 md:p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-4">
                    {/* 회사/딜 정보 */}
                    <div className="flex-shrink-0 md:w-48">
                      <div className="flex items-center justify-between md:justify-start gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 size={16} className="text-blue-500 flex-shrink-0" />
                          <span className="font-semibold text-gray-900 text-sm md:text-base truncate">
                            {deal.companyName || '(회사명 추출 중)'}
                          </span>
                        </div>
                        {/* 날짜 - 모바일에서는 회사명 옆에 표시 */}
                        <div className="flex-shrink-0 text-right text-xs text-gray-400 md:hidden">
                          <span className="font-medium text-gray-600">
                            {formatDate(deal.latestActivityDate)}
                          </span>
                        </div>
                      </div>
                      <a
                        href={getHubspotDealUrl(deal.dealId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {deal.dealName}
                        <ExternalLink size={12} />
                      </a>
                      <div className="flex items-center flex-wrap gap-1 mt-2 text-xs text-gray-500">
                        <span className="inline-block bg-gray-100 px-2 py-0.5 rounded">
                          {deal.stageName}
                        </span>
                        {deal.amount > 0 && (
                          <span className="text-gray-700 font-medium">
                            ₩{formatAmount(deal.amount)}
                          </span>
                        )}
                        {/* 최근 활동 아이콘들 */}
                        <div className="flex items-center gap-1.5 ml-1">
                          {deal.activities.map((activity, idx) => {
                            const Icon = activity.type === 'call' ? Phone :
                                        activity.type === 'meeting' ? Calendar :
                                        activity.type === 'email' ? Mail : FileText
                            const color = activity.type === 'call' ? 'text-blue-500' :
                                         activity.type === 'meeting' ? 'text-purple-500' :
                                         activity.type === 'email' ? 'text-orange-500' : 'text-green-500'
                            return (
                              <div key={idx} className={`${color}`} title={`${activity.title} (${activity.date})`}>
                                <Icon size={14} />
                              </div>
                            )
                          })}
                          {deal.activityCount > deal.activities.length && (
                            <span className="text-xs text-gray-400">+{deal.activityCount - deal.activities.length}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* AI 요약 */}
                    <div className="flex-1">
                      {deal.aiSummary ? (
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-3 md:p-4 border border-purple-100">
                          <div className="flex items-center gap-1 text-xs text-purple-600 mb-1.5 md:mb-2">
                            <Sparkles size={12} />
                            <span className="font-medium">AI 요약</span>
                          </div>
                          <p className="text-gray-800 text-xs md:text-sm leading-relaxed whitespace-pre-line">{deal.aiSummary}</p>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-3 md:p-4 text-gray-500 text-xs md:text-sm">
                          요약 생성 중...
                        </div>
                      )}
                    </div>

                    {/* 날짜 - 데스크톱에서만 표시 */}
                    <div className="hidden md:block flex-shrink-0 text-right text-xs text-gray-400">
                      <div>최근 활동</div>
                      <div className="font-medium text-gray-600">
                        {formatDate(deal.latestActivityDate)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : !activitiesLoading ? (
            <div className="text-center text-gray-500 py-8 md:py-12">
              <Calendar size={36} className="mx-auto mb-3 md:mb-4 opacity-50 md:w-12 md:h-12" />
              <p className="text-sm md:text-base">최근 2주간 활동이 있는 딜이 없습니다</p>
            </div>
          ) : null}
        </div>
      )}

      {/* 데이터 없음 */}
      {(!data || data.pipelines.length === 0) && (
        <div className="text-center text-gray-500 py-8 md:py-12 bg-white rounded-xl border border-gray-200">
          <Target size={36} className="mx-auto mb-3 md:mb-4 opacity-50 md:w-12 md:h-12" />
          <p className="text-sm md:text-base">거래 데이터가 없습니다</p>
        </div>
      )}
    </div>
  )
}

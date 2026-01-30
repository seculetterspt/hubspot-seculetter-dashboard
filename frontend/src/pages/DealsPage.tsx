import { useEffect, useState } from 'react'
import { Handshake, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import KPICard from '../components/widgets/KPICard/KPICard'
import { api } from '../services/api'

interface PipelineStage {
  id: string
  name: string
  count: number
  value: number
  color: string
}

interface Pipeline {
  stages: PipelineStage[]
  totalValue: number
  totalCount: number
  conversionRates: Record<string, number>
}

export default function DealsPage() {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get('/analytics/pipeline')
        setPipeline(res.data)
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const formatCurrency = (value: number) => {
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(1)}억원`
    }
    return `${(value / 10000).toFixed(0)}만원`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const maxValue = Math.max(...(pipeline?.stages.map(s => s.value) || [1]))

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="파이프라인 총액"
          value={formatCurrency(pipeline?.totalValue || 0)}
          change={8}
          icon={<Handshake size={24} className="text-primary-600" />}
          iconBgColor="bg-primary-100"
        />
        <KPICard
          title="진행중 거래"
          value={pipeline?.totalCount || 0}
          change={5}
          icon={<TrendingUp size={24} className="text-blue-600" />}
          iconBgColor="bg-blue-100"
        />
        <KPICard
          title="이번 달 성사"
          value="3건"
          subValue="2.8억원"
          change={15}
          icon={<TrendingUp size={24} className="text-green-600" />}
          iconBgColor="bg-green-100"
        />
        <KPICard
          title="정체 거래"
          value="8건"
          icon={<AlertTriangle size={24} className="text-red-600" />}
          iconBgColor="bg-red-100"
          urgent
        />
      </div>

      {/* Pipeline Funnel */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-6">영업 파이프라인 (보안 솔루션)</h2>
        <div className="space-y-4">
          {pipeline?.stages.map((stage, index) => (
            <div key={stage.id} className="flex items-center gap-4">
              <div className="w-24 text-sm font-medium text-gray-700">{stage.name}</div>
              <div className="flex-1 h-12 bg-gray-100 rounded-lg overflow-hidden relative">
                <div
                  className="h-full rounded-lg flex items-center justify-between px-4 transition-all"
                  style={{
                    width: `${(stage.value / maxValue) * 100}%`,
                    backgroundColor: stage.color,
                    minWidth: '120px'
                  }}
                >
                  <span className="text-white font-medium">{stage.count}건</span>
                  <span className="text-white font-medium">{formatCurrency(stage.value)}</span>
                </div>
              </div>
              {index < (pipeline?.stages.length || 0) - 1 && (
                <div className="w-16 text-center">
                  <span className="text-sm text-gray-500">
                    {Object.values(pipeline?.conversionRates || {})[index] || 0}%
                  </span>
                  <TrendingDown size={16} className="text-gray-400 mx-auto" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stage Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {pipeline?.stages.map((stage) => (
          <div key={stage.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{stage.name}</h3>
              <span
                className="px-3 py-1 rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: stage.color }}
              >
                {stage.count}건
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">총 금액</span>
                <span className="font-medium text-gray-900">{formatCurrency(stage.value)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">평균 거래 금액</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(stage.count > 0 ? stage.value / stage.count : 0)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

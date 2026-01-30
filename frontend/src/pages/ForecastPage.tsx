import { useEffect, useState } from 'react'
import { TrendingUp, Target, DollarSign, Calendar } from 'lucide-react'
import KPICard from '../components/widgets/KPICard/KPICard'
import { api } from '../services/api'

interface ForecastData {
  currentMonth: {
    name: string
    expected: number
    weighted: number
    bestCase: number
    worstCase: number
    closed: number
  }
  nextMonth: {
    name: string
    expected: number
    weighted: number
    bestCase: number
    worstCase: number
  }
  quarter: {
    name: string
    expected: number
    weighted: number
    bestCase: number
    worstCase: number
    target: number
  }
  byStage: Array<{
    stage: string
    value: number
    probability: number
    weighted: number
  }>
}

export default function ForecastPage() {
  const [forecast, setForecast] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get('/analytics/forecast')
        setForecast(res.data)
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

  const quarterProgress = forecast?.quarter
    ? (forecast.quarter.weighted / forecast.quarter.target) * 100
    : 0

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="분기 목표"
          value={formatCurrency(forecast?.quarter.target || 0)}
          icon={<Target size={24} className="text-primary-600" />}
          iconBgColor="bg-primary-100"
        />
        <KPICard
          title="예상 매출 (가중치)"
          value={formatCurrency(forecast?.quarter.weighted || 0)}
          subValue={`목표 대비 ${quarterProgress.toFixed(0)}%`}
          icon={<TrendingUp size={24} className="text-blue-600" />}
          iconBgColor="bg-blue-100"
        />
        <KPICard
          title="이번 달 확정"
          value={formatCurrency(forecast?.currentMonth.closed || 0)}
          icon={<DollarSign size={24} className="text-green-600" />}
          iconBgColor="bg-green-100"
        />
        <KPICard
          title="Best Case"
          value={formatCurrency(forecast?.quarter.bestCase || 0)}
          icon={<Calendar size={24} className="text-purple-600" />}
          iconBgColor="bg-purple-100"
        />
      </div>

      {/* Forecast Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Month */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{forecast?.currentMonth.name}</h3>
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">확정 매출</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(forecast?.currentMonth.closed || 0)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">예상</p>
                <p className="font-semibold">{formatCurrency(forecast?.currentMonth.expected || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">가중치</p>
                <p className="font-semibold">{formatCurrency(forecast?.currentMonth.weighted || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Best Case</p>
                <p className="font-semibold text-green-600">
                  {formatCurrency(forecast?.currentMonth.bestCase || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Worst Case</p>
                <p className="font-semibold text-red-600">
                  {formatCurrency(forecast?.currentMonth.worstCase || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Next Month */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{forecast?.nextMonth.name}</h3>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">가중치 예상</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(forecast?.nextMonth.weighted || 0)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">예상</p>
                <p className="font-semibold">{formatCurrency(forecast?.nextMonth.expected || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">가중치</p>
                <p className="font-semibold">{formatCurrency(forecast?.nextMonth.weighted || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Best Case</p>
                <p className="font-semibold text-green-600">
                  {formatCurrency(forecast?.nextMonth.bestCase || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Worst Case</p>
                <p className="font-semibold text-red-600">
                  {formatCurrency(forecast?.nextMonth.worstCase || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quarter */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{forecast?.quarter.name}</h3>
          <div className="space-y-4">
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600">목표 달성률</p>
              <p className="text-2xl font-bold text-purple-600">{quarterProgress.toFixed(0)}%</p>
              <div className="mt-2 h-2 bg-purple-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full"
                  style={{ width: `${Math.min(quarterProgress, 100)}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">목표</p>
                <p className="font-semibold">{formatCurrency(forecast?.quarter.target || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">가중치</p>
                <p className="font-semibold">{formatCurrency(forecast?.quarter.weighted || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Best Case</p>
                <p className="font-semibold text-green-600">
                  {formatCurrency(forecast?.quarter.bestCase || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Worst Case</p>
                <p className="font-semibold text-red-600">
                  {formatCurrency(forecast?.quarter.worstCase || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* By Stage */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">단계별 예상 매출</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">단계</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">금액</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">확률</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">가중치 금액</th>
              </tr>
            </thead>
            <tbody>
              {forecast?.byStage.map((item) => (
                <tr key={item.stage} className="border-b border-gray-100">
                  <td className="py-3 px-4 font-medium text-gray-900">{item.stage}</td>
                  <td className="py-3 px-4 text-right text-gray-600">{formatCurrency(item.value)}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                      {item.probability}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900">
                    {formatCurrency(item.weighted)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50">
                <td className="py-3 px-4 font-semibold text-gray-900">합계</td>
                <td className="py-3 px-4 text-right font-semibold text-gray-900">
                  {formatCurrency(forecast?.byStage.reduce((sum, i) => sum + i.value, 0) || 0)}
                </td>
                <td className="py-3 px-4"></td>
                <td className="py-3 px-4 text-right font-semibold text-gray-900">
                  {formatCurrency(forecast?.byStage.reduce((sum, i) => sum + i.weighted, 0) || 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

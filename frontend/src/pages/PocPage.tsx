import { useEffect, useState } from 'react'
import { FlaskConical, CheckCircle, Clock, XCircle } from 'lucide-react'
import KPICard from '../components/widgets/KPICard/KPICard'
import { api } from '../services/api'

interface PocData {
  active: Array<{
    id: string
    name: string
    company: string
    startDate: string
    expectedEndDate: string
    progress: number
    owner: string
    status: string
  }>
  summary: {
    totalActive: number
    startedThisMonth: number
    completedThisMonth: number
    successRate: number
    avgDurationDays: number
  }
  history: Array<{
    month: string
    started: number
    completed: number
    success: number
    failed: number
  }>
}

export default function PocPage() {
  const [pocData, setPocData] = useState<PocData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get('/analytics/poc-status')
        setPocData(res.data)
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="진행중 POC"
          value={pocData?.summary.totalActive || 0}
          icon={<FlaskConical size={24} className="text-primary-600" />}
          iconBgColor="bg-primary-100"
        />
        <KPICard
          title="이번 달 시작"
          value={pocData?.summary.startedThisMonth || 0}
          icon={<Clock size={24} className="text-blue-600" />}
          iconBgColor="bg-blue-100"
        />
        <KPICard
          title="POC 성공률"
          value={`${pocData?.summary.successRate || 0}%`}
          icon={<CheckCircle size={24} className="text-green-600" />}
          iconBgColor="bg-green-100"
        />
        <KPICard
          title="평균 소요 기간"
          value={`${pocData?.summary.avgDurationDays || 0}일`}
          icon={<Clock size={24} className="text-purple-600" />}
          iconBgColor="bg-purple-100"
        />
      </div>

      {/* Active POCs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">진행중인 POC/BMT</h3>
        <div className="space-y-4">
          {pocData?.active.map((poc) => (
            <div key={poc.id} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-gray-900">{poc.name}</h4>
                  <p className="text-sm text-gray-500">{poc.company} | {poc.owner}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    poc.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-700'
                      : poc.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {poc.status === 'in_progress' ? '진행중' : poc.status === 'completed' ? '완료' : poc.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                <span>시작: {poc.startDate}</span>
                <span>예상 종료: {poc.expectedEndDate}</span>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">진행률</span>
                  <span className="font-medium text-gray-900">{poc.progress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full"
                    style={{ width: `${poc.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* POC History */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">POC 이력</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">월</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">시작</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">완료</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">성공</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">실패</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">성공률</th>
              </tr>
            </thead>
            <tbody>
              {pocData?.history.map((item) => {
                const total = item.success + item.failed
                const rate = total > 0 ? ((item.success / total) * 100).toFixed(0) : 0
                return (
                  <tr key={item.month} className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-900">{item.month}</td>
                    <td className="py-3 px-4 text-center text-gray-600">{item.started}</td>
                    <td className="py-3 px-4 text-center text-gray-600">{item.completed}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <CheckCircle size={16} />
                        {item.success}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-red-600">
                        <XCircle size={16} />
                        {item.failed}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                        {rate}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

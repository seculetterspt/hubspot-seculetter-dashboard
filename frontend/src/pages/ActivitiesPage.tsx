import { useEffect, useState } from 'react'
import { Activity, Calendar, Phone, FileText, Users } from 'lucide-react'
import KPICard from '../components/widgets/KPICard/KPICard'
import { api } from '../services/api'

interface ActivitiesData {
  meetings: number
  calls: number
  notes: number
  total: number
  byOwner: Record<string, { meetings: number; calls: number; notes: number }>
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivitiesData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get('/analytics/activities')
        setActivities(res.data)
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
          title="오늘 미팅"
          value={activities?.meetings || 0}
          change={20}
          icon={<Calendar size={24} className="text-purple-600" />}
          iconBgColor="bg-purple-100"
        />
        <KPICard
          title="오늘 통화"
          value={activities?.calls || 0}
          change={-5}
          icon={<Phone size={24} className="text-cyan-600" />}
          iconBgColor="bg-cyan-100"
        />
        <KPICard
          title="오늘 메모"
          value={activities?.notes || 0}
          change={10}
          icon={<FileText size={24} className="text-amber-600" />}
          iconBgColor="bg-amber-100"
        />
        <KPICard
          title="총 활동"
          value={activities?.total || 0}
          icon={<Activity size={24} className="text-primary-600" />}
          iconBgColor="bg-primary-100"
        />
      </div>

      {/* Activity Summary by Type */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">활동 유형별 분포</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center p-6 bg-purple-50 rounded-xl">
            <div className="w-16 h-16 bg-purple-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Calendar size={32} className="text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{activities?.meetings || 0}</p>
            <p className="text-gray-500 mt-1">미팅</p>
            <p className="text-sm text-purple-600 mt-2">
              {activities?.total ? ((activities.meetings / activities.total) * 100).toFixed(0) : 0}%
            </p>
          </div>
          <div className="text-center p-6 bg-cyan-50 rounded-xl">
            <div className="w-16 h-16 bg-cyan-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Phone size={32} className="text-cyan-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{activities?.calls || 0}</p>
            <p className="text-gray-500 mt-1">통화</p>
            <p className="text-sm text-cyan-600 mt-2">
              {activities?.total ? ((activities.calls / activities.total) * 100).toFixed(0) : 0}%
            </p>
          </div>
          <div className="text-center p-6 bg-amber-50 rounded-xl">
            <div className="w-16 h-16 bg-amber-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <FileText size={32} className="text-amber-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{activities?.notes || 0}</p>
            <p className="text-gray-500 mt-1">메모</p>
            <p className="text-sm text-amber-600 mt-2">
              {activities?.total ? ((activities.notes / activities.total) * 100).toFixed(0) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Activity by Owner */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">담당자별 활동</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">담당자</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">
                  <div className="flex items-center justify-center gap-1">
                    <Calendar size={16} className="text-purple-600" />
                    미팅
                  </div>
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">
                  <div className="flex items-center justify-center gap-1">
                    <Phone size={16} className="text-cyan-600" />
                    통화
                  </div>
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">
                  <div className="flex items-center justify-center gap-1">
                    <FileText size={16} className="text-amber-600" />
                    메모
                  </div>
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">총 활동</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(activities?.byOwner || {}).map(([owner, data]) => {
                const total = data.meetings + data.calls + data.notes
                return (
                  <tr key={owner} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <Users size={16} className="text-primary-600" />
                        </div>
                        <span className="font-medium text-gray-900">{owner}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-purple-100 text-purple-700 rounded-full font-medium">
                        {data.meetings}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-cyan-100 text-cyan-700 rounded-full font-medium">
                        {data.calls}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-amber-100 text-amber-700 rounded-full font-medium">
                        {data.notes}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-semibold text-gray-900">{total}</span>
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

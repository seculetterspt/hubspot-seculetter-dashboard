import { useEffect, useState } from 'react'
import { Users, UserPlus, UserCheck, Building2 } from 'lucide-react'
import KPICard from '../components/widgets/KPICard/KPICard'
import { api } from '../services/api'

interface ContactsData {
  total: number
  created: number
  modified: number
  bySource: Record<string, number>
  byLifecycleStage: Record<string, number>
  byDecisionMakerRole: Record<string, number>
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get('/analytics/contacts')
        setContacts(res.data)
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

  const sourceColors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']
  const roleColors = { 'C-Level': '#EF4444', 'Director': '#F59E0B', 'Manager': '#3B82F6', '실무자': '#94A3B8' }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="전체 연락처"
          value={contacts?.total || 0}
          change={5}
          icon={<Users size={24} className="text-primary-600" />}
          iconBgColor="bg-primary-100"
        />
        <KPICard
          title="오늘 신규"
          value={contacts?.created || 0}
          change={15}
          icon={<UserPlus size={24} className="text-green-600" />}
          iconBgColor="bg-green-100"
        />
        <KPICard
          title="오늘 수정"
          value={contacts?.modified || 0}
          icon={<UserCheck size={24} className="text-blue-600" />}
          iconBgColor="bg-blue-100"
        />
        <KPICard
          title="의사결정자"
          value={
            (contacts?.byDecisionMakerRole?.['C-Level'] || 0) +
            (contacts?.byDecisionMakerRole?.['Director'] || 0)
          }
          icon={<Building2 size={24} className="text-purple-600" />}
          iconBgColor="bg-purple-100"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Source */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">유입 경로별 분포</h3>
          <div className="space-y-3">
            {Object.entries(contacts?.bySource || {}).map(([source, count], index) => {
              const total = Object.values(contacts?.bySource || {}).reduce((a, b) => a + b, 0)
              const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0
              return (
                <div key={source}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{source}</span>
                    <span className="font-medium">{count}명 ({percentage}%)</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: sourceColors[index % sourceColors.length]
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* By Lifecycle Stage */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">라이프사이클 단계별</h3>
          <div className="space-y-3">
            {Object.entries(contacts?.byLifecycleStage || {}).map(([stage, count], index) => {
              const total = Object.values(contacts?.byLifecycleStage || {}).reduce((a, b) => a + b, 0)
              const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0
              const stageLabels: Record<string, string> = {
                subscriber: '구독자',
                lead: '리드',
                marketingqualifiedlead: 'MQL',
                salesqualifiedlead: 'SQL',
                opportunity: '기회',
                customer: '고객'
              }
              return (
                <div key={stage}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{stageLabels[stage] || stage}</span>
                    <span className="font-medium">{count}명 ({percentage}%)</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: sourceColors[index % sourceColors.length]
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Decision Maker Roles */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">의사결정자 역할 분포</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(contacts?.byDecisionMakerRole || {}).map(([role, count]) => {
            const color = roleColors[role as keyof typeof roleColors] || '#94A3B8'
            return (
              <div key={role} className="p-4 bg-gray-50 rounded-lg text-center">
                <div
                  className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                  style={{ backgroundColor: `${color}20` }}
                >
                  <Users size={24} style={{ color }} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-sm text-gray-500">{role}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

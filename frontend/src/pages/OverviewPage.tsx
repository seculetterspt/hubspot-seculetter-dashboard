import { useEffect, useState } from 'react'
import {
  Users,
  Handshake,
  Trophy,
  AlertTriangle,
  Calendar,
  Phone,
  FileText,
  Clock,
  DollarSign
} from 'lucide-react'
import KPICard from '../components/widgets/KPICard/KPICard'
import { api } from '../services/api'

interface OverviewData {
  kpi: {
    newContactsToday: number
    newContactsChange: number
    activeDeals: number
    pipelineValue: number
    dealsWonMonth: number
    dealsWonValue: number
    openTickets: number
    stalledDeals: number
  }
}

interface TodayTasks {
  meetings: Array<{ id: string; title: string; time: string; contact: string; deal: string }>
  followUps: Array<{ id: string; title: string; deal: string; dueDate: string; priority: string }>
  expiringQuotes: Array<{ id: string; deal: string; expiresIn: number; amount: number }>
  totalMeetings: number
  totalFollowUps: number
  totalExpiringQuotes: number
}

interface StalledDeal {
  id: string
  name: string
  amount: number
  stage: string
  owner: string
  daysSinceActivity: number
  lastActivity: string
}

interface TeamMember {
  id: string
  name: string
  dealsCount: number
  dealsWon: number
  wonValue: number
  winRate: number
  activitiesCount: number
  target: number
  achievement: number
}

export default function OverviewPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [todayTasks, setTodayTasks] = useState<TodayTasks | null>(null)
  const [stalledDeals, setStalledDeals] = useState<{ deals: StalledDeal[]; totalCount: number } | null>(null)
  const [teamPerformance, setTeamPerformance] = useState<{ team: TeamMember[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [overviewRes, tasksRes, stalledRes, teamRes] = await Promise.all([
          api.get('/analytics/overview'),
          api.get('/analytics/today-tasks'),
          api.get('/analytics/stalled-deals'),
          api.get('/analytics/team-performance'),
        ])
        setOverview(overviewRes.data)
        setTodayTasks(tasksRes.data)
        setStalledDeals(stalledRes.data)
        setTeamPerformance(teamRes.data)
      } catch (error) {
        console.error('Error fetching data:', error)
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

  const formatCurrency = (value: number) => {
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(1)}억원`
    } else if (value >= 10000) {
      return `${(value / 10000).toFixed(0)}만원`
    }
    return `${value}원`
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="오늘 신규 연락처"
          value={overview?.kpi.newContactsToday || 0}
          change={overview?.kpi.newContactsChange}
          icon={<Users size={24} className="text-primary-600" />}
          iconBgColor="bg-primary-100"
        />
        <KPICard
          title="진행중 거래"
          value={overview?.kpi.activeDeals || 0}
          subValue={formatCurrency(overview?.kpi.pipelineValue || 0)}
          icon={<Handshake size={24} className="text-blue-600" />}
          iconBgColor="bg-blue-100"
        />
        <KPICard
          title="이번 달 성사"
          value={overview?.kpi.dealsWonMonth || 0}
          subValue={formatCurrency(overview?.kpi.dealsWonValue || 0)}
          change={12}
          icon={<Trophy size={24} className="text-green-600" />}
          iconBgColor="bg-green-100"
        />
        <KPICard
          title="30일+ 정체 거래"
          value={overview?.kpi.stalledDeals || 0}
          icon={<AlertTriangle size={24} className="text-red-600" />}
          iconBgColor="bg-red-100"
          urgent={true}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Tasks - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Meetings Today */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Calendar size={20} className="text-primary-600" />
                오늘의 미팅 ({todayTasks?.totalMeetings || 0})
              </h2>
            </div>
            <div className="space-y-3">
              {todayTasks?.meetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{meeting.title}</p>
                    <p className="text-sm text-gray-500">
                      {meeting.contact} | {meeting.deal}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
                    {meeting.time}
                  </span>
                </div>
              ))}
              {(!todayTasks?.meetings || todayTasks.meetings.length === 0) && (
                <p className="text-gray-500 text-center py-4">예정된 미팅이 없습니다</p>
              )}
            </div>
          </div>

          {/* Follow-ups Required */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText size={20} className="text-orange-600" />
                후속 조치 필요 ({todayTasks?.totalFollowUps || 0})
              </h2>
            </div>
            <div className="space-y-3">
              {todayTasks?.followUps.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{task.title}</p>
                    <p className="text-sm text-gray-500">{task.deal}</p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      task.priority === 'high'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {task.dueDate}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Stalled Deals Alert */}
          <div className="bg-red-50 rounded-xl border border-red-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-red-800 flex items-center gap-2">
                <AlertTriangle size={20} />
                정체 거래 알림 (30일 이상 무활동)
              </h2>
              <span className="text-sm text-red-600">{stalledDeals?.totalCount || 0}건</span>
            </div>
            <div className="space-y-2">
              {stalledDeals?.deals.slice(0, 5).map((deal) => (
                <div
                  key={deal.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-100"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{deal.name}</p>
                    <p className="text-sm text-gray-500">
                      {deal.stage} | {deal.owner}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{formatCurrency(deal.amount)}</p>
                    <p className="text-sm text-red-600">{deal.daysSinceActivity}일 경과</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Quote Expiring Soon */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Clock size={20} className="text-yellow-600" />
              견적 만료 임박
            </h2>
            <div className="space-y-3">
              {todayTasks?.expiringQuotes.map((quote) => (
                <div
                  key={quote.id}
                  className="p-3 bg-yellow-50 rounded-lg border border-yellow-100"
                >
                  <p className="font-medium text-gray-900">{quote.deal}</p>
                  <div className="flex justify-between mt-1">
                    <span className="text-sm text-gray-500">{formatCurrency(quote.amount)}</span>
                    <span className="text-sm font-medium text-yellow-700">
                      {quote.expiresIn}일 후 만료
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Team Performance */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Trophy size={20} className="text-primary-600" />
              영업팀 성과 (이번 달)
            </h2>
            <div className="space-y-3">
              {teamPerformance?.team.slice(0, 5).map((member, index) => (
                <div key={member.id} className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0
                        ? 'bg-yellow-100 text-yellow-700'
                        : index === 1
                        ? 'bg-gray-100 text-gray-700'
                        : index === 2
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-gray-50 text-gray-500'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-900">{member.name}</span>
                      <span className="text-sm text-gray-500">{member.achievement}%</span>
                    </div>
                    <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{ width: `${Math.min(member.achievement, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">오늘의 활동</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-lg mx-auto mb-2">
                  <Calendar size={20} className="text-purple-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">8</p>
                <p className="text-xs text-gray-500">미팅</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center w-10 h-10 bg-cyan-100 rounded-lg mx-auto mb-2">
                  <Phone size={20} className="text-cyan-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">24</p>
                <p className="text-xs text-gray-500">통화</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center w-10 h-10 bg-amber-100 rounded-lg mx-auto mb-2">
                  <FileText size={20} className="text-amber-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">15</p>
                <p className="text-xs text-gray-500">메모</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

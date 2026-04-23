import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Calendar, Plus, Loader2, FileText, Users, ChevronRight, Trash2 } from 'lucide-react'
import { api } from '../services/api'

interface WeeklyReport {
  id: number
  report_date: string
  team_name: string
  brief_content: string
  generated_content: string
  related_activities: any[]
  created_by: string
  created_at: string
  updated_at: string
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })
}

export default function WeeklyReportListPage() {
  const navigate = useNavigate()
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [loading, setLoading] = useState(true)

  const loadReports = async () => {
    try {
      setLoading(true)
      const res = await api.get('/weekly-reports')
      setReports(res.data.reports || [])
    } catch (error) {
      console.error('Failed to load reports:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [])

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('이 주간보고를 삭제하시겠습니까?')) return

    try {
      await api.delete(`/weekly-reports/${id}`)
      loadReports()
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('삭제 실패')
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">주간보고</h1>
        </div>
        <Link
          to="/weekly/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={18} />
          새 보고서 작성
        </Link>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">주간보고가 없습니다</h3>
          <p className="text-gray-500 mb-6">
            새 보고서를 작성하여 CEO 보고용 주간보고를 생성하세요.
          </p>
          <Link
            to="/weekly/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus size={18} />
            첫 보고서 작성하기
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {reports.map(report => (
            <div
              key={report.id}
              onClick={() => navigate(`/weekly/${report.id}`)}
              className="p-4 hover:bg-gray-50 cursor-pointer transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold text-gray-900">
                      {formatDate(report.report_date)}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                      <Users size={12} />
                      {report.team_name}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">
                    {report.brief_content || '내용 없음'}
                  </p>
                  {report.related_activities && report.related_activities.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      연결된 활동 {report.related_activities.length}건
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleDelete(report.id, e)}
                    className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronRight size={20} className="text-gray-400" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

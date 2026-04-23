import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, Users, Loader2, ExternalLink, Phone, Mail, FileText, Trash2, Copy, Check, Edit, Save, X } from 'lucide-react'
import { api } from '../services/api'

interface RelatedActivity {
  id: string
  type: 'call' | 'note' | 'meeting' | 'email'
  title: string
  timestamp: string
  companyName?: string
  summary?: string
}

interface WeeklyReport {
  id: number
  report_date: string
  team_name: string
  brief_content: string
  generated_content: string
  related_activities: RelatedActivity[]
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

const HUBSPOT_PORTAL_ID = '243367573'

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'call': return <Phone size={14} className="text-blue-600" />
    case 'meeting': return <Calendar size={14} className="text-purple-600" />
    case 'email': return <Mail size={14} className="text-orange-600" />
    default: return <FileText size={14} className="text-green-600" />
  }
}

const getActivityUrl = (type: string, id: string) => {
  return `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-${
    type === 'call' ? '48' : type === 'meeting' ? '47' : type === 'email' ? '49' : '46'
  }/${id}`
}

function renderMarkdown(content: string): string {
  return content
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-gray-900 mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-gray-900 mt-5 mb-3">$2</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-gray-700">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc space-y-1 my-2">$&</ul>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}

export default function WeeklyReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadReport = async () => {
      try {
        setLoading(true)
        const res = await api.get(`/weekly-reports/${id}`)
        setReport(res.data.report)
        setEditContent(res.data.report?.generated_content || '')
      } catch (error) {
        console.error('Failed to load report:', error)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      loadReport()
    }
  }, [id])

  const handleDelete = async () => {
    if (!confirm('이 주간보고를 삭제하시겠습니까?')) return

    try {
      await api.delete(`/weekly-reports/${id}`)
      navigate('/weekly')
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('삭제 실패')
    }
  }

  const handleCopy = async () => {
    if (!report) return

    try {
      await navigator.clipboard.writeText(report.generated_content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleEdit = () => {
    setEditContent(report?.generated_content || '')
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditContent(report?.generated_content || '')
  }

  const handleSave = async () => {
    if (!report) return

    try {
      setSaving(true)
      await api.put(`/weekly-reports/${id}`, {
        generatedContent: editContent
      })
      setReport({ ...report, generated_content: editContent })
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to save:', error)
      alert('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">보고서를 찾을 수 없습니다</h2>
        <Link to="/weekly" className="text-primary-600 hover:underline">
          목록으로 돌아가기
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/weekly"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {formatDate(report.report_date)} 주간보고
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-sm rounded-full">
                <Users size={14} />
                {report.team_name}
              </span>
              <span className="text-sm text-gray-500">
                작성: {report.created_by}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
              >
                <X size={16} />
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                저장
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleEdit}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
              >
                <Edit size={16} />
                수정
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
              >
                {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                {copied ? '복사됨' : '복사'}
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm"
              >
                <Trash2 size={16} />
                삭제
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">CEO 보고 내용</h2>

            {isEditing ? (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none font-mono text-sm"
                placeholder="마크다운 형식으로 작성하세요..."
              />
            ) : (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(report.generated_content) }}
              />
            )}
          </div>
        </div>

        {/* Sidebar - Related Activities */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-4">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ExternalLink size={16} className="text-primary-600" />
              연결된 HubSpot 활동
            </h2>

            {(!report.related_activities || report.related_activities.length === 0) ? (
              <p className="text-sm text-gray-500 text-center py-4">
                연결된 활동이 없습니다
              </p>
            ) : (
              <div className="space-y-2">
                {report.related_activities.map((activity, idx) => (
                  <a
                    key={idx}
                    href={getActivityUrl(activity.type, activity.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        {activity.companyName && (
                          <p className="text-xs font-medium text-gray-500 mb-0.5">
                            {activity.companyName}
                          </p>
                        )}
                        <p className="text-sm text-gray-800 line-clamp-2">
                          {activity.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(activity.timestamp).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                      <ExternalLink size={12} className="text-gray-400 flex-shrink-0 mt-1" />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

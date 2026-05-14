import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Sparkles, Save, Loader2, Calendar, Users, FileText, ExternalLink, Phone, Mail, DollarSign } from 'lucide-react'
import { api } from '../services/api'

interface RelatedActivity {
  id: string
  type: 'call' | 'note' | 'meeting' | 'email' | 'deal'
  title: string
  timestamp: string
  companyName?: string
  summary?: string
}

interface GeneratedReport {
  content: string
  activities: RelatedActivity[]
}

function getThisMonday(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

const HUBSPOT_PORTAL_ID = '243367573'

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'call': return <Phone size={14} className="text-blue-600" />
    case 'meeting': return <Calendar size={14} className="text-purple-600" />
    case 'email': return <Mail size={14} className="text-orange-600" />
    case 'deal': return <DollarSign size={14} className="text-emerald-600" />
    default: return <FileText size={14} className="text-green-600" />
  }
}

const getActivityUrl = (type: string, id: string) => {
  const objectTypeId = type === 'deal' ? '3' : type === 'call' ? '48' : type === 'meeting' ? '47' : type === 'email' ? '49' : '46'
  return `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-${objectTypeId}/${id}`
}

export default function WeeklyReportNewPage() {
  const navigate = useNavigate()
  const [reportDate, setReportDate] = useState(getThisMonday())
  const [teamName, setTeamName] = useState('')
  const [briefContent, setBriefContent] = useState('')
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleGenerate = async () => {
    if (!teamName.trim() || !briefContent.trim()) {
      alert('팀 이름과 내용을 입력해주세요.')
      return
    }

    try {
      setGenerating(true)
      const res = await api.post('/weekly-reports/generate', {
        reportDate,
        teamName,
        briefContent
      })
      setGeneratedReport(res.data)
    } catch (error) {
      console.error('Failed to generate:', error)
      alert('보고서 생성 실패. 다시 시도해주세요.')
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!generatedReport) return

    try {
      setSaving(true)
      const res = await api.post('/weekly-reports', {
        reportDate,
        teamName,
        briefContent,
        generatedContent: generatedReport.content,
        relatedActivities: generatedReport.activities
      })
      navigate(`/weekly/${res.data.report.id}`)
    } catch (error) {
      console.error('Failed to save:', error)
      alert('저장 실패. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/weekly"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">새 주간보고 작성</h1>
          <p className="text-sm text-gray-500">간략한 내용을 입력하면 AI가 CEO 보고용으로 보강해드립니다</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText size={18} className="text-primary-600" />
            기본 정보 입력
          </h2>

          <div className="space-y-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar size={14} className="inline mr-1" />
                보고 날짜
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Team Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Users size={14} className="inline mr-1" />
                팀 이름
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="예: 영업팀, 기술지원팀"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Brief Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                간략 내용
              </label>
              <textarea
                value={briefContent}
                onChange={(e) => setBriefContent(e.target.value)}
                placeholder={`이번 주 주요 활동을 간략히 입력하세요.

예시:
한국투자증권 POC 진행 중
법무부 제품 시연 완료
신규 파트너사 비엔씨 등록`}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={generating || !teamName.trim() || !briefContent.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {generating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  AI가 HubSpot 활동을 분석 중...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  AI 보고서 생성
                </>
              )}
            </button>
          </div>
        </div>

        {/* Generated Preview */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles size={18} className="text-purple-600" />
            CEO 보고용 (AI 생성)
          </h2>

          {!generatedReport ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Sparkles size={48} className="mb-4 opacity-30" />
              <p className="text-center">
                왼쪽에 내용을 입력하고<br />
                "AI 보고서 생성" 버튼을 클릭하세요
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Generated Content */}
              <div className="prose prose-sm max-w-none">
                <div
                  className="whitespace-pre-wrap text-gray-800 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: generatedReport.content.replace(/\n/g, '<br/>') }}
                />
              </div>

              {/* Related Activities */}
              {generatedReport.activities.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    연결된 HubSpot 활동 ({generatedReport.activities.length}건)
                  </h3>
                  <div className="space-y-2">
                    {generatedReport.activities.map((activity, idx) => (
                      <a
                        key={idx}
                        href={getActivityUrl(activity.type, activity.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                      >
                        {getActivityIcon(activity.type)}
                        <span className="flex-1 truncate">
                          {activity.companyName && (
                            <span className="font-medium text-gray-900">{activity.companyName} - </span>
                          )}
                          {activity.title}
                        </span>
                        <ExternalLink size={12} className="text-gray-400 flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    보고서 저장
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

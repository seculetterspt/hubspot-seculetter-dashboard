import { useState } from 'react'
import {
  ChevronLeft, Loader2, Target, MessageSquare, AlertTriangle,
  Lightbulb, CheckCircle2, ListTodo, ArrowRight, HelpCircle,
  ThumbsUp, Minus, ThumbsDown, Star, RotateCcw, ChevronDown, ChevronUp, PenLine
} from 'lucide-react'
import { api } from '../../services/api'

interface StructuredContent {
  summary_one_liner: string
  meeting_purpose: string
  key_discussions: string
  customer_needs: string
  proposed_solution: string
  decisions: string
  action_items: { task: string; assignee: string; deadline: string }[]
  next_steps: string
  detail_markdown: string
  meeting_outcome: 'positive' | 'neutral' | 'negative'
  follow_up_required: boolean
  importance: boolean
}

interface ClarificationQuestion {
  question: string
  type: 'yesno' | 'short'
  answer?: string
}

type Phase = 'memo' | 'loading' | 'result' | 'error'

interface Props {
  transcript: string
  meetingContext?: {
    companyName?: string
    dealName?: string
    contactName?: string
  }
  onStructured: (content: StructuredContent, questions: ClarificationQuestion[]) => void
  onBack: () => void
}

export default function StructuredReviewStep({ transcript, meetingContext, onStructured, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('memo')
  const [manualMemo, setManualMemo] = useState('')
  const [memoExpanded, setMemoExpanded] = useState(false)
  const [content, setContent] = useState<StructuredContent | null>(null)
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [reStructuring, setReStructuring] = useState(false)
  const [error, setError] = useState('')

  const fetchStructure = async (clarificationAnswers?: { question: string; answer: string }[], memo?: string) => {
    try {
      setPhase('loading')
      setError('')
      const res = await api.post('/meetings/structure', {
        transcript,
        meetingContext,
        clarificationAnswers,
        manualMemo: memo || manualMemo || undefined,
      })

      const data = res.data
      setContent({
        summary_one_liner: data.summary_one_liner || '',
        meeting_purpose: data.meeting_purpose || '',
        key_discussions: data.key_discussions || '',
        customer_needs: data.customer_needs || '',
        proposed_solution: data.proposed_solution || '',
        decisions: data.decisions || '',
        action_items: data.action_items || [],
        next_steps: data.next_steps || '',
        detail_markdown: data.detail_markdown || '',
        meeting_outcome: data.meeting_outcome || 'neutral',
        follow_up_required: data.follow_up_required ?? false,
        importance: data.importance ?? false,
      })
      setQuestions(data.clarification_questions || [])
      setAnswers({})
      setPhase('result')
    } catch {
      setError('AI 정리에 실패했습니다')
      setPhase('error')
    }
  }

  const handleReStructure = async () => {
    const answeredQuestions = questions
      .map((q, i) => ({ question: q.question, answer: answers[i] || '' }))
      .filter(a => a.answer)

    if (answeredQuestions.length === 0) return

    setReStructuring(true)
    await fetchStructure(answeredQuestions)
    setReStructuring(false)
  }

  const handleConfirm = () => {
    if (!content) return
    onStructured(content, questions)
  }

  const outcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'positive': return <ThumbsUp size={16} className="text-green-600" />
      case 'negative': return <ThumbsDown size={16} className="text-red-600" />
      default: return <Minus size={16} className="text-yellow-600" />
    }
  }

  const outcomeLabel = (outcome: string) => {
    switch (outcome) {
      case 'positive': return '긍정적'
      case 'negative': return '부정적'
      default: return '보통'
    }
  }

  const outcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'positive': return 'bg-green-50 text-green-700 border-green-200'
      case 'negative': return 'bg-red-50 text-red-700 border-red-200'
      default: return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    }
  }

  // 메모 입력 단계
  if (phase === 'memo') {
    return (
      <div className="max-w-lg mx-auto pb-6">
        <div className="flex items-center gap-3 mb-5 pt-2">
          <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
            <ChevronLeft size={24} className="text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">AI 정리 준비</h1>
        </div>

        {/* 트랜스크립트 미리보기 */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">녹음 내용 (변환됨)</p>
          <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">{transcript}</p>
        </div>

        {/* 추가 메모 (선택) */}
        <button
          onClick={() => setMemoExpanded(!memoExpanded)}
          className="w-full flex items-center gap-2 px-4 py-3 bg-white rounded-xl border border-gray-200 mb-2 text-sm font-medium text-gray-600"
        >
          <PenLine size={16} className="text-primary-500" />
          <span className="flex-1 text-left">추가 메모 (선택)</span>
          {memoExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {memoExpanded && (
          <div className="mb-4">
            <textarea
              value={manualMemo}
              onChange={(e) => setManualMemo(e.target.value)}
              placeholder="녹음에서 빠진 내용, 보충 사항, 핵심 키워드 등을 입력하세요..."
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-400 resize-none"
              rows={4}
            />
            <p className="text-xs text-gray-400 mt-1 px-1">
              AI가 높은 신뢰도로 반영합니다
            </p>
          </div>
        )}

        <button
          onClick={() => fetchStructure(undefined, manualMemo)}
          className="w-full py-4 bg-primary-600 text-white font-bold text-lg rounded-2xl hover:bg-primary-700 active:bg-primary-800 transition-colors shadow-lg"
        >
          AI 정리 시작
        </button>
      </div>
    )
  }

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={48} className="animate-spin text-primary-600 mb-6" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">AI가 내용을 정리하고 있습니다...</h2>
        <p className="text-gray-500 text-sm">잠시만 기다려주세요</p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <p className="text-red-500 mb-4">{error}</p>
        <button onClick={() => fetchStructure()} className="px-6 py-3 bg-primary-600 text-white rounded-xl">
          다시 시도
        </button>
      </div>
    )
  }

  if (!content) return null

  return (
    <div className="max-w-lg mx-auto pb-6">
      <div className="flex items-center gap-3 mb-5 pt-2">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ChevronLeft size={24} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">AI 정리 결과</h1>
      </div>

      {/* 1줄 요약 + 결과/플래그 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
        <p className="font-bold text-gray-900 text-base mb-3">{content.summary_one_liner}</p>
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${outcomeColor(content.meeting_outcome)}`}>
            {outcomeIcon(content.meeting_outcome)} {outcomeLabel(content.meeting_outcome)}
          </span>
          {content.follow_up_required && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
              <RotateCcw size={12} /> 후속조치 필요
            </span>
          )}
          {content.importance && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              <Star size={12} /> 중요
            </span>
          )}
        </div>
      </div>

      {/* 구조화된 섹션들 */}
      <div className="space-y-2">
        <Section icon={Target} title="미팅 목적" content={content.meeting_purpose} color="blue" />
        <Section icon={MessageSquare} title="주요 논의 내용" content={content.key_discussions} color="indigo" />
        <Section icon={AlertTriangle} title="고객 니즈 / Pain Point" content={content.customer_needs} color="orange" />
        <Section icon={Lightbulb} title="제안한 솔루션" content={content.proposed_solution} color="yellow" />
        <Section icon={CheckCircle2} title="결정 사항" content={content.decisions} color="green" />

        {/* 액션 아이템 */}
        {content.action_items.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <ListTodo size={16} className="text-purple-600" />
              <h3 className="text-sm font-semibold text-gray-700">액션 아이템</h3>
            </div>
            <div className="space-y-2">
              {content.action_items.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm bg-purple-50 rounded-xl px-3 py-2">
                  <span className="text-purple-400 mt-0.5">-</span>
                  <div>
                    <span className="text-gray-900">{item.task}</span>
                    <span className="text-purple-600 text-xs block">
                      {item.assignee} / {item.deadline}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Section icon={ArrowRight} title="다음 단계" content={content.next_steps} color="teal" />
      </div>

      {/* 확인 질문 */}
      {questions.length > 0 && (
        <div className="mt-4 bg-amber-50 rounded-2xl border border-amber-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle size={18} className="text-amber-600" />
            <h3 className="font-semibold text-amber-800">확인이 필요합니다</h3>
          </div>
          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={i}>
                <p className="text-sm text-gray-800 mb-2">{q.question}</p>
                {q.type === 'yesno' ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAnswers(prev => ({ ...prev, [i]: '예' }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        answers[i] === '예'
                          ? 'bg-primary-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-700'
                      }`}
                    >
                      예
                    </button>
                    <button
                      onClick={() => setAnswers(prev => ({ ...prev, [i]: '아니오' }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        answers[i] === '아니오'
                          ? 'bg-primary-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-700'
                      }`}
                    >
                      아니오
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={answers[i] || ''}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                    placeholder="답변 입력..."
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-400"
                  />
                )}
              </div>
            ))}
            <button
              onClick={handleReStructure}
              disabled={reStructuring || Object.keys(answers).length === 0}
              className="w-full py-3 bg-amber-600 text-white rounded-xl font-medium disabled:bg-gray-300 flex items-center justify-center gap-2"
            >
              {reStructuring ? (
                <><Loader2 size={16} className="animate-spin" /> 재정리 중...</>
              ) : (
                '답변 반영하여 재정리'
              )}
            </button>
          </div>
        </div>
      )}

      {/* 다음 버튼 */}
      <button
        onClick={handleConfirm}
        className="w-full mt-6 py-4 bg-primary-600 text-white font-bold text-lg rounded-2xl hover:bg-primary-700 active:bg-primary-800 transition-colors shadow-lg"
      >
        다음
      </button>
    </div>
  )
}

// 섹션 컴포넌트
function Section({ icon: Icon, title, content, color }: {
  icon: any
  title: string
  content: string
  color: string
}) {
  if (!content) return null

  const colorMap: Record<string, string> = {
    blue: 'text-blue-600',
    indigo: 'text-indigo-600',
    orange: 'text-orange-600',
    yellow: 'text-yellow-600',
    green: 'text-green-600',
    teal: 'text-teal-600',
    purple: 'text-purple-600',
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={colorMap[color] || 'text-gray-600'} />
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  )
}

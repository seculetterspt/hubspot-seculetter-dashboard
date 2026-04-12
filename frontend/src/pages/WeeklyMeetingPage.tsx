import { useState, useEffect, useCallback } from 'react'
import { Calendar, Plus, Save, Loader2, Trash2, Link, ExternalLink, ChevronDown, ChevronUp, RefreshCw, Search } from 'lucide-react'
import { api } from '../services/api'

interface MatchedDeal {
  id: string
  name: string
  stage?: string
  amount?: number
}

interface ParsedItem {
  companyName: string
  content: string
  matchedDeals: MatchedDeal[]
}

interface WeeklyMeeting {
  id: number
  meeting_date: string
  created_by: string
  raw_content: string
  parsed_items: ParsedItem[]
  created_at: string
  updated_at: string
}

// 이번 주 월요일 날짜 계산
function getThisMonday(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

// 날짜 포맷
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })
}

// 금액 포맷
function formatAmount(amount?: number): string {
  if (!amount) return ''
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억원`
  }
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(0)}만원`
  }
  return `${amount.toLocaleString()}원`
}

export default function WeeklyMeetingPage() {
  const [meetings, setMeetings] = useState<WeeklyMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(getThisMonday())
  const [rawContent, setRawContent] = useState('')
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([])
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())
  const [searchingDeals, setSearchingDeals] = useState<number | null>(null)
  const [dealSearchQuery, setDealSearchQuery] = useState('')
  const [dealSearchResults, setDealSearchResults] = useState<MatchedDeal[]>([])
  const [showDealSearch, setShowDealSearch] = useState<number | null>(null)

  // 주간회의 목록 로드
  const loadMeetings = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/weekly-meetings')
      setMeetings(res.data.meetings || [])
    } catch (error) {
      console.error('Failed to load meetings:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // 특정 날짜 회의 로드
  const loadMeetingByDate = useCallback(async (date: string) => {
    try {
      const res = await api.get(`/weekly-meetings/${date}`)
      if (res.data.meeting) {
        setRawContent(res.data.meeting.raw_content || '')
        setParsedItems(res.data.meeting.parsed_items || [])
      } else {
        setRawContent('')
        setParsedItems([])
      }
    } catch (error) {
      console.error('Failed to load meeting:', error)
      setRawContent('')
      setParsedItems([])
    }
  }, [])

  useEffect(() => {
    loadMeetings()
  }, [loadMeetings])

  useEffect(() => {
    loadMeetingByDate(selectedDate)
  }, [selectedDate, loadMeetingByDate])

  // 내용 파싱 (LLM + HubSpot 딜 매칭)
  const handleParse = async () => {
    if (!rawContent.trim()) return

    try {
      setParsing(true)
      const res = await api.post('/weekly-meetings/parse', { content: rawContent })
      setParsedItems(res.data.items || [])
      // 모든 아이템 확장
      setExpandedItems(new Set(res.data.items.map((_: any, i: number) => i)))
    } catch (error) {
      console.error('Failed to parse content:', error)
      alert('파싱 실패. 다시 시도해주세요.')
    } finally {
      setParsing(false)
    }
  }

  // 저장
  const handleSave = async () => {
    if (!rawContent.trim()) return

    try {
      setSaving(true)
      await api.post('/weekly-meetings', {
        meetingDate: selectedDate,
        rawContent,
        parsedItems
      })
      alert('저장되었습니다.')
      loadMeetings()
    } catch (error) {
      console.error('Failed to save:', error)
      alert('저장 실패. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  // 딜 검색
  const handleDealSearch = async (query: string, itemIndex: number) => {
    if (query.length < 2) {
      setDealSearchResults([])
      return
    }

    try {
      setSearchingDeals(itemIndex)
      const res = await api.get(`/weekly-meetings/search/deals?q=${encodeURIComponent(query)}`)
      setDealSearchResults(res.data.deals || [])
    } catch (error) {
      console.error('Failed to search deals:', error)
    } finally {
      setSearchingDeals(null)
    }
  }

  // 딜 추가
  const handleAddDeal = (itemIndex: number, deal: MatchedDeal) => {
    const newItems = [...parsedItems]
    const item = newItems[itemIndex]
    if (!item.matchedDeals.find(d => d.id === deal.id)) {
      item.matchedDeals = [...item.matchedDeals, deal]
      setParsedItems(newItems)
    }
    setShowDealSearch(null)
    setDealSearchQuery('')
    setDealSearchResults([])
  }

  // 딜 제거
  const handleRemoveDeal = (itemIndex: number, dealId: string) => {
    const newItems = [...parsedItems]
    newItems[itemIndex].matchedDeals = newItems[itemIndex].matchedDeals.filter(d => d.id !== dealId)
    setParsedItems(newItems)
  }

  // 아이템 확장/축소
  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedItems(newExpanded)
  }

  // 삭제
  const handleDelete = async (id: number) => {
    if (!confirm('이 주간회의 기록을 삭제하시겠습니까?')) return

    try {
      await api.delete(`/weekly-meetings/${id}`)
      loadMeetings()
      if (meetings.find(m => m.id === id)?.meeting_date === selectedDate) {
        setRawContent('')
        setParsedItems([])
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('삭제 실패')
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">주간회의</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 이전 회의 목록 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-4">지난 회의</h2>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : meetings.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">
                기록된 주간회의가 없습니다.
              </p>
            ) : (
              <div className="space-y-2">
                {meetings.map(meeting => (
                  <div
                    key={meeting.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedDate === meeting.meeting_date
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedDate(meeting.meeting_date)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {formatDate(meeting.meeting_date)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(meeting.id)
                        }}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {(meeting.parsed_items || []).length}개 항목
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* 새 회의 추가 버튼 */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                날짜 선택
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* 오른쪽: 입력/편집 영역 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 입력 영역 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">
                {formatDate(selectedDate)} 회의 내용
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleParse}
                  disabled={parsing || !rawContent.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {parsing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  파싱 + 딜 매칭
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !rawContent.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  저장
                </button>
              </div>
            </div>

            <textarea
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              placeholder={`주간회의 내용을 입력하세요.

예시:
한국투자증권 : POC 시나리오 자료 전달, 차주 POC 연동 관련하여 고객사와 미팅 진행

법무부 : 차주 월요일 제품 시연 및 제품 설명 진행 예정

비엔씨 : 진주저축은행 건 영업 파트너로 신규 파트너사 등록 진행`}
              className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
          </div>

          {/* 파싱 결과 */}
          {parsedItems.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 mb-4">
                파싱 결과 ({parsedItems.length}개 항목)
              </h2>
              <div className="space-y-3">
                {parsedItems.map((item, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* 헤더 */}
                    <div
                      className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer"
                      onClick={() => toggleExpand(index)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-900">
                          {item.companyName}
                        </span>
                        {item.matchedDeals.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                            <Link size={12} />
                            {item.matchedDeals.length}개 딜 연결
                          </span>
                        )}
                      </div>
                      {expandedItems.has(index) ? (
                        <ChevronUp size={18} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={18} className="text-gray-400" />
                      )}
                    </div>

                    {/* 확장 내용 */}
                    {expandedItems.has(index) && (
                      <div className="px-4 py-3 space-y-4">
                        {/* 내용 */}
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 mb-1">내용</h4>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {item.content}
                          </p>
                        </div>

                        {/* 연결된 딜 */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-medium text-gray-500">연결된 HubSpot 딜</h4>
                            <button
                              onClick={() => setShowDealSearch(showDealSearch === index ? null : index)}
                              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                            >
                              <Plus size={14} />
                              딜 추가
                            </button>
                          </div>

                          {/* 딜 검색 UI */}
                          {showDealSearch === index && (
                            <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                              <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input
                                  type="text"
                                  value={dealSearchQuery}
                                  onChange={(e) => {
                                    setDealSearchQuery(e.target.value)
                                    handleDealSearch(e.target.value, index)
                                  }}
                                  placeholder="딜 이름으로 검색..."
                                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                  autoFocus
                                />
                              </div>
                              {searchingDeals === index && (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                </div>
                              )}
                              {dealSearchResults.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {dealSearchResults.map(deal => (
                                    <button
                                      key={deal.id}
                                      onClick={() => handleAddDeal(index, deal)}
                                      className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-white rounded-lg"
                                    >
                                      <span>{deal.name}</span>
                                      {deal.amount && (
                                        <span className="text-gray-500">
                                          {formatAmount(deal.amount)}
                                        </span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 연결된 딜 목록 */}
                          {item.matchedDeals.length > 0 ? (
                            <div className="space-y-2">
                              {item.matchedDeals.map(deal => (
                                <div
                                  key={deal.id}
                                  className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-lg"
                                >
                                  <div className="flex items-center gap-2">
                                    <a
                                      href={`https://app.hubspot.com/contacts/243367573/deal/${deal.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm font-medium text-green-700 hover:text-green-800 flex items-center gap-1"
                                    >
                                      {deal.name}
                                      <ExternalLink size={12} />
                                    </a>
                                    {deal.amount && (
                                      <span className="text-xs text-green-600">
                                        ({formatAmount(deal.amount)})
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleRemoveDeal(index, deal.id)}
                                    className="p-1 text-green-600 hover:text-red-500"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400">
                              연결된 딜이 없습니다. 위 버튼으로 수동 추가하세요.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

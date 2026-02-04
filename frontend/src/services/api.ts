import axios from 'axios'

// Use same domain for API calls (backend serves frontend)
const baseURL = '/api'

export const api = axios.create({
  baseURL,
  timeout: 120000, // 2분 타임아웃 (딜 그룹화 + AI 요약 생성 시간 고려)
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

// API functions
export const analyticsApi = {
  getOverview: () => api.get('/analytics/overview'),
  getTrends: (period = 'daily', range = 30) =>
    api.get(`/analytics/trends?period=${period}&range=${range}`),
  getPipeline: () => api.get('/analytics/pipeline'),
  getStalledDeals: () => api.get('/analytics/stalled-deals'),
  getTodayTasks: () => api.get('/analytics/today-tasks'),
  getTeamPerformance: () => api.get('/analytics/team-performance'),
  getForecast: () => api.get('/analytics/forecast'),
  getPocStatus: () => api.get('/analytics/poc-status'),
  getContacts: () => api.get('/analytics/contacts'),
  getCompanies: () => api.get('/analytics/companies'),
  getTickets: () => api.get('/analytics/tickets'),
  getActivities: () => api.get('/analytics/activities'),
  getTodayModified: () => api.get('/analytics/today-modified'),
  getDealSummary: (year?: number, pipelineId?: string) => {
    const params = new URLSearchParams()
    if (year) params.append('year', year.toString())
    if (pipelineId) params.append('pipelineId', pipelineId)
    const queryString = params.toString()
    return api.get(`/analytics/deal-summary${queryString ? `?${queryString}` : ''}`)
  },
  getDealRecentActivities: (year?: number, pipelineId?: string, days?: number) => {
    const params = new URLSearchParams()
    if (year) params.append('year', year.toString())
    if (pipelineId) params.append('pipelineId', pipelineId)
    if (days) params.append('days', days.toString())
    const queryString = params.toString()
    return api.get(`/analytics/deal-recent-activities${queryString ? `?${queryString}` : ''}`)
  },
  // 통합된 활동 타임라인 API (딜별 그룹화 지원)
  getActivityTimelineWithDeals: (options: {
    from?: string
    to?: string
    year?: number
    pipelineId?: string
    includeAssociations?: boolean
    groupByDeals?: boolean
    generateSummaries?: boolean
  }) => {
    const params = new URLSearchParams()
    if (options.from) params.append('from', options.from)
    if (options.to) params.append('to', options.to)
    if (options.year) params.append('year', options.year.toString())
    if (options.pipelineId) params.append('pipelineId', options.pipelineId)
    if (options.includeAssociations) params.append('includeAssociations', 'true')
    if (options.groupByDeals) params.append('groupByDeals', 'true')
    if (options.generateSummaries) params.append('generateSummaries', 'true')
    const queryString = params.toString()
    return api.get(`/analytics/activity-timeline${queryString ? `?${queryString}` : ''}`)
  },
}

// Snapshot API functions
export const snapshotApi = {
  // 주간 비교 데이터 조회
  getComparison: (pipelineId: string, year?: number) => {
    const params = new URLSearchParams()
    params.append('pipelineId', pipelineId)
    if (year) params.append('year', year.toString())
    return api.get(`/snapshot/comparison?${params.toString()}`)
  },
  // 스냅샷 수동 생성
  createSnapshot: (date?: string) => {
    return api.post('/snapshot/create', { date })
  },
  // 스냅샷 이력 조회
  getHistory: (pipelineId: string, year?: number, limit?: number) => {
    const params = new URLSearchParams()
    params.append('pipelineId', pipelineId)
    if (year) params.append('year', year.toString())
    if (limit) params.append('limit', limit.toString())
    return api.get(`/snapshot/history?${params.toString()}`)
  },
}

export default api

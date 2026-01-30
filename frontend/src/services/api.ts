import axios from 'axios'

const baseURL = import.meta.env.PROD
  ? 'https://seculetter-hubspot-api.onrender.com/api'
  : 'http://localhost:3001/api'

export const api = axios.create({
  baseURL,
  timeout: 10000,
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

export default api

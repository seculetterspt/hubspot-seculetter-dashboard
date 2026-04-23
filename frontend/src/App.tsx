import { Routes, Route, Outlet } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { LoginPage } from './pages/LoginPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import ActivityTimelinePage from './pages/ActivityTimelinePage'
import DealSummaryPage from './pages/DealSummaryPage'
import MeetingLogPage from './pages/MeetingLogPage'
import MeetingRecordsPage from './pages/MeetingRecordsPage'
import WeeklyReportListPage from './pages/WeeklyReportListPage'
import WeeklyReportNewPage from './pages/WeeklyReportNewPage'
import WeeklyReportDetailPage from './pages/WeeklyReportDetailPage'

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <Layout>
        <Outlet />
      </Layout>
    </ProtectedRoute>
  )
}

function App() {
  return (
    <Routes>
      {/* Public login route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected routes with layout */}
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<ActivityTimelinePage />} />
        <Route path="/meeting/new" element={<MeetingLogPage />} />
        <Route path="/meeting/records" element={<MeetingRecordsPage />} />
        <Route path="/deals" element={<DealSummaryPage />} />
        <Route path="/weekly" element={<WeeklyReportListPage />} />
        <Route path="/weekly/new" element={<WeeklyReportNewPage />} />
        <Route path="/weekly/:id" element={<WeeklyReportDetailPage />} />
      </Route>
    </Routes>
  )
}

export default App

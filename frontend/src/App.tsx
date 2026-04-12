import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { LoginPage } from './pages/LoginPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import ActivityTimelinePage from './pages/ActivityTimelinePage'
import DealSummaryPage from './pages/DealSummaryPage'
import MeetingLogPage from './pages/MeetingLogPage'
import MeetingRecordsPage from './pages/MeetingRecordsPage'
import WeeklyMeetingPage from './pages/WeeklyMeetingPage'

function App() {
  return (
    <Routes>
      {/* Public login route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<ActivityTimelinePage />} />
                <Route path="/meeting/new" element={<MeetingLogPage />} />
                <Route path="/meeting/records" element={<MeetingRecordsPage />} />
                <Route path="/deals" element={<DealSummaryPage />} />
                <Route path="/weekly" element={<WeeklyMeetingPage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App

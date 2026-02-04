import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ActivityTimelinePage from './pages/ActivityTimelinePage'
import DealSummaryPage from './pages/DealSummaryPage'
import MeetingLogPage from './pages/MeetingLogPage'
import MeetingRecordsPage from './pages/MeetingRecordsPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ActivityTimelinePage />} />
        <Route path="/meeting/new" element={<MeetingLogPage />} />
        <Route path="/meeting/records" element={<MeetingRecordsPage />} />
        <Route path="/deals" element={<DealSummaryPage />} />
      </Routes>
    </Layout>
  )
}

export default App

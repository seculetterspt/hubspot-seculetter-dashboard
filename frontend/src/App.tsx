import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ActivityTimelinePage from './pages/ActivityTimelinePage'
import DealSummaryPage from './pages/DealSummaryPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ActivityTimelinePage />} />
        <Route path="/deals" element={<DealSummaryPage />} />
      </Routes>
    </Layout>
  )
}

export default App

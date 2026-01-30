import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import OverviewPage from './pages/OverviewPage'
import DealsPage from './pages/DealsPage'
import ContactsPage from './pages/ContactsPage'
import ActivitiesPage from './pages/ActivitiesPage'
import ForecastPage from './pages/ForecastPage'
import PocPage from './pages/PocPage'
import TodayModifiedPage from './pages/TodayModifiedPage'
import DailyComparisonPage from './pages/DailyComparisonPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/today" element={<TodayModifiedPage />} />
        <Route path="/comparison" element={<DailyComparisonPage />} />
        <Route path="/deals" element={<DealsPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/activities" element={<ActivitiesPage />} />
        <Route path="/forecast" element={<ForecastPage />} />
        <Route path="/poc" element={<PocPage />} />
      </Routes>
    </Layout>
  )
}

export default App

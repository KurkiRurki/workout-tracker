import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import LogPage from './pages/LogPage.jsx'
import PlanPage from './pages/PlanPage.jsx'
import ProgressPage from './pages/ProgressPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/"         element={<Dashboard />} />
        <Route path="/log"      element={<LogPage />} />
        <Route path="/plan"     element={<PlanPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

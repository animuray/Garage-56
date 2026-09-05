import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import PublicLayout from './components/layout/PublicLayout'
import CRMLayout from './components/layout/CRMLayout'
import HomePage from './pages/public/HomePage'
import ServicesPage from './pages/public/ServicesPage'
import BookingPage from './pages/public/BookingPage'
import LoginPage from './pages/crm/LoginPage'
import DashboardPage from './pages/crm/DashboardPage'
import AppointmentsPage from './pages/crm/AppointmentsPage'
import ClientsPage from './pages/crm/ClientsPage'
import CarsPage from './pages/crm/CarsPage'
import CorporatePage from './pages/crm/CorporatePage'
import WarehousePage from './pages/crm/WarehousePage'
import AnalyticsPage from './pages/crm/AnalyticsPage'
import MasterPage from './pages/crm/MasterPage'
import SettingsPage from './pages/crm/SettingsPage'
import EmployeesPage from './pages/crm/EmployeesPage'
import CRMServicesPage from './pages/crm/ServicesPage'
import PrivacyPage from './pages/public/PrivacyPage'

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const { user, isAuthenticated } = useAuth()

  return (
    <Routes>
      {/* Public routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/booking" element={<BookingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
      </Route>

      {/* Login */}
      <Route
        path="/login"
        element={isAuthenticated ? (
          user?.role === 'master' ? <Navigate to="/master" replace /> :
          user?.role === 'corporate' ? <Navigate to="/corporate" replace /> :
          <Navigate to="/crm" replace />
        ) : <LoginPage />}
      />

      {/* CRM — admin / owner */}
      <Route
        path="/crm"
        element={
          <ProtectedRoute roles={['admin', 'owner']}>
            <CRMLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/crm/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="cars" element={<CarsPage />} />
        <Route path="corporate" element={<CorporatePage />} />
        <Route path="warehouse" element={<WarehousePage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="services" element={<CRMServicesPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Master cabinet */}
      <Route
        path="/master"
        element={
          <ProtectedRoute roles={['master', 'admin', 'owner']}>
            <CRMLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<MasterPage />} />
      </Route>

      {/* Corporate client cabinet */}
      <Route
        path="/corporate"
        element={
          <ProtectedRoute roles={['corporate', 'admin', 'owner']}>
            <CRMLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<CorporatePage corporateView />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

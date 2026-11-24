import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { GuestOnly, RequireAdmin, RequireAuth } from './components/RouteGuards'
import Layout from './components/Layout'
import AuthPage from './pages/AuthPage'
import TriageQueue from './pages/TriageQueue'
import Resources from './pages/Resources'
import ResourceDetail from './pages/ResourceDetail'
import MyBookings from './pages/MyBookings'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route element={<GuestOnly />}>
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/register" element={<AuthPage mode="register" />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route path="/" element={<TriageQueue />} />
                <Route path="/resources" element={<Resources />} />
                <Route path="/resources/:id" element={<ResourceDetail />} />
                <Route path="/bookings" element={<MyBookings />} />
                <Route element={<RequireAdmin />}>
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

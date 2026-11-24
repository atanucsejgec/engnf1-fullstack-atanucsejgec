import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LoadingState } from './ui'

// Logged-in users only; others are sent to /login and come back afterwards
export function RequireAuth() {
  const { user, checking } = useAuth()
  const location = useLocation()
  if (checking) return <LoadingState text="Checking your session…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

// Admin pages: a normal user is sent back to the queue
export function RequireAdmin() {
  const { isAdmin } = useAuth()
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />
}

// Login/register: already logged-in users skip straight to the app
export function GuestOnly() {
  const { user, checking } = useAuth()
  if (checking) return <LoadingState />
  return user ? <Navigate to="/" replace /> : <Outlet />
}

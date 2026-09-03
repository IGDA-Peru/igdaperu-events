import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { LoadingState } from './Feedback'

export function ProtectedRoute() {
  const { loading, user } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingState label="Verificando sesión" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

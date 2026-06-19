import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import KandooLoader from './KandooLoader';

export default function ProtectedRoute({ children }) {
  const { user, isGuest, loading } = useAuth();

  if (loading) return <KandooLoader fullscreen message="Opening your workspace…" />;
  if (!user && !isGuest) return <Navigate to="/login" replace />;
  return children;
}


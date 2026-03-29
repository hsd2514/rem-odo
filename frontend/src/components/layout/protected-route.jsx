import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/auth-context";

export function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/auth" replace />;
}

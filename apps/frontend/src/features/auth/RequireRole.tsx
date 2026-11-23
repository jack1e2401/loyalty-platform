import { Navigate, Outlet } from "react-router-dom";
import { useAuthSession, routeForRole } from "../../api/auth-session";
import type { BackendRole } from "../../api/contracts/auth";

export function RequireRole({ role }: { role: BackendRole }) {
  const { user } = useAuthSession();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={routeForRole(user.role)} replace />;
  return <Outlet />;
}

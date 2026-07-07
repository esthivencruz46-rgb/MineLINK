import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useMineroAuth } from "../context/MineroAuthContext";

export function ProtectedRouteMinero({ children }: { children: ReactNode }) {
  const { token } = useMineroAuth();

  if (!token) {
    return <Navigate to="/ingresar" replace />;
  }

  return <>{children}</>;
}

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useInversionistaAuth } from "../context/InversionistaAuthContext";

export function ProtectedRouteInversionista({ children }: { children: ReactNode }) {
  const { token } = useInversionistaAuth();

  if (!token) {
    return <Navigate to="/ingresar-inversionista" replace />;
  }

  return <>{children}</>;
}

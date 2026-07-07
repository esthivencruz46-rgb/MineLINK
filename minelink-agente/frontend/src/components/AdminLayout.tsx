import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ENLACES = [
  { to: "/admin", label: "Dashboard", fin: true },
  { to: "/admin/empresas", label: "Empresas" },
  { to: "/admin/leads", label: "Leads" },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function salir() {
    logout();
    navigate("/admin/login");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <nav className="flex gap-4">
          {ENLACES.map((e) => (
            <NavLink
              key={e.to}
              to={e.to}
              end={e.fin}
              className={({ isActive }) =>
                `min-h-[44px] content-center border-b-2 px-1 font-medium ${
                  isActive
                    ? "border-acento text-acento"
                    : "border-transparent text-texto-suave dark:text-texto-suave-dark"
                }`
              }
            >
              {e.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={salir}
          className="min-h-[44px] rounded-lg border border-black/10 px-4 text-sm font-semibold dark:border-white/10"
        >
          Cerrar sesión
        </button>
      </div>
      {children}
    </div>
  );
}

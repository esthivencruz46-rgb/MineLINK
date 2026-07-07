import { createContext, useContext, useState, type ReactNode } from "react";
import { BASE_URL } from "../config/apiUrl";

interface AuthContextValue {
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  authFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

// JWT SOLO en memoria (useState), NUNCA en localStorage: si recarga la
// página, Esthiven vuelve a loguearse. Es un solo usuario, no es fricción
// real (regla dura de agents/admin.md).
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  async function login(username: string, password: string) {
    const resp = await fetch(`${BASE_URL}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!resp.ok) {
      throw new Error("Usuario o contraseña incorrectos");
    }
    const data = await resp.json();
    setToken(data.access_token as string);
  }

  function logout() {
    setToken(null);
  }

  async function authFetch(path: string, options: RequestInit = {}) {
    const resp = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        Authorization: `Bearer ${token ?? ""}`,
      },
    });
    if (resp.status === 401) {
      setToken(null);
    }
    return resp;
  }

  return (
    <AuthContext.Provider value={{ token, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

import { createContext, useContext, useState, type ReactNode } from "react";
import { BASE_URL } from "../config/apiUrl";

interface MineroAuthContextValue {
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  authFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

// JWT SOLO en memoria (useState), NUNCA en localStorage: si recarga la
// página, el minero vuelve a loguearse (mismo criterio que el admin).
const MineroAuthContext = createContext<MineroAuthContextValue | null>(null);

export function MineroAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  async function login(username: string, password: string) {
    const resp = await fetch(`${BASE_URL}/mineros/login`, {
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
    <MineroAuthContext.Provider value={{ token, login, logout, authFetch }}>
      {children}
    </MineroAuthContext.Provider>
  );
}

export function useMineroAuth(): MineroAuthContextValue {
  const ctx = useContext(MineroAuthContext);
  if (!ctx) throw new Error("useMineroAuth debe usarse dentro de MineroAuthProvider");
  return ctx;
}

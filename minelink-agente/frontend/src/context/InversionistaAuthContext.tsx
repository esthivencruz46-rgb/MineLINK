import { createContext, useContext, useState, type ReactNode } from "react";
import { BASE_URL } from "../config/apiUrl";

interface InversionistaAuthContextValue {
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  /** Usado tras recuperar la contraseña: el backend ya entrega un token
   * válido junto con la confirmación, sin pedir login de nuevo. */
  establecerToken: (token: string) => void;
  logout: () => void;
  authFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

// JWT SOLO en memoria (useState), NUNCA en localStorage — mismo criterio
// que el admin y el minero.
const InversionistaAuthContext = createContext<InversionistaAuthContextValue | null>(null);

export function InversionistaAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  async function login(username: string, password: string) {
    const resp = await fetch(`${BASE_URL}/inversionistas/login`, {
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
    <InversionistaAuthContext.Provider
      value={{ token, login, establecerToken: setToken, logout, authFetch }}
    >
      {children}
    </InversionistaAuthContext.Provider>
  );
}

export function useInversionistaAuth(): InversionistaAuthContextValue {
  const ctx = useContext(InversionistaAuthContext);
  if (!ctx) throw new Error("useInversionistaAuth debe usarse dentro de InversionistaAuthProvider");
  return ctx;
}

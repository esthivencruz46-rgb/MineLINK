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

const CLAVE_TOKEN = "minelink_token_inversionista";

// Sesión persistida en localStorage (agosto 2026, pedido explícito de
// Esthiven: "como en eToro, si ya inició sesión se mantiene hasta que
// quiera cerrarla") — mismo cambio y mismo motivo que MineroAuthContext.tsx.
// El JWT del inversionista YA dura 30 días en el backend
// (auth.MINERO_TOKEN_EXPIRE_MINUTES, se reusa para ambos roles). Distinto
// del admin (AuthContext.tsx), que sigue en memoria a propósito.
const InversionistaAuthContext = createContext<InversionistaAuthContextValue | null>(null);

function tokenInicial(): string | null {
  return localStorage.getItem(CLAVE_TOKEN);
}

export function InversionistaAuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(tokenInicial);

  function setToken(nuevo: string | null) {
    setTokenState(nuevo);
    if (nuevo) {
      localStorage.setItem(CLAVE_TOKEN, nuevo);
    } else {
      localStorage.removeItem(CLAVE_TOKEN);
    }
  }

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
    // 401 = el token ya no es válido para el servidor (expiró o se
    // revocó) -- se limpia también de localStorage, no solo de memoria.
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

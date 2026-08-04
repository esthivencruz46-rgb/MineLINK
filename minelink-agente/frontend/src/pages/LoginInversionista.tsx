import { useState } from "react";
import { useTitulo } from "../hooks/useTitulo";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { CampoPassword } from "../components/CampoPassword";
import { BotonIngresarConHuella } from "../components/BotonIngresarConHuella";
import { useInversionistaAuth } from "../context/InversionistaAuthContext";

export function LoginInversionista() {
  useTitulo("Ingresar como inversionista");
  const { token, login, establecerToken } = useInversionistaAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (token) {
    return <Navigate to="/mi-cuenta-inversionista" replace />;
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await login(username, password);
      navigate("/mi-cuenta-inversionista");
    } catch {
      setError("Usuario o contraseña incorrectos");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold">Ingresa a tu cuenta de inversionista</h1>
      <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
        Usa el usuario y contraseña que elegiste al dejar tu interés en un proyecto.
      </p>
      <BotonIngresarConHuella
        rol="inversionista"
        onIngresar={(t) => {
          establecerToken(t);
          navigate("/mi-cuenta-inversionista");
        }}
      />
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <input
          className="min-h-[44px] border border-black/10 bg-transparent px-3 transition-colors focus:border-acento focus:outline-none dark:border-white/10"
          placeholder="Usuario"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <CampoPassword
          placeholder="Contraseña"
          name="current-password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          disabled={enviando || !username || !password}
          className="min-h-[44px] bg-acento font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-acento/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {enviando ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
      <Link
        to="/recuperar-password-inversionista"
        className="text-center text-sm text-texto-suave underline dark:text-texto-suave-dark"
      >
        ¿Olvidaste tu contraseña? Recupérala aquí
      </Link>
    </div>
  );
}

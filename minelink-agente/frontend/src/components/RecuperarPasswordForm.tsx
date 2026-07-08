import { useState } from "react";
import { CampoPassword } from "./CampoPassword";
import { BASE_URL } from "../config/apiUrl";

interface Props {
  /** "/mineros" o "/inversionistas" */
  apiPrefix: string;
  onExito: (token: string) => void;
}

type Paso = "usuario" | "respuesta";

/** Recuperación de contraseña autoservicio: el usuario escribe su
 * usuario, le mostramos SU pregunta de seguridad (la que él eligió al
 * registrarse) y si la responde bien (4 intentos) elige una contraseña
 * nueva y queda logueado. Reutilizado por mineros e inversionistas. */
export function RecuperarPasswordForm({ apiPrefix, onExito }: Props) {
  const [paso, setPaso] = useState<Paso>("usuario");
  const [username, setUsername] = useState("");
  const [pregunta, setPregunta] = useState("");
  const [respuesta, setRespuesta] = useState("");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buscarPregunta(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const resp = await fetch(
        `${BASE_URL}${apiPrefix}/pregunta-seguridad/${encodeURIComponent(username.trim())}`
      );
      if (!resp.ok) {
        const detalle = await resp.json().catch(() => null);
        throw new Error(
          detalle?.detail ??
            "No encontramos una pregunta de seguridad para ese usuario."
        );
      }
      const data = await resp.json();
      setPregunta(data.pregunta);
      setPaso("respuesta");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  async function enviarRespuesta(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const resp = await fetch(`${BASE_URL}${apiPrefix}/recuperar-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          respuesta_seguridad: respuesta,
          nueva_password: nuevaPassword,
        }),
      });
      if (!resp.ok) {
        const detalle = await resp.json().catch(() => null);
        throw new Error(detalle?.detail ?? "No pudimos procesar tu solicitud.");
      }
      const data = await resp.json();
      onExito(data.access_token as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  const passwordsCoinciden = nuevaPassword === confirmarPassword;
  const passwordValida = nuevaPassword.length >= 6;

  if (paso === "usuario") {
    return (
      <form onSubmit={buscarPregunta} className="flex flex-col gap-3">
        <input
          className="min-h-[44px] rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
          placeholder="Tu usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          disabled={cargando || !username.trim()}
          className="min-h-[44px] rounded-lg bg-acento font-semibold text-white disabled:opacity-50"
        >
          {cargando ? "Buscando..." : "Continuar"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={enviarRespuesta} className="flex flex-col gap-3">
      <div className="rounded-lg bg-acento/5 p-3 text-sm dark:bg-acento/10">
        <p className="font-semibold">{pregunta}</p>
      </div>
      <input
        className="min-h-[44px] rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
        placeholder="Tu respuesta"
        value={respuesta}
        onChange={(e) => setRespuesta(e.target.value)}
        autoFocus
      />
      <CampoPassword
        placeholder="Nueva contraseña (mín. 6 caracteres)"
        value={nuevaPassword}
        onChange={setNuevaPassword}
      />
      <CampoPassword
        placeholder="Repite la nueva contraseña"
        value={confirmarPassword}
        onChange={setConfirmarPassword}
      />
      {confirmarPassword.length > 0 && !passwordsCoinciden && (
        <p className="text-sm text-red-500">Las contraseñas no coinciden</p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        disabled={cargando || !respuesta.trim() || !passwordValida || !passwordsCoinciden}
        className="min-h-[44px] rounded-lg bg-acento font-semibold text-white disabled:opacity-50"
      >
        {cargando ? "Verificando..." : "Cambiar contraseña"}
      </button>
    </form>
  );
}

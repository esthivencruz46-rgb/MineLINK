import { useState } from "react";
import { CampoPassword } from "./CampoPassword";

interface Props {
  codigoReinfoInicial?: string;
  enviando: boolean;
  error?: string;
  onCerrar: () => void;
  onEnviar: (datos: {
    nombre: string;
    whatsapp: string;
    email: string;
    nombreOperacion: string;
    codigoReinfo: string;
    username: string;
    password: string;
  }) => void;
}

export function RegistroMineroModal({
  codigoReinfoInicial,
  enviando,
  error,
  onCerrar,
  onEnviar,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("+51");
  const [email, setEmail] = useState("");
  const [nombreOperacion, setNombreOperacion] = useState("");
  const [codigoReinfo, setCodigoReinfo] = useState(codigoReinfoInicial ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");

  const usernameValido = username.trim().length >= 3;
  const passwordValida = password.length >= 6;
  const passwordsCoinciden = password === confirmarPassword;

  const valido =
    nombre.trim().length > 0 &&
    /^\+51\d{9}$/.test(whatsapp) &&
    usernameValido &&
    passwordValida &&
    passwordsCoinciden;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4">
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-tarjeta p-6 dark:bg-tarjeta-dark md:max-h-[90vh] md:rounded-2xl">
        <h2 className="text-lg font-bold">Regístrate para que te ayudemos</h2>
        <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
          No compartimos tus datos con nadie más. Crea un usuario y contraseña
          para volver a ver tus datos cuando quieras.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <input
            className="min-h-[44px] rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
            placeholder="Tu nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <input
            className="min-h-[44px] rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
            placeholder="+51987654321"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
          <input
            className="min-h-[44px] rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
            placeholder="Nombre de tu operación o labor (opcional)"
            value={nombreOperacion}
            onChange={(e) => setNombreOperacion(e.target.value)}
          />
          <input
            className="min-h-[44px] rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
            placeholder="Email (opcional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="min-h-[44px] rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
            placeholder="Código REINFO (opcional)"
            value={codigoReinfo}
            onChange={(e) => setCodigoReinfo(e.target.value)}
          />

          <hr className="my-1 border-black/10 dark:border-white/10" />

          <input
            className="min-h-[44px] rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
            placeholder="Elige un usuario (mín. 3 caracteres)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <CampoPassword
            placeholder="Elige una contraseña (mín. 6 caracteres)"
            value={password}
            onChange={setPassword}
          />
          <CampoPassword
            placeholder="Repite la contraseña"
            value={confirmarPassword}
            onChange={setConfirmarPassword}
          />
          {password.length > 0 && !passwordsCoinciden && (
            <p className="text-sm text-red-500">Las contraseñas no coinciden</p>
          )}
        </div>

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onCerrar}
            className="min-h-[44px] flex-1 rounded-lg border border-black/10 font-semibold dark:border-white/10"
          >
            Cancelar
          </button>
          <button
            disabled={!valido || enviando}
            onClick={() =>
              onEnviar({
                nombre: nombre.trim(),
                whatsapp,
                email: email.trim(),
                nombreOperacion: nombreOperacion.trim(),
                codigoReinfo: codigoReinfo.trim(),
                username: username.trim(),
                password,
              })
            }
            className="min-h-[44px] flex-1 rounded-lg bg-acento font-semibold text-white disabled:opacity-50"
          >
            {enviando ? "Enviando..." : "Registrarme"}
          </button>
        </div>
      </div>
    </div>
  );
}

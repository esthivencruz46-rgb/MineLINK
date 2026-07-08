import { useState } from "react";
import { CampoPassword } from "./CampoPassword";
import { CampoPreguntaSeguridad } from "./CampoPreguntaSeguridad";
import { CampoTelefono } from "./CampoTelefono";

interface Props {
  situacion?: string;
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
    preguntaSeguridad: string;
    respuestaSeguridad: string;
  }) => void;
}

export function RegistroMineroModal({
  situacion,
  codigoReinfoInicial,
  enviando,
  error,
  onCerrar,
  onEnviar,
}: Props) {
  const esConcesionario = situacion === "concesionario";
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [nombreOperacion, setNombreOperacion] = useState("");
  const [codigoReinfo, setCodigoReinfo] = useState(codigoReinfoInicial ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [preguntaSeguridad, setPreguntaSeguridad] = useState("");
  const [respuestaSeguridad, setRespuestaSeguridad] = useState("");

  const usernameValido = username.trim().length >= 3;
  const passwordValida = password.length >= 6;
  const passwordsCoinciden = password === confirmarPassword;

  const valido =
    nombre.trim().length > 0 &&
    /^\d{9}$/.test(whatsapp) &&
    usernameValido &&
    passwordValida &&
    passwordsCoinciden &&
    preguntaSeguridad.trim().length > 0 &&
    respuestaSeguridad.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4">
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-tarjeta p-6 dark:bg-tarjeta-dark md:max-h-[90vh] md:rounded-2xl">
        <h2 className="text-lg font-bold">
          {esConcesionario
            ? "Regístrate para que te ayudemos con tu concesión"
            : "Regístrate para que te ayudemos"}
        </h2>
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
          <CampoTelefono
            value={whatsapp}
            onChange={setWhatsapp}
            placeholder="Tu WhatsApp (9 dígitos)"
          />
          <input
            className="min-h-[44px] rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
            placeholder={
              esConcesionario
                ? "Nombre de tu proyecto o concesión (opcional)"
                : "Nombre de tu operación o labor (opcional)"
            }
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

          <CampoPreguntaSeguridad
            pregunta={preguntaSeguridad}
            onPreguntaChange={setPreguntaSeguridad}
            respuesta={respuestaSeguridad}
            onRespuestaChange={setRespuestaSeguridad}
          />
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
                whatsapp: `+51${whatsapp}`,
                email: email.trim(),
                nombreOperacion: nombreOperacion.trim(),
                codigoReinfo: codigoReinfo.trim(),
                username: username.trim(),
                password,
                preguntaSeguridad: preguntaSeguridad.trim(),
                respuestaSeguridad: respuestaSeguridad.trim(),
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

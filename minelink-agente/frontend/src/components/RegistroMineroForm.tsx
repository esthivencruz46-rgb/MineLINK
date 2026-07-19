import { useState } from "react";
import { AceptaLegal } from "./AceptaLegal";
import { CampoPassword } from "./CampoPassword";
import { CampoPreguntaSeguridad } from "./CampoPreguntaSeguridad";
import { CampoTelefono } from "./CampoTelefono";
import { FuerzaPassword } from "./FuerzaPassword";
import { DEPARTAMENTOS } from "../data/departamentos";

export interface DatosRegistroMinero {
  nombre: string;
  whatsapp: string;
  region: string;
  email: string;
  nombreOperacion: string;
  codigoReinfo: string;
  username: string;
  password: string;
  preguntaSeguridad: string;
  respuestaSeguridad: string;
}

interface Props {
  situacion?: string;
  codigoReinfoInicial?: string;
  enviando: boolean;
  error?: string;
  onEnviar: (datos: DatosRegistroMinero) => void;
  /** Si se pasa, muestra un botón "Cancelar" al lado de "Registrarme". */
  onCancelar?: () => void;
}

/** Campos del registro del minero (lead + cuenta). Lo usan el modal de
 * /empresas y la página /registro — mismo formulario en ambos lados. */
export function RegistroMineroForm({
  situacion,
  codigoReinfoInicial,
  enviando,
  error,
  onEnviar,
  onCancelar,
}: Props) {
  const esConcesionario = situacion === "concesionario";
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [region, setRegion] = useState("");
  const [email, setEmail] = useState("");
  const [nombreOperacion, setNombreOperacion] = useState("");
  const [codigoReinfo, setCodigoReinfo] = useState(codigoReinfoInicial ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [preguntaSeguridad, setPreguntaSeguridad] = useState("");
  const [respuestaSeguridad, setRespuestaSeguridad] = useState("");
  const [aceptaLegal, setAceptaLegal] = useState(false);

  const usernameValido = username.trim().length >= 3;
  const passwordValida = password.length >= 6;
  const passwordsCoinciden = password === confirmarPassword;

  const valido =
    nombre.trim().length > 0 &&
    /^\d{9}$/.test(whatsapp) &&
    region.trim().length > 0 &&
    usernameValido &&
    passwordValida &&
    passwordsCoinciden &&
    preguntaSeguridad.trim().length > 0 &&
    respuestaSeguridad.trim().length > 0 &&
    aceptaLegal;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || enviando) return;
    onEnviar({
      nombre: nombre.trim(),
      whatsapp: `+51${whatsapp}`,
      region,
      email: email.trim(),
      nombreOperacion: nombreOperacion.trim(),
      codigoReinfo: codigoReinfo.trim(),
      username: username.trim(),
      password,
      preguntaSeguridad: preguntaSeguridad.trim(),
      respuestaSeguridad: respuestaSeguridad.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
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
        <select
          className="min-h-[44px] rounded-lg border border-black/10 bg-tarjeta px-3 text-texto dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-dark"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          <option value="" className="bg-white text-black">
            ¿En qué departamento trabajas?
          </option>
          {DEPARTAMENTOS.map((d) => (
            <option key={d} value={d.toLowerCase()} className="bg-white text-black">
              {d}
            </option>
          ))}
        </select>
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
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <CampoPassword
          placeholder="Elige una contraseña (mín. 6 caracteres)"
          name="new-password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />
        <FuerzaPassword password={password} />
        <CampoPassword
          placeholder="Repite la contraseña"
          name="new-password"
          autoComplete="new-password"
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

      <div className="mt-4">
        <AceptaLegal aceptado={aceptaLegal} onCambiar={setAceptaLegal} />
      </div>

      <div className="mt-5 flex gap-3">
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="min-h-[44px] flex-1 rounded-lg border border-black/10 font-semibold dark:border-white/10"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={!valido || enviando}
          className="min-h-[44px] flex-1 rounded-lg bg-acento font-semibold text-white disabled:opacity-50"
        >
          {enviando ? "Enviando..." : "Registrarme"}
        </button>
      </div>
    </form>
  );
}

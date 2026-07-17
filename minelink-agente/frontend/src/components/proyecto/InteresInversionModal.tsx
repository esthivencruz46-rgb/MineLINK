import { useState } from "react";
import { MARCA } from "../../config/marca";
import { Check } from "lucide-react";
import { CampoPassword } from "../CampoPassword";
import { CampoPreguntaSeguridad } from "../CampoPreguntaSeguridad";
import { CampoTelefono } from "../CampoTelefono";
import { CampoMonto } from "../CampoMonto";
import { FuerzaPassword } from "../FuerzaPassword";
import { registrarInteresInversion } from "../../services/api";

interface Props {
  operacionId: string;
  mensajeInicial: string;
  onCerrar: () => void;
}

export function InteresInversionModal({ operacionId, mensajeInicial, onCerrar }: Props) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [motivoInversion, setMotivoInversion] = useState("");
  const [monto, setMonto] = useState("");
  const [informacionRequerida, setInformacionRequerida] = useState("");
  const [mensaje, setMensaje] = useState(mensajeInicial);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [preguntaSeguridad, setPreguntaSeguridad] = useState("");
  const [respuestaSeguridad, setRespuestaSeguridad] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const valido =
    nombre.trim().length > 0 &&
    username.trim().length >= 3 &&
    password.length >= 6 &&
    preguntaSeguridad.trim().length > 0 &&
    respuestaSeguridad.trim().length > 0;

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      await registrarInteresInversion(operacionId, {
        nombre: nombre.trim(),
        username: username.trim(),
        password,
        pregunta_seguridad: preguntaSeguridad.trim(),
        respuesta_seguridad: respuestaSeguridad.trim(),
        telefono: telefono.trim() ? `+51${telefono.trim()}` : undefined,
        email: email.trim() || undefined,
        motivo_inversion: motivoInversion.trim() || undefined,
        monto: monto.trim() || undefined,
        informacion_requerida: informacionRequerida.trim() || undefined,
        mensaje: mensaje.trim() || undefined,
      });
      setEnviado(true);
    } catch (e) {
      const texto = e instanceof Error ? e.message : "";
      if (texto.includes("409")) {
        setError("Ese nombre de usuario ya está en uso, elige otro.");
      } else {
        setError("No pudimos enviar tu solicitud. Intenta de nuevo.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4">
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-tarjeta p-6 dark:bg-tarjeta-dark md:max-h-[90vh] md:rounded-lg">
        {enviado ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
              <Check size={24} strokeWidth={2.5} aria-hidden />
            </div>
            <h2 className="text-lg font-semibold">Solicitud enviada</h2>
            <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
              El equipo de {MARCA} revisará tu interés y te contactará para
              coordinar con el proyecto. Ya puedes iniciar sesión con tu
              usuario y contraseña cuando quieras.
            </p>
            <button
              onClick={onCerrar}
              className="mt-2 min-h-[44px] w-full rounded-lg bg-acento px-6 font-semibold text-white transition duration-200 hover:opacity-90"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!valido || enviando) return;
              enviar();
            }}
          >
            <h2 className="text-lg font-semibold">Contactar sobre este proyecto</h2>
            <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
              Nunca compartimos el contacto directo del proyecto. El equipo de
              {MARCA} revisa tu solicitud y hace de intermediario.
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <input
                className="min-h-[44px] rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
                placeholder="Tu nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
              <CampoTelefono
                value={telefono}
                onChange={setTelefono}
                placeholder="Tu número (9 dígitos)"
              />
              <input
                className="min-h-[44px] rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
                placeholder="Tu email (opcional)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <textarea
                className="min-h-[70px] rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10"
                placeholder="¿Cuál es tu motivo de inversión?"
                value={motivoInversion}
                onChange={(e) => setMotivoInversion(e.target.value)}
              />
              <div>
                <label className="mb-1 block text-xs text-texto-suave dark:text-texto-suave-dark">
                  ¿Cuánto capital tienes en mente?
                </label>
                <CampoMonto value={monto} onChange={setMonto} />
              </div>
              <textarea
                className="min-h-[70px] rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10"
                placeholder="¿Qué información necesitas del proyecto?"
                value={informacionRequerida}
                onChange={(e) => setInformacionRequerida(e.target.value)}
              />
              <textarea
                className="min-h-[70px] rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10"
                placeholder="Mensaje (opcional)"
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
              />

              <hr className="my-1 border-black/10 dark:border-white/10" />
              <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
                Crea un usuario y contraseña para volver a ver tu solicitud cuando quieras.
              </p>
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
                type="button"
                onClick={onCerrar}
                className="min-h-[44px] flex-1 rounded-lg border border-black/10 font-semibold dark:border-white/10"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!valido || enviando}
                className="min-h-[44px] flex-1 rounded-lg bg-secundario font-semibold text-white transition duration-200 hover:opacity-90 disabled:opacity-50"
              >
                {enviando ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

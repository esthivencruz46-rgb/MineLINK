import { useEffect, useState } from "react";
import { useTitulo } from "../hooks/useTitulo";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { useInversionistaAuth } from "../context/InversionistaAuthContext";
import { MARCA } from "../config/marca";
import { PanelCuentaSkeleton } from "../components/Skeleton";

interface PerfilInversionista {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  motivo_inversion?: string | null;
  monto?: string | null;
  informacion_requerida?: string | null;
  mensaje?: string | null;
  operacion_id: string;
  created_at: string;
  estado_contacto: string;
  nombre_proyecto?: string | null;
  proyecto_publicado: boolean;
}

/** Línea de tiempo del interés (julio 2026): reemplaza al placeholder
 *  "Estamos preparando esta sección" — lo único que la cartera pública no
 *  puede mostrarle al inversionista es qué pasó con SU solicitud. */
const PASOS_SEGUIMIENTO = [
  { estado: "recibido", titulo: "Interés recibido" },
  { estado: "en_intermediacion", titulo: "En intermediación" },
  { estado: "contactado", titulo: "Te contactamos" },
];

export function MiCuentaInversionista() {
  useTitulo("Mi cuenta de inversionista");
  const { authFetch, logout } = useInversionistaAuth();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<PerfilInversionista | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch("/inversionistas/me")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setPerfil(data);
        setError(null);
      })
      .catch(() => setError("No pudimos cargar tus datos."))
      .finally(() => setCargando(false));
  }, [authFetch]);

  function cerrarSesion() {
    logout();
    navigate("/");
  }

  if (cargando) {
    return <PanelCuentaSkeleton />;
  }

  if (error || !perfil) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-8 text-center">
        <p className="text-red-500">{error ?? "No encontramos tus datos."}</p>
        <button onClick={cerrarSesion} className="text-sm text-acento underline">
          Volver a intentar
        </button>
      </div>
    );
  }

  const indiceEstado = PASOS_SEGUIMIENTO.findIndex(
    (p) => p.estado === perfil.estado_contacto
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Hola, {perfil.nombre}</h1>
        <button
          onClick={cerrarSesion}
          className="min-h-[44px] border border-black/10 px-4 text-sm font-semibold dark:border-white/10"
        >
          Cerrar sesión
        </button>
      </div>

      {/* SEGUIMIENTO DEL INTERÉS */}
      <div className="border border-black/10 p-6 dark:border-white/10">
        <h2 className="font-semibold">Tu interés en {perfil.nombre_proyecto ?? "el proyecto"}</h2>
        <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
          El equipo de {MARCA} intermedia cada presentación — aquí ves en qué paso va la
          tuya.
        </p>

        <div className="mt-5 flex flex-col gap-0">
          {PASOS_SEGUIMIENTO.map((paso, i) => {
            const completado = i <= indiceEstado;
            const esUltimo = i === PASOS_SEGUIMIENTO.length - 1;
            return (
              <div key={paso.estado} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                      completado
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-black/15 text-texto-suave dark:border-white/15 dark:text-texto-suave-dark"
                    }`}
                  >
                    {completado ? <Check size={14} strokeWidth={2.5} aria-hidden /> : i + 1}
                  </span>
                  {!esUltimo && (
                    <span
                      className={`w-px flex-1 ${
                        i < indiceEstado ? "bg-emerald-500" : "bg-black/10 dark:bg-white/10"
                      }`}
                    />
                  )}
                </div>
                <div className={esUltimo ? "" : "pb-5"}>
                  <p
                    className={`text-sm font-semibold ${
                      completado ? "" : "text-texto-suave dark:text-texto-suave-dark"
                    }`}
                  >
                    {paso.titulo}
                  </p>
                  {i === indiceEstado && (
                    <p className="mt-0.5 text-xs text-texto-suave dark:text-texto-suave-dark">
                      {perfil.estado_contacto === "recibido"
                        ? "Tu solicitud llegó y está en cola de revisión."
                        : perfil.estado_contacto === "en_intermediacion"
                          ? "Estamos coordinando con el titular del proyecto."
                          : "Ya hicimos la presentación — revisa tu WhatsApp o correo."}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {perfil.proyecto_publicado && (
          <Link
            to={`/proyectos/${perfil.operacion_id}`}
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-acento"
          >
            Ver la ficha del proyecto
            <ArrowRight size={15} strokeWidth={2} aria-hidden />
          </Link>
        )}
      </div>

      {/* Lo que dejó registrado */}
      <div className="flex flex-col gap-2 border border-black/10 p-5 text-sm dark:border-white/10">
        <h2 className="font-semibold">Lo que dejaste registrado</h2>
        {perfil.telefono && (
          <p>
            <span className="font-medium">Teléfono:</span> {perfil.telefono}
          </p>
        )}
        {perfil.email && (
          <p>
            <span className="font-medium">Email:</span> {perfil.email}
          </p>
        )}
        {perfil.motivo_inversion && (
          <p>
            <span className="font-medium">Motivo de inversión:</span> {perfil.motivo_inversion}
          </p>
        )}
        {perfil.monto && (
          <p>
            <span className="font-medium">Capital:</span> {perfil.monto}
          </p>
        )}
        {perfil.informacion_requerida && (
          <p>
            <span className="font-medium">Información solicitada:</span>{" "}
            {perfil.informacion_requerida}
          </p>
        )}
        {perfil.mensaje && (
          <p>
            <span className="font-medium">Mensaje:</span> {perfil.mensaje}
          </p>
        )}
        <p className="text-texto-suave dark:text-texto-suave-dark">
          Registrado el {new Date(perfil.created_at).toLocaleDateString("es-PE")}
        </p>
      </div>

      <Link
        to="/proyectos"
        className="flex min-h-[44px] items-center justify-center border border-black/15 px-4 text-sm font-semibold transition hover:border-acento/40 hover:text-acento dark:border-white/15"
      >
        Explorar más proyectos
      </Link>
    </div>
  );
}

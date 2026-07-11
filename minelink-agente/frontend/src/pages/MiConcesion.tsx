import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Search, X } from "lucide-react";
import { DocumentosMinero } from "../components/DocumentosMinero";
import { SalidasList } from "../components/SalidasList";
import { SemaforoCard } from "../components/SemaforoCard";
import { UrgenciaYReloj } from "../components/UrgenciaYReloj";
import { INFO_BRECHA } from "../data/brechas";
import { NOMBRE_PERFIL } from "../data/preguntas";
import { useMineroAuth } from "../context/MineroAuthContext";
import { semaforoDesdeColor } from "../utils/semaforo";
import type { DocumentoOperacion } from "../types/documento";
import type { MineroPerfil } from "../types/minero";

/** Ventana exclusiva de la Ruta 2 (concesionario que recién inicia) —
 * paralela a MiCuenta.tsx (Ruta 1). Enfocada en lo esencial por ahora: su
 * Track Legal y entregar los documentos que declaró tener en el
 * diagnóstico (DocumentosMinero) — la parte de perfil de inversión
 * (PerfilInversionForm, "proyecto ante los inversionistas") queda fuera
 * de esta ventana hasta que se retome esa función. */
export function MiConcesion() {
  const { authFetch, logout } = useMineroAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [perfil, setPerfil] = useState<MineroPerfil | null>(null);
  const [, setDocumentos] = useState<DocumentoOperacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarBienvenida, setMostrarBienvenida] = useState(
    Boolean((location.state as { bienvenida?: boolean } | null)?.bienvenida)
  );

  useEffect(() => {
    authFetch("/mineros/me")
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
    return <p className="p-8 text-center">Cargando tus datos...</p>;
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

  // Un minero artesanal (Ruta 1) no tiene nada que ver aquí
  if (perfil.situacion !== "concesionario") {
    return <Navigate to="/mi-cuenta" state={location.state} replace />;
  }

  const semLegal = semaforoDesdeColor(perfil.semaforo_legal);
  // Perfil A/A_avanzado todavía no tiene concesión — no tiene sentido
  // decirle "no tienes brechas pendientes": no hay nada que medir todavía.
  const muestraEstudios = perfil.perfil !== "A" && perfil.perfil !== "A_avanzado";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mi concesión</h1>
        <button
          onClick={cerrarSesion}
          className="min-h-[44px] rounded-lg border border-black/10 px-4 text-sm font-semibold dark:border-white/10"
        >
          Cerrar sesión
        </button>
      </div>

      {perfil.nombre_operacion && (
        <p className="text-texto-suave dark:text-texto-suave-dark">
          {perfil.nombre_operacion} · {perfil.region}
        </p>
      )}

      {mostrarBienvenida && (
        <div className="flex items-start justify-between gap-3 rounded-lg bg-acento/10 p-4 text-sm text-acento">
          <p>
            <span className="font-semibold">¡Ya estás dentro! </span>
            Esta es tu cuenta: aquí puedes subir tus fotos y documentos ahora
            mismo, o dejarlo para después — no se pierde nada. Cuando quieras
            volver, entra con tu usuario y contraseña desde{" "}
            <span className="font-semibold">Ingresar</span>.
          </p>
          <button
            onClick={() => setMostrarBienvenida(false)}
            aria-label="Cerrar"
            className="shrink-0 text-acento/70 hover:text-acento"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
      )}

      {perfil.brechas_pendientes.length > 0 && (
        <div
          className={`flex items-start gap-3 rounded-lg p-4 text-sm ${
            perfil.estado_contacto === "contactado"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-acento/10 text-acento"
          }`}
        >
          <span aria-hidden>
            {perfil.estado_contacto === "contactado" ? (
              <CheckCircle2 size={20} strokeWidth={2} />
            ) : (
              <Search size={20} strokeWidth={2} />
            )}
          </span>
          <p>
            {perfil.estado_contacto === "contactado"
              ? "Ya te contactamos por WhatsApp para ayudarte con lo que te falta. Revisa tus mensajes."
              : "Estamos buscando quién te ayude con lo que te falta. Te escribiremos por WhatsApp."}
          </p>
        </div>
      )}

      {perfil.perfil && (
        <div className="text-center">
          <span className="rounded-full bg-acento/15 px-4 py-1 text-sm font-semibold text-acento">
            {NOMBRE_PERFIL[perfil.perfil] ?? perfil.perfil}
          </span>
        </div>
      )}

      <SemaforoCard titulo="Track Legal" semaforo={semLegal} grande />

      {perfil.etiquetas_bloqueantes.length > 0 && (
        <div className="rounded-lg bg-red-900/10 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-red-600">
            <AlertTriangle size={18} /> Primero resolvamos esto
          </h3>
          <ul className="flex flex-col gap-1 text-sm">
            {perfil.etiquetas_bloqueantes.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      <UrgenciaYReloj urgencia={perfil.urgencia} relojProduccion={perfil.reloj_produccion} />

      <SalidasList salidas={perfil.salidas} onBuscarAyuda={() => navigate("/empresas")} />

      {muestraEstudios && (
        <div className="rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
          <h2 className="font-semibold">Lo que te falta</h2>
          {perfil.brechas_pendientes.length === 0 ? (
            <p className="mt-2 text-sm text-texto-suave dark:text-texto-suave-dark">
              No tienes brechas pendientes.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {perfil.brechas_pendientes.map((b) => (
                <li key={b}>• {INFO_BRECHA[b]?.texto ?? b}</li>
              ))}
            </ul>
          )}

          {perfil.brechas_resueltas.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-semibold text-texto-suave dark:text-texto-suave-dark">
                Ya resuelto
              </h3>
              <ul className="mt-1 flex flex-col gap-1 text-sm text-texto-suave line-through dark:text-texto-suave-dark">
                {perfil.brechas_resueltas.map((b) => (
                  <li key={b}>{INFO_BRECHA[b]?.texto ?? b}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="rounded-lg bg-tarjeta p-5 text-sm dark:bg-tarjeta-dark">
        <h2 className="font-semibold">Tus datos</h2>
        <p className="mt-2 text-texto-suave dark:text-texto-suave-dark">
          WhatsApp: {perfil.whatsapp}
        </p>
        {perfil.email && (
          <p className="text-texto-suave dark:text-texto-suave-dark">
            Email: {perfil.email}
          </p>
        )}
        <p className="text-texto-suave dark:text-texto-suave-dark">
          Registrado el {new Date(perfil.created_at).toLocaleDateString("es-PE")}
        </p>
      </div>

      <DocumentosMinero
        onDocumentosChange={setDocumentos}
        estudiosAplicables={perfil.estudios_aplicables}
        fotosPerfilAplicables={perfil.fotos_perfil}
        esTitularConcesion={perfil.es_titular_concesion}
      />
    </div>
  );
}

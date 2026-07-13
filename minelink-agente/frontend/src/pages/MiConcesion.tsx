import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, RefreshCw, X } from "lucide-react";
import { LoQueTeFaltaCard } from "../components/LoQueTeFaltaCard";
import { ProyectoPublicadoAcciones } from "../components/ProyectoPublicadoAcciones";
import { CuestionarioInversionInline } from "../components/CuestionarioInversionInline";
import { DocumentosInversionSustento } from "../components/DocumentosInversionSustento";
import { DocumentosMinero } from "../components/DocumentosMinero";
import { ResumenInversionRespuestas } from "../components/ResumenInversionRespuestas";
import { NotificacionesBell } from "../components/NotificacionesBell";
import { PasosFormalizacionInversion } from "../components/PasosFormalizacionInversion";
import { PerfilInversionForm } from "../components/PerfilInversionForm";
import { SeccionInversionista } from "../components/SeccionInversionista";
import { SemaforoCard } from "../components/SemaforoCard";
import { UrgenciaYReloj } from "../components/UrgenciaYReloj";
import { useMineroAuth } from "../context/MineroAuthContext";
import { semaforoDesdeColor } from "../utils/semaforo";
import type { DocumentoOperacion } from "../types/documento";
import type { MineroPerfil } from "../types/minero";

/** Ventana exclusiva de la Ruta 2 (concesionario que recién inicia) —
 * paralela a MiCuenta.tsx (Ruta 1): su Track Legal, los documentos que
 * declaró tener en el diagnóstico (DocumentosMinero) y su perfil para
 * inversionistas (PerfilInversionForm, sin capacidad de producción — Ruta
 * 2 todavía no opera, no tiene nada que producir que declarar). */
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
  // Cambiar la key remonta todo el contenido: cada tarjeta (documentos,
  // fotos, notificaciones) vuelve a pedir sus datos al backend.
  const [recarga, setRecarga] = useState(0);
  const [mostrarInversion, setMostrarInversion] = useState(
    Boolean((location.state as { abrirInversion?: boolean } | null)?.abrirInversion)
  );

  function cargarPerfil() {
    return authFetch("/mineros/me")
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
  }

  useEffect(() => {
    cargarPerfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div key={recarga} className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mi concesión</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              cargarPerfil();
              setRecarga((k) => k + 1);
            }}
            className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <RefreshCw size={15} strokeWidth={2.25} aria-hidden />
            Guardar
          </button>
          <NotificacionesBell />
          <button
            onClick={cerrarSesion}
            className="min-h-[44px] rounded-lg border border-black/10 px-4 text-sm font-semibold dark:border-white/10"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {perfil.nombre_operacion && (
        <p className="text-texto-suave dark:text-texto-suave-dark">
          {perfil.nombre_operacion} · {perfil.region}
        </p>
      )}

      {/* Franja superior: Tus datos + (si ya está publicado) el aviso de
          visibilidad para inversionistas, lado a lado. */}
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-tarjeta px-5 py-3 text-sm text-texto-suave dark:bg-tarjeta-dark dark:text-texto-suave-dark">
          <span className="font-semibold text-texto dark:text-texto-dark">Tus datos:</span>
          <span>WhatsApp {perfil.whatsapp}</span>
          {perfil.email && <span>· {perfil.email}</span>}
          <span>· Registrado el {new Date(perfil.created_at).toLocaleDateString("es-PE")}</span>
        </div>
        {perfil.apto_inversionistas && <ProyectoPublicadoAcciones perfil={perfil} />}
      </div>

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

      {/* Solo se avisa cuando el admin YA contactó — la promesa genérica de
          "estamos buscando quién te ayude" se retiró (julio 2026). */}
      {perfil.brechas_pendientes.length > 0 && perfil.estado_contacto === "contactado" && (
        <div className="flex items-start gap-3 rounded-lg bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={20} strokeWidth={2} aria-hidden />
          <p>
            Ya te contactamos por WhatsApp para ayudarte con lo que te falta. Revisa tus
            mensajes.
          </p>
        </div>
      )}

      {perfil.inversion_ofrecida && <PasosFormalizacionInversion perfil={perfil} />}

      {/* Desktop web: dos columnas (formalización a la izquierda, cuenta +
          inversión a la derecha) — en celular/APK se apilan en una sola,
          la sidebar queda debajo. */}
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="flex flex-col gap-5">
          <h2 className="text-lg font-bold text-texto-suave dark:text-texto-suave-dark">
            Formalización
          </h2>

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


          <DocumentosMinero
            onDocumentosChange={setDocumentos}
            estudiosAplicables={perfil.estudios_aplicables}
            fotosPerfilAplicables={perfil.fotos_perfil}
            esTitularConcesion={perfil.es_titular_concesion}
            ocultarFotosOperacion
            ocultarEncabezado
            ocultarDocumentosLegales
            documentosEnviados={perfil.documentos_enviados}
            datosFormalizacion={perfil.datos_formalizacion ?? {}}
            rutaVolver="/mi-concesion"
            onEnviado={() => {
              cargarPerfil();
              // Habilita la parte de inversión ahí mismo, sin salir de la
              // cuenta: si el módulo aplica y no se envió, abre el
              // cuestionario directamente.
              setMostrarInversion(true);
            }}
          />

          <LoQueTeFaltaCard
            perfil={perfil}
            mostrarFormalizacion={muestraEstudios}
            onActualizado={() => {
              cargarPerfil();
              setRecarga((k) => k + 1);
            }}
          />

          <PerfilInversionForm perfil={perfil} onGuardado={setPerfil} />
        </div>

        <div className="flex flex-col gap-5">
          <h2 className="text-lg font-bold text-texto-suave dark:text-texto-suave-dark">
            Inversión
          </h2>
          <SeccionInversionista perfil={perfil} onAbrir={() => setMostrarInversion(true)} />
          {mostrarInversion && perfil.inversion_ofrecida && !perfil.inv_enviado && (
            <CuestionarioInversionInline
              perfil={perfil}
              onEnviado={() => {
                setMostrarInversion(false);
                cargarPerfil();
              }}
              onCerrar={() => setMostrarInversion(false)}
            />
          )}
          {perfil.inv_enviado && (
            <ResumenInversionRespuestas
              perfil={perfil}
              onGuardado={setPerfil}
              declarados={perfil.respaldos_declarados_inversion ?? []}
            />
          )}
          <DocumentosInversionSustento
            perfil={perfil}
            onGuardado={setPerfil}
            declarados={perfil.respaldos_declarados_inversion ?? []}
          />
        </div>
      </div>
    </div>
  );
}

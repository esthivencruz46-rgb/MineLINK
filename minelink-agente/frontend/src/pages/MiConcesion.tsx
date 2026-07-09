import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Check, CheckCircle2, Circle, Search } from "lucide-react";
import { DocumentosMinero } from "../components/DocumentosMinero";
import { PerfilInversionForm } from "../components/PerfilInversionForm";
import { INFO_BRECHA } from "../data/brechas";
import { useMineroAuth } from "../context/MineroAuthContext";
import { calcularSemaforo } from "../utils/semaforo";
import type { DocumentoOperacion } from "../types/documento";
import type { MineroPerfil } from "../types/minero";

/** Ventana exclusiva de la Ruta 2 (concesionario que recién inicia) —
 * paralela a MiCuenta.tsx (Ruta 1), pero con su propio encabezado, su
 * propio "score de preparación" y el resumen del perfil de la concesión
 * capturado en el diagnóstico (declaración original, no editable aquí). */
export function MiConcesion() {
  const { authFetch, logout } = useMineroAuth();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<MineroPerfil | null>(null);
  const [, setDocumentos] = useState<DocumentoOperacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    return <Navigate to="/mi-cuenta" replace />;
  }

  const semaforo = calcularSemaforo(perfil.score_actual, perfil.bloqueado_actual);
  const hayCambios = perfil.score_actual !== perfil.score_total;

  const requisitos: { texto: string; cumplido: boolean }[] = [
    {
      texto: "Ubicación de tu concesión (enlace de Google Maps)",
      cumplido: Boolean(perfil.ubicacion_maps),
    },
    {
      texto: "Para qué buscas el apoyo (motivo)",
      cumplido: Boolean(perfil.uso_fondos?.trim()),
    },
    {
      texto: "Cuánto capital buscas",
      cumplido: Boolean(perfil.capital_buscado?.trim()),
    },
  ];
  const pendientesRequisitos = requisitos.filter((r) => !r.cumplido).length;

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

      <div className="rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
        <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
          Score de preparación de tu concesión
        </p>
        <p className={`font-mono text-3xl font-bold ${semaforo.claseTexto}`}>
          {perfil.score_actual}
          {hayCambios && (
            <span className="ml-2 text-lg text-texto-suave line-through dark:text-texto-suave-dark">
              {perfil.score_total}
            </span>
          )}
        </p>
        <p className={`text-sm font-semibold ${semaforo.claseTexto}`}>{semaforo.etiqueta}</p>
        <p className="mt-1 text-xs text-texto-suave dark:text-texto-suave-dark">
          Mide qué tan lista está tu concesión para operar y formalizarse —
          distinto del MineScore de una mina en producción.
        </p>
      </div>

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

      <div className="rounded-lg bg-tarjeta p-5 text-sm dark:bg-tarjeta-dark">
        <h2 className="font-semibold">Perfil de tu concesión</h2>
        <p className="mt-1 text-xs text-texto-suave dark:text-texto-suave-dark">
          Esto es lo que declaraste en tu diagnóstico — para actualizarlo,
          escríbenos por WhatsApp.
        </p>
        <div className="mt-3 flex flex-col gap-1">
          {perfil.concesion_vigente != null && (
            <p>
              <span className="font-medium">Concesión vigente:</span>{" "}
              {perfil.concesion_vigente ? "Sí" : "No"}
            </p>
          )}
          {perfil.tipo_deposito && (
            <p>
              <span className="font-medium">Tipo de depósito:</span> {perfil.tipo_deposito}
            </p>
          )}
          {perfil.etapa_proyecto && (
            <p>
              <span className="font-medium">Etapa del proyecto:</span> {perfil.etapa_proyecto}
            </p>
          )}
          {perfil.trabajos_exploracion_json && perfil.trabajos_exploracion_json.length > 0 && (
            <p>
              <span className="font-medium">Trabajos de exploración:</span>{" "}
              {perfil.trabajos_exploracion_json.join(", ")}
            </p>
          )}
          {perfil.info_geologica_disponible != null && (
            <p>
              <span className="font-medium">Información geológica disponible:</span>{" "}
              {perfil.info_geologica_disponible ? "Sí" : "No"}
            </p>
          )}
          {perfil.tiene_estimaciones_leyes != null && (
            <p>
              <span className="font-medium">Estimaciones de leyes:</span>{" "}
              {perfil.tiene_estimaciones_leyes ? "Sí" : "No"}
            </p>
          )}
          {perfil.documento_autorizacion && (
            <p>
              <span className="font-medium">Documento de autorización:</span>{" "}
              {perfil.documento_autorizacion}
            </p>
          )}
          {perfil.tipo_apoyo_json && perfil.tipo_apoyo_json.length > 0 && (
            <p>
              <span className="font-medium">Apoyo que buscas:</span>{" "}
              {perfil.tipo_apoyo_json.join(", ")}
            </p>
          )}
        </div>
      </div>

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

      <div className="rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
        <h2 className="font-semibold">
          Tu proyecto ante los inversionistas{" "}
          {pendientesRequisitos === 0 ? (
            <span className="ml-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-500">
              Completo
            </span>
          ) : (
            <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-500">
              {pendientesRequisitos} pendiente{pendientesRequisitos !== 1 && "s"}
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
          Para que tu proyecto se vea completo y confiable en la sección
          Proyectos, necesitas entregar esto:
        </p>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {requisitos.map((r) => (
            <li key={r.texto} className="flex items-start gap-2">
              <span className={r.cumplido ? "text-emerald-500" : "text-amber-500"}>
                {r.cumplido ? (
                  <Check size={16} strokeWidth={2.5} aria-hidden />
                ) : (
                  <Circle size={16} strokeWidth={2} aria-hidden />
                )}
              </span>
              <span className={r.cumplido ? "text-texto-suave line-through dark:text-texto-suave-dark" : ""}>
                {r.texto}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <PerfilInversionForm perfil={perfil} onGuardado={setPerfil} ocultarCapacidadProduccion />

      <DocumentosMinero
        onDocumentosChange={setDocumentos}
        estudiosAplicables={perfil.estudios_aplicables}
      />
    </div>
  );
}

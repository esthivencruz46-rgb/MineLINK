import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Check, CheckCircle2, Circle, Search } from "lucide-react";
import { DocumentosMinero } from "../components/DocumentosMinero";
import { PerfilInformativoAgrupado } from "../components/PerfilInformativoAgrupado";
import { PerfilInversionForm } from "../components/PerfilInversionForm";
import { INFO_BRECHA } from "../data/brechas";
import { useMineroAuth } from "../context/MineroAuthContext";
import { calcularSemaforo } from "../utils/semaforo";
import type { DocumentoOperacion } from "../types/documento";
import type { MineroPerfil } from "../types/minero";

const FOTOS_MINIMAS = 3;

export function MiCuenta() {
  const { authFetch, logout } = useMineroAuth();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<MineroPerfil | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoOperacion[]>([]);
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

  // Ruta 2 (concesionario) tiene su propia ventana, distinta de esta
  if (perfil.situacion === "concesionario") {
    return <Navigate to="/mi-concesion" replace />;
  }

  const semaforo = calcularSemaforo(perfil.score_actual, perfil.bloqueado_actual);
  const hayCambios = perfil.score_actual !== perfil.score_total;

  const fotos = documentos.filter((d) => d.categoria === "fotos_mina");
  const requisitos: { texto: string; cumplido: boolean }[] = [
    {
      texto: `Mínimo ${FOTOS_MINIMAS} fotos de tu mina, máximo 5 (tienes ${fotos.length})`,
      cumplido: fotos.length >= FOTOS_MINIMAS,
    },
    {
      texto: "Ubicación de tu mina (enlace de Google Maps)",
      cumplido: Boolean(perfil.ubicacion_maps),
    },
    {
      texto: "Para qué buscas el dinero (motivo)",
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
        <h1 className="text-2xl font-bold">Hola, {perfil.nombre}</h1>
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
          Tu puntaje
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
        <h2 className="font-semibold">Tus datos</h2>
        <p className="mt-2 text-texto-suave dark:text-texto-suave-dark">
          WhatsApp: {perfil.whatsapp}
        </p>
        {perfil.email && (
          <p className="text-texto-suave dark:text-texto-suave-dark">
            Email: {perfil.email}
          </p>
        )}
        {perfil.codigo_reinfo && (
          <p className="text-texto-suave dark:text-texto-suave-dark">
            Código REINFO: {perfil.codigo_reinfo}
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

      <div className="rounded-lg bg-tarjeta p-5 text-sm dark:bg-tarjeta-dark">
        <h2 className="font-semibold">Lo que declaraste en tu diagnóstico</h2>
        <p className="mt-1 text-xs text-texto-suave dark:text-texto-suave-dark">
          Un recordatorio de tus respuestas — para actualizarlas, escríbenos
          por WhatsApp.
        </p>
        <div className="mt-4">
          <PerfilInformativoAgrupado datos={perfil as unknown as Record<string, unknown>} />
        </div>
      </div>

      <PerfilInversionForm perfil={perfil} onGuardado={setPerfil} />

      <DocumentosMinero
        onDocumentosChange={setDocumentos}
        estudiosAplicables={perfil.estudios_aplicables}
      />
    </div>
  );
}

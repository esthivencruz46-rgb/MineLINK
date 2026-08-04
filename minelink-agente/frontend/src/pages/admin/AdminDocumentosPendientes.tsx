import { useEffect, useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { useAuth } from "../../context/AuthContext";
import { CATEGORIAS_DOCUMENTO } from "../../types/documento";
import type { DocumentoPendiente } from "../../types/documento";
import { INFO_BRECHA } from "../../data/brechas";

function etiquetaCategoria(categoria: string): string {
  return (
    CATEGORIAS_DOCUMENTO.find((c) => c.categoria === categoria)?.etiqueta ??
    INFO_BRECHA[categoria]?.texto ??
    categoria
  );
}

/** Cola única con todos los documentos "Sin revisar" de todos los
 * mineros juntos (agosto 2026, pedido explícito de Esthiven: antes había
 * que entrar lead por lead, desde /admin/leads → "Documentos", a buscar
 * qué faltaba revisar). Reutiliza el mismo endpoint de aprobar/rechazar
 * que ya usa AdminLeads — esta pantalla solo cambia de dónde sale la
 * lista (todos los mineros, más viejo primero, en vez de uno por uno). */
export function AdminDocumentosPendientes() {
  const { authFetch } = useAuth();
  const [pendientes, setPendientes] = useState<DocumentoPendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vistaUrl, setVistaUrl] = useState<string | null>(null);
  const [vistaTipo, setVistaTipo] = useState("");

  function cargar() {
    setCargando(true);
    authFetch("/admin/documentos/pendientes")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setPendientes)
      .catch(() => setError("No pudimos cargar los documentos pendientes."))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verArchivo(doc: DocumentoPendiente) {
    const resp = await authFetch(`/admin/documentos/${doc.id}/archivo`);
    if (!resp.ok) {
      setError("No se pudo abrir el archivo.");
      return;
    }
    const blob = await resp.blob();
    setVistaUrl(URL.createObjectURL(blob));
    setVistaTipo(doc.content_type);
  }

  function cerrarVista() {
    if (vistaUrl) URL.revokeObjectURL(vistaUrl);
    setVistaUrl(null);
    setVistaTipo("");
  }

  async function revisar(doc: DocumentoPendiente, aprobado: boolean) {
    let motivo: string | null = null;
    if (!aprobado) {
      motivo = window.prompt("¿Por qué se rechaza este documento?");
      if (motivo === null) return;
      if (!motivo.trim()) {
        window.alert("Escribe el motivo del rechazo — el minero lo va a ver en su cuenta.");
        return;
      }
    }
    const resp = await authFetch(`/admin/documentos/${doc.id}/revision`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estado_revision: aprobado ? "aprobado" : "rechazado",
        motivo_rechazo: aprobado ? null : motivo,
      }),
    });
    if (!resp.ok) return;
    // Aprobado o rechazado: en ambos casos sale de la cola de "pendientes".
    setPendientes((actuales) => actuales.filter((d) => d.id !== doc.id));
  }

  return (
    <AdminLayout>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Documentos pendientes</h1>
          <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
            Todos los mineros juntos, el más antiguo primero.
          </p>
        </div>
        <button
          onClick={cargar}
          className="min-h-[44px] border border-black/10 px-4 font-semibold dark:border-white/10"
        >
          Actualizar
        </button>
      </div>

      {error && (
        <p className="mb-4 border border-red-500/25 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {cargando && <p className="text-sm">Cargando...</p>}

      {!cargando && pendientes.length === 0 && !error && (
        <div className="border border-black/10 bg-tarjeta p-6 text-center text-sm text-texto-suave dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-suave-dark">
          No hay documentos sin revisar — estás al día.
        </div>
      )}

      {!cargando && pendientes.length > 0 && (
        <ul className="flex flex-col gap-3">
          {pendientes.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-col gap-3 border border-black/10 bg-tarjeta p-4 dark:border-white/10 dark:bg-tarjeta-dark sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {doc.lead_nombre}
                  {doc.nombre_operacion && (
                    <span className="font-normal text-texto-suave dark:text-texto-suave-dark">
                      {" "}
                      · {doc.nombre_operacion}
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-texto-suave dark:text-texto-suave-dark">
                  {etiquetaCategoria(doc.categoria)} — {doc.nombre_original}
                </p>
                <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
                  Subido el {new Date(doc.created_at).toLocaleString("es-PE")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => verArchivo(doc)}
                  className="rounded border border-acento/30 px-3 py-2 text-xs font-semibold text-acento"
                >
                  Ver
                </button>
                <button
                  onClick={() => revisar(doc, true)}
                  className="rounded border border-emerald-500/40 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                >
                  Aprobar
                </button>
                <button
                  onClick={() => revisar(doc, false)}
                  className="rounded border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-500"
                >
                  Rechazar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {vistaUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={cerrarVista}
        >
          {vistaTipo.startsWith("image/") ? (
            <img
              src={vistaUrl}
              alt="Documento"
              className="max-h-[90vh] max-w-full rounded-lg object-contain"
            />
          ) : (
            <iframe
              src={vistaUrl}
              title="Documento"
              className="h-[90vh] w-full max-w-3xl rounded-lg bg-white"
            />
          )}
        </div>
      )}
    </AdminLayout>
  );
}

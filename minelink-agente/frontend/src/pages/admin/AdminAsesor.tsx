import { useEffect, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { useAuth } from "../../context/AuthContext";
import type { DocumentoAsesor } from "../../types/admin";

/** Nutrir al asesor conversacional sin git/GitHub/Claude Code (julio
 * 2026, pedido explícito de Esthiven: "imagina que ya no uso Claude
 * Code"). Sube un PDF/.md/.txt, se extrae el texto y queda disponible
 * para el asesor desde la siguiente pregunta que le haga cualquier
 * visitante — sin redeploy. */
export function AdminAsesor() {
  const { authFetch } = useAuth();
  const [documentos, setDocumentos] = useState<DocumentoAsesor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [categoria, setCategoria] = useState("");

  function cargar() {
    authFetch("/admin/asesor/documentos")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setDocumentos)
      .catch(() => setError("No pudimos cargar los documentos."))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function subirArchivo(archivo: File) {
    setError(null);
    setSubiendo(true);
    const formData = new FormData();
    formData.set("archivo", archivo);
    formData.set("categoria", categoria.trim());
    try {
      const resp = await authFetch("/admin/asesor/documentos", {
        method: "POST",
        body: formData,
      });
      if (!resp.ok) {
        const detalle = await resp.json().catch(() => null);
        throw new Error(detalle?.detail ?? "No se pudo subir el documento.");
      }
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el documento.");
    } finally {
      setSubiendo(false);
    }
  }

  async function alternarActivo(doc: DocumentoAsesor) {
    setDocumentos((actuales) =>
      actuales.map((d) => (d.id === doc.id ? { ...d, activo: !d.activo } : d))
    );
    await authFetch(`/admin/asesor/documentos/${doc.id}/activo`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !doc.activo }),
    });
  }

  async function eliminar(doc: DocumentoAsesor) {
    if (!window.confirm(`¿Borrar "${doc.nombre}"? No se puede deshacer.`)) return;
    await authFetch(`/admin/asesor/documentos/${doc.id}`, { method: "DELETE" });
    setDocumentos((actuales) => actuales.filter((d) => d.id !== doc.id));
  }

  return (
    <AdminLayout>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Documentos del asesor</h1>
          <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
            Sube normas, guías o jurisprudencia para que el asesor conversacional las use
            al responder — queda disponible de inmediato, sin publicar código.
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3 border border-black/10 p-4 dark:border-white/10">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-texto-suave dark:text-texto-suave-dark">
            Tema (opcional)
          </label>
          <input
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="ej. ambiental, REINFO..."
            className="min-h-[44px] border border-black/10 bg-transparent px-3 text-sm dark:border-white/10"
          />
        </div>
        <label
          className={`flex min-h-[44px] cursor-pointer items-center gap-1.5 border border-acento px-4 font-semibold text-acento ${
            subiendo ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <Upload size={16} strokeWidth={1.75} aria-hidden />
          {subiendo ? "Subiendo..." : "Subir PDF / .md / .txt"}
          <input
            type="file"
            accept=".pdf,.md,.txt"
            className="hidden"
            disabled={subiendo}
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) subirArchivo(archivo);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
      {cargando && !error && <p>Cargando...</p>}

      {!cargando && documentos.length === 0 && !error && (
        <p className="text-texto-suave dark:text-texto-suave-dark">
          Todavía no has subido ningún documento por acá — el asesor sigue usando el spec
          de MineLink y lo que haya en la carpeta del repositorio.
        </p>
      )}

      {documentos.length > 0 && (
        <div className="flex flex-col gap-2">
          {documentos.map((doc) => (
            <div
              key={doc.id}
              className={`flex flex-wrap items-center justify-between gap-2 border border-black/10 p-3 dark:border-white/10 ${
                doc.activo ? "" : "opacity-50"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{doc.nombre}</p>
                <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
                  {doc.categoria && <span>{doc.categoria} · </span>}
                  {doc.caracteres.toLocaleString("es-PE")} caracteres ·{" "}
                  {new Date(doc.created_at).toLocaleDateString("es-PE")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => alternarActivo(doc)}
                  className="min-h-[36px] border border-black/10 px-3 text-xs font-semibold dark:border-white/10"
                >
                  {doc.activo ? "Desactivar" : "Activar"}
                </button>
                <button
                  onClick={() => eliminar(doc)}
                  aria-label="Borrar"
                  className="flex h-9 w-9 items-center justify-center text-texto-suave hover:text-red-500 dark:text-texto-suave-dark"
                >
                  <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

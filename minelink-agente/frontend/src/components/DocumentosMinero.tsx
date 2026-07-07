import { useEffect, useRef, useState } from "react";
import { useMineroAuth } from "../context/MineroAuthContext";
import { CATEGORIAS_DOCUMENTO, type DocumentoOperacion } from "../types/documento";

export function DocumentosMinero() {
  const { authFetch } = useMineroAuth();
  const [documentos, setDocumentos] = useState<DocumentoOperacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [vistaUrl, setVistaUrl] = useState<string | null>(null);
  const [vistaTipo, setVistaTipo] = useState<string>("");
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  function cargar() {
    setCargando(true);
    authFetch("/mineros/documentos")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setDocumentos(data);
        setError(null);
      })
      .catch(() => setError("No pudimos cargar tus archivos."))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, [authFetch]);

  async function subir(categoria: string, archivo: File) {
    setSubiendo(categoria);
    setError(null);
    try {
      const form = new FormData();
      form.set("categoria", categoria);
      form.set("archivo", archivo);
      const resp = await authFetch("/mineros/documentos", { method: "POST", body: form });
      if (!resp.ok) {
        const detalle = await resp.json().catch(() => null);
        throw new Error(detalle?.detail ?? "No se pudo subir el archivo");
      }
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el archivo");
    } finally {
      setSubiendo(null);
    }
  }

  async function eliminar(doc: DocumentoOperacion) {
    if (!window.confirm(`¿Eliminar "${doc.nombre_original}"?`)) return;
    await authFetch(`/mineros/documentos/${doc.id}`, { method: "DELETE" });
    setDocumentos((actuales) => actuales.filter((d) => d.id !== doc.id));
  }

  async function ver(doc: DocumentoOperacion) {
    const resp = await authFetch(`/mineros/documentos/${doc.id}/archivo`);
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

  return (
    <div className="rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
      <h2 className="font-semibold">Documentos de tu operación</h2>
      <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
        Súbelos para estar listo cuando conectemos con inversionistas
        interesados en operaciones formalizadas. Por ahora solo los guardamos
        para ti — Esthiven los revisará más adelante.
      </p>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {cargando && <p className="mt-2 text-sm">Cargando...</p>}

      {!cargando && (
        <div className="mt-4 flex flex-col gap-4">
          {CATEGORIAS_DOCUMENTO.map((cat) => {
            const archivos = documentos.filter((d) => d.categoria === cat.categoria);
            return (
              <div key={cat.categoria} className="rounded-lg border border-black/10 p-3 dark:border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{cat.etiqueta}</p>
                    <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
                      {cat.descripcion}
                    </p>
                    <p className="mt-0.5 text-xs text-texto-suave dark:text-texto-suave-dark">
                      {cat.formatos}
                    </p>
                  </div>
                  <button
                    onClick={() => inputsRef.current[cat.categoria]?.click()}
                    disabled={subiendo === cat.categoria}
                    className="min-h-[36px] shrink-0 rounded-lg border border-acento px-3 text-xs font-semibold text-acento disabled:opacity-50"
                  >
                    {subiendo === cat.categoria ? "Subiendo..." : "+ Agregar"}
                  </button>
                  <input
                    ref={(el) => {
                      inputsRef.current[cat.categoria] = el;
                    }}
                    type="file"
                    accept={cat.accept}
                    className="hidden"
                    onChange={(e) => {
                      const archivo = e.target.files?.[0];
                      if (archivo) subir(cat.categoria, archivo);
                      e.target.value = "";
                    }}
                  />
                </div>

                {archivos.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {archivos.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <button
                          onClick={() => ver(doc)}
                          className="truncate text-left text-acento underline"
                        >
                          {doc.nombre_original}
                        </button>
                        <button
                          onClick={() => eliminar(doc)}
                          className="shrink-0 text-xs font-semibold text-red-500"
                        >
                          Eliminar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {vistaUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-2 md:p-6">
          <div className="mb-2 flex items-center justify-between text-white">
            <p className="font-medium">Vista previa</p>
            <button
              onClick={cerrarVista}
              className="min-h-[44px] rounded-lg bg-white/10 px-4 font-semibold"
            >
              Cerrar
            </button>
          </div>
          {vistaTipo.startsWith("image/") ? (
            <img src={vistaUrl} className="mx-auto max-h-full max-w-full object-contain" />
          ) : (
            <iframe src={vistaUrl} title="Vista previa" className="flex-1 rounded-lg bg-white" />
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { useMineroAuth } from "../context/MineroAuthContext";
import type { DocumentoOperacion } from "../types/documento";

const ACCEPT_FOTO_O_PDF = "application/pdf,image/jpeg,image/png,image/webp";

interface Props {
  /** Categorías de sustento de inversión requeridas para este perfil (ver
   *  MineroPerfil.categorias_requeridas_inversion) — si viene vacío, este
   *  componente no renderiza nada (perfil A/A_avanzado no tiene). */
  categorias: { categoria: string; etiqueta: string; aprobado: boolean }[];
}

/** "Respalda tu inversión" — mismo tratamiento visual que "Respalda tu
 *  declaración" en DocumentosMinero.tsx, pero para los documentos de
 *  sustento del Módulo INV (liquidaciones de venta, estados financieros,
 *  título de concesión, etc.). Vive aparte porque esas categorías no
 *  tienen una pregunta de origen del diagnóstico (sin "Marcaste: X") y se
 *  muestran en la columna de Inversión, no junto a formalización. */
export function DocumentosInversionSustento({ categorias }: Props) {
  const { authFetch } = useMineroAuth();
  const [documentos, setDocumentos] = useState<DocumentoOperacion[]>([]);
  const [miniaturas, setMiniaturas] = useState<Record<number, string>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [vistaUrl, setVistaUrl] = useState<string | null>(null);
  const [vistaTipo, setVistaTipo] = useState("");
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    authFetch("/mineros/documentos")
      .then((r) => (r.ok ? r.json() : []))
      .then(setDocumentos)
      .catch(() => setError("No pudimos cargar tus archivos."))
      .finally(() => setCargando(false));
  }, [authFetch]);

  useEffect(() => {
    let cancelado = false;
    const urls: string[] = [];
    Promise.all(
      documentos.map(async (doc) => {
        if (!doc.content_type.startsWith("image/")) return null;
        const resp = await authFetch(`/mineros/documentos/${doc.id}/archivo`);
        if (!resp.ok) return null;
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return [doc.id, url] as const;
      })
    ).then((pares) => {
      if (cancelado) return;
      const mapa: Record<number, string> = {};
      for (const par of pares) if (par) mapa[par[0]] = par[1];
      setMiniaturas(mapa);
    });
    return () => {
      cancelado = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentos]);

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
      const doc = await resp.json();
      setDocumentos((actuales) => [doc, ...actuales]);
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

  if (categorias.length === 0) return null;

  return (
    <div className="rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
      <h2 className="font-semibold">Respalda tu inversión</h2>
      <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
        Sube una foto o PDF por cada documento que tu perfil de inversión necesita.
      </p>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {cargando && <p className="mt-2 text-sm">Cargando...</p>}

      {!cargando && (
        <div className="mt-4 flex flex-col gap-4">
          {categorias.map((cat) => {
            const archivos = documentos.filter((d) => d.categoria === cat.categoria);
            return (
              <div
                key={cat.categoria}
                className="rounded-lg border border-black/10 p-3 dark:border-white/10"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{cat.etiqueta}</p>
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
                    accept={ACCEPT_FOTO_O_PDF}
                    className="hidden"
                    onChange={(e) => {
                      const archivo = e.target.files?.[0];
                      if (archivo) subir(cat.categoria, archivo);
                      e.target.value = "";
                    }}
                  />
                </div>

                {archivos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {archivos.map((doc) => (
                      <div key={doc.id} className="flex w-24 flex-col items-center gap-1">
                        <button
                          onClick={() => ver(doc)}
                          title={doc.nombre_original}
                          className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                        >
                          {miniaturas[doc.id] ? (
                            <img
                              src={miniaturas[doc.id]}
                              className="h-full w-full object-cover"
                              alt={doc.nombre_original}
                            />
                          ) : (
                            <ImageIcon
                              size={22}
                              strokeWidth={1.75}
                              className="text-texto-suave dark:text-texto-suave-dark"
                              aria-hidden
                            />
                          )}
                        </button>
                        {doc.estado_revision === "aprobado" && (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            Aprobado
                          </span>
                        )}
                        {doc.estado_revision === "pendiente" && (
                          <span className="text-xs text-texto-suave dark:text-texto-suave-dark">
                            En revisión
                          </span>
                        )}
                        {doc.estado_revision === "rechazado" && (
                          <span
                            className="text-center text-xs font-semibold text-red-500"
                            title={doc.motivo_rechazo ?? undefined}
                          >
                            Rechazado{doc.motivo_rechazo ? `: ${doc.motivo_rechazo}` : ""}
                          </span>
                        )}
                        {doc.estado_revision !== "aprobado" && (
                          <button
                            onClick={() => eliminar(doc)}
                            className="text-xs font-semibold text-red-500"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
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
              onClick={() => setVistaUrl(null)}
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

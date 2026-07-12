import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImageIcon } from "lucide-react";
import { useMineroAuth } from "../context/MineroAuthContext";
import { CATEGORIAS_DOCUMENTO, type CategoriaInfo, type DocumentoOperacion } from "../types/documento";
import { INFO_BRECHA } from "../data/brechas";
import { DIMENSION_POR_ESTUDIO } from "../data/estudioDimension";
import { ORDEN_DIMENSIONES } from "../data/estudiosPorDimension";
import { NOMBRES_DIMENSION, POR_ID } from "../data/preguntas";

const FORMATOS_FOTO_O_PDF = "Formato: PDF o una foto del documento (JPG, PNG, WEBP)";
const ACCEPT_FOTO_O_PDF = "application/pdf,image/jpeg,image/png,image/webp";

/** Traduce el valor crudo que el minero marcó (ej. "en_tramite") a su
 *  etiqueta legible, buscando la pregunta de origen en el catálogo del
 *  cuestionario — mismo texto que vio al responder. */
function etiquetaDeclarada(preguntaId: string, valor: string): string | undefined {
  return POR_ID[preguntaId]?.opciones?.find((o) => o.valor === valor)?.etiqueta;
}

interface EstudioAplicable {
  codigo: string;
  pregunta_id: string;
  valor: string;
}

interface Props {
  onDocumentosChange?: (documentos: DocumentoOperacion[]) => void;
  /** Estudios del catálogo (ver INFO_BRECHA) que aplican a la ruta de
   * este minero, con lo que respondió — se muestran como categorías
   * extra para que pueda respaldar con una foto lo que declaró. */
  estudiosAplicables?: EstudioAplicable[];
  /** Fotos condicionadas al perfil informativo (mineral, camino de
   * acceso, agua, energía) — ya vienen con la etiqueta compuesta desde
   * el backend (incluye lo que el minero declaró, ej. "Foto del mineral
   * que extraes (Cobre)"). */
  fotosPerfilAplicables?: { categoria: string; etiqueta: string }[];
  /** True si es titular de la concesión, False si no, undefined si no se
   * pudo determinar. Solo se muestra el documento legal que le aplica:
   * "Título de concesión" si es titular, "Contrato de explotación" si no
   * — mostrar ambos confundía (julio 2026). */
  esTitularConcesion?: boolean | null;
  /** Oculta el bloque "Fotos de tu operación" (fotos_mina + condicionadas
   * al perfil) — por ahora fuera de /mi-concesion, ver MiConcesion.tsx. */
  ocultarFotosOperacion?: boolean;
  /** Oculta el título "Documentos de tu operación" y el párrafo que
   * menciona inversionistas — por ahora fuera de /mi-concesion, ver
   * MiConcesion.tsx (esa ventana ya no habla de inversionistas). */
  ocultarEncabezado?: boolean;
  /** Oculta "Documentos legales" (título, RUC, contrato, catastro, informe
   * de leyes) — por ahora fuera de /mi-concesion, solo queda "Respalda tu
   * declaración" (lo que sí salió del diagnóstico). */
  ocultarDocumentosLegales?: boolean;
  /** True si el minero ya pulsó "Guardar archivos" (ver
   * MineroPerfil.documentos_enviados) — cambia el botón a "Enviado, en
   * revisión" en vez de "Guardar archivos". */
  documentosEnviados?: boolean;
  /** Ruta de la cuenta del minero (/mi-cuenta o /mi-concesion) — a dónde
   * vuelve desde la pantalla de confirmación tras enviar. */
  rutaVolver: string;
}

export function DocumentosMinero({
  onDocumentosChange,
  estudiosAplicables,
  fotosPerfilAplicables,
  esTitularConcesion,
  ocultarFotosOperacion,
  ocultarEncabezado,
  ocultarDocumentosLegales,
  documentosEnviados,
  rutaVolver,
}: Props) {
  const navigate = useNavigate();
  const { authFetch } = useMineroAuth();
  const [documentos, setDocumentos] = useState<DocumentoOperacion[]>([]);
  const [miniaturas, setMiniaturas] = useState<Record<number, string>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [vistaUrl, setVistaUrl] = useState<string | null>(null);
  const [vistaTipo, setVistaTipo] = useState<string>("");
  const [enviado, setEnviado] = useState(Boolean(documentosEnviados));
  const [enviando, setEnviando] = useState(false);
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => setEnviado(Boolean(documentosEnviados)), [documentosEnviados]);

  function cargar() {
    setCargando(true);
    authFetch("/mineros/documentos")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setDocumentos(data);
        onDocumentosChange?.(data);
        setError(null);
      })
      .catch(() => setError("No pudimos cargar tus archivos."))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, [authFetch]);

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
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el archivo");
    } finally {
      setSubiendo(null);
    }
  }

  async function enviarDocumentos() {
    setEnviando(true);
    setError(null);
    try {
      const resp = await authFetch("/mineros/documentos/enviar", { method: "POST" });
      if (!resp.ok) {
        const detalle = await resp.json().catch(() => null);
        throw new Error(detalle?.detail ?? "No pudimos enviar tus archivos a revisión");
      }
      setEnviado(true);
      navigate("/documentos-enviados", { state: { volverA: rutaVolver } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos enviar tus archivos a revisión");
    } finally {
      setEnviando(false);
    }
  }

  async function eliminar(doc: DocumentoOperacion) {
    if (!window.confirm(`¿Eliminar "${doc.nombre_original}"?`)) return;
    await authFetch(`/mineros/documentos/${doc.id}`, { method: "DELETE" });
    setDocumentos((actuales) => {
      const restantes = actuales.filter((d) => d.id !== doc.id);
      onDocumentosChange?.(restantes);
      return restantes;
    });
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

  const categoriasEstudio: CategoriaInfo[] = (estudiosAplicables ?? []).map(
    ({ codigo, pregunta_id, valor }) => ({
      categoria: codigo as CategoriaInfo["categoria"],
      etiqueta: INFO_BRECHA[codigo]?.texto ?? codigo,
      descripcion: INFO_BRECHA[codigo]?.resuelve ?? "",
      accept: ACCEPT_FOTO_O_PDF,
      formatos: FORMATOS_FOTO_O_PDF,
      declarado: etiquetaDeclarada(pregunta_id, valor),
    })
  );

  // Agrupadas por dimensión (Legal/Ambiental/Operativo/Técnico/Seguridad/
  // Social) para que "Respalda tu declaración" no sea una lista larga sin
  // orden — mismo criterio que ya usan Postular.tsx y AdminEmpresas.tsx.
  const categoriasEstudioPorDimension = ORDEN_DIMENSIONES.map((dim) => ({
    dim,
    categorias: categoriasEstudio.filter((c) => DIMENSION_POR_ESTUDIO[c.categoria] === dim),
  })).filter((grupo) => grupo.categorias.length > 0);

  const FORMATOS_SOLO_FOTO = "Formato: JPG, PNG o WEBP";
  const ACCEPT_SOLO_FOTO = "image/jpeg,image/png,image/webp";
  const categoriasFotoPerfil: CategoriaInfo[] = (fotosPerfilAplicables ?? []).map(
    ({ categoria, etiqueta }) => ({
      categoria: categoria as CategoriaInfo["categoria"],
      etiqueta,
      descripcion: "",
      accept: ACCEPT_SOLO_FOTO,
      formatos: FORMATOS_SOLO_FOTO,
    })
  );
  const categoriaFotos = [
    ...CATEGORIAS_DOCUMENTO.filter((c) => c.categoria === "fotos_mina"),
    ...categoriasFotoPerfil,
  ];
  const categoriasLegales = CATEGORIAS_DOCUMENTO.filter((c) => {
    if (c.categoria === "fotos_mina") return false;
    // Solo se le pide el documento que le aplica según si es titular o
    // no — pedirle los dos confunde (uno de ellos nunca le va a servir).
    if (esTitularConcesion === true && c.categoria === "contrato_explotacion") return false;
    if (esTitularConcesion === false && c.categoria === "titulo_concesion") return false;
    return true;
  });

  function bloqueCategoria(cat: CategoriaInfo) {
    const archivos = documentos.filter((d) => d.categoria === cat.categoria);
    return (
      <div key={cat.categoria} className="rounded-lg border border-black/10 p-3 dark:border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{cat.etiqueta}</p>
            {cat.declarado && (
              <p className="mt-0.5 text-xs font-semibold text-acento">
                Marcaste: {cat.declarado}
              </p>
            )}
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
  }

  return (
    <div className="rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
      {!ocultarEncabezado && (
        <>
          <h2 className="font-semibold">Documentos de tu operación</h2>
          <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
            Súbelos para estar listo cuando conectemos con inversionistas
            interesados en operaciones formalizadas. Por ahora solo los guardamos
            para ti — Esthiven los revisará más adelante.
          </p>
        </>
      )}

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {cargando && <p className="mt-2 text-sm">Cargando...</p>}

      {!cargando && (!ocultarFotosOperacion || !ocultarDocumentosLegales) && (
        <div className="mt-4 flex flex-col gap-6">
          {!ocultarFotosOperacion && (
            <div>
              <h3 className="text-sm font-semibold uppercase text-texto-suave dark:text-texto-suave-dark">
                Fotos de tu operación
              </h3>
              <div className="mt-2 flex flex-col gap-4">
                {categoriaFotos.map(bloqueCategoria)}
              </div>
            </div>
          )}
          {!ocultarDocumentosLegales && (
            <div>
              <h3 className="text-sm font-semibold uppercase text-texto-suave dark:text-texto-suave-dark">
                Documentos legales
              </h3>
              <div className="mt-2 flex flex-col gap-4">
                {categoriasLegales.map(bloqueCategoria)}
              </div>
            </div>
          )}
        </div>
      )}

      {!cargando && categoriasEstudioPorDimension.length > 0 && (
        <div
          className={
            ocultarFotosOperacion && ocultarDocumentosLegales
              ? "mt-4"
              : "mt-6 border-t border-black/10 pt-4 dark:border-white/10"
          }
        >
          <h2 className="font-semibold">Respalda tu declaración</h2>
          <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
            En el diagnóstico respondiste Sí/No sobre tu estado de
            formalización, pero esa respuesta por sí sola no se puede
            comprobar. Sube una foto de respaldo (o una foto del PDF) por
            cada trámite o estudio que quieras acreditar — es opcional.
          </p>
          <div className="mt-4 flex flex-col gap-5">
            {categoriasEstudioPorDimension.map(({ dim, categorias }) => (
              <div key={dim}>
                <h3 className="text-sm font-semibold uppercase text-texto-suave dark:text-texto-suave-dark">
                  {NOMBRES_DIMENSION[dim]}
                </h3>
                <div className="mt-2 flex flex-col gap-4">
                  {categorias.map(bloqueCategoria)}
                </div>
              </div>
            ))}
          </div>

          {(() => {
            const faltantes = categoriasEstudio.filter(
              (c) => !documentos.some((d) => d.categoria === c.categoria)
            );
            if (enviado) {
              return (
                <p className="mt-4 rounded-lg bg-acento/10 p-3 text-sm font-semibold text-acento">
                  Enviado — Esthiven está revisando tus archivos.
                </p>
              );
            }
            return (
              <div className="mt-4">
                {faltantes.length > 0 && (
                  <p className="mb-2 text-xs text-texto-suave dark:text-texto-suave-dark">
                    Sube al menos un archivo para cada categoría antes de guardar (
                    {faltantes.length} pendiente{faltantes.length !== 1 ? "s" : ""}).
                  </p>
                )}
                <button
                  onClick={enviarDocumentos}
                  disabled={faltantes.length > 0 || enviando}
                  className="min-h-[44px] w-full rounded-lg bg-acento px-4 font-semibold text-white disabled:opacity-50"
                >
                  {enviando ? "Guardando..." : "Guardar archivos"}
                </button>
              </div>
            );
          })()}
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

import { useEffect, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { useMineroAuth } from "../context/MineroAuthContext";
import { CATEGORIAS_DOCUMENTO, type CategoriaInfo, type DocumentoOperacion } from "../types/documento";
import { INFO_BRECHA } from "../data/brechas";
import { DIMENSION_POR_ESTUDIO } from "../data/estudioDimension";
import { ORDEN_DIMENSIONES } from "../data/estudiosPorDimension";
import { NOMBRES_DIMENSION } from "../data/preguntas";

const FORMATOS_FOTO_O_PDF = "Formato: PDF o una foto del documento (JPG, PNG, WEBP)";
const ACCEPT_FOTO_O_PDF = "application/pdf,image/jpeg,image/png,image/webp";

interface Props {
  onDocumentosChange?: (documentos: DocumentoOperacion[]) => void;
  /** Códigos de estudio del catálogo (ver INFO_BRECHA) que aplican a la
   * ruta de este minero — se muestran como categorías extra para que
   * pueda respaldar con una foto lo que declaró en el diagnóstico. */
  estudiosAplicables?: string[];
}

export function DocumentosMinero({ onDocumentosChange, estudiosAplicables }: Props = {}) {
  const { authFetch } = useMineroAuth();
  const [documentos, setDocumentos] = useState<DocumentoOperacion[]>([]);
  const [miniaturas, setMiniaturas] = useState<Record<number, string>>({});
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

  const categoriasEstudio: CategoriaInfo[] = (estudiosAplicables ?? []).map((codigo) => ({
    categoria: codigo as CategoriaInfo["categoria"],
    etiqueta: INFO_BRECHA[codigo]?.texto ?? codigo,
    descripcion: INFO_BRECHA[codigo]?.resuelve ?? "",
    accept: ACCEPT_FOTO_O_PDF,
    formatos: FORMATOS_FOTO_O_PDF,
  }));

  // Agrupadas por dimensión (Legal/Ambiental/Operativo/Técnico/Seguridad/
  // Social) para que "Respalda tu declaración" no sea una lista larga sin
  // orden — mismo criterio que ya usan Postular.tsx y AdminEmpresas.tsx.
  const categoriasEstudioPorDimension = ORDEN_DIMENSIONES.map((dim) => ({
    dim,
    categorias: categoriasEstudio.filter((c) => DIMENSION_POR_ESTUDIO[c.categoria] === dim),
  })).filter((grupo) => grupo.categorias.length > 0);

  const categoriaFotos = CATEGORIAS_DOCUMENTO.filter((c) => c.categoria === "fotos_mina");
  const categoriasLegales = CATEGORIAS_DOCUMENTO.filter((c) => c.categoria !== "fotos_mina");

  function bloqueCategoria(cat: CategoriaInfo) {
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
          <div className="mt-2 flex flex-wrap gap-3">
            {archivos.map((doc) => (
              <div key={doc.id} className="flex w-20 flex-col items-center gap-1">
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
                <button
                  onClick={() => eliminar(doc)}
                  className="text-xs font-semibold text-red-500"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
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
        <div className="mt-4 flex flex-col gap-6">
          <div>
            <h3 className="text-sm font-semibold uppercase text-texto-suave dark:text-texto-suave-dark">
              Fotos de la mina
            </h3>
            <div className="mt-2 flex flex-col gap-4">
              {categoriaFotos.map(bloqueCategoria)}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase text-texto-suave dark:text-texto-suave-dark">
              Documentos legales
            </h3>
            <div className="mt-2 flex flex-col gap-4">
              {categoriasLegales.map(bloqueCategoria)}
            </div>
          </div>
        </div>
      )}

      {!cargando && categoriasEstudioPorDimension.length > 0 && (
        <div className="mt-6 border-t border-black/10 pt-4 dark:border-white/10">
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

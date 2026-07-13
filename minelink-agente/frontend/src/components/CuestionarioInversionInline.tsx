import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ImageIcon, X } from "lucide-react";
import { ProgressBar } from "./ProgressBar";
import { useMineroAuth } from "../context/MineroAuthContext";
import {
  categoriasRequeridasInversion,
  ETIQUETA_CATEGORIA_INV,
  preguntasVisiblesInversion,
  type PreguntaInv,
  type RespuestasInversion,
} from "../data/preguntasInversion";
import type { DocumentoOperacion } from "../types/documento";
import type { MineroPerfil } from "../types/minero";

/** Misma lógica de CuestionarioInversion.tsx (el wizard del Módulo INV),
 *  pero en un recuadro modal sobre la propia cuenta del minero en vez de
 *  navegar a una página aparte — se abre al costado de "Formalización"
 *  sin salir de la ventana, y al enviar cierra solo para dejar la
 *  columna de Inversión mostrando lo que respondió + los documentos. */
export function CuestionarioInversionInline({
  perfil,
  onEnviado,
  onCerrar,
}: {
  perfil: MineroPerfil;
  onEnviado: () => void;
  onCerrar: () => void;
}) {
  const { authFetch } = useMineroAuth();
  const [respuestas, setRespuestas] = useState<RespuestasInversion>({});
  const [paso, setPaso] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoOperacion[]>([]);
  const [subiendoCategoria, setSubiendoCategoria] = useState<string | null>(null);
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    Promise.all([
      authFetch("/mineros/inversion").then((r) => r.json()),
      authFetch("/mineros/documentos").then((r) => r.json()),
    ])
      .then(([inv, docs]) => {
        const respuestasPrevias: RespuestasInversion = inv.respuestas ?? {};
        setRespuestas(respuestasPrevias);
        setDocumentos(docs ?? []);
        const visibles = preguntasVisiblesInversion(perfil.perfil, respuestasPrevias);
        const idx = visibles.findIndex((p) => respuestasPrevias[p.id] === undefined);
        setPaso(idx === -1 ? visibles.length : idx);
      })
      .catch(() => setError("No pudimos cargar tu módulo de inversión."))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authFetch]);

  const categoriasRequeridas = useMemo(
    () => categoriasRequeridasInversion(perfil.perfil, respuestas),
    [perfil.perfil, respuestas]
  );
  const faltanDocumentos = categoriasRequeridas.filter(
    (c) => !documentos.some((d) => d.categoria === c)
  );

  async function subirDocumentoSustento(categoria: string, archivo: File) {
    setSubiendoCategoria(categoria);
    setError(null);
    try {
      const form = new FormData();
      form.set("categoria", categoria);
      form.set("archivo", archivo);
      const resp = await authFetch("/mineros/documentos", { method: "POST", body: form });
      if (!resp.ok) {
        const detalle = await resp.json().catch(() => null);
        throw new Error(detalle?.detail ?? "No se pudo subir el archivo.");
      }
      const doc = await resp.json();
      setDocumentos((actuales) => [doc, ...actuales]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el archivo.");
    } finally {
      setSubiendoCategoria(null);
    }
  }

  const visibles = useMemo(
    () => preguntasVisiblesInversion(perfil.perfil, respuestas),
    [perfil.perfil, respuestas]
  );
  const actual: PreguntaInv | null = visibles[paso] ?? null;

  function responder(id: string, valor: string | string[]) {
    setError(null);
    setRespuestas((r) => ({ ...r, [id]: valor }));
    setPaso((p) => p + 1);
  }

  function volver() {
    setError(null);
    setPaso((p) => Math.max(0, p - 1));
  }

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const resp = await authFetch("/mineros/inversion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respuestas }),
      });
      if (!resp.ok) {
        const detalle = await resp.json().catch(() => null);
        throw new Error(detalle?.detail ?? "No pudimos enviar tus respuestas.");
      }
      onEnviado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos enviar tus respuestas.");
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) {
    return (
      <ModalShell onCerrar={onCerrar}>
        <p className="text-sm text-texto-suave dark:text-texto-suave-dark">Cargando...</p>
      </ModalShell>
    );
  }

  if (!actual) {
    return (
      <ModalShell onCerrar={onCerrar}>
        <h2 className="font-semibold">Listo para enviar</h2>
        <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
          Respondiste todas las preguntas del perfil de inversión.
          {categoriasRequeridas.length > 0 &&
            " Sube también los documentos que tu perfil necesita antes de enviar."}
        </p>

        {categoriasRequeridas.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 className="text-sm font-semibold uppercase text-texto-suave dark:text-texto-suave-dark">
              Documentos de sustento
            </h3>
            {categoriasRequeridas.map((categoria) => {
              const archivos = documentos.filter((d) => d.categoria === categoria);
              return (
                <div key={categoria} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {archivos.length > 0 ? (
                      <Check size={18} strokeWidth={2.5} className="shrink-0 text-emerald-500" aria-hidden />
                    ) : (
                      <ImageIcon size={18} strokeWidth={2} className="shrink-0 text-texto-suave dark:text-texto-suave-dark" aria-hidden />
                    )}
                    <span className="text-sm">
                      {ETIQUETA_CATEGORIA_INV[categoria] ?? categoria}
                    </span>
                  </div>
                  <button
                    onClick={() => inputsRef.current[categoria]?.click()}
                    disabled={subiendoCategoria === categoria}
                    className="min-h-[36px] shrink-0 rounded-lg border border-acento px-3 text-xs font-semibold text-acento disabled:opacity-50"
                  >
                    {subiendoCategoria === categoria
                      ? "Subiendo..."
                      : archivos.length > 0
                        ? "Reemplazar"
                        : "+ Agregar"}
                  </button>
                  <input
                    ref={(el) => {
                      inputsRef.current[categoria] = el;
                    }}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const archivo = e.target.files?.[0];
                      if (archivo) subirDocumentoSustento(categoria, archivo);
                      e.target.value = "";
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="mt-5 flex items-center justify-between gap-3">
          <BotonVolver onClick={volver} />
          <button
            disabled={enviando || faltanDocumentos.length > 0}
            onClick={enviar}
            className="min-h-[44px] rounded-lg bg-acento px-6 font-semibold text-white disabled:opacity-50"
          >
            {enviando
              ? "Enviando..."
              : faltanDocumentos.length > 0
                ? "Sube los documentos que faltan"
                : "Enviar"}
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onCerrar={onCerrar}>
      <ProgressBar actual={paso + 1} total={visibles.length + 1} />

      <div className="mt-4 flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{actual.texto}</h2>
        {actual.ayuda && (
          <p className="text-sm text-texto-suave dark:text-texto-suave-dark">{actual.ayuda}</p>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      <div className="mt-4">
        {actual.tipo === "opcion" && (
          <OpcionesInv
            key={actual.id}
            opciones={actual.opciones ?? []}
            valorActual={respuestas[actual.id] as string | undefined}
            onContinuar={(v) => responder(actual.id, v)}
            onVolver={paso > 0 ? volver : undefined}
          />
        )}
        {actual.tipo === "multi_opcion" && (
          <MultiOpcionInv
            key={actual.id}
            pregunta={actual}
            valorActual={(respuestas[actual.id] as string[] | undefined) ?? []}
            onContinuar={(v) => responder(actual.id, v)}
            onVolver={paso > 0 ? volver : undefined}
          />
        )}
        {actual.tipo === "texto_corto" && (
          <TextoCortoInv
            key={actual.id}
            pregunta={actual}
            valorActual={(respuestas[actual.id] as string | undefined) ?? ""}
            onContinuar={(v) => responder(actual.id, v)}
            onVolver={paso > 0 ? volver : undefined}
          />
        )}
      </div>
    </ModalShell>
  );
}

/** Recuadro modal centrado sobre la propia cuenta del minero — mismo
 *  patrón de InteresInversionModal.tsx (fondo bg-black/50 + tarjeta
 *  redondeada), para que las preguntas se respondan sin salir de la
 *  ventana ni perder de vista "Formalización" detrás. */
function ModalShell({ children, onCerrar }: { children: ReactNode; onCerrar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4">
      <div className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-tarjeta p-6 dark:bg-tarjeta-dark md:max-h-[90vh] md:rounded-lg">
        <button
          onClick={onCerrar}
          aria-label="Cerrar"
          className="absolute right-4 top-4 text-texto-suave hover:text-texto dark:text-texto-suave-dark dark:hover:text-texto-dark"
        >
          <X size={20} strokeWidth={2} />
        </button>
        {children}
      </div>
    </div>
  );
}

function BotonVolver({ onClick }: { onClick?: () => void }) {
  if (!onClick) return <span />;
  return (
    <button
      onClick={onClick}
      className="min-h-[44px] rounded-lg border border-black/10 px-4 text-sm font-semibold dark:border-white/10"
    >
      ← Volver
    </button>
  );
}

function OpcionesInv({
  opciones,
  valorActual,
  onContinuar,
  onVolver,
}: {
  opciones: { valor: string; etiqueta: string }[];
  valorActual?: string;
  onContinuar: (valor: string) => void;
  onVolver?: () => void;
}) {
  const [seleccion, setSeleccion] = useState<string | undefined>(valorActual);

  return (
    <div className="flex flex-col gap-3">
      {opciones.map((op) => {
        const seleccionada = op.valor === seleccion;
        return (
          <button
            key={op.valor}
            onClick={() => setSeleccion(op.valor)}
            className={`flex min-h-[44px] items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left font-medium transition-colors ${
              seleccionada
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-black/10 hover:bg-acento/10 dark:border-white/10"
            }`}
          >
            <span>{op.etiqueta}</span>
            {seleccionada && (
              <Check size={18} strokeWidth={2.5} className="shrink-0 text-emerald-500" aria-hidden />
            )}
          </button>
        );
      })}
      <div className="mt-2 flex items-center justify-between gap-3">
        <BotonVolver onClick={onVolver} />
        <button
          disabled={!seleccion}
          onClick={() => seleccion && onContinuar(seleccion)}
          className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}

function MultiOpcionInv({
  pregunta,
  valorActual,
  onContinuar,
  onVolver,
}: {
  pregunta: PreguntaInv;
  valorActual: string[];
  onContinuar: (valores: string[]) => void;
  onVolver?: () => void;
}) {
  const [seleccion, setSeleccion] = useState<string[]>(valorActual);
  const maximo = pregunta.maxSelecciones;

  function alternar(valor: string) {
    setSeleccion((actual) => {
      if (actual.includes(valor)) return actual.filter((v) => v !== valor);
      if (maximo && actual.length >= maximo) return actual;
      return [...actual, valor];
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {(pregunta.opciones ?? []).map((op) => {
        const marcada = seleccion.includes(op.valor);
        const deshabilitada = !marcada && Boolean(maximo) && seleccion.length >= (maximo ?? 0);
        return (
          <label
            key={op.valor}
            className={`flex min-h-[44px] items-center gap-3 rounded-lg border px-4 py-3 font-medium ${
              marcada
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-black/10 dark:border-white/10"
            } ${deshabilitada ? "opacity-50" : ""}`}
          >
            <input
              type="checkbox"
              checked={marcada}
              disabled={deshabilitada}
              onChange={() => alternar(op.valor)}
            />
            {op.etiqueta}
          </label>
        );
      })}
      {maximo && (
        <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
          {seleccion.length}/{maximo} seleccionadas
        </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-3">
        <BotonVolver onClick={onVolver} />
        <button
          disabled={seleccion.length === 0}
          onClick={() => onContinuar(seleccion)}
          className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}

function TextoCortoInv({
  pregunta,
  valorActual,
  onContinuar,
  onVolver,
}: {
  pregunta: PreguntaInv;
  valorActual: string;
  onContinuar: (valor: string) => void;
  onVolver?: () => void;
}) {
  const [texto, setTexto] = useState(valorActual);
  const maximo = pregunta.maxCaracteres ?? 300;

  return (
    <div className="flex flex-col gap-3">
      <textarea
        className="min-h-[100px] w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/10"
        value={texto}
        maxLength={maximo}
        onChange={(e) => setTexto(e.target.value)}
      />
      <p className="text-right text-xs text-texto-suave dark:text-texto-suave-dark">
        {texto.length}/{maximo}
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <BotonVolver onClick={onVolver} />
        <button
          disabled={!texto.trim()}
          onClick={() => onContinuar(texto.trim())}
          className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}

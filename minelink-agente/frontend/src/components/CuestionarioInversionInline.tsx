import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { ProgressBar } from "./ProgressBar";
import { useMineroAuth } from "../context/MineroAuthContext";
import {
  preguntasVisiblesInversion,
  type PreguntaInv,
  type RespuestasInversion,
} from "../data/preguntasInversion";
import type { MineroPerfil } from "../types/minero";

/** Misma lógica de CuestionarioInversion.tsx (el wizard del Módulo INV),
 *  pero en un recuadro modal de tamaño FIJO sobre la propia cuenta del
 *  minero en vez de navegar a una página aparte — se abre al costado de
 *  "Formalización" sin salir de la ventana. El tamaño del recuadro no
 *  cambia entre pasos (a diferencia de la versión anterior, que crecía o
 *  encogía según la pregunta y obligaba a hacer scroll en la página): el
 *  contenido de cada pregunta se desplaza dentro de un área fija y los
 *  botones Volver/Continuar quedan siempre en la misma posición abajo. */
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

  useEffect(() => {
    authFetch("/mineros/inversion")
      .then((r) => r.json())
      .then((inv) => {
        const respuestasPrevias: RespuestasInversion = inv.respuestas ?? {};
        setRespuestas(respuestasPrevias);
        const visibles = preguntasVisiblesInversion(perfil.perfil, respuestasPrevias);
        const idx = visibles.findIndex((p) => respuestasPrevias[p.id] === undefined);
        setPaso(idx === -1 ? visibles.length : idx);
      })
      .catch(() => setError("No pudimos cargar tu módulo de inversión."))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authFetch]);

  const visibles = useMemo(
    () => preguntasVisiblesInversion(perfil.perfil, respuestas),
    [perfil.perfil, respuestas]
  );
  const actual: PreguntaInv | null = visibles[paso] ?? null;

  // Borrador de la pregunta actual — vive en el padre (no en cada
  // sub-componente) para poder mostrar el botón "Continuar →" en un pie
  // fijo, en vez de pegado al final de la lista de opciones.
  const [borrador, setBorrador] = useState<string | string[]>("");
  useEffect(() => {
    if (!actual) return;
    const previa = respuestas[actual.id];
    if (previa !== undefined) {
      setBorrador(previa);
    } else {
      setBorrador(actual.tipo === "multi_opcion" ? [] : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual?.id]);

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
      <ModalShell
        onCerrar={onCerrar}
        footer={
          <div className="flex items-center justify-between gap-3">
            <BotonVolver onClick={volver} />
            <button
              disabled={enviando}
              onClick={enviar}
              className="min-h-[44px] rounded-lg bg-acento px-6 font-semibold text-white disabled:opacity-50"
            >
              {enviando ? "Enviando..." : "Enviar"}
            </button>
          </div>
        }
      >
        <h2 className="font-semibold">Listo para enviar</h2>
        <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
          Respondiste todas las preguntas del perfil de inversión.
        </p>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </ModalShell>
    );
  }

  const puedeContinuar =
    actual.tipo === "multi_opcion"
      ? (borrador as string[]).length > 0
      : actual.tipo === "texto_corto"
        ? (borrador as string).trim().length > 0
        : Boolean(borrador);

  return (
    <ModalShell
      onCerrar={onCerrar}
      footer={
        <div className="flex items-center justify-between gap-3">
          <BotonVolver onClick={paso > 0 ? volver : undefined} />
          <button
            disabled={!puedeContinuar}
            onClick={() => responder(actual.id, borrador)}
            className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white disabled:opacity-50"
          >
            Continuar →
          </button>
        </div>
      }
    >
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
          <CampoOpcion
            opciones={actual.opciones ?? []}
            valor={borrador as string}
            onCambiar={setBorrador}
          />
        )}
        {actual.tipo === "multi_opcion" && (
          <CampoMultiOpcion
            pregunta={actual}
            valor={borrador as string[]}
            onCambiar={setBorrador}
          />
        )}
        {actual.tipo === "texto_corto" && (
          <CampoTextoCorto
            pregunta={actual}
            valor={borrador as string}
            onCambiar={setBorrador}
          />
        )}
      </div>
    </ModalShell>
  );
}

/** Recuadro modal de tamaño fijo centrado sobre la propia cuenta del
 *  minero — mismo fondo bg-black/50 + tarjeta redondeada que
 *  InteresInversionModal.tsx, pero con altura constante (no crece ni
 *  encoge entre pasos) y el pie de Volver/Continuar siempre en la misma
 *  posición: el contenido de cada pregunta se desplaza dentro de un área
 *  con scroll propio en vez de mover el recuadro entero. */
function ModalShell({
  children,
  footer,
  onCerrar,
}: {
  children: ReactNode;
  footer?: ReactNode;
  onCerrar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-0 md:items-center md:p-4">
      <div className="relative flex min-h-[600px] w-full max-w-2xl flex-col rounded-t-2xl bg-tarjeta p-6 dark:bg-tarjeta-dark md:rounded-lg">
        <button
          onClick={onCerrar}
          aria-label="Cerrar"
          className="absolute right-4 top-4 text-texto-suave hover:text-texto dark:text-texto-suave-dark dark:hover:text-texto-dark"
        >
          <X size={20} strokeWidth={2} />
        </button>
        <div className="flex-1">{children}</div>
        {footer && <div className="mt-4 shrink-0 border-t border-black/10 pt-4 dark:border-white/10">{footer}</div>}
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

function CampoOpcion({
  opciones,
  valor,
  onCambiar,
}: {
  opciones: { valor: string; etiqueta: string }[];
  valor: string;
  onCambiar: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {opciones.map((op) => {
        const seleccionada = op.valor === valor;
        return (
          <button
            key={op.valor}
            onClick={() => onCambiar(op.valor)}
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
    </div>
  );
}

function CampoMultiOpcion({
  pregunta,
  valor,
  onCambiar,
}: {
  pregunta: PreguntaInv;
  valor: string[];
  onCambiar: (v: string[]) => void;
}) {
  const maximo = pregunta.maxSelecciones;

  function alternar(v: string) {
    if (valor.includes(v)) {
      onCambiar(valor.filter((x) => x !== v));
      return;
    }
    if (maximo && valor.length >= maximo) return;
    onCambiar([...valor, v]);
  }

  return (
    <div className="flex flex-col gap-3">
      {(pregunta.opciones ?? []).map((op) => {
        const marcada = valor.includes(op.valor);
        const deshabilitada = !marcada && Boolean(maximo) && valor.length >= (maximo ?? 0);
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
          {valor.length}/{maximo} seleccionadas
        </p>
      )}
    </div>
  );
}

function CampoTextoCorto({
  pregunta,
  valor,
  onCambiar,
}: {
  pregunta: PreguntaInv;
  valor: string;
  onCambiar: (v: string) => void;
}) {
  const maximo = pregunta.maxCaracteres ?? 300;

  return (
    <div className="flex flex-col gap-3">
      <textarea
        className="min-h-[100px] w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/10"
        value={valor}
        maxLength={maximo}
        onChange={(e) => onCambiar(e.target.value)}
      />
      <p className="text-right text-xs text-texto-suave dark:text-texto-suave-dark">
        {valor.length}/{maximo}
      </p>
    </div>
  );
}

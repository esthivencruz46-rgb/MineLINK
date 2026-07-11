import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { ProgressBar } from "../components/ProgressBar";
import { useMineroAuth } from "../context/MineroAuthContext";
import {
  preguntasVisiblesInversion,
  type PreguntaInv,
  type RespuestasInversion,
} from "../data/preguntasInversion";

/** Wizard del Módulo INV — misma arquitectura de fondo que Cuestionario.tsx
 *  (respuestas + posición derivadas, sin aritmética de saltos guardada),
 *  simplificada porque aquí no hay ramas de perfil que cambiar a mitad de
 *  camino: el perfil ya viene fijo de /mineros/me. */
export function CuestionarioInversion() {
  const { authFetch } = useMineroAuth();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<string | null>(null);
  const [ofrece, setOfrece] = useState<boolean | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [respuestas, setRespuestas] = useState<RespuestasInversion>({});
  const [paso, setPaso] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      authFetch("/mineros/me").then((r) => r.json()),
      authFetch("/mineros/inversion").then((r) => r.json()),
    ])
      .then(([me, inv]) => {
        const perfilMinero: string | null = me.perfil ?? null;
        const respuestasPrevias: RespuestasInversion = inv.respuestas ?? {};
        setPerfil(perfilMinero);
        setOfrece(inv.ofrece);
        setMotivo(inv.motivo ?? null);
        setRespuestas(respuestasPrevias);
        setEnviado(Boolean(inv.enviado));
        // Retoma en la primera pregunta sin responder, no siempre desde 0.
        const visibles = preguntasVisiblesInversion(perfilMinero, respuestasPrevias);
        const idx = visibles.findIndex((p) => respuestasPrevias[p.id] === undefined);
        setPaso(idx === -1 ? visibles.length : idx);
      })
      .catch(() => setError("No pudimos cargar tu módulo de inversión."))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authFetch]);

  const visibles = useMemo(
    () => preguntasVisiblesInversion(perfil, respuestas),
    [perfil, respuestas]
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
      setEnviado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos enviar tus respuestas.");
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) {
    return <p className="p-8 text-center">Cargando...</p>;
  }

  if (ofrece === false) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p>
          {motivo ?? "El módulo de inversión no está disponible para tu perfil todavía."}
        </p>
        <button onClick={() => navigate(-1)} className="font-semibold text-acento underline">
          Volver a mi cuenta
        </button>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <Check size={36} strokeWidth={2} className="text-emerald-500" aria-hidden />
        <h1 className="text-xl font-bold">¡Enviado!</h1>
        <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
          Esthiven va a revisar tus respuestas y tus documentos de sustento. Te avisamos por
          WhatsApp cuando tu perfil quede visible para inversionistas.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="min-h-[44px] rounded-lg bg-acento px-6 font-semibold text-white"
        >
          Volver a mi cuenta
        </button>
      </div>
    );
  }

  if (!actual) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6 px-4">
        <BotonVolver onClick={volver} />
        <h1 className="text-xl font-bold">Listo para enviar</h1>
        <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
          Respondiste todas las preguntas del perfil de inversión. Una vez que envíes,
          Esthiven revisará tus respuestas junto con tus documentos de sustento.
        </p>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          disabled={enviando}
          onClick={enviar}
          className="min-h-[44px] rounded-lg bg-acento px-6 font-semibold text-white disabled:opacity-50"
        >
          {enviando ? "Enviando..." : "Enviar"}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center gap-6 px-4">
      {paso > 0 && <BotonVolver onClick={volver} />}
      <ProgressBar actual={paso + 1} total={visibles.length + 1} />

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">{actual.texto}</h2>
        {actual.ayuda && (
          <p className="text-sm text-texto-suave dark:text-texto-suave-dark">{actual.ayuda}</p>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {actual.tipo === "opcion" && (
        <OpcionesInv
          opciones={actual.opciones ?? []}
          valorActual={respuestas[actual.id] as string | undefined}
          onSeleccionar={(v) => responder(actual.id, v)}
        />
      )}
      {actual.tipo === "multi_opcion" && (
        <MultiOpcionInv
          pregunta={actual}
          valorActual={(respuestas[actual.id] as string[] | undefined) ?? []}
          onContinuar={(v) => responder(actual.id, v)}
        />
      )}
      {actual.tipo === "texto_corto" && (
        <TextoCortoInv
          pregunta={actual}
          valorActual={(respuestas[actual.id] as string | undefined) ?? ""}
          onContinuar={(v) => responder(actual.id, v)}
        />
      )}
    </div>
  );
}

function BotonVolver({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="self-start text-sm text-texto-suave underline dark:text-texto-suave-dark"
    >
      ← Volver
    </button>
  );
}

function OpcionesInv({
  opciones,
  valorActual,
  onSeleccionar,
}: {
  opciones: { valor: string; etiqueta: string }[];
  valorActual?: string;
  onSeleccionar: (valor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {opciones.map((op) => {
        const seleccionada = op.valor === valorActual;
        return (
          <button
            key={op.valor}
            onClick={() => onSeleccionar(op.valor)}
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

function MultiOpcionInv({
  pregunta,
  valorActual,
  onContinuar,
}: {
  pregunta: PreguntaInv;
  valorActual: string[];
  onContinuar: (valores: string[]) => void;
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
      <button
        disabled={seleccion.length === 0}
        onClick={() => onContinuar(seleccion)}
        className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white disabled:opacity-50"
      >
        Continuar →
      </button>
    </div>
  );
}

function TextoCortoInv({
  pregunta,
  valorActual,
  onContinuar,
}: {
  pregunta: PreguntaInv;
  valorActual: string;
  onContinuar: (valor: string) => void;
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
      <button
        disabled={!texto.trim()}
        onClick={() => onContinuar(texto.trim())}
        className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white disabled:opacity-50"
      >
        Continuar →
      </button>
    </div>
  );
}

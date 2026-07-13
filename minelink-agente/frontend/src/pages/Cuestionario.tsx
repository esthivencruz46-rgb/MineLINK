import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, Lightbulb } from "lucide-react";
import { ProgressBar } from "../components/ProgressBar";
import {
  MODULO_0,
  MODULO_A,
  MODULO_B,
  MODULO_C,
  MODULO_D,
  NOMBRE_PERFIL,
  clasificarPerfil,
  idsAplicables,
  type PreguntaCatalogo,
} from "../data/preguntas";
import { enviarDiagnostico, registrarEvento } from "../services/api";
import { guardarDiagnostico, leerDiagnostico } from "../services/storage";
import type { DiagnosticoRequest, Respuestas } from "../types/diagnostico";

const SIN_ESPECIFICAR = "no especificado";

// Prellenados silenciosos: responder la pregunta origen fija también la
// pregunta destino (C1_1 no se repregunta — viene del Módulo 0). Los
// prellenados hacia el Módulo INV (B3_1→INV_1, B3_2→INV_2, C4_2→INV_5)
// quedaron en pausa junto con el módulo — ver data/preguntas.ts.
const PRELLENADOS: Record<string, (valor: string) => Record<string, string>> = {
  M0_4: (v): Record<string, string> => {
    if (v === "vigente") return { C1_1: "vigente" };
    if (v === "suspendido") return { C1_1: "suspendida" };
    return {};
  },
};

// Mineral principal — pantalla de contexto para B/C/D (el perfil A lo
// declara en A5_2). Alimenta la búsqueda de /proyectos, no el diagnóstico.
const OPCIONES_MINERAL = [
  { valor: "oro", etiqueta: "Oro" },
  { valor: "plata", etiqueta: "Plata" },
  { valor: "cobre", etiqueta: "Cobre" },
  { valor: "zinc", etiqueta: "Zinc" },
  { valor: "plomo", etiqueta: "Plomo" },
  { valor: "estaño", etiqueta: "Estaño" },
  { valor: "polimetálico", etiqueta: "Polimetálico" },
  { valor: SIN_ESPECIFICAR, etiqueta: "Prefiero no decir" },
];

/** Una respuesta es prellenada (no la eligió el usuario en esa pantalla)
 *  si su pregunta origen está respondida — la navegación las salta. */
function esPrellenada(respuestas: Respuestas, id: string): boolean {
  if (id === "C1_1") return ["vigente", "suspendido"].includes(respuestas.M0_4 ?? "");
  return false;
}

/** Lista ORDENADA de preguntas visibles dadas las respuestas actuales —
 *  derivada en cada render (regla dura anti-wizard-trabado: cero índices
 *  guardados). Las prellenadas no se muestran porque ya tienen valor. */
function preguntasVisibles(respuestas: Respuestas): PreguntaCatalogo[] {
  const ids = idsAplicables(respuestas);
  const perfil = clasificarPerfil(respuestas);
  const modulo =
    perfil === "A" || perfil === "A_avanzado"
      ? MODULO_A
      : perfil === "B"
        ? MODULO_B
        : perfil === "C"
          ? MODULO_C
          : perfil === "D"
            ? MODULO_D
            : [];
  return [...MODULO_0, ...modulo].filter((p) => ids.has(p.id));
}

/** Última pregunta respondida POR EL USUARIO (saltando prellenadas) —
 *  el destino natural de "Volver" cuando ya se respondió todo. */
function ultimaRespondida(respuestas: Respuestas): string | null {
  const contestadas = preguntasVisibles(respuestas).filter(
    (p) => respuestas[p.id] && !esPrellenada(respuestas, p.id)
  );
  return contestadas.length > 0 ? contestadas[contestadas.length - 1].id : null;
}

/** El payload solo puede llevar los ids aplicables A LA RAMA FINAL — si el
 *  usuario retrocedió y cambió de rama, pueden quedar respuestas huérfanas
 *  de la rama anterior que el backend rechazaría. */
function soloAplicables(respuestas: Respuestas): Respuestas {
  const ids = idsAplicables(respuestas);
  return Object.fromEntries(
    Object.entries(respuestas).filter(([id]) => ids.has(id))
  );
}

export function Cuestionario() {
  const navigate = useNavigate();
  const location = useLocation();
  const vuelveDeResultado = Boolean((location.state as { volver?: boolean } | null)?.volver);
  const guardado = vuelveDeResultado ? leerDiagnostico() : null;

  // "Volver" desde /resultado: se conservan TODAS las respuestas y se abre
  // la última pregunta respondida, con su elección marcada en verde.
  const respuestasIniciales: Respuestas = { ...(guardado?.estadoWizard?.respuestas ?? {}) };

  const [respuestas, setRespuestas] = useState<Respuestas>(respuestasIniciales);
  // Pregunta que se está VIENDO. null = la primera sin responder (flujo
  // normal hacia adelante). Un id concreto = modo revisión (el usuario
  // retrocedió); la pregunta se muestra con su respuesta marcada.
  const [idActual, setIdActual] = useState<string | null>(() =>
    vuelveDeResultado ? ultimaRespondida(respuestasIniciales) : null
  );
  // Selección marcada pero NO confirmada — separada de `respuestas` para
  // que elegir una opción no avance solo: hace falta pulsar "Continuar →"
  // (igual que el Módulo INV), así el recuadro no salta de tamaño ni de
  // posición cada vez que tocas algo.
  const [borrador, setBorrador] = useState("");
  const [mineral, setMineral] = useState<string>("");
  const [mineralBorrador, setMineralBorrador] = useState<string>("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inicioRegistrado = useRef(false);

  // --- Derivados (nunca estado) ---
  const perfil = respuestas.M0_1 ? clasificarPerfil(respuestas) : null;
  const visibles = preguntasVisibles(respuestas);
  const primeraSinResponder = visibles.find((p) => !respuestas[p.id]) ?? null;
  // Si la pregunta en revisión dejó de existir (cambió la rama), se cae al
  // flujo normal.
  const actual =
    (idActual ? visibles.find((p) => p.id === idActual) : null) ?? primeraSinResponder;
  // El perfil A declara su mineral en A5_2; B/C/D lo eligen en una
  // pantalla de contexto al final.
  const faltaMineral =
    actual === null &&
    perfil !== null &&
    perfil !== "sin_ruta" &&
    !(perfil === "A" || perfil === "A_avanzado") &&
    !mineral;

  // Sin ruta legal (opera sin REINFO): página informativa, sin POST.
  useEffect(() => {
    if (perfil === "sin_ruta") {
      registrarEvento("sin_ruta_mostrado");
      navigate("/sin-ruta");
    }
  }, [perfil, navigate]);

  // El borrador arranca en lo que ya estaba respondido (modo revisión) o
  // vacío (pregunta nueva) cada vez que cambia la pregunta que se ve.
  useEffect(() => {
    if (actual) setBorrador(respuestas[actual.id] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual?.id]);
  useEffect(() => {
    if (faltaMineral) setMineralBorrador(mineral);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faltaMineral]);

  // Todo respondido → enviar (una sola vez).
  const listoParaEnviar =
    perfil !== null && perfil !== "sin_ruta" && actual === null && !faltaMineral;
  useEffect(() => {
    if (listoParaEnviar && !enviando && !error) {
      terminar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listoParaEnviar]);

  /** Avanza a la siguiente pregunta después de `id` (saltando prellenadas).
   *  Si la siguiente ya está respondida se abre en modo revisión (para
   *  poder repasar hacia adelante); si no, se vuelve al flujo normal. */
  function avanzarDesde(id: string, conRespuestas: Respuestas) {
    const lista = preguntasVisibles(conRespuestas);
    const idx = lista.findIndex((p) => p.id === id);
    let siguiente: PreguntaCatalogo | null = null;
    for (let i = idx + 1; i < lista.length; i++) {
      if (!esPrellenada(conRespuestas, lista[i].id)) {
        siguiente = lista[i];
        break;
      }
    }
    if (siguiente && conRespuestas[siguiente.id]) {
      setIdActual(siguiente.id);
    } else {
      setIdActual(null);
    }
  }

  function responder(valor: string) {
    if (!actual) return;
    if (!inicioRegistrado.current) {
      registrarEvento("diagnostico_iniciado");
      inicioRegistrado.current = true;
    }
    const extra = PRELLENADOS[actual.id]?.(valor) ?? {};
    const nuevas = { ...respuestas, [actual.id]: valor, ...extra };
    setRespuestas(nuevas);
    setError(null);
    avanzarDesde(actual.id, nuevas);
  }

  function volver() {
    // Retrocede a la pregunta anterior SIN borrar nada — la respuesta que
    // diste se muestra marcada en verde y puedes cambiarla o continuar.
    setError(null);
    if (!actual) {
      const ultima = ultimaRespondida(respuestas);
      if (ultima) setIdActual(ultima);
      return;
    }
    const idx = visibles.findIndex((p) => p.id === actual.id);
    for (let i = idx - 1; i >= 0; i--) {
      if (!esPrellenada(respuestas, visibles[i].id)) {
        setIdActual(visibles[i].id);
        return;
      }
    }
  }

  async function terminar() {
    if (!perfil || perfil === "sin_ruta") return;
    setEnviando(true);
    setError(null);
    try {
      const respuestasFinales = soloAplicables(respuestas);
      // El backend deriva el perfil de las respuestas; `situacion` decide
      // qué ventana de cuenta ve el minero (C/D operan → /mi-cuenta;
      // A/B todavía no → /mi-concesion). tipo_mina quedó sin pregunta
      // en el modelo nuevo — valor neutro.
      const payload: DiagnosticoRequest = {
        respuestas: respuestasFinales,
        region: SIN_ESPECIFICAR,
        mineral:
          perfil === "A" || perfil === "A_avanzado"
            ? (respuestasFinales.A5_2 ?? SIN_ESPECIFICAR)
            : mineral || SIN_ESPECIFICAR,
        tipo_mina: "tajo_abierto",
        situacion: perfil === "C" || perfil === "D" ? "minero_artesanal" : "concesionario",
      };

      const respuesta = await enviarDiagnostico(payload);
      guardarDiagnostico({
        respuesta,
        region: SIN_ESPECIFICAR,
        situacion: respuestas.M0_1 ?? "",
        estadoWizard: { respuestas: respuestasFinales, paso: 0 },
      });
      navigate("/resultado");
    } catch {
      setError("No pudimos calcular tu diagnóstico. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  // -------------------------------------------------------------------
  // Pantalla de mineral (contexto B/C/D, al final)
  // -------------------------------------------------------------------

  if (!enviando && actual === null && faltaMineral) {
    return (
      <TarjetaPregunta
        footer={
          <div className="flex items-center justify-between gap-3">
            <BotonVolver onClick={volver} />
            <button
              disabled={!mineralBorrador}
              onClick={() => setMineral(mineralBorrador)}
              className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white disabled:opacity-50"
            >
              Continuar →
            </button>
          </div>
        }
      >
        <ProgressBar actual={visibles.length + 1} total={visibles.length + 1} />
        <h2 className="mt-4 text-xl font-semibold">
          ¿Cuál es el principal mineral de tu operación?
        </h2>
        <p className="mt-2 text-sm text-texto-suave dark:text-texto-suave-dark">
          Sirve para que los inversionistas encuentren tu proyecto por mineral.
        </p>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        <div className="mt-4">
          <OpcionesSeleccionables
            opciones={OPCIONES_MINERAL}
            valorActual={mineralBorrador}
            disabled={enviando}
            onSeleccionar={(v) => {
              setMineralBorrador(v);
              setMineral(v);
            }}
          />
        </div>
      </TarjetaPregunta>
    );
  }

  // -------------------------------------------------------------------
  // Pantalla de pregunta del catálogo
  // -------------------------------------------------------------------

  if (actual) {
    const indiceActual = visibles.findIndex((p) => p.id === actual.id);
    const esNumerica = actual.tipo === "numero" || actual.tipo === "anio";
    const puedeContinuar = borrador.trim().length > 0;
    return (
      <TarjetaPregunta
        footer={
          <div className="flex items-center justify-between gap-3">
            <BotonVolver onClick={indiceActual > 0 ? volver : undefined} />
            <button
              disabled={!puedeContinuar}
              onClick={() => responder(borrador)}
              className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white disabled:opacity-50"
            >
              Continuar →
            </button>
          </div>
        }
      >
        <ProgressBar actual={indiceActual + 1} total={visibles.length} />

        <div className="mt-4 flex flex-col gap-3">
          {perfil && perfil !== "sin_ruta" && actual.id !== "M0_1" && (
            <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
              {NOMBRE_PERFIL[perfil] ?? perfil}
            </p>
          )}
          <h2 className="text-xl font-semibold">{actual.texto}</h2>
          {actual.ayuda && (
            <div className="flex items-start gap-2 rounded-lg bg-acento/5 p-3 text-sm text-texto-suave dark:bg-acento/10 dark:text-texto-suave-dark">
              <Lightbulb size={17} strokeWidth={2} className="mt-0.5 shrink-0 text-acento" aria-hidden />
              <p>
                <span className="font-semibold">¿Qué es esto? </span>
                {actual.ayuda}
              </p>
            </div>
          )}
        </div>

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        <div className="mt-4">
          {esNumerica ? (
            <input
              key={actual.id}
              className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
              type="number"
              placeholder={actual.placeholder}
              min={actual.min}
              max={actual.max}
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
            />
          ) : (
            <OpcionesSeleccionables
              opciones={actual.opciones ?? []}
              valorActual={borrador}
              disabled={enviando}
              onSeleccionar={(v) => {
                setBorrador(v);
                responder(v);
              }}
            />
          )}
        </div>
      </TarjetaPregunta>
    );
  }

  // -------------------------------------------------------------------
  // Enviando / error de envío
  // -------------------------------------------------------------------

  if (error) {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={() => terminar()}
          className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white"
        >
          Reintentar
        </button>
        <button onClick={volver} className="text-sm text-texto-suave underline dark:text-texto-suave-dark">
          ← Volver a la última pregunta
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center gap-4 px-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-acento border-t-transparent" />
      <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
        Calculando tu diagnóstico...
      </p>
    </div>
  );
}

// -------------------------------------------------------------------
// Sub-componentes
// -------------------------------------------------------------------

/** Recuadro ancho, con una altura mínima que ya alcanza para la pregunta
 *  más grande del catálogo (8 opciones, la pantalla de mineral) — así
 *  nunca hace falta scroll interno ni se ve un recuadro angosto, y las
 *  preguntas cortas no lo encogen: se ve del mismo tamaño siempre, sin la
 *  barra de scroll que se veía mal. Solo crecería en el caso extremo de
 *  una pregunta con ayuda muy larga, nunca se hace más chico. */
function TarjetaPregunta({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-2xl flex-col items-center justify-center px-4">
      <div className="flex min-h-[620px] w-full flex-col rounded-lg bg-tarjeta p-6 dark:bg-tarjeta-dark">
        <div className="flex-1">{children}</div>
        <div className="mt-4 shrink-0 border-t border-black/10 pt-4 dark:border-white/10">
          {footer}
        </div>
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

/** Botones de opción con selección visible: la elegida queda en verde (y
 * se mantiene así al volver); elegir otra mueve la marca. */
function OpcionesSeleccionables({
  opciones,
  valorActual,
  disabled,
  onSeleccionar,
}: {
  opciones: { valor: string; etiqueta: string; descripcion?: string }[];
  valorActual?: string;
  disabled: boolean;
  onSeleccionar: (valor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {opciones.map((op) => {
        const seleccionada = op.valor === valorActual;
        return (
          <button
            key={op.valor}
            disabled={disabled}
            onClick={() => onSeleccionar(op.valor)}
            className={`flex min-h-[44px] items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left font-medium transition-colors ${
              seleccionada
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-black/10 hover:bg-acento/10 dark:border-white/10"
            }`}
          >
            <span>
              {op.etiqueta}
              {op.descripcion && (
                <span
                  className={`block text-xs font-normal ${
                    seleccionada
                      ? "text-emerald-600/80 dark:text-emerald-400/80"
                      : "text-texto-suave dark:text-texto-suave-dark"
                  }`}
                >
                  {op.descripcion}
                </span>
              )}
            </span>
            {seleccionada && (
              <Check size={18} strokeWidth={2.5} className="shrink-0 text-emerald-500" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}


import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Lightbulb } from "lucide-react";
import { ProgressBar } from "../components/ProgressBar";
import {
  MODULO_0,
  MODULO_A,
  MODULO_B,
  MODULO_C,
  MODULO_D,
  MODULO_INV,
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
// pregunta destino (el spec dice que B3/C4 son la base del índice de
// madurez y que C1_1 no se repregunta — viene del Módulo 0).
const PRELLENADOS: Record<string, (valor: string) => Record<string, string>> = {
  M0_3: (v): Record<string, string> => {
    if (v === "vigente") return { C1_1: "vigente" };
    if (v === "suspendido") return { C1_1: "suspendida" };
    return {};
  },
  B3_1: (v) => ({ INV_1: v === "estudios_formales" ? "si" : "no" }),
  B3_2: (v) => ({ INV_2: v === "laboratorio" ? "si" : "no" }),
  C4_2: (v) => ({ INV_5: v === "siempre" ? "si" : "no" }),
};

// Qué ids borra `volver()` al des-responder la pregunta origen (no se puede
// derivar de PRELLENADOS("") porque algunas funciones devuelven {} para
// valores no reconocidos).
const OBJETIVOS_PRELLENADO: Record<string, string[]> = {
  M0_3: ["C1_1"],
  B3_1: ["INV_1"],
  B3_2: ["INV_2"],
  C4_2: ["INV_5"],
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
  return [...MODULO_0, ...modulo, ...MODULO_INV].filter((p) => ids.has(p.id));
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

  // "Volver" desde /resultado: retomar con la última pregunta respondida
  // abierta (se borra su respuesta para que vuelva a mostrarse).
  const respuestasIniciales: Respuestas = { ...(guardado?.estadoWizard?.respuestas ?? {}) };
  if (vuelveDeResultado && Object.keys(respuestasIniciales).length > 0) {
    const visibles = preguntasVisibles(respuestasIniciales);
    const respondidas = visibles.filter((p) => respuestasIniciales[p.id]);
    const ultima = respondidas[respondidas.length - 1];
    if (ultima) delete respuestasIniciales[ultima.id];
  }

  const [respuestas, setRespuestas] = useState<Respuestas>(respuestasIniciales);
  const [mineral, setMineral] = useState<string>("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inicioRegistrado = useRef(false);

  // --- Derivados (nunca estado) ---
  const perfil = respuestas.M0_1 ? clasificarPerfil(respuestas) : null;
  const visibles = preguntasVisibles(respuestas);
  const actual = visibles.find((p) => !respuestas[p.id]) ?? null;
  const respondidas = visibles.filter((p) => respuestas[p.id]).length;
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

  // Todo respondido → enviar (una sola vez).
  const listoParaEnviar =
    perfil !== null && perfil !== "sin_ruta" && actual === null && !faltaMineral;
  useEffect(() => {
    if (listoParaEnviar && !enviando && !error) {
      terminar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listoParaEnviar]);

  function responder(valor: string) {
    if (!actual) return;
    if (!inicioRegistrado.current) {
      registrarEvento("diagnostico_iniciado");
      inicioRegistrado.current = true;
    }
    const extra = PRELLENADOS[actual.id]?.(valor) ?? {};
    setRespuestas({ ...respuestas, [actual.id]: valor, ...extra });
    setError(null);
  }

  function esPrellenada(id: string): boolean {
    // Una respuesta es prellenada (no la tecleó el usuario) si su pregunta
    // origen está respondida — volver() debe saltarlas, no reabrirlas.
    if (id === "C1_1") return ["vigente", "suspendido"].includes(respuestas.M0_3 ?? "");
    if (id === "INV_1") return Boolean(respuestas.B3_1);
    if (id === "INV_2") return Boolean(respuestas.B3_2);
    if (id === "INV_5") return Boolean(respuestas.C4_2);
    return false;
  }

  function volver() {
    // Borra la respuesta de la última pregunta respondida POR EL USUARIO
    // (saltando prellenadas) — la pregunta reaparece; si el cambio de
    // respuesta cambia la rama, todo el flujo se re-deriva solo.
    const contestadas = visibles.filter((p) => respuestas[p.id] && !esPrellenada(p.id));
    const ultima = contestadas[contestadas.length - 1];
    if (!ultima) return;
    const nuevas = { ...respuestas };
    delete nuevas[ultima.id];
    for (const idPrellenado of OBJETIVOS_PRELLENADO[ultima.id] ?? []) {
      delete nuevas[idPrellenado];
    }
    setRespuestas(nuevas);
    setError(null);
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
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center gap-6 px-4">
        <BotonVolver onClick={volver} />
        <ProgressBar actual={respondidas} total={visibles.length + 1} />
        <h2 className="text-xl font-semibold">
          ¿Cuál es el principal mineral de tu operación?
        </h2>
        <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
          Sirve para que los inversionistas encuentren tu proyecto por mineral.
        </p>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex flex-col gap-3">
          {OPCIONES_MINERAL.map((op) => (
            <button
              key={op.valor}
              onClick={() => setMineral(op.valor)}
              className="min-h-[44px] rounded-lg border border-black/10 px-4 py-3 text-left font-medium transition-colors hover:bg-acento/10 dark:border-white/10"
            >
              {op.etiqueta}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // Pantalla de pregunta del catálogo
  // -------------------------------------------------------------------

  if (actual) {
    const esPrimera = respondidas === 0;
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center gap-6 px-4">
        {!esPrimera && <BotonVolver onClick={volver} />}
        <ProgressBar actual={respondidas} total={visibles.length} />

        <div className="flex flex-col gap-3">
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

        {error && <p className="text-sm text-red-500">{error}</p>}

        {actual.tipo === "numero" || actual.tipo === "anio" ? (
          <NumeroInput key={actual.id} pregunta={actual} onResponder={responder} />
        ) : (
          <OpcionInput
            opciones={actual.opciones ?? []}
            disabled={enviando}
            onResponder={responder}
          />
        )}
      </div>
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

function OpcionInput({
  opciones,
  disabled,
  onResponder,
}: {
  opciones: { valor: string; etiqueta: string; descripcion?: string }[];
  disabled: boolean;
  onResponder: (valor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {opciones.map((op) => (
        <button
          key={op.valor}
          disabled={disabled}
          onClick={() => onResponder(op.valor)}
          className="min-h-[44px] rounded-lg border border-black/10 px-4 py-3 text-left font-medium transition-colors hover:bg-acento/10 dark:border-white/10"
        >
          {op.etiqueta}
          {op.descripcion && (
            <span className="block text-xs font-normal text-texto-suave dark:text-texto-suave-dark">
              {op.descripcion}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function NumeroInput({
  pregunta,
  onResponder,
}: {
  pregunta: PreguntaCatalogo;
  onResponder: (valor: string) => void;
}) {
  const [valor, setValor] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <input
        className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
        type="number"
        placeholder={pregunta.placeholder}
        min={pregunta.min}
        max={pregunta.max}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      />
      <button
        disabled={!valor.trim()}
        onClick={() => onResponder(valor.trim())}
        className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white disabled:opacity-50"
      >
        Continuar
      </button>
    </div>
  );
}

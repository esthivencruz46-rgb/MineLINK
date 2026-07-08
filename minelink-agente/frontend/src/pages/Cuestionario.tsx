import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AutocompleteDepartamento } from "../components/AutocompleteDepartamento";
import { ProgressBar } from "../components/ProgressBar";
import { SITUACIONES, informativasAplicables, preguntasAplicables } from "../data/preguntas";
import { enviarDiagnostico, registrarEvento } from "../services/api";
import { guardarDiagnostico } from "../services/storage";
import type { Respuestas, Situacion, TipoMina } from "../types/diagnostico";

type DatosInformativos = {
  produccion_mensual?: string;
  maquinaria?: string;
  num_trabajadores?: string;
};

export function Cuestionario() {
  const navigate = useNavigate();
  const [paso, setPaso] = useState(0);
  const [region, setRegion] = useState("");
  const [mineral, setMineral] = useState("");
  const [tipoMina, setTipoMina] = useState<TipoMina | "">("");
  const [situacion, setSituacion] = useState<Situacion | "">("");
  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [informativas, setInformativas] = useState<DatosInformativos>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preguntas =
    tipoMina && situacion ? preguntasAplicables(tipoMina, situacion) : [];
  const informativasDelCaso = situacion ? informativasAplicables(situacion) : [];
  const TOTAL_PREGUNTAS = preguntas.length;
  const TOTAL_INFORMATIVAS = informativasDelCaso.length;

  const preguntaActual =
    paso >= 1 && paso <= TOTAL_PREGUNTAS ? preguntas[paso - 1] : undefined;
  const informativaActual =
    paso > TOTAL_PREGUNTAS && paso <= TOTAL_PREGUNTAS + TOTAL_INFORMATIVAS
      ? informativasDelCaso[paso - TOTAL_PREGUNTAS - 1]
      : undefined;

  async function terminar(respuestasFinales: Respuestas, datosFinales: DatosInformativos) {
    if (!tipoMina || !situacion) return;
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await enviarDiagnostico({
        respuestas: respuestasFinales,
        region,
        mineral: mineral.trim() || "no especificado",
        tipo_mina: tipoMina,
        situacion,
        produccion_mensual: datosFinales.produccion_mensual,
        maquinaria: datosFinales.maquinaria,
        num_trabajadores: datosFinales.num_trabajadores,
      });
      guardarDiagnostico({ respuesta, region });
      navigate("/resultado");
    } catch {
      setError(
        "No pudimos calcular tu diagnóstico. Revisa tu conexión e intenta de nuevo."
      );
    } finally {
      setEnviando(false);
    }
  }

  function responder(valor: boolean) {
    if (!preguntaActual) return;
    const nuevas = { ...respuestas, [preguntaActual.id]: valor };
    setRespuestas(nuevas);
    setPaso(paso + 1);
  }

  function responderInformativa(valor: string | undefined) {
    if (!informativaActual) return;
    const nuevos = { ...informativas, [informativaActual.campo]: valor };
    setInformativas(nuevos);

    if (paso === TOTAL_PREGUNTAS + TOTAL_INFORMATIVAS) {
      terminar(respuestas, nuevos);
    } else {
      setPaso(paso + 1);
    }
  }

  if (paso === 0) {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center gap-5 px-4 py-8">
        <h1 className="text-2xl font-bold">Antes de empezar</h1>
        <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
          No todos los proyectos mineros son iguales: cuéntanos tu situación y
          armamos un cuestionario solo con lo que corresponde a tu caso.
        </p>

        <div>
          <label className="mb-2 block text-sm font-medium">
            ¿Cuál describe mejor tu situación?
          </label>
          <div className="flex flex-col gap-2">
            {SITUACIONES.map((s) => (
              <button
                key={s.valor}
                onClick={() => setSituacion(s.valor)}
                className={`rounded-lg border px-4 py-3 text-left ${
                  situacion === s.valor
                    ? "border-acento bg-acento/15"
                    : "border-black/10 dark:border-white/10"
                }`}
              >
                <span className={`block font-medium ${situacion === s.valor ? "text-acento" : ""}`}>
                  {s.titulo}
                </span>
                <span className="block text-xs text-texto-suave dark:text-texto-suave-dark">
                  {s.descripcion}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            ¿En qué departamento trabajas?
          </label>
          <AutocompleteDepartamento
            value={region}
            onChange={setRegion}
            placeholder="Escribe tu departamento"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            ¿Qué mineral trabajas?
          </label>
          <input
            className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
            placeholder="Ej. oro"
            value={mineral}
            onChange={(e) => setMineral(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            ¿Tu mina es subterránea o de tajo abierto?
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setTipoMina("subterranea")}
              className={`min-h-[44px] flex-1 rounded-lg border px-3 font-medium ${
                tipoMina === "subterranea"
                  ? "border-acento bg-acento/15 text-acento"
                  : "border-black/10 dark:border-white/10"
              }`}
            >
              Subterránea
            </button>
            <button
              onClick={() => setTipoMina("tajo_abierto")}
              className={`min-h-[44px] flex-1 rounded-lg border px-3 font-medium ${
                tipoMina === "tajo_abierto"
                  ? "border-acento bg-acento/15 text-acento"
                  : "border-black/10 dark:border-white/10"
              }`}
            >
              Tajo abierto
            </button>
          </div>
        </div>
        <button
          disabled={!region || !tipoMina || !situacion}
          onClick={() => {
            registrarEvento("diagnostico_iniciado");
            setPaso(1);
          }}
          className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          Empezar el diagnóstico ({TOTAL_PREGUNTAS || "..."} preguntas)
        </button>
      </div>
    );
  }

  if (informativaActual) {
    return (
      <InformativaScreen
        key={informativaActual.campo}
        pregunta={informativaActual}
        valorActual={informativas[informativaActual.campo]}
        pasoActual={TOTAL_PREGUNTAS + (paso - TOTAL_PREGUNTAS)}
        onResponder={responderInformativa}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center gap-6 px-4">
      <ProgressBar actual={paso} total={TOTAL_PREGUNTAS + TOTAL_INFORMATIVAS} />

      {preguntaActual && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">{preguntaActual.texto}</h2>
          {preguntaActual.nota && (
            <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
              {preguntaActual.nota}
            </p>
          )}
          {preguntaActual.ayuda && (
            <div className="flex items-start gap-2 rounded-lg bg-acento/5 p-3 text-sm text-texto-suave dark:bg-acento/10 dark:text-texto-suave-dark">
              <span aria-hidden>💡</span>
              <p>
                <span className="font-semibold">¿Qué es esto? </span>
                {preguntaActual.ayuda}
              </p>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex flex-col gap-3">
        <button
          disabled={enviando}
          onClick={() => responder(true)}
          className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          Sí
        </button>
        <button
          disabled={enviando}
          onClick={() => responder(false)}
          className="min-h-[44px] rounded-lg bg-secundario px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          No
        </button>
        <button
          disabled={enviando}
          onClick={() => responder(false)}
          className="min-h-[44px] rounded-lg border border-black/10 px-6 py-3 font-semibold disabled:opacity-50 dark:border-white/10"
        >
          No sé
        </button>
      </div>
    </div>
  );
}

function InformativaScreen({
  pregunta,
  valorActual,
  pasoActual,
  onResponder,
}: {
  pregunta: { campo: string; texto: string; placeholder: string };
  valorActual?: string;
  pasoActual: number;
  onResponder: (valor: string | undefined) => void;
}) {
  const [texto, setTexto] = useState(valorActual ?? "");

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center gap-6 px-4">
      <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
        Pregunta {pasoActual} · esta no afecta tu puntaje
      </p>
      <h2 className="text-xl font-semibold">{pregunta.texto}</h2>
      <input
        className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
        placeholder={pregunta.placeholder}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className="flex flex-col gap-3">
        <button
          onClick={() => onResponder(texto.trim() || undefined)}
          className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white"
        >
          Continuar
        </button>
        <button
          onClick={() => onResponder(undefined)}
          className="min-h-[44px] rounded-lg border border-black/10 px-6 py-3 font-semibold dark:border-white/10"
        >
          Prefiero no decirlo
        </button>
      </div>
    </div>
  );
}

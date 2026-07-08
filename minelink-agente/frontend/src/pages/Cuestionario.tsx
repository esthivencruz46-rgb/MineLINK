import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PreguntaPerfilScreen } from "../components/PreguntaPerfilScreen";
import { ProgressBar } from "../components/ProgressBar";
import { SITUACIONES, informativasAplicables, preguntasAplicables } from "../data/preguntas";
import { PERFIL_ARTESANAL, PERFIL_CONCESIONARIO, type PreguntaPerfil } from "../data/preguntasPerfil";
import { enviarDiagnostico, registrarEvento } from "../services/api";
import { guardarDiagnostico } from "../services/storage";
import type { DiagnosticoRequest, Respuestas, Situacion, TipoMina } from "../types/diagnostico";

type DatosInformativos = {
  produccion_mensual?: string;
  maquinaria?: string;
  num_trabajadores?: string;
};

type Perfil = Record<string, unknown>;

// Departamento sigue sin preguntarse (pendiente de definir dónde
// recogerlo). Mineral se deriva del "elemento económico principal" del
// perfil de cada ruta.
const SIN_ESPECIFICAR = "no especificado";

function textoOpcional(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function boolOpcional(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

function listaOpcional(v: unknown): string[] | undefined {
  return Array.isArray(v) && v.length > 0 ? (v as string[]) : undefined;
}

function tipoMinaDe(situacion: Situacion, perfil: Perfil): TipoMina {
  if (situacion !== "minero_artesanal") return "subterranea"; // fijo, irrelevante en Ruta 2
  return perfil.tipo_explotacion === "subterranea" ? "subterranea" : "tajo_abierto";
}

/** Ruta 2 (concesionario): TODAS sus preguntas de formalización (L1-L4,L6,
 * T1,T3,T6) ya se respondieron en el perfil — se copian aquí, sin repetir
 * la pregunta en un paso Sí/No aparte. Ruta 1 no prellena nada: su
 * cuestionario Sí/No sigue siendo el completo de siempre. */
function respuestasPrellenadasDe(situacion: Situacion, perfil: Perfil): Respuestas {
  if (situacion !== "concesionario") return {};
  const titular = perfil.titular === true;
  return {
    L1: perfil.formalizacion_iniciada === true,
    L2: titular,
    L3: titular ? true : Boolean(perfil.documento_autorizacion),
    L4: perfil.tiene_ruc === true,
    L6: perfil.concesion_vigente === true,
    T1: perfil.info_geologica_disponible === true,
    T3: perfil.tiene_resultados_laboratorio === true,
    T6: perfil.tiene_estimaciones_leyes === true,
  };
}

export function Cuestionario() {
  const navigate = useNavigate();
  const [paso, setPaso] = useState(0);
  const [situacion, setSituacion] = useState<Situacion | "">("");
  const [perfil, setPerfil] = useState<Perfil>({});
  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [informativas, setInformativas] = useState<DatosInformativos>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const perfilArray: PreguntaPerfil[] =
    situacion === "concesionario" ? PERFIL_CONCESIONARIO : situacion === "minero_artesanal" ? PERFIL_ARTESANAL : [];
  const perfilVisible = perfilArray.filter((p) => !p.mostrarSi || p.mostrarSi(perfil));
  const TOTAL_PERFIL = perfilVisible.length;

  const respuestasPrellenadas = situacion ? respuestasPrellenadasDe(situacion, perfil) : {};
  const tipoMina = situacion ? tipoMinaDe(situacion, perfil) : "subterranea";
  const preguntas = situacion
    ? preguntasAplicables(tipoMina, situacion).filter((p) => !(p.id in respuestasPrellenadas))
    : [];
  const informativasDelCaso = situacion ? informativasAplicables(situacion) : [];
  const TOTAL_PREGUNTAS = preguntas.length;
  const TOTAL_INFORMATIVAS = informativasDelCaso.length;

  const perfilActual =
    paso >= 1 && paso <= TOTAL_PERFIL ? perfilVisible[paso - 1] : undefined;
  const preguntaActual =
    paso > TOTAL_PERFIL && paso <= TOTAL_PERFIL + TOTAL_PREGUNTAS
      ? preguntas[paso - TOTAL_PERFIL - 1]
      : undefined;
  const informativaActual =
    paso > TOTAL_PERFIL + TOTAL_PREGUNTAS && paso <= TOTAL_PERFIL + TOTAL_PREGUNTAS + TOTAL_INFORMATIVAS
      ? informativasDelCaso[paso - TOTAL_PERFIL - TOTAL_PREGUNTAS - 1]
      : undefined;

  async function terminar(
    respuestasFinales: Respuestas,
    datosFinales: DatosInformativos,
    perfilFinal: Perfil
  ) {
    if (!situacion) return;
    setEnviando(true);
    setError(null);
    try {
      const mineral = textoOpcional(perfilFinal.elemento_valor) ?? SIN_ESPECIFICAR;
      const produccionValor = textoOpcional(perfilFinal.produccion_mensual_valor);
      const produccionMensual = produccionValor
        ? `${produccionValor} ${textoOpcional(perfilFinal.produccion_mensual_unidad) ?? ""}`.trim()
        : undefined;
      const leyValor =
        perfilFinal.conoce_ley === true ? textoOpcional(perfilFinal.ley_valor) : undefined;
      const leyPromedio = leyValor
        ? `${leyValor} ${textoOpcional(perfilFinal.ley_unidad) ?? ""}`.trim()
        : undefined;

      const payload: DiagnosticoRequest = {
        respuestas: { ...respuestasPrellenadasDe(situacion, perfilFinal), ...respuestasFinales },
        region: SIN_ESPECIFICAR,
        mineral,
        tipo_mina: tipoMinaDe(situacion, perfilFinal),
        situacion,
        produccion_mensual: produccionMensual,
        maquinaria: datosFinales.maquinaria,
        num_trabajadores: datosFinales.num_trabajadores,
        estado_operacion: textoOpcional(perfilFinal.estado_operacion),
        tipo_explotacion: textoOpcional(perfilFinal.tipo_explotacion),
        material_comercializado: textoOpcional(perfilFinal.material_comercializado),
        forma_comercializacion: textoOpcional(perfilFinal.forma_comercializacion),
        tiempo_operacion: textoOpcional(perfilFinal.tiempo_operacion),
        ley_promedio: leyPromedio,
        ley_como_obtenida: textoOpcional(perfilFinal.ley_como_obtenida),
        tiene_resultados_laboratorio: boolOpcional(perfilFinal.tiene_resultados_laboratorio),
        concesion_vigente: boolOpcional(perfilFinal.concesion_vigente),
        tipo_deposito: textoOpcional(perfilFinal.tipo_deposito),
        etapa_proyecto: textoOpcional(perfilFinal.etapa_proyecto),
        trabajos_exploracion_json: listaOpcional(perfilFinal.trabajos_exploracion_json),
        info_geologica_disponible: boolOpcional(perfilFinal.info_geologica_disponible),
        tiene_estimaciones_leyes: boolOpcional(perfilFinal.tiene_estimaciones_leyes),
        documento_autorizacion: textoOpcional(perfilFinal.documento_autorizacion),
        tipo_apoyo_json: listaOpcional(perfilFinal.tipo_apoyo_json),
      };

      const respuesta = await enviarDiagnostico(payload);
      guardarDiagnostico({ respuesta, region: SIN_ESPECIFICAR });
      navigate("/resultado");
    } catch {
      setError(
        "No pudimos calcular tu diagnóstico. Revisa tu conexión e intenta de nuevo."
      );
    } finally {
      setEnviando(false);
    }
  }

  function responderPerfil(valor: unknown) {
    if (!perfilActual || !situacion) return;
    const nuevoPerfil = { ...perfil, [perfilActual.campo]: valor };
    setPerfil(nuevoPerfil);

    const visibleTrasResponder = perfilArray.filter(
      (p) => !p.mostrarSi || p.mostrarSi(nuevoPerfil)
    );
    const esUltimoPasoDelPerfil = paso >= visibleTrasResponder.length;

    if (esUltimoPasoDelPerfil && TOTAL_PREGUNTAS === 0 && TOTAL_INFORMATIVAS === 0) {
      terminar({}, {}, nuevoPerfil);
    } else {
      setPaso(paso + 1);
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

    if (paso === TOTAL_PERFIL + TOTAL_PREGUNTAS + TOTAL_INFORMATIVAS) {
      terminar(respuestas, nuevos, perfil);
    } else {
      setPaso(paso + 1);
    }
  }

  if (paso === 0) {
    const totalAproximado = TOTAL_PERFIL + TOTAL_PREGUNTAS + TOTAL_INFORMATIVAS;
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

        <button
          disabled={!situacion}
          onClick={() => {
            registrarEvento("diagnostico_iniciado");
            setPaso(1);
          }}
          className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          Empezar el diagnóstico ({totalAproximado || "..."} preguntas)
        </button>
      </div>
    );
  }

  if (perfilActual) {
    return (
      <PreguntaPerfilScreen
        key={perfilActual.campo}
        pregunta={perfilActual}
        valorActual={perfil[perfilActual.campo]}
        onResponder={responderPerfil}
      />
    );
  }

  if (informativaActual) {
    return (
      <InformativaScreen
        key={informativaActual.campo}
        pregunta={informativaActual}
        valorActual={informativas[informativaActual.campo]}
        pasoActual={TOTAL_PERFIL + TOTAL_PREGUNTAS + (paso - TOTAL_PERFIL - TOTAL_PREGUNTAS)}
        onResponder={responderInformativa}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center gap-6 px-4">
      <ProgressBar actual={paso} total={TOTAL_PERFIL + TOTAL_PREGUNTAS + TOTAL_INFORMATIVAS} />

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

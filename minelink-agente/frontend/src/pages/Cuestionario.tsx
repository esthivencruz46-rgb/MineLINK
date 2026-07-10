import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Lightbulb } from "lucide-react";
import { PreguntaPerfilScreen } from "../components/PreguntaPerfilScreen";
import { ProgressBar } from "../components/ProgressBar";
import { SITUACIONES, informativasAplicables, preguntasAplicables } from "../data/preguntas";
import {
  OPCIONES_ELEMENTO_VALOR,
  OPCIONES_MINERAL_POR_ELEMENTO,
  OPCIONES_MONTO_REQUERIDO_RUTA1,
  OPCIONES_MONTO_REQUERIDO_RUTA2,
  OPCIONES_UNIDAD_LEY,
  PERFIL_ARTESANAL,
  PERFIL_CONCESIONARIO,
  type PreguntaPerfil,
} from "../data/preguntasPerfil";
import { enviarDiagnostico, registrarEvento } from "../services/api";
import { guardarDiagnostico, leerDiagnostico } from "../services/storage";
import type { DiagnosticoRequest, Respuestas, Situacion, TipoMina } from "../types/diagnostico";

type DatosInformativos = {
  produccion_mensual?: string;
  maquinaria?: string;
  num_trabajadores?: string;
};

type Perfil = Record<string, unknown>;

// Departamento sigue sin preguntarse (pendiente de definir dónde
// recogerlo). Mineral se deriva de los elementos económicos del perfil.
const SIN_ESPECIFICAR = "no especificado";

function textoOpcional(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function listaOpcional(v: unknown): string[] | undefined {
  return Array.isArray(v) && v.length > 0 ? (v as string[]) : undefined;
}

function tipoMinaDe(situacion: Situacion, perfil: Perfil): TipoMina {
  if (situacion !== "minero_artesanal") return "subterranea"; // fijo, irrelevante en Ruta 2
  return perfil.tipo_explotacion === "subterranea" ? "subterranea" : "tajo_abierto";
}

function etiquetaElemento(elemento: string): string {
  return OPCIONES_ELEMENTO_VALOR.find((o) => o.valor === elemento)?.etiqueta ?? elemento;
}

/** Construye el perfil visible insertando, dinámicamente: (1) una pregunta
 * de especie mineralógica por CADA elemento económico marcado — justo
 * después de "¿Qué elementos económicos extraes?" (no basta con saber que
 * es cobre: puede ser calcopirita, malaquita, etc.) — y (2) una pregunta de
 * ley (valor+unidad) por elemento, justo después de "¿Conoces la ley...?". */
function construirPerfilVisible(situacion: Situacion, perfil: Perfil): PreguntaPerfil[] {
  const base = situacion === "concesionario" ? PERFIL_CONCESIONARIO : PERFIL_ARTESANAL;
  let visibles = base.filter((p) => !p.mostrarSi || p.mostrarSi(perfil));

  const elementos = Array.isArray(perfil.elemento_valor) ? (perfil.elemento_valor as string[]) : [];

  if (situacion === "minero_artesanal" && elementos.length > 0) {
    const preguntasMineral: PreguntaPerfil[] = elementos.map((elemento) => ({
      campo: `mineral__${elemento}`,
      texto: `¿Qué mineral(es) de ${etiquetaElemento(elemento)} extraes? (puedes marcar varios)`,
      tipo: "opciones_multi",
      opciones: OPCIONES_MINERAL_POR_ELEMENTO[elemento] ?? [{ valor: "No sé", etiqueta: "No sé" }],
      permiteOtro: true,
    }));
    const indiceElementoValor = visibles.findIndex((p) => p.campo === "elemento_valor");
    if (indiceElementoValor !== -1) {
      visibles = [
        ...visibles.slice(0, indiceElementoValor + 1),
        ...preguntasMineral,
        ...visibles.slice(indiceElementoValor + 1),
      ];
    }
  }

  // "¿En qué moneda calculas ese capital?": si eligió "no sé", la pregunta
  // de monto (bucket) ni se muestra — significa que necesita asesoría, y
  // el selector de moneda queda abierto en /mi-cuenta (ver PerfilInversionForm).
  // Si eligió una moneda, las opciones de monto se reemplazan por la tabla
  // de esa moneda en vez de las de soles por defecto.
  const moneda = perfil.moneda_capital;
  if (moneda === "no_se") {
    visibles = visibles.filter((p) => p.campo !== "monto_requerido");
  } else if (moneda === "dolares") {
    const tabla =
      situacion === "concesionario"
        ? OPCIONES_MONTO_REQUERIDO_RUTA2.dolares
        : OPCIONES_MONTO_REQUERIDO_RUTA1.dolares;
    visibles = visibles.map((p) => (p.campo === "monto_requerido" ? { ...p, opciones: tabla } : p));
  }

  if (situacion !== "minero_artesanal" || perfil.conoce_ley !== true) return visibles;
  if (elementos.length === 0) return visibles;

  const preguntasLey: PreguntaPerfil[] = elementos.map((elemento) => ({
    campo: `ley__${elemento}`,
    texto: `¿Cuál es la ley promedio de ${elemento}?`,
    tipo: "numero_con_unidad",
    placeholder: "Ej. 2.5",
    opciones: OPCIONES_UNIDAD_LEY,
    permiteOtro: true,
  }));

  const indiceConoceLey = visibles.findIndex((p) => p.campo === "conoce_ley");
  if (indiceConoceLey === -1) return visibles;
  return [
    ...visibles.slice(0, indiceConoceLey + 1),
    ...preguntasLey,
    ...visibles.slice(indiceConoceLey + 1),
  ];
}

function noEsNo(v: unknown): boolean {
  return typeof v === "string" && v !== "no";
}

/** Ruta 2 (concesionario): TODAS sus preguntas de formalización (L1-L4,L6,
 * A1,T1,T3,T6,T7,R1) ya se respondieron en el perfil — se copian aquí, sin
 * repetir la pregunta en un paso Sí/No aparte. Ruta 1 prellena T7 (de
 * "documentacion_disponible") y, si declaró sustancias tóxicas, A4 (de
 * "gestion_sustancias") — el resto de su cuestionario Sí/No sigue siendo
 * el completo de siempre. */
function respuestasPrellenadasDe(situacion: Situacion, perfil: Perfil): Respuestas {
  const prellenadas: Respuestas = {};

  if (situacion === "concesionario") {
    const titular = perfil.titular === true;
    prellenadas.L1 = perfil.formalizacion_iniciada === "aprobado";
    prellenadas.L2 = titular;
    prellenadas.L3 = titular ? true : Boolean(perfil.documento_autorizacion);
    prellenadas.L4 = perfil.tiene_ruc === "activo";
    prellenadas.L6 = perfil.concesion_vigente === "si";
    prellenadas.A1 = perfil.pasivos_ambientales === "no";
    prellenadas.T1 = noEsNo(perfil.info_geologica_disponible);
    prellenadas.T3 = noEsNo(perfil.tiene_resultados_laboratorio);
    prellenadas.T6 = noEsNo(perfil.tiene_estimaciones_leyes);
    prellenadas.T7 = noEsNo(perfil.estudio_previo);
    prellenadas.R1 = perfil.conflictividad_social === "no";
  }

  if (situacion === "minero_artesanal") {
    prellenadas.T7 = noEsNo(perfil.documentacion_disponible);
    // El perfil ya pregunta "¿Cuentas con resultados de laboratorio?"
    // (mismo hecho que T3) — evita preguntarlo dos veces, igual que ya
    // se hace en Ruta 2 con el mismo campo.
    prellenadas.T3 = noEsNo(perfil.tiene_resultados_laboratorio);
    if (noEsNo(perfil.sustancias_toxicas)) {
      prellenadas.A4 = perfil.gestion_sustancias !== "no_se_gestiona" && noEsNo(perfil.gestion_sustancias);
    }
  }

  return prellenadas;
}

/** "Oro: 2.5 g/t; Plata: 30 g/t" — una ley por cada elemento marcado. */
function leyPromedioDe(perfilFinal: Perfil): string | undefined {
  if (perfilFinal.conoce_ley !== true) return undefined;
  const elementos = Array.isArray(perfilFinal.elemento_valor)
    ? (perfilFinal.elemento_valor as string[])
    : [];
  const partes = elementos
    .map((elemento) => {
      const valor = textoOpcional(perfilFinal[`ley__${elemento}`]);
      return valor ? `${elemento}: ${valor}` : null;
    })
    .filter((v): v is string => v !== null);
  return partes.length > 0 ? partes.join("; ") : undefined;
}

/** "Cobre: Calcopirita, Malaquita; Oro: Oro nativo" — especies declaradas
 * por cada elemento marcado (ver preguntas `mineral__${elemento}`). */
function especieMineralDe(perfilFinal: Perfil): string | undefined {
  const elementos = Array.isArray(perfilFinal.elemento_valor)
    ? (perfilFinal.elemento_valor as string[])
    : [];
  const partes = elementos
    .map((elemento) => {
      const especies = listaOpcional(perfilFinal[`mineral__${elemento}`]);
      return especies ? `${etiquetaElemento(elemento)}: ${especies.join(", ")}` : null;
    })
    .filter((v): v is string => v !== null);
  return partes.length > 0 ? partes.join("; ") : undefined;
}

function mineralDe(perfilFinal: Perfil): string {
  const elementos = Array.isArray(perfilFinal.elemento_valor)
    ? (perfilFinal.elemento_valor as string[])
    : [];
  if (elementos.length > 0) return elementos.join(", ");
  return textoOpcional(perfilFinal.elemento_valor) ?? SIN_ESPECIFICAR;
}

export function Cuestionario() {
  const navigate = useNavigate();
  const location = useLocation();
  // "Volver" desde /resultado: retoma el wizard en la última pregunta
  // respondida en vez de reiniciar todo el cuestionario desde cero.
  const estadoPrevio = (location.state as { volver?: boolean } | null)?.volver
    ? leerDiagnostico()?.estadoWizard
    : undefined;

  const [paso, setPaso] = useState(estadoPrevio?.paso ?? 0);
  const [situacion, setSituacion] = useState<Situacion | "">(estadoPrevio?.situacion ?? "");
  const [perfil, setPerfil] = useState<Perfil>(estadoPrevio?.perfil ?? {});
  const [respuestas, setRespuestas] = useState<Respuestas>(estadoPrevio?.respuestas ?? {});
  const [informativas, setInformativas] = useState<DatosInformativos>(
    estadoPrevio?.informativas ?? {}
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const perfilVisible = situacion ? construirPerfilVisible(situacion, perfil) : [];
  const TOTAL_PERFIL = perfilVisible.length;

  const respuestasPrellenadas = situacion ? respuestasPrellenadasDe(situacion, perfil) : {};
  const tipoMina = situacion ? tipoMinaDe(situacion, perfil) : "subterranea";
  const preguntas = situacion
    ? preguntasAplicables(tipoMina, situacion, perfil).filter((p) => !(p.id in respuestasPrellenadas))
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

  function volver() {
    setPaso((p) => {
      let anterior = Math.max(0, p - 1);
      // Si el paso anterior es una pregunta que se autocompletó al
      // avanzar (ver responder()), sáltala también para volver
      // directo a la pregunta que la originó (L2 o A1).
      const preguntaAnterior =
        anterior > TOTAL_PERFIL && anterior <= TOTAL_PERFIL + TOTAL_PREGUNTAS
          ? preguntas[anterior - TOTAL_PERFIL - 1]
          : undefined;
      if (
        (preguntaAnterior?.id === "L3" && respuestas.L2 === true) ||
        (preguntaAnterior?.id === "A2" && respuestas.A1 === false)
      ) {
        anterior = Math.max(0, anterior - 1);
      }
      return anterior;
    });
  }

  async function terminar(
    respuestasFinales: Respuestas,
    datosFinales: DatosInformativos,
    perfilFinal: Perfil
  ) {
    if (!situacion) return;
    setEnviando(true);
    setError(null);
    try {
      const payload: DiagnosticoRequest = {
        respuestas: { ...respuestasPrellenadasDe(situacion, perfilFinal), ...respuestasFinales },
        region: SIN_ESPECIFICAR,
        mineral: mineralDe(perfilFinal),
        tipo_mina: tipoMinaDe(situacion, perfilFinal),
        situacion,
        produccion_mensual: textoOpcional(perfilFinal.produccion_mensual),
        maquinaria: textoOpcional(perfilFinal.maquinaria) ?? datosFinales.maquinaria,
        num_trabajadores: textoOpcional(perfilFinal.num_trabajadores) ?? datosFinales.num_trabajadores,
        estado_operacion: textoOpcional(perfilFinal.estado_operacion),
        tipo_explotacion: textoOpcional(perfilFinal.tipo_explotacion),
        material_comercializado: textoOpcional(perfilFinal.material_comercializado),
        forma_comercializacion: textoOpcional(perfilFinal.forma_comercializacion),
        tiempo_operacion: textoOpcional(perfilFinal.tiempo_operacion),
        ley_promedio: leyPromedioDe(perfilFinal),
        ley_como_obtenida: textoOpcional(perfilFinal.ley_como_obtenida),
        especie_mineral: especieMineralDe(perfilFinal),
        tiene_resultados_laboratorio: textoOpcional(perfilFinal.tiene_resultados_laboratorio),
        modalidad_trabajadores: textoOpcional(perfilFinal.modalidad_trabajadores),
        provincia: textoOpcional(perfilFinal.provincia),
        sustancias_toxicas: textoOpcional(perfilFinal.sustancias_toxicas),
        gestion_sustancias: textoOpcional(perfilFinal.gestion_sustancias),
        incidentes_previos: textoOpcional(perfilFinal.incidentes_previos),
        permisos_comunitarios: textoOpcional(perfilFinal.permisos_comunitarios),
        acceso_logistico: textoOpcional(perfilFinal.acceso_logistico),
        experiencia_operador: textoOpcional(perfilFinal.experiencia_operador),
        capacitacion_operador: textoOpcional(perfilFinal.capacitacion_operador),
        documentacion_disponible: textoOpcional(perfilFinal.documentacion_disponible),
        plan_formalizacion: textoOpcional(perfilFinal.plan_formalizacion),
        prioridad_crecimiento: textoOpcional(perfilFinal.prioridad_crecimiento),
        concesion_vigente: textoOpcional(perfilFinal.concesion_vigente),
        tipo_deposito: textoOpcional(perfilFinal.tipo_deposito),
        etapa_proyecto: textoOpcional(perfilFinal.etapa_proyecto),
        trabajos_exploracion_json: listaOpcional(perfilFinal.trabajos_exploracion_json),
        info_geologica_disponible: textoOpcional(perfilFinal.info_geologica_disponible),
        tiene_estimaciones_leyes: textoOpcional(perfilFinal.tiene_estimaciones_leyes),
        toneladas_estimadas: textoOpcional(perfilFinal.toneladas_estimadas),
        ley_esperada: textoOpcional(perfilFinal.ley_esperada),
        capital_disponible: textoOpcional(perfilFinal.capital_disponible),
        estudio_previo: textoOpcional(perfilFinal.estudio_previo),
        historial_operacion: textoOpcional(perfilFinal.historial_operacion),
        pasivos_ambientales: textoOpcional(perfilFinal.pasivos_ambientales),
        experiencia_titular: textoOpcional(perfilFinal.experiencia_titular),
        background_titular: textoOpcional(perfilFinal.background_titular),
        equipo_tecnico: textoOpcional(perfilFinal.equipo_tecnico),
        tipo_socio_buscado: textoOpcional(perfilFinal.tipo_socio_buscado),
        siguiente_hito: textoOpcional(perfilFinal.siguiente_hito),
        timeline_operacion: textoOpcional(perfilFinal.timeline_operacion),
        motivo_inicio: textoOpcional(perfilFinal.motivo_inicio),
        documento_autorizacion: textoOpcional(perfilFinal.documento_autorizacion),
        tipo_apoyo: textoOpcional(perfilFinal.tipo_apoyo),
        acceso_agua: textoOpcional(perfilFinal.acceso_agua),
        acceso_energia: textoOpcional(perfilFinal.acceso_energia),
        conflictividad_social: textoOpcional(perfilFinal.conflictividad_social),
        estructura_propiedad: textoOpcional(perfilFinal.estructura_propiedad),
        moneda_capital: textoOpcional(perfilFinal.moneda_capital),
        monto_requerido:
          textoOpcional(perfilFinal.monto_requerido) ??
          (perfilFinal.moneda_capital === "no_se"
            ? "Aún no sabe — necesita asesoría"
            : undefined),
        plazo_capital: textoOpcional(perfilFinal.plazo_capital),
        motivo_capital: textoOpcional(perfilFinal.motivo_capital),
        produccion_objetivo: textoOpcional(perfilFinal.produccion_objetivo),
        uso_fondos_diagnostico: textoOpcional(perfilFinal.uso_fondos_diagnostico),
      };

      const respuesta = await enviarDiagnostico(payload);
      guardarDiagnostico({
        respuesta,
        region: SIN_ESPECIFICAR,
        estadoWizard: {
          situacion,
          perfil: perfilFinal,
          respuestas: respuestasFinales,
          informativas: datosFinales,
          paso,
        },
      });
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

    const visibleTrasResponder = construirPerfilVisible(situacion, nuevoPerfil);
    const esUltimoPasoDelPerfil = paso >= visibleTrasResponder.length;

    if (esUltimoPasoDelPerfil && TOTAL_PREGUNTAS === 0 && TOTAL_INFORMATIVAS === 0) {
      terminar({}, {}, nuevoPerfil);
    } else {
      setPaso(paso + 1);
    }
  }

  function responder(valor: boolean) {
    if (!preguntaActual) return;
    let nuevas = { ...respuestas, [preguntaActual.id]: valor };
    let saltos = 1;

    // Dos preguntas que la siguiente pregunta hace lógicamente innecesaria:
    // si eres titular (L2=Sí), el "contrato de explotación" (L3) no aplica
    // — su propia ayuda lo dice ("si la concesión es tuya, no te hace
    // falta"). Si no tienes IGAFOM aprobado (A1=No), su vigencia (A2)
    // tampoco puede ser Sí. En vez de preguntarlas y arriesgar una
    // respuesta inconsistente que penaliza el score sin motivo, se
    // autocompletan y se saltan (ver "Autocompletado dentro del propio
    // Sí/No" en context/criterios_score.md).
    const siguiente = preguntas[preguntas.indexOf(preguntaActual) + 1];
    if (preguntaActual.id === "L2" && valor === true && siguiente?.id === "L3") {
      nuevas = { ...nuevas, L3: true };
      saltos = 2;
    } else if (preguntaActual.id === "A1" && valor === false && siguiente?.id === "A2") {
      nuevas = { ...nuevas, A2: false };
      saltos = 2;
    }

    setRespuestas(nuevas);

    // Antes, el paso de "informativas" siempre existía y era el que
    // terminaba el cuestionario. Ahora puede estar vacío (Ruta 1 movió
    // maquinaria/trabajadores al perfil, Ruta 2 nunca las tuvo) — si esta
    // era la última pantalla de cualquier tipo, hay que terminar aquí.
    if (paso + saltos > TOTAL_PERFIL + TOTAL_PREGUNTAS + TOTAL_INFORMATIVAS) {
      terminar(nuevas, informativas, perfil);
    } else {
      setPaso(paso + saltos);
    }
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
        onVolver={volver}
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
        onVolver={volver}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center gap-6 px-4">
      <button
        onClick={volver}
        className="self-start text-sm text-texto-suave underline dark:text-texto-suave-dark"
      >
        ← Volver
      </button>
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
              <Lightbulb size={17} strokeWidth={2} className="mt-0.5 shrink-0 text-acento" aria-hidden />
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
  onVolver,
}: {
  pregunta: { campo: string; texto: string; placeholder: string };
  valorActual?: string;
  pasoActual: number;
  onResponder: (valor: string | undefined) => void;
  onVolver: () => void;
}) {
  const [texto, setTexto] = useState(valorActual ?? "");

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center gap-6 px-4">
      <button
        onClick={onVolver}
        className="self-start text-sm text-texto-suave underline dark:text-texto-suave-dark"
      >
        ← Volver
      </button>
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

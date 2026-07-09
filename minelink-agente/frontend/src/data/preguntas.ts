import type { IdPregunta, NombreDimension, Situacion } from "../types/diagnostico";

export interface Pregunta {
  id: IdPregunta;
  texto: string;
  nota?: string;
  /** Explicación en lenguaje simple de qué es el documento/trámite,
   * para mineros que no conocen el término (perfil_usuario.md:
   * "cero siglas sin explicar, cada término con ejemplo simple"). */
  ayuda?: string;
  /** Si está presente, la pregunta solo aplica cuando tipo_mina === este valor. */
  soloSiTipoMina?: "subterranea";
  /** Se muestra solo si esta función, evaluada contra el perfil informativo
   * acumulado, devuelve true. Sin esto = siempre se muestra (salvo que la
   * excluya soloSiTipoMina o la regla de situación). Hoy solo la usa A4. */
  mostrarSi?: (perfil: Record<string, unknown>) => boolean;
  /** El mismo id puede significar algo distinto según la ruta (ej. T7).
   * Si la situación actual tiene entrada acá, se usa esa en vez de `texto`. */
  textoPorSituacion?: Partial<Record<Situacion, string>>;
}

export interface Bloque {
  dimension: NombreDimension;
  titulo: string;
  preguntas: Pregunta[];
}

// Textos copiados EXACTAMENTE de context/criterios_score.md.
// `nota` es la aclaración de sigla (perfil_usuario.md: "cada sigla con
// aclaración la primera vez"), no forma parte del texto de la pregunta.
// `ayuda` explica qué es el documento/trámite en lenguaje de campo.
export const BLOQUES: Bloque[] = [
  {
    dimension: "legal",
    titulo: "Legal",
    preguntas: [
      {
        id: "L1",
        texto: "¿Está inscrito en REINFO?",
        nota: "REINFO: tu registro como minero en proceso de formalización",
        ayuda:
          "Es la lista del Estado donde te inscribes para poder trabajar mientras te formalizas. Si estás inscrito y vigente, puedes operar sin multas. Puedes verificarlo con tu DNI en la página del MINEM.",
      },
      {
        id: "L2",
        texto: "¿Es titular de la concesión?",
        ayuda:
          "La concesión es el permiso sobre el terreno donde está tu mina. Eres titular si está a tu nombre. Si trabajas en la concesión de otra persona, responde No.",
      },
      {
        id: "L3",
        texto: "¿Cuenta con contrato de explotación o autorización?",
        ayuda:
          "Es el acuerdo firmado con el dueño de la concesión que te autoriza a trabajar en su terreno. Si la concesión es tuya, este contrato no te hace falta.",
      },
      {
        id: "L4",
        texto: "¿Tiene RUC activo?",
        nota: "RUC: tu registro tributario en SUNAT",
        ayuda:
          "Es tu número de registro en SUNAT, el que usas para emitir boletas o facturas. \"Activo\" significa que no está suspendido ni dado de baja.",
      },
      {
        id: "L5",
        texto: "¿Cuenta con coordenadas georreferenciadas?",
        ayuda:
          "Son los puntos GPS exactos que marcan dónde está tu labor. Los toma un topógrafo con equipo especial y sirven para el sinceramiento de tu REINFO.",
      },
      {
        id: "L6",
        texto: "¿La concesión se encuentra vigente?",
        ayuda:
          "Una concesión hay que mantenerla pagando el derecho de vigencia cada año ante INGEMMET. Si dejas de pagarlo, se puede caducar y perder tus derechos sobre la zona.",
      },
    ],
  },
  {
    dimension: "ambiental",
    titulo: "Ambiental",
    preguntas: [
      {
        id: "A1",
        texto: "¿Tiene tu IGAFOM aprobado?",
        nota: "IGAFOM: tu plan ambiental (Correctivo o Preventivo, según tu caso)",
        ayuda:
          "El IGAFOM es tu compromiso ambiental ante el Estado. Si ya operas, es el Correctivo (corrige daños existentes); si vas a operar, el Preventivo. Responde Sí si ya lo presentaste y fue aprobado.",
        textoPorSituacion: {
          concesionario: "¿La concesión está libre de pasivos ambientales heredados?",
        },
      },
      {
        id: "A2",
        texto: "¿Su instrumento ambiental está vigente?",
        ayuda:
          "No basta con que te lo hayan aprobado alguna vez: el instrumento ambiental tiene una vigencia y hay que renovarlo. Responde Sí si sigue vigente hoy.",
        textoPorSituacion: {
          concesionario: "¿Tienes un plan de gestión ambiental preliminar?",
        },
      },
      {
        id: "A3",
        texto: "¿No ha tenido clausuras ambientales en los últimos 3 años?",
        ayuda:
          "Una clausura es cuando la autoridad ambiental paraliza tu operación por incumplimiento. Responde Sí si en los últimos 3 años no te clausuraron por temas ambientales.",
      },
      {
        id: "A4",
        texto: "¿Cuenta con un plan de manejo para el mercurio, cianuro o relaves que genera?",
        ayuda:
          "Si en tu proceso usas mercurio, cianuro, o generas relaves, necesitas un plan que diga cómo los confinas, tratas o reúsas sin dañar el ambiente.",
        mostrarSi: (perfil) =>
          typeof perfil.sustancias_toxicas === "string" && perfil.sustancias_toxicas !== "no",
      },
    ],
  },
  {
    dimension: "operativo",
    titulo: "Operativo",
    preguntas: [
      {
        id: "O1",
        texto: "¿Actualmente produce mineral?",
        ayuda:
          "Responde Sí si hoy estás sacando mineral de tu labor, aunque sea poco. Si estás parado o todavía explorando, responde No.",
      },
    ],
  },
  {
    dimension: "tecnico",
    titulo: "Técnico",
    preguntas: [
      {
        id: "T1",
        texto: "¿Tiene informe geológico?",
        ayuda:
          "Es un documento hecho por un geólogo que describe qué tipo de roca y mineral hay en tu zona y por dónde corre la veta.",
      },
      {
        id: "T2",
        texto: "¿Cuenta con muestreo geoquímico?",
        ayuda:
          "Es tomar muestras de roca o suelo en varios puntos de tu labor para saber cuánto mineral hay y de qué calidad.",
      },
      {
        id: "T3",
        texto: "¿Tiene análisis de laboratorio?",
        ayuda:
          "Son los resultados de un laboratorio que dicen cuánta ley tienen tus muestras (por ejemplo, cuántos gramos de oro por tonelada).",
      },
      {
        id: "T4",
        texto: "¿Posee planos geológicos?",
        ayuda:
          "Son mapas de tu labor donde se dibujan las vetas, fallas y tipos de roca. Los prepara un geólogo o ingeniero.",
      },
      {
        id: "T5",
        texto: "¿Tiene topografía?",
        ayuda:
          "Es el plano con medidas exactas de tu terreno y tus labores (galerías, tajos, accesos). Lo hace un topógrafo con GPS o estación total.",
      },
      {
        id: "T6",
        texto: "¿Cuenta con una estimación de recursos?",
        ayuda:
          "Es el cálculo técnico de cuánto mineral tienes y para cuánto tiempo te alcanza. Es lo primero que pregunta un inversionista serio.",
      },
      {
        id: "T7",
        texto: "¿Puedes documentar tu operación con fotos o reportes técnicos?",
        ayuda:
          "Fotos actuales de tu labor o reportes técnicos que respalden lo que declaras — le dan más confianza a quien evalúa tu proyecto.",
        textoPorSituacion: {
          concesionario: "¿Cuenta con un estudio de prefactibilidad o factibilidad?",
        },
      },
    ],
  },
  {
    dimension: "seguridad",
    titulo: "Seguridad",
    preguntas: [
      {
        id: "S1",
        texto: "¿Cuenta con IPERC?",
        nota: "IPERC: identificación de peligros y evaluación de riesgos",
        ayuda:
          "Es una tabla donde apuntas los peligros de cada tarea (caída de rocas, gases, explosivos...) y qué haces para controlarlos. Se hace antes de empezar el trabajo.",
      },
      {
        id: "S2",
        texto: "¿Tiene SCTR para los trabajadores?",
        nota: "SCTR: el seguro de riesgo para tus trabajadores",
        ayuda:
          "Es el seguro obligatorio que cubre a tus trabajadores si sufren un accidente en la mina. Se contrata cada mes con una aseguradora y les da atención médica y pensión.",
      },
      {
        id: "S3",
        texto: "¿Dispone de un plan de seguridad?",
        ayuda:
          "Es el documento que ordena cómo se trabaja seguro en tu mina: quién es responsable de qué, qué equipos de protección se usan y qué hacer en una emergencia.",
      },
      {
        id: "S4",
        texto: "¿Tiene evaluación geomecánica?",
        ayuda:
          "Es un estudio que dice qué tan firme es la roca de tu labor y qué sostenimiento necesitas (cuadros de madera, pernos) para evitar derrumbes.",
      },
      {
        id: "S5",
        texto: "¿Cuenta con estudio de ventilación?",
        soloSiTipoMina: "subterranea",
        ayuda:
          "Es un estudio que verifica que dentro del socavón entre suficiente aire limpio y no se acumulen gases peligrosos donde trabaja tu gente.",
      },
    ],
  },
  {
    // Dimensión nueva, hoy exclusiva de Ruta 2 (concesionario) — ver
    // scoring.SITUACIONES. Un proyecto que recién inicia no tiene
    // historial operativo que evaluar en Seguridad/Ambiental, pero sí
    // puede tener conflictividad social alrededor de la concesión.
    dimension: "social",
    titulo: "Social",
    preguntas: [
      {
        id: "R1",
        texto: "¿No hay conflictividad comunitaria activa alrededor de la concesión?",
        ayuda:
          "Responde Sí si no hay protestas activas ni oposición organizada de las comunidades cercanas a tu concesión.",
      },
    ],
  },
];

/** Preguntas informativas de Operativo: NUNCA puntúan, se guardan como
 * texto libre y admiten "prefiero no decirlo" (perfil_usuario.md). */
export interface PreguntaInformativa {
  campo: "produccion_mensual" | "maquinaria" | "num_trabajadores";
  texto: string;
  placeholder: string;
}

export const PREGUNTAS_INFORMATIVAS_OPERATIVO: PreguntaInformativa[] = [
  {
    campo: "produccion_mensual",
    texto: "¿Cuánto produce por mes?",
    placeholder: "Ej. 30 gramos de oro",
  },
  {
    campo: "maquinaria",
    texto: "¿Qué maquinaria posee?",
    placeholder: "Ej. compresora, chancadora",
  },
  {
    campo: "num_trabajadores",
    texto: "¿Cuántos trabajadores tiene?",
    placeholder: "Ej. 5",
  },
];

/** Opciones de la primera pregunta del formulario dinámico: "no todos los
 * proyectos mineros son iguales; primero se identifica la situación". */
export const SITUACIONES: {
  valor: Situacion;
  titulo: string;
  descripcion: string;
}[] = [
  {
    valor: "minero_artesanal",
    titulo: "Ya tengo una operación minera",
    descripcion: "Trabajo una labor minera pequeña, con o sin REINFO.",
  },
  {
    valor: "concesionario",
    titulo: "Tengo una concesión y recién estoy iniciando",
    descripcion: "Soy titular de una concesión y todavía no opero.",
  },
];

// Espejo exacto de backend/scoring.py → SITUACIONES (mantener sincronizados).
// A4 es condicional (ver `mostrarSi` en su Pregunta) y no se resuelve acá.
const REGLA_POR_SITUACION: Record<Situacion, { excluir?: string[]; solo?: string[] }> = {
  minero_artesanal: { excluir: ["L6", "R1"] },
  concesionario: {
    solo: ["L1", "L2", "L3", "L4", "L6", "A1", "A2", "T1", "T3", "T6", "T7", "R1"],
  },
};

/** `perfil` es el perfil informativo acumulado hasta este punto del
 * cuestionario — solo se usa para resolver preguntas condicionales
 * (`mostrarSi`), hoy únicamente A4. Aplica también `textoPorSituacion`
 * cuando corresponde, así el llamador siempre recibe el texto correcto. */
export function preguntasAplicables(
  tipoMina: "subterranea" | "tajo_abierto",
  situacion: Situacion = "minero_artesanal",
  perfil: Record<string, unknown> = {}
): Pregunta[] {
  const regla = REGLA_POR_SITUACION[situacion];
  return BLOQUES.flatMap((b) => b.preguntas)
    .filter((p) => !p.soloSiTipoMina || p.soloSiTipoMina === tipoMina)
    .filter((p) =>
      regla.solo ? regla.solo.includes(p.id) : !(regla.excluir ?? []).includes(p.id)
    )
    .filter((p) => !p.mostrarSi || p.mostrarSi(perfil))
    .map((p) => ({ ...p, texto: p.textoPorSituacion?.[situacion] ?? p.texto }));
}

/** Ya no se usa: maquinaria y num_trabajadores se preguntan ahora en el
 * perfil informativo (Ruta 1, Bloque 3) y producción mensual también.
 * Se deja definida por si se necesita reactivar una informativa suelta
 * más adelante. */
export function informativasAplicables(_situacion: Situacion): PreguntaInformativa[] {
  return [];
}

export const NOMBRES_DIMENSION: Record<NombreDimension, string> = {
  legal: "Legal",
  ambiental: "Ambiental",
  operativo: "Operativo",
  tecnico: "Técnico",
  seguridad: "Seguridad",
  social: "Social",
};

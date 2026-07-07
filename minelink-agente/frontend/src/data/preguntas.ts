import type { IdPregunta, NombreDimension } from "../types/diagnostico";

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
        texto: "¿Cuenta con contrato de explotación?",
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
    ],
  },
  {
    dimension: "ambiental",
    titulo: "Ambiental",
    preguntas: [
      {
        id: "A1",
        texto: "¿Tiene IGAFOM Correctivo?",
        nota: "IGAFOM: tu plan ambiental",
        ayuda:
          "El IGAFOM es tu compromiso ambiental ante el Estado. El Correctivo aplica si YA vienes trabajando: dice cómo vas a corregir los daños que existen (relaves, desmontes, pozas).",
      },
      {
        id: "A2",
        texto: "¿Tiene IGAFOM Preventivo?",
        ayuda:
          "El Preventivo es para lo que vas a hacer de aquí en adelante: dice cómo evitarás dañar el ambiente en tus próximas labores.",
      },
      {
        id: "A3",
        texto: "¿Su instrumento ambiental está aprobado?",
        ayuda:
          "No basta con presentar tu IGAFOM: la autoridad de minería de tu región (DREM o GREM) debe revisarlo y darte una resolución de aprobación. Si tienes ese papel, responde Sí.",
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

export function preguntasAplicables(tipoMina: "subterranea" | "tajo_abierto"): Pregunta[] {
  return BLOQUES.flatMap((b) => b.preguntas).filter(
    (p) => !p.soloSiTipoMina || p.soloSiTipoMina === tipoMina
  );
}

export const NOMBRES_DIMENSION: Record<NombreDimension, string> = {
  legal: "Legal",
  ambiental: "Ambiental",
  operativo: "Operativo",
  tecnico: "Técnico",
  seguridad: "Seguridad",
};

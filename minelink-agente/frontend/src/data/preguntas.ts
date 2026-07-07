import type { IdPregunta, NombreDimension } from "../types/diagnostico";

export interface Pregunta {
  id: IdPregunta;
  texto: string;
  nota?: string;
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
export const BLOQUES: Bloque[] = [
  {
    dimension: "legal",
    titulo: "Legal",
    preguntas: [
      {
        id: "L1",
        texto: "¿Está inscrito en REINFO?",
        nota: "REINFO: tu registro como minero en proceso de formalización",
      },
      { id: "L2", texto: "¿Es titular de la concesión?" },
      { id: "L3", texto: "¿Cuenta con contrato de explotación?" },
      {
        id: "L4",
        texto: "¿Tiene RUC activo?",
        nota: "RUC: tu registro tributario en SUNAT",
      },
      { id: "L5", texto: "¿Cuenta con coordenadas georreferenciadas?" },
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
      },
      { id: "A2", texto: "¿Tiene IGAFOM Preventivo?" },
      { id: "A3", texto: "¿Su instrumento ambiental está aprobado?" },
    ],
  },
  {
    dimension: "operativo",
    titulo: "Operativo",
    preguntas: [{ id: "O1", texto: "¿Actualmente produce mineral?" }],
  },
  {
    dimension: "tecnico",
    titulo: "Técnico",
    preguntas: [
      { id: "T1", texto: "¿Tiene informe geológico?" },
      { id: "T2", texto: "¿Cuenta con muestreo geoquímico?" },
      { id: "T3", texto: "¿Tiene análisis de laboratorio?" },
      { id: "T4", texto: "¿Posee planos geológicos?" },
      { id: "T5", texto: "¿Tiene topografía?" },
      { id: "T6", texto: "¿Cuenta con una estimación de recursos?" },
    ],
  },
  {
    dimension: "seguridad",
    titulo: "Seguridad",
    preguntas: [
      { id: "S1", texto: "¿Cuenta con IPERC?", nota: "IPERC: identificación de peligros y evaluación de riesgos" },
      { id: "S2", texto: "¿Tiene SCTR para los trabajadores?", nota: "SCTR: el seguro de riesgo para tus trabajadores" },
      { id: "S3", texto: "¿Dispone de un plan de seguridad?" },
      { id: "S4", texto: "¿Tiene evaluación geomecánica?" },
      {
        id: "S5",
        texto: "¿Cuenta con estudio de ventilación?",
        soloSiTipoMina: "subterranea",
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

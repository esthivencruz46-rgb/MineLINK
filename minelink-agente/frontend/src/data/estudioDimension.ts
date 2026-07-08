import type { NombreDimension } from "../types/diagnostico";

// A qué dimensión pertenece cada etiqueta de estudio (para ordenar brechas
// por la dimensión más débil primero, según skills/score-display/SKILL.md).
// Basado en context/criterios_score.md (julio 2026).
export const DIMENSION_POR_ESTUDIO: Record<string, NombreDimension> = {
  tramite_reinfo: "legal",
  titularidad_concesion: "legal",
  contrato_explotacion: "legal",
  tramite_sunat: "legal",
  levantamiento_georreferenciado: "legal",
  vigencia_concesion: "legal",
  igafom_correctivo: "ambiental",
  igafom_preventivo: "ambiental",
  aprobacion_instrumento_ambiental: "ambiental",
  puesta_en_produccion: "operativo",
  informe_geologico: "tecnico",
  muestreo_geoquimico: "tecnico",
  analisis_laboratorio: "tecnico",
  planos_geologicos: "tecnico",
  levantamiento_topografico: "tecnico",
  estimacion_recursos: "tecnico",
  iperc: "seguridad",
  sctr: "seguridad",
  plan_seguridad: "seguridad",
  evaluacion_geomecanica: "seguridad",
  estudio_ventilacion: "seguridad",
};

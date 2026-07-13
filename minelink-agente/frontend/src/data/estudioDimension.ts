import type { NombreDimension } from "../types/diagnostico";

/** A qué dimensión pertenece cada etiqueta de estudio — para ordenar
 *  brechas por la dimensión más débil primero. Basado en
 *  backend/catalogo_diagnostico.BRECHA_POR_PREGUNTA (julio 2026). */
export const DIMENSION_POR_ESTUDIO: Record<string, NombreDimension> = {
  // --- Brechas del nuevo diagnóstico ---
  tramite_reinfo: "legal",
  levantamiento_georreferenciado: "legal",
  acreditacion_terreno: "legal",
  vigencia_concesion: "legal",
  declaracion_bienal_pma_ppm: "legal",
  contrato_explotacion: "legal",
  tramite_sunat: "legal",
  dj_arqueologica: "legal",
  declaracion_anual_consolidada: "legal",
  subsanacion_fiscalizacion: "legal",
  autorizacion_inicio_actividades: "legal",
  // Credencial del perfil D (formal pleno) — se pide en "Respalda tu
  // declaración" aunque no sea una brecha (ver scoring.estudios_aplicables).
  autorizacion_drem: "legal",
  declaracion_produccion_semestral: "operativo",
  igafom_aprobado: "ambiental",
  instrumento_ambiental_dia_eia: "ambiental",
  licencia_agua_ana: "ambiental",
  informe_geologico: "tecnico",
  analisis_laboratorio: "tecnico",
  expediente_tecnico: "tecnico",
  estimacion_recursos: "tecnico",
  costos_opex: "tecnico",
  documentacion_operacion: "tecnico",
  puesta_en_produccion: "operativo",
  elaboracion_petitorio: "legal",
  // --- Estudios legacy ---
  titularidad_concesion: "legal",
  iperc: "seguridad",
  sctr: "seguridad",
  plan_seguridad: "seguridad",
  evaluacion_geomecanica: "seguridad",
  estudio_ventilacion: "seguridad",
  instrumento_ambiental_vigente: "ambiental",
  sin_clausura_ambiental: "ambiental",
  plan_manejo_residuos: "ambiental",
  muestreo_geoquimico: "tecnico",
  planos_geologicos: "tecnico",
  levantamiento_topografico: "tecnico",
  gestion_conflictividad_social: "social",
};

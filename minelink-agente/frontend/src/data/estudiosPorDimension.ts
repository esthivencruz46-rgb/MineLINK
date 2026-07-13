import type { NombreDimension } from "../types/diagnostico";
import { INFO_BRECHA } from "./brechas";
import { DIMENSION_POR_ESTUDIO } from "./estudioDimension";

export const ORDEN_DIMENSIONES: NombreDimension[] = [
  "legal",
  "ambiental",
  "operativo",
  "tecnico",
  "seguridad",
  "social",
];

export const ESTUDIOS_POR_DIMENSION: Record<NombreDimension, string[]> =
  ORDEN_DIMENSIONES.reduce((acc, dim) => {
    acc[dim] = Object.keys(INFO_BRECHA).filter((e) => DIMENSION_POR_ESTUDIO[e] === dim);
    return acc;
  }, {} as Record<NombreDimension, string[]>);

/** Estudios que alguna pregunta ACTUAL puede generar como brecha (espejo
 *  de backend BRECHA_POR_PREGUNTA + _BRECHA_INV_POR_PREGUNTA, julio 2026).
 *  El formulario público de consultores solo ofrece estos: marcar un
 *  estudio legacy (iperc, sctr, ventilación...) nunca haría match con
 *  ningún minero porque ninguna pregunta lo genera. Los legacy se
 *  conservan en INFO_BRECHA para las empresas ya cargadas por el admin. */
export const ESTUDIOS_CON_PREGUNTA = new Set([
  "acreditacion_terreno",
  "analisis_laboratorio",
  "autorizacion_inicio_actividades",
  "contrato_explotacion",
  "costos_opex",
  "declaracion_anual_consolidada",
  "declaracion_bienal_pma_ppm",
  "declaracion_produccion_semestral",
  "dj_arqueologica",
  "documentacion_operacion",
  "elaboracion_petitorio",
  "estimacion_recursos",
  "expediente_tecnico",
  "igafom_aprobado",
  "informe_geologico",
  "instrumento_ambiental_dia_eia",
  "levantamiento_georreferenciado",
  "licencia_agua_ana",
  "puesta_en_produccion",
  "subsanacion_fiscalizacion",
  "tramite_reinfo",
  "tramite_sunat",
  "vigencia_concesion",
]);

export const ESTUDIOS_POR_DIMENSION_CON_PREGUNTA: Record<NombreDimension, string[]> =
  ORDEN_DIMENSIONES.reduce((acc, dim) => {
    acc[dim] = ESTUDIOS_POR_DIMENSION[dim].filter((e) => ESTUDIOS_CON_PREGUNTA.has(e));
    return acc;
  }, {} as Record<NombreDimension, string[]>);

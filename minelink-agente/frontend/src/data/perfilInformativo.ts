import type { NombreDimensionInversion } from "../types/proyecto";

/** Perfil informativo del diagnóstico (Fase 1, ~40 campos según ruta):
 * nunca puntúa el MineScore, pero es la base del Score de Atractivo de
 * Inversión. Se agrupa por las mismas 5 dimensiones que el score (todas
 * menos "formalizacion", que tiene su propia tarjeta con el checklist del
 * diagnóstico) para que la ficha pública lea en el mismo orden que el
 * panel lateral — ver components/PerfilInformativoAgrupado.tsx, usado
 * solo en ProyectoDetalle.tsx (julio 2026). */
export const CATEGORIAS_PERFIL_INFORMATIVO: Exclude<NombreDimensionInversion, "formalizacion">[] = [
  "escala_economica",
  "viabilidad_tecnica",
  "riesgo_ambiental_social",
  "capacidad_equipo",
  "claridad_oportunidad",
];

export type CategoriaPerfilInformativo = (typeof CATEGORIAS_PERFIL_INFORMATIVO)[number];

export const CAMPOS_PERFIL_INFORMATIVO: {
  campo: string;
  etiqueta: string;
  categoria: CategoriaPerfilInformativo;
}[] = [
  // Escala económica
  { campo: "capacidad_produccion", etiqueta: "Producción / reservas", categoria: "escala_economica" },
  { campo: "tiempo_operacion", etiqueta: "Tiempo operando", categoria: "escala_economica" },
  { campo: "modalidad_trabajadores", etiqueta: "Modalidad de trabajadores", categoria: "escala_economica" },
  { campo: "num_trabajadores", etiqueta: "Nº de trabajadores", categoria: "escala_economica" },
  { campo: "produccion_objetivo", etiqueta: "Producción objetivo", categoria: "escala_economica" },
  { campo: "toneladas_estimadas", etiqueta: "Toneladas estimadas del depósito", categoria: "escala_economica" },
  { campo: "etapa_proyecto", etiqueta: "Etapa del proyecto", categoria: "escala_economica" },
  { campo: "provincia", etiqueta: "Provincia", categoria: "escala_economica" },

  // Viabilidad técnica
  { campo: "tiene_resultados_laboratorio", etiqueta: "Resultados de laboratorio", categoria: "viabilidad_tecnica" },
  { campo: "documentacion_disponible", etiqueta: "Documentación técnica disponible", categoria: "viabilidad_tecnica" },
  { campo: "tipo_deposito", etiqueta: "Tipo de depósito", categoria: "viabilidad_tecnica" },
  { campo: "ley_esperada", etiqueta: "Ley esperada", categoria: "viabilidad_tecnica" },
  { campo: "info_geologica_disponible", etiqueta: "Información geológica disponible", categoria: "viabilidad_tecnica" },
  { campo: "tiene_estimaciones_leyes", etiqueta: "Estimaciones de leyes", categoria: "viabilidad_tecnica" },
  { campo: "estudio_previo", etiqueta: "Estudio de prefactibilidad/factibilidad", categoria: "viabilidad_tecnica" },
  { campo: "maquinaria", etiqueta: "Maquinaria principal", categoria: "viabilidad_tecnica" },

  // Riesgo ambiental/social
  { campo: "sustancias_toxicas", etiqueta: "Mercurio/cianuro/relaves", categoria: "riesgo_ambiental_social" },
  { campo: "gestion_sustancias", etiqueta: "Gestión de esas sustancias", categoria: "riesgo_ambiental_social" },
  { campo: "pasivos_ambientales", etiqueta: "Pasivos ambientales heredados", categoria: "riesgo_ambiental_social" },
  { campo: "conflictividad_social", etiqueta: "Conflictividad con comunidades", categoria: "riesgo_ambiental_social" },
  { campo: "permisos_comunitarios", etiqueta: "Permisos/relaciones comunitarias", categoria: "riesgo_ambiental_social" },
  { campo: "incidentes_previos", etiqueta: "Incidentes en los últimos 2 años", categoria: "riesgo_ambiental_social" },
  { campo: "historial_operacion", etiqueta: "Operada previamente", categoria: "riesgo_ambiental_social" },

  // Capacidad del equipo
  { campo: "experiencia_operador", etiqueta: "Experiencia del operador", categoria: "capacidad_equipo" },
  { campo: "capacitacion_operador", etiqueta: "Capacitación/colegiatura", categoria: "capacidad_equipo" },
  { campo: "experiencia_titular", etiqueta: "Experiencia del titular", categoria: "capacidad_equipo" },
  { campo: "background_titular", etiqueta: "Background profesional del titular", categoria: "capacidad_equipo" },
  { campo: "equipo_tecnico", etiqueta: "Equipo técnico definido", categoria: "capacidad_equipo" },
  { campo: "estructura_propiedad", etiqueta: "Estructura de propiedad", categoria: "capacidad_equipo" },

  // Claridad de oportunidad
  { campo: "tipo_apoyo", etiqueta: "Apoyo que busca primordialmente", categoria: "claridad_oportunidad" },
  { campo: "monto_requerido", etiqueta: "Monto aproximado (diagnóstico)", categoria: "claridad_oportunidad" },
  { campo: "plazo_capital", etiqueta: "Plazo para usar el capital", categoria: "claridad_oportunidad" },
  { campo: "capital_disponible", etiqueta: "Capital ya disponible", categoria: "claridad_oportunidad" },
  { campo: "tipo_socio_buscado", etiqueta: "Tipo de socio buscado", categoria: "claridad_oportunidad" },
  { campo: "prioridad_crecimiento", etiqueta: "Prioridad para crecer", categoria: "claridad_oportunidad" },
  { campo: "siguiente_hito", etiqueta: "Siguiente hito", categoria: "claridad_oportunidad" },
  { campo: "timeline_operacion", etiqueta: "Timeline esperado hasta operación", categoria: "claridad_oportunidad" },
  { campo: "motivo_inicio", etiqueta: "Por qué inició el proyecto", categoria: "claridad_oportunidad" },
  { campo: "plan_formalizacion", etiqueta: "Plan de formalización", categoria: "claridad_oportunidad" },
];

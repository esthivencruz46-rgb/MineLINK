export interface ProyectoPublico {
  operacion_id: string;
  nombre_proyecto: string;
  region: string;
  mineral: string;
  tipo_mina: string;
  situacion: string;
  score_actual: number;
  // Score de Atractivo de Inversión (Fase 2): el número principal para el
  // inversionista y el que ordena /proyectos. score_actual (MineScore de
  // formalización) sigue existiendo como uno de sus ingredientes.
  score_inversion: number;
  bloqueado_actual: boolean;
  descripcion_operacion?: string | null;
  capacidad_produccion?: string | null;
  capital_buscado?: string | null;
  uso_fondos?: string | null;
  created_at: string;
  foto_portada_url?: string | null;
}

export interface FotoPublica {
  id: number;
  url: string;
}

export interface DimensionScore {
  puntaje: number;
  maximo: number;
}

export interface ProyectoDetalle extends ProyectoPublico {
  fotos: FotoPublica[];
  documentos_presentados: Record<string, boolean>;
  documentos_legales: Record<string, FotoPublica[]>;
  // Fotos de respaldo por estudio (catálogo completo, no solo los 5
  // documentos legales fijos) — ver brechas_verificadas.
  documentos_estudios: Record<string, FotoPublica[]>;
  brechas_pendientes: string[];
  brechas_resueltas: string[];
  // Subconjunto de brechas_resueltas con foto de respaldo subida. El
  // diagnóstico es autodeclarado, así que el check ✓ público solo debe
  // mostrarse para brechas en esta lista, no para brechas_resueltas.
  brechas_verificadas: string[];
  dimensiones: Record<string, DimensionScore> | null;
  // Desglose del score_inversion: formalizacion, escala_economica,
  // viabilidad_tecnica, riesgo_ambiental_social, capacidad_equipo,
  // claridad_oportunidad.
  dimensiones_inversion: Record<string, DimensionScore>;
  ubicacion_maps?: string | null;
  ubicacion_coords?: string | null;
  descripcion_generada?: string | null;
  // Perfil informativo del diagnóstico (Fase 1) — para la sección
  // "Perfil del proyecto" de la ficha pública.
  tiempo_operacion?: string | null;
  ley_promedio?: string | null;
  ley_como_obtenida?: string | null;
  tiene_resultados_laboratorio?: string | null;
  num_trabajadores?: string | null;
  modalidad_trabajadores?: string | null;
  maquinaria?: string | null;
  provincia?: string | null;
  sustancias_toxicas?: string | null;
  gestion_sustancias?: string | null;
  acceso_agua?: string | null;
  acceso_energia?: string | null;
  tipo_apoyo?: string | null;
  monto_requerido?: string | null;
  plazo_capital?: string | null;
  uso_fondos_diagnostico?: string | null;
  motivo_capital?: string | null;
  produccion_objetivo?: string | null;
  incidentes_previos?: string | null;
  conflictividad_social?: string | null;
  permisos_comunitarios?: string | null;
  acceso_logistico?: string | null;
  experiencia_operador?: string | null;
  capacitacion_operador?: string | null;
  documentacion_disponible?: string | null;
  estructura_propiedad?: string | null;
  plan_formalizacion?: string | null;
  prioridad_crecimiento?: string | null;
  concesion_vigente?: string | null;
  pagos_vigencia_al_dia?: string | null;
  tipo_deposito?: string | null;
  toneladas_estimadas?: string | null;
  ley_esperada?: string | null;
  etapa_proyecto?: string | null;
  trabajos_exploracion_json?: string[] | null;
  info_geologica_disponible?: string | null;
  tiene_estimaciones_leyes?: string | null;
  capital_disponible?: string | null;
  estudio_previo?: string | null;
  historial_operacion?: string | null;
  pasivos_ambientales?: string | null;
  experiencia_titular?: string | null;
  background_titular?: string | null;
  equipo_tecnico?: string | null;
  tipo_socio_buscado?: string | null;
  siguiente_hito?: string | null;
  timeline_operacion?: string | null;
  motivo_inicio?: string | null;
  documento_autorizacion?: string | null;
}

export type NombreDimensionInversion =
  | "formalizacion"
  | "escala_economica"
  | "viabilidad_tecnica"
  | "riesgo_ambiental_social"
  | "capacidad_equipo"
  | "claridad_oportunidad";

export const ORDEN_DIMENSION_INVERSION: NombreDimensionInversion[] = [
  "formalizacion",
  "escala_economica",
  "viabilidad_tecnica",
  "riesgo_ambiental_social",
  "capacidad_equipo",
  "claridad_oportunidad",
];

export const NOMBRES_DIMENSION_INVERSION: Record<NombreDimensionInversion, string> = {
  formalizacion: "Formalización",
  escala_economica: "Escala económica",
  viabilidad_tecnica: "Viabilidad técnica",
  riesgo_ambiental_social: "Riesgo ambiental/social",
  capacidad_equipo: "Capacidad del equipo",
  claridad_oportunidad: "Claridad de oportunidad",
};

export const COLOR_DIMENSION_INVERSION: Record<NombreDimensionInversion, string> = {
  formalizacion: "bg-acento",
  escala_economica: "bg-secundario",
  viabilidad_tecnica: "bg-purple-500",
  riesgo_ambiental_social: "bg-amber-500",
  capacidad_equipo: "bg-blue-500",
  claridad_oportunidad: "bg-pink-500",
};

export interface InteresInversionRequest {
  nombre: string;
  username: string;
  password: string;
  pregunta_seguridad: string;
  respuesta_seguridad: string;
  telefono?: string;
  email?: string;
  motivo_inversion?: string;
  monto?: string;
  informacion_requerida?: string;
  mensaje?: string;
}

export const ETIQUETAS_DOCUMENTO_LEGAL: Record<string, string> = {
  informe_leyes: "Informe de leyes / ensayes",
  catastro: "Catastro / plano de ubicación",
  ruc: "RUC",
  contrato_explotacion: "Contrato de explotación",
  titulo_concesion: "Título de concesión",
};

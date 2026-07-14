export interface ProyectoPublico {
  operacion_id: string;
  nombre_proyecto: string;
  region: string;
  mineral: string;
  tipo_mina: string;
  situacion: string;
  // Tarjeta del spec (julio 2026): perfil del pipeline + dos semáforos
  // independientes + Índice de Madurez 0-5 — reemplazan a los scores 0-100.
  estado_formalizacion?: string | null;
  perfil?: string | null;
  semaforo_legal?: string | null;
  semaforo_tecnico?: string | null;
  indice_madurez?: number | null;
  // Avance documentario del perfil C ("5/7 documentos")
  docs_completados?: number | null;
  docs_totales?: number | null;
  // ¿Vende con liquidación formal? (evidencia de flujo de caja, perfil C)
  vende_liquidacion?: boolean | null;
  // Scores 0-100 por track (julio 2026) — para comparar proyectos de la
  // cartera; los semáforos siguen mandando en la regla de bloqueo.
  score_formalizacion?: number | null;
  score_inversion?: number | null;
  // ✓ declaró ventas con liquidación Y subió el respaldo (archivo privado)
  ventas_verificadas?: boolean;
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

/** Señales públicas derivadas de documentos PRIVADOS: el hecho verificado
 *  (existe respaldo, cuántos, de cuándo), nunca el documento en sí. */
export interface IndicadoresVerificados {
  ventas_liquidacion_verificada: boolean;
  ventas_liquidacion_docs: number;
  ventas_liquidacion_ultima?: string | null;
  contabilidad?: string | null;
  contabilidad_verificada: boolean;
  opex_verificado: boolean;
  opex_costo_aprox?: string | null;
  num_trabajadores?: string | null;
  maquinaria?: string | null;
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
  // True si declaró ser titular de la concesión, False si no, null si no
  // aplica — solo se muestra el documento legal que corresponde (Título de
  // concesión O Contrato de explotación, nunca ambos).
  es_titular_concesion?: boolean | null;
  // Señales verificadas derivadas de los documentos privados.
  indicadores?: IndicadoresVerificados;
  // Legacy (siempre null/vacío desde julio 2026 — los semáforos y la
  // madurez reemplazaron a los scores por dimensión).
  dimensiones: Record<string, DimensionScore> | null;
  dimensiones_inversion?: Record<string, DimensionScore>;
  ubicacion_maps?: string | null;
  ubicacion_coords?: string | null;
  descripcion_generada?: string | null;
  // Perfil informativo del diagnóstico (Fase 1) — para la sección
  // "Perfil del proyecto" de la ficha pública.
  tiempo_operacion?: string | null;
  ley_promedio?: string | null;
  ley_como_obtenida?: string | null;
  especie_mineral?: string | null;
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
  moneda_capital?: string | null;
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

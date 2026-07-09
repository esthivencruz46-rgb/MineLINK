export type IdPregunta =
  | "L1" | "L2" | "L3" | "L4" | "L5" | "L6"
  | "A1" | "A2" | "A3" | "A4"
  | "O1"
  | "T1" | "T2" | "T3" | "T4" | "T5" | "T6" | "T7"
  | "S1" | "S2" | "S3" | "S4" | "S5"
  | "R1";

// Record<string, ...> y no Record<IdPregunta, ...>: S5 es condicional
// (solo minería subterránea), así que el set de ids varía según tipo_mina.
export type Respuestas = Record<string, boolean>;

export type TipoMina = "subterranea" | "tajo_abierto";

// Formulario dinámico: "primero se identifica la situación del usuario y
// luego se construye un formulario con solo lo que corresponde a su caso"
export type Situacion = "minero_artesanal" | "concesionario";

export interface DiagnosticoRequest {
  respuestas: Respuestas;
  region: string;
  mineral: string;
  tipo_mina: TipoMina;
  situacion: Situacion;
  nombre_minero?: string;
  codigo_reinfo?: string;
  produccion_mensual?: string;
  maquinaria?: string;
  num_trabajadores?: string;

  // Perfil de la operación (Ruta 1) — informativo, nunca puntúa
  estado_operacion?: string;
  tipo_explotacion?: string;
  material_comercializado?: string;
  forma_comercializacion?: string;
  tiempo_operacion?: string;
  ley_promedio?: string;
  ley_como_obtenida?: string;
  especie_mineral?: string;
  tiene_resultados_laboratorio?: string;
  modalidad_trabajadores?: string;
  provincia?: string;
  sustancias_toxicas?: string;
  gestion_sustancias?: string;
  incidentes_previos?: string;
  permisos_comunitarios?: string;
  acceso_logistico?: string;
  experiencia_operador?: string;
  capacitacion_operador?: string;
  documentacion_disponible?: string;
  plan_formalizacion?: string;
  prioridad_crecimiento?: string;

  // Perfil de la concesión (Ruta 2) — informativo, nunca puntúa
  concesion_vigente?: string;
  tipo_deposito?: string;
  etapa_proyecto?: string;
  trabajos_exploracion_json?: string[];
  info_geologica_disponible?: string;
  tiene_estimaciones_leyes?: string;
  pagos_vigencia_al_dia?: string;
  toneladas_estimadas?: string;
  ley_esperada?: string;
  capital_disponible?: string;
  estudio_previo?: string;
  historial_operacion?: string;
  pasivos_ambientales?: string;
  experiencia_titular?: string;
  background_titular?: string;
  equipo_tecnico?: string;
  tipo_socio_buscado?: string;
  siguiente_hito?: string;
  timeline_operacion?: string;
  motivo_inicio?: string;

  // Compartidos por ambas rutas
  documento_autorizacion?: string;
  tipo_apoyo_json?: string[];
  tipo_apoyo?: string;
  acceso_agua?: string;
  acceso_energia?: string;
  conflictividad_social?: string;
  estructura_propiedad?: string;
  monto_requerido?: string;
  plazo_capital?: string;
  motivo_capital?: string;
  produccion_objetivo?: string;
  uso_fondos_diagnostico?: string;
}

export interface Dimension {
  puntaje: number;
  maximo: number;
}

export type NombreDimension =
  | "legal"
  | "ambiental"
  | "operativo"
  | "tecnico"
  | "seguridad"
  | "social";

export interface DiagnosticoResponse {
  id: string;
  score_total: number;
  // Partial: concesionario (Ruta 2) solo trae "legal" y "tecnico", nunca
  // las 5 dimensiones — ver DimensionBars.tsx (filtra por las presentes).
  dimensiones: Partial<Record<NombreDimension, Dimension>>;
  bloqueado: boolean;
  brechas: string[];
  situacion: Situacion;
}

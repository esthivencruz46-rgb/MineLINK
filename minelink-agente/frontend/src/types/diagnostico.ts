export type IdPregunta =
  | "L1" | "L2" | "L3" | "L4" | "L5" | "L6"
  | "A1" | "A2" | "A3"
  | "O1"
  | "T1" | "T2" | "T3" | "T4" | "T5" | "T6"
  | "S1" | "S2" | "S3" | "S4" | "S5";

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
  tiene_resultados_laboratorio?: boolean;

  // Perfil de la concesión (Ruta 2) — informativo, nunca puntúa
  concesion_vigente?: boolean;
  tipo_deposito?: string;
  etapa_proyecto?: string;
  trabajos_exploracion_json?: string[];
  info_geologica_disponible?: boolean;
  tiene_estimaciones_leyes?: boolean;

  // Compartidos por ambas rutas
  documento_autorizacion?: string;
  tipo_apoyo_json?: string[];
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
  | "seguridad";

export interface DiagnosticoResponse {
  id: string;
  score_total: number;
  dimensiones: Record<NombreDimension, Dimension>;
  bloqueado: boolean;
  brechas: string[];
}

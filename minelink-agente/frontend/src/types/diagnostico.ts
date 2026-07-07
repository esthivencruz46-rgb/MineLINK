export type IdPregunta =
  | "L1" | "L2" | "L3" | "L4" | "L5"
  | "A1" | "A2" | "A3"
  | "O1"
  | "T1" | "T2" | "T3" | "T4" | "T5" | "T6"
  | "S1" | "S2" | "S3" | "S4" | "S5";

// Record<string, ...> y no Record<IdPregunta, ...>: S5 es condicional
// (solo minería subterránea), así que el set de ids varía según tipo_mina.
export type Respuestas = Record<string, boolean>;

export type TipoMina = "subterranea" | "tajo_abierto";

export interface DiagnosticoRequest {
  respuestas: Respuestas;
  region: string;
  mineral: string;
  tipo_mina: TipoMina;
  nombre_minero?: string;
  codigo_reinfo?: string;
  produccion_mensual?: string;
  maquinaria?: string;
  num_trabajadores?: string;
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

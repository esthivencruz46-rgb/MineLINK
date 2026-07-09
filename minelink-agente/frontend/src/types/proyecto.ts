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
  brechas_pendientes: string[];
  brechas_resueltas: string[];
  dimensiones: Record<string, DimensionScore> | null;
  // Desglose del score_inversion: formalizacion, escala_economica,
  // viabilidad_tecnica, riesgo_ambiental_social, capacidad_equipo,
  // claridad_oportunidad.
  dimensiones_inversion: Record<string, DimensionScore>;
  ubicacion_maps?: string | null;
  ubicacion_coords?: string | null;
  descripcion_generada?: string | null;
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

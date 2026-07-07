export interface ProyectoPublico {
  operacion_id: string;
  nombre_proyecto: string;
  region: string;
  mineral: string;
  tipo_mina: string;
  score_actual: number;
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
  brechas_pendientes: string[];
  brechas_resueltas: string[];
  dimensiones: Record<string, DimensionScore> | null;
  ubicacion_maps?: string | null;
  ubicacion_coords?: string | null;
  descripcion_generada?: string | null;
}

export interface InteresInversionRequest {
  nombre: string;
  username: string;
  password: string;
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

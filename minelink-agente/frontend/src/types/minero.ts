export interface MineroPerfil {
  nombre: string;
  whatsapp: string;
  email?: string | null;
  nombre_operacion?: string | null;
  region: string;
  mineral: string;
  tipo_mina: string;
  codigo_reinfo?: string | null;
  created_at: string;
  score_total: number;
  bloqueado: boolean;
  brechas: string[];
  brechas_resueltas: string[];
  brechas_pendientes: string[];
  score_actual: number;
  bloqueado_actual: boolean;
  descripcion_operacion?: string | null;
  capacidad_produccion?: string | null;
  capital_buscado?: string | null;
  uso_fondos?: string | null;
  ubicacion_maps?: string | null;
  estado_contacto: string;
}

export interface PerfilInversionRequest {
  descripcion_operacion?: string;
  capacidad_produccion?: string;
  capital_buscado?: string;
  uso_fondos?: string;
  ubicacion_maps?: string;
}

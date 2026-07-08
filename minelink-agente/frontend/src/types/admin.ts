export interface LeadConDiagnostico {
  id: number;
  operacion_id: string;
  nombre: string;
  whatsapp: string;
  email?: string | null;
  nombre_operacion?: string | null;
  region: string;
  codigo_reinfo?: string | null;
  created_at: string;
  // Declaración original del minero — inmutable
  score_total: number;
  bloqueado: boolean;
  brechas: string[];
  // Seguimiento del admin (no edita lo de arriba)
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
  situacion: string;
  // Perfil de la operación (Ruta 1) / concesión (Ruta 2) — informativo
  estado_operacion?: string | null;
  tipo_explotacion?: string | null;
  material_comercializado?: string | null;
  forma_comercializacion?: string | null;
  tiempo_operacion?: string | null;
  ley_promedio?: string | null;
  ley_como_obtenida?: string | null;
  tiene_resultados_laboratorio?: boolean | null;
  concesion_vigente?: boolean | null;
  tipo_deposito?: string | null;
  etapa_proyecto?: string | null;
  trabajos_exploracion_json?: string[] | null;
  info_geologica_disponible?: boolean | null;
  tiene_estimaciones_leyes?: boolean | null;
  documento_autorizacion?: string | null;
  tipo_apoyo_json?: string[] | null;
}

export interface TopBrecha {
  estudio: string;
  conteo: number;
}

export interface UltimoLead {
  nombre: string;
  region: string;
  score_total: number;
  created_at: string;
}

export interface DashboardOut {
  diagnosticos_hoy: number;
  diagnosticos_total: number;
  leads_hoy: number;
  leads_total: number;
  score_promedio: number;
  top_brechas: TopBrecha[];
  ultimos_leads: UltimoLead[];
  diagnosticos_iniciados: number;
}

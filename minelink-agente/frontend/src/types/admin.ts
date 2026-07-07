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
}

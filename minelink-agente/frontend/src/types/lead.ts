export interface LeadRequest {
  nombre: string;
  whatsapp: string;
  operacion_id: string;
  username: string;
  password: string;
  pregunta_seguridad: string;
  respuesta_seguridad: string;
  email?: string;
  nombre_operacion?: string;
  codigo_reinfo?: string;
}

export interface LeadResponse {
  id: number;
  operacion_id: string;
  nombre: string;
  whatsapp: string;
  email?: string | null;
  nombre_operacion?: string | null;
  region: string;
  codigo_reinfo?: string | null;
  created_at: string;
}

export type TipoProveedor = "empresa" | "consultor";

export interface Empresa {
  id: number;
  tipo: TipoProveedor;
  nombre: string;
  ruc?: string | null;
  colegiatura?: string | null;
  cv_filename?: string | null;
  anios_servicio: number;
  regiones_json: string[];
  estudios_json: string[];
  whatsapp: string;
  email?: string | null;
  activa: boolean;
  created_at: string;
}

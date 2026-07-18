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
  // Solo se muestran en el panel admin por ahora; internamente ordenan
  // los listados públicos de mejor a peor
  rating?: number | null;
  num_resenas?: number | null;
  // Contexto de la base externa de profesionales (scraping de Google
  // Maps, julio 2026) — solo visible en el admin, ayuda a evaluar la
  // empresa antes de activarla.
  web?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  categoria?: string | null;
  keyword?: string | null;
}

/** Lo que ve el minero en /empresas — sin whatsapp ni email. El contacto
 * directo se reemplazó por "Me interesa" (ver services/api.ts,
 * enviarInteresEmpresa): Esthiven intermedia desde /admin. */
export interface EmpresaPublica {
  id: number;
  tipo: TipoProveedor;
  nombre: string;
  ruc?: string | null;
  colegiatura?: string | null;
  anios_servicio: number;
  regiones_json: string[];
  estudios_json: string[];
  activa: boolean;
  created_at: string;
  // No se muestra en la UI, solo ordena internamente los bloques
  rating?: number | null;
  num_resenas?: number | null;
}

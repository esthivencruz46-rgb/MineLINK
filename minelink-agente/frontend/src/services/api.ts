import type { DiagnosticoRequest, DiagnosticoResponse } from "../types/diagnostico";
import type { Empresa, EmpresaPublica } from "../types/empresa";
import type { LeadRequest, LeadResponse } from "../types/lead";
import type {
  InteresInversionRequest,
  ProyectoDetalle,
  ProyectoPublico,
} from "../types/proyecto";
import { BASE_URL } from "../config/apiUrl";

export { BASE_URL };

// DEMO: empresas de ejemplo si el backend no responde, marcadas
// visualmente en EmpresaCard para no hacerlas pasar por reales.
const EMPRESAS_DEMO: EmpresaPublica[] = [
  {
    id: -1,
    tipo: "empresa",
    nombre: "Consultora Andina de Formalización (DEMO)",
    ruc: "20100000001",
    colegiatura: null,
    anios_servicio: 8,
    regiones_json: ["arequipa", "puno", "ayacucho", "la libertad", "madre de dios"],
    estudios_json: [
      "tramite_reinfo",
      "levantamiento_georreferenciado",
      "igafom_aprobado",
      "informe_geologico",
    ],
    activa: true,
    created_at: new Date().toISOString(),
  },
  {
    id: -2,
    tipo: "consultor",
    nombre: "Ing. Ejemplo Demo (DEMO)",
    ruc: null,
    colegiatura: "000000",
    anios_servicio: 5,
    regiones_json: ["arequipa", "puno"],
    estudios_json: ["plan_seguridad", "evaluacion_geomecanica", "sctr"],
    activa: true,
    created_at: new Date().toISOString(),
  },
];

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const detalle = await resp.text();
    throw new Error(`${resp.status}: ${detalle}`);
  }
  return resp.json() as Promise<T>;
}

export async function enviarDiagnostico(
  payload: DiagnosticoRequest
): Promise<DiagnosticoResponse> {
  return postJSON<DiagnosticoResponse>("/diagnostico", payload);
}

export async function obtenerEmpresas(
  estudios: string[],
  region: string
): Promise<{ empresas: EmpresaPublica[]; demo: boolean }> {
  const params = new URLSearchParams();
  if (estudios.length > 0) params.set("estudios", estudios.join(","));
  if (region) params.set("region", region);

  try {
    const resp = await fetch(`${BASE_URL}/empresas?${params.toString()}`);
    if (!resp.ok) throw new Error(`${resp.status}`);
    const empresas = (await resp.json()) as EmpresaPublica[];
    return { empresas, demo: false };
  } catch {
    // DEMO: backend caído, se muestran empresas de ejemplo
    return { empresas: EMPRESAS_DEMO, demo: true };
  }
}

export interface InteresEmpresaRequest {
  operacion_id: string;
  nombre: string;
  whatsapp: string;
  brecha?: string;
  mensaje?: string;
}

/** Reemplaza el link directo a WhatsApp: el minero deja su contacto para
 * ESTA empresa/consultor y Esthiven intermedia desde /admin. */
export async function enviarInteresEmpresa(
  empresaId: number,
  payload: InteresEmpresaRequest
): Promise<void> {
  await postJSON(`/empresas/${empresaId}/interes`, payload);
}

export async function enviarLead(payload: LeadRequest): Promise<LeadResponse> {
  return postJSON<LeadResponse>("/leads", payload);
}

export interface FiltrosProyectos {
  mineral?: string;
  region?: string;
  /** Rango del Score de Atractivo de Inversión (0-100). */
  scoreMin?: number;
  scoreMax?: number;
  /** Solo lista proyectos por debajo del promedio en esa dimensión — ver
   * NombreDimensionInversion en types/proyecto.ts. */
  dimensionDebil?: string;
}

export async function obtenerProyectos(filtros: FiltrosProyectos): Promise<ProyectoPublico[]> {
  const params = new URLSearchParams();
  if (filtros.mineral) params.set("mineral", filtros.mineral);
  if (filtros.region) params.set("region", filtros.region);
  if (filtros.scoreMin !== undefined) params.set("score_min", String(filtros.scoreMin));
  if (filtros.scoreMax !== undefined) params.set("score_max", String(filtros.scoreMax));
  if (filtros.dimensionDebil) params.set("dimension_debil", filtros.dimensionDebil);

  const resp = await fetch(`${BASE_URL}/proyectos?${params.toString()}`);
  if (!resp.ok) throw new Error(`${resp.status}`);
  return resp.json() as Promise<ProyectoPublico[]>;
}

export async function obtenerMineralesDisponibles(): Promise<string[]> {
  const resp = await fetch(`${BASE_URL}/proyectos/minerales`);
  if (!resp.ok) throw new Error(`${resp.status}`);
  return resp.json() as Promise<string[]>;
}

export async function obtenerProyecto(operacionId: string): Promise<ProyectoDetalle> {
  const resp = await fetch(`${BASE_URL}/proyectos/${operacionId}`);
  if (!resp.ok) throw new Error(`${resp.status}`);
  return resp.json() as Promise<ProyectoDetalle>;
}

export async function registrarInteresInversion(
  operacionId: string,
  payload: InteresInversionRequest
): Promise<void> {
  const resp = await fetch(`${BASE_URL}/proyectos/${operacionId}/interes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const detalle = await resp.text();
    throw new Error(`${resp.status}: ${detalle}`);
  }
}

export interface PostulacionConsultor {
  nombre: string;
  colegiatura: string;
  regiones_json: string[];
  estudios_json: string[];
  whatsapp: string;
  email: string;
  cv: File;
}

export async function postularConsultor(payload: PostulacionConsultor): Promise<Empresa> {
  const form = new FormData();
  form.set("nombre", payload.nombre);
  form.set("colegiatura", payload.colegiatura);
  form.set("whatsapp", payload.whatsapp);
  form.set("email", payload.email);
  form.set("regiones_json", JSON.stringify(payload.regiones_json));
  form.set("estudios_json", JSON.stringify(payload.estudios_json));
  form.set("cv", payload.cv);

  const resp = await fetch(`${BASE_URL}/consultores/postular`, {
    method: "POST",
    body: form,
  });
  if (!resp.ok) {
    const detalle = await resp.text();
    throw new Error(`${resp.status}: ${detalle}`);
  }
  return resp.json() as Promise<Empresa>;
}

/** Evento anónimo de uso para las métricas del embudo del admin.
 * Fire-and-forget: si falla, no debe romper la experiencia del usuario. */
export function registrarEvento(tipo: "diagnostico_iniciado" | "sin_ruta_mostrado"): void {
  fetch(`${BASE_URL}/eventos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo }),
  }).catch(() => {});
}

import type { DiagnosticoResponse, Respuestas, Situacion } from "../types/diagnostico";

// sessionStorage (NUNCA localStorage): el diagnóstico se borra al cerrar
// la pestaña, no es un dato que deba persistir entre sesiones.
const CLAVE = "minelink_diagnostico";

/** Snapshot del wizard justo antes de enviar el diagnóstico — permite que
 * "Volver" desde /resultado regrese a la última pregunta respondida en vez
 * de reiniciar todo el cuestionario (ver Cuestionario.tsx `terminar`). */
export interface EstadoWizard {
  situacion: Situacion;
  perfil: Record<string, unknown>;
  respuestas: Respuestas;
  informativas: Record<string, string | undefined>;
  paso: number;
}

export interface DiagnosticoGuardado {
  respuesta: DiagnosticoResponse;
  region: string;
  codigoReinfo?: string;
  estadoWizard?: EstadoWizard;
}

export function guardarDiagnostico(data: DiagnosticoGuardado): void {
  sessionStorage.setItem(CLAVE, JSON.stringify(data));
}

export function leerDiagnostico(): DiagnosticoGuardado | null {
  const crudo = sessionStorage.getItem(CLAVE);
  if (!crudo) return null;
  try {
    return JSON.parse(crudo) as DiagnosticoGuardado;
  } catch {
    return null;
  }
}

export function limpiarDiagnostico(): void {
  sessionStorage.removeItem(CLAVE);
}

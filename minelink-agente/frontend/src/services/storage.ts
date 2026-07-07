import type { DiagnosticoResponse } from "../types/diagnostico";

// sessionStorage (NUNCA localStorage): el diagnóstico se borra al cerrar
// la pestaña, no es un dato que deba persistir entre sesiones.
const CLAVE = "minelink_diagnostico";

export interface DiagnosticoGuardado {
  respuesta: DiagnosticoResponse;
  region: string;
  codigoReinfo?: string;
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

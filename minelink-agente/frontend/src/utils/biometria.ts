/** Almacenamiento en localStorage para el login biométrico opcional de la
 * app móvil (agosto 2026). Módulo neutral (no importa nada de React ni de
 * los contextos de auth) para que tanto los contextos como los
 * componentes de biometría puedan usarlo sin import circular.
 *
 * Dos cosas separadas, a propósito:
 * - `biometriaActivada()`: el interruptor general (¿el usuario quiere
 *   usar huella en esta app?).
 * - `tokenBiometricoGuardado(rol)`: el JWT que la huella puede "traer de
 *   vuelta" — vive en su PROPIA clave, distinta de la del token activo
 *   (`minelink_token_minero`/`_inversionista` en los AuthContext). Pedido
 *   explícito de Esthiven tras probarlo: cerrar sesión no debe borrar la
 *   huella guardada, si no, no queda ninguna forma de volver a entrar CON
 *   la huella después de un logout a propósito — la gracia es que
 *   funcione como una forma de login en sí misma, no solo como un
 *   candado sobre una sesión que ya sigue abierta. */
export type RolBiometria = "minero" | "inversionista";

const CLAVE_ACTIVADA = "minelink_biometria_activada";

const CLAVE_TOKEN: Record<RolBiometria, string> = {
  minero: "minelink_biometria_token_minero",
  inversionista: "minelink_biometria_token_inversionista",
};

export function biometriaActivada(): boolean {
  return localStorage.getItem(CLAVE_ACTIVADA) === "1";
}

export function setBiometriaActivada(activa: boolean): void {
  if (activa) localStorage.setItem(CLAVE_ACTIVADA, "1");
  else localStorage.removeItem(CLAVE_ACTIVADA);
}

export function tokenBiometricoGuardado(rol: RolBiometria): string | null {
  return localStorage.getItem(CLAVE_TOKEN[rol]);
}

export function guardarTokenBiometrico(rol: RolBiometria, token: string): void {
  localStorage.setItem(CLAVE_TOKEN[rol], token);
}

export function borrarTokenBiometrico(rol: RolBiometria): void {
  localStorage.removeItem(CLAVE_TOKEN[rol]);
}

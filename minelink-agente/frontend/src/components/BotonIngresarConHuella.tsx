import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { Fingerprint } from "lucide-react";
import { MARCA } from "../config/marca";
import { biometriaActivada, tokenBiometricoGuardado, type RolBiometria } from "../utils/biometria";

/** Botón "Ingresar con huella" en las pantallas de login (agosto 2026,
 * pedido explícito de Esthiven: la huella tiene que servir como una
 * FORMA DE ENTRAR en sí misma, no solo un candado sobre una sesión que
 * ya estaba abierta -- probado en un celular real: cerrar sesión no
 * dejaba ningún botón para volver a entrar con la huella). Solo aparece
 * si: es la app nativa, el usuario activó la huella alguna vez desde su
 * cuenta (ToggleBiometria.tsx), y hay un token guardado para este rol
 * (sobrevive al logout, ver utils/biometria.ts). Si no se cumple alguna
 * de esas tres, no se renderiza nada -- el formulario de usuario y
 * contraseña de abajo sigue siendo el único camino, como siempre. */
export function BotonIngresarConHuella({
  rol,
  onIngresar,
}: {
  rol: RolBiometria;
  onIngresar: (token: string) => void;
}) {
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenGuardado = Capacitor.isNativePlatform() && biometriaActivada()
    ? tokenBiometricoGuardado(rol)
    : null;
  if (!tokenGuardado) return null;

  async function ingresar() {
    setError(null);
    setVerificando(true);
    try {
      await BiometricAuth.authenticate({
        reason: `Confirma tu huella para entrar a tu cuenta de ${MARCA}`,
        cancelTitle: "Cancelar",
        androidTitle: "Ingresar con huella",
        allowDeviceCredential: true,
      });
      onIngresar(tokenGuardado as string);
    } catch {
      setError("No se pudo confirmar tu huella. Usa tu usuario y contraseña.");
    } finally {
      setVerificando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={ingresar}
        disabled={verificando}
        className="flex min-h-[44px] items-center justify-center gap-2 border border-acento/30 font-semibold text-acento transition hover:bg-acento/5 disabled:pointer-events-none disabled:opacity-50"
      >
        <Fingerprint size={18} strokeWidth={2} aria-hidden />
        {verificando ? "Verificando..." : "Ingresar con huella"}
      </button>
      {error && <p className="text-center text-xs text-red-500">{error}</p>}
      <div className="flex items-center gap-2 text-xs text-texto-suave dark:text-texto-suave-dark">
        <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        o con tu usuario y contraseña
        <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      </div>
    </div>
  );
}

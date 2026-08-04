import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { Fingerprint } from "lucide-react";
import { MARCA } from "../config/marca";
import {
  biometriaActivada,
  borrarTokenBiometrico,
  guardarTokenBiometrico,
  setBiometriaActivada,
  type RolBiometria,
} from "../utils/biometria";

/** Toggle OPCIONAL para pedir huella/Face ID al retomar la app (agosto
 * 2026, corrección tras probar en un celular real: la primera versión la
 * pedía siempre, sin forma de desactivarla, y atrapaba al usuario en un
 * loop). Apagado por defecto — el usuario decide prenderlo. Solo aparece
 * en la app nativa; en la web no se renderiza nada.
 *
 * Al activarla, pide confirmar la huella AL TOQUE ("Guardar huella" —
 * pedido explícito de Esthiven: quiere ver ese cuadro de confirmación
 * apenas tilda la opción, no recién la próxima vez que abra la app) y
 * GUARDA el token actual bajo su propia clave, separada de la del token
 * de sesión activo -- esto es lo que le permite a `BotonIngresarConHuella`
 * volver a entrar CON la huella incluso después de un "Cerrar sesión" a
 * propósito (probado en un celular real: sin esto, cerrar sesión dejaba
 * sin ninguna forma de volver a entrar por huella, solo servía como
 * candado de una sesión que ya seguía abierta). Si cancela o falla la
 * huella, el interruptor NO queda activado. */
export function ToggleBiometria({
  rol,
  token,
}: {
  rol: RolBiometria;
  token: string | null;
}) {
  const [activa, setActiva] = useState(biometriaActivada);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!Capacitor.isNativePlatform()) return null;

  async function alternar() {
    setError(null);
    if (activa) {
      setBiometriaActivada(false);
      borrarTokenBiometrico(rol);
      setActiva(false);
      return;
    }
    if (!token) return;
    setGuardando(true);
    try {
      await BiometricAuth.authenticate({
        reason: `Guarda tu huella para entrar más rápido a tu cuenta de ${MARCA}`,
        cancelTitle: "Cancelar",
        androidTitle: "Guardar huella",
        allowDeviceCredential: true,
      });
      setBiometriaActivada(true);
      guardarTokenBiometrico(rol, token);
      setActiva(true);
    } catch {
      setError("No se pudo guardar tu huella. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="border border-black/10 bg-tarjeta dark:border-white/10 dark:bg-tarjeta-dark">
      <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm">
        <span className="flex items-center gap-2">
          <Fingerprint size={16} strokeWidth={1.75} className="text-acento" aria-hidden />
          Pedir huella o Face ID al abrir la app
        </span>
        <input
          type="checkbox"
          checked={activa}
          onChange={alternar}
          disabled={guardando}
          className="h-5 w-5 accent-acento"
        />
      </label>
      {guardando && (
        <p className="px-4 pb-3 text-xs text-texto-suave dark:text-texto-suave-dark">
          Confirmá tu huella en el cuadro que apareció...
        </p>
      )}
      {error && <p className="px-4 pb-3 text-xs text-red-500">{error}</p>}
    </div>
  );
}

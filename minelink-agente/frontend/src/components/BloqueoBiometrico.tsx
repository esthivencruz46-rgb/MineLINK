import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import type { PluginListenerHandle } from "@capacitor/core";
import { Fingerprint } from "lucide-react";
import { MARCA } from "../config/marca";
import { useMineroAuth } from "../context/MineroAuthContext";
import { useInversionistaAuth } from "../context/InversionistaAuthContext";

/** Bloqueo con huella/Face ID al abrir o retomar la app nativa de Android
 * (agosto 2026, pedido explícito de Esthiven: la sesión web se mantiene
 * abierta "como en eToro", pero en la app móvil sí quiere una huella de
 * por medio -- el celular puede perderse o prestarse, la sesión web no se
 * mueve de la computadora del dueño). Reglas duras:
 * - NUNCA se activa en la web (`Capacitor.isNativePlatform()` es false
 *   ahí) -- la sesión persistida ya alcanza en desktop/navegador.
 * - Solo bloquea si HAY una sesión abierta (minero o inversionista) --
 *   no tiene sentido pedir huella para mirar la cartera pública.
 * - Si el celular no tiene biometría configurada (`isAvailable: false`),
 *   NO bloquea nada -- mismo comportamiento que la web, sin capa extra.
 *   No tiene sentido dejar a alguien afuera de su propia cuenta porque
 *   nunca configuró huella en el teléfono.
 * - "Cerrar sesión" es la salida de emergencia si la huella falla o el
 *   dueño del teléfono cambió -- cierra AMBAS sesiones (minero e
 *   inversionista) y deja re-loguearse con contraseña normal. */
export function BloqueoBiometrico() {
  const minero = useMineroAuth();
  const inversionista = useInversionistaAuth();
  const haySesion = Boolean(minero.token || inversionista.token);

  const [bloqueado, setBloqueado] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !haySesion) return;

    let cancelado = false;
    let handle: PluginListenerHandle | undefined;

    (async () => {
      // checkBiometry() debe llamarse al menos una vez antes de poder
      // registrar addResumeListener (lo exige la propia librería).
      const info = await BiometricAuth.checkBiometry().catch(() => null);
      if (cancelado || !info?.isAvailable) return;
      setBloqueado(true); // bloquea también en frío, al recién abrir la app
      handle = await BiometricAuth.addResumeListener((infoAlRetomar) => {
        if (infoAlRetomar.isAvailable) setBloqueado(true);
      });
    })();

    return () => {
      cancelado = true;
      handle?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [haySesion]);

  async function verificar() {
    setVerificando(true);
    setError(null);
    try {
      await BiometricAuth.authenticate({
        reason: `Confirma tu identidad para entrar a tu cuenta de ${MARCA}`,
        cancelTitle: "Cancelar",
        androidTitle: `Ingresar a ${MARCA}`,
        allowDeviceCredential: true,
      });
      setBloqueado(false);
    } catch {
      setError("No se pudo confirmar tu identidad. Intenta de nuevo.");
    } finally {
      setVerificando(false);
    }
  }

  function cerrarSesion() {
    minero.logout();
    inversionista.logout();
    setBloqueado(false);
  }

  if (!bloqueado) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-fondo p-6 text-center dark:bg-fondo-dark">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-acento/10 text-acento">
        <Fingerprint size={30} strokeWidth={1.75} aria-hidden />
      </span>
      <div>
        <p className="font-semibold">Confirma tu identidad</p>
        <p className="mt-1 max-w-xs text-sm text-texto-suave dark:text-texto-suave-dark">
          Tu sesión de {MARCA} sigue abierta — verificala con tu huella o Face ID para continuar.
        </p>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        onClick={verificar}
        disabled={verificando}
        className="min-h-[44px] bg-acento px-6 font-semibold text-white transition hover:bg-acento/90 disabled:pointer-events-none disabled:opacity-50"
      >
        {verificando ? "Verificando..." : "Verificar identidad"}
      </button>
      <button
        onClick={cerrarSesion}
        className="text-sm font-medium text-texto-suave underline dark:text-texto-suave-dark"
      >
        Cerrar sesión
      </button>
    </div>
  );
}

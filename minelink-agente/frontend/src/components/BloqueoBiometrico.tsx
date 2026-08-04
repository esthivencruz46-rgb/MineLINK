import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import type { PluginListenerHandle } from "@capacitor/core";
import { Fingerprint } from "lucide-react";
import { MARCA } from "../config/marca";
import { useMineroAuth } from "../context/MineroAuthContext";
import { useInversionistaAuth } from "../context/InversionistaAuthContext";

const CLAVE_ACTIVADA = "minelink_biometria_activada";

/** OPCIONAL, apagado por defecto (agosto 2026, corrección tras probar en
 * un celular real: "debiendo lo de la huella ser opcional no una
 * obligación"). El usuario la prende desde su cuenta — ver
 * ToggleBiometria.tsx. */
export function biometriaActivada(): boolean {
  return localStorage.getItem(CLAVE_ACTIVADA) === "1";
}

export function setBiometriaActivada(activa: boolean): void {
  if (activa) localStorage.setItem(CLAVE_ACTIVADA, "1");
  else localStorage.removeItem(CLAVE_ACTIVADA);
}

/** Bloqueo con huella/Face ID al retomar la app nativa de Android (agosto
 * 2026, pedido explícito de Esthiven: la sesión web se mantiene abierta
 * "como en eToro", pero en la app móvil quiere una huella de por medio --
 * el celular puede perderse o prestarse, la sesión web no se mueve de la
 * computadora del dueño). Reglas duras:
 * - NUNCA se activa en la web, y NUNCA si el usuario no lo prendió a
 *   propósito desde su cuenta (`biometriaActivada()`) -- probado en un
 *   celular real y corregido: pedirla siempre, sin poder desactivarla,
 *   resultaba en quedar atrapado sin forma de entrar salvo cerrando sesión.
 * - Solo bloquea si HAY una sesión abierta (minero o inversionista).
 * - Si el celular no tiene biometría configurada, NO bloquea nada --
 *   no tiene sentido dejar a alguien afuera de su cuenta por eso.
 * - Si la sesión YA estaba abierta al recién abrir la app (volviendo de
 *   haber cerrado el proceso), se pide huella de entrada. Si la sesión
 *   se acaba de crear en este mismo arranque (recién puso su contraseña),
 *   NO se le pide huella también -- sería pedir dos verificaciones
 *   seguidas por lo mismo.
 * - "Cerrar sesión" es la salida de emergencia si la huella falla.
 *
 * Bug real encontrado al probar en un celular real (agosto 2026): el
 * propio diálogo nativo de huella, al cerrarse, puede disparar un evento
 * de "app retomada" -- sin el `autenticandoRef` de abajo, ese evento
 * volvía a poner `bloqueado=true` una fracción de segundo después de
 * desbloquear, atrapando al usuario en un loop ("pongo mi huella y no
 * sale nada"). */
export function BloqueoBiometrico() {
  const minero = useMineroAuth();
  const inversionista = useInversionistaAuth();
  const haySesion = Boolean(minero.token || inversionista.token);

  const [bloqueado, setBloqueado] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autenticandoRef = useRef(false);
  const yaHabiaSesionAlMontar = useRef(haySesion);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !biometriaActivada() || !haySesion) return;

    let cancelado = false;
    let handle: PluginListenerHandle | undefined;

    (async () => {
      // checkBiometry() debe llamarse al menos una vez antes de poder
      // registrar addResumeListener (lo exige la propia librería).
      const info = await BiometricAuth.checkBiometry().catch(() => null);
      if (cancelado || !info?.isAvailable) return;
      if (yaHabiaSesionAlMontar.current) setBloqueado(true);
      handle = await BiometricAuth.addResumeListener((infoAlRetomar) => {
        // Ignora el "resume" que puede disparar el propio diálogo nativo
        // de huella al cerrarse -- ver nota del loop arriba.
        if (autenticandoRef.current) return;
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
    autenticandoRef.current = true;
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
      // Margen antes de volver a escuchar "resume": el cierre del diálogo
      // nativo puede disparar ese evento un instante después de que esta
      // promesa ya resolvió.
      setTimeout(() => {
        autenticandoRef.current = false;
      }, 800);
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

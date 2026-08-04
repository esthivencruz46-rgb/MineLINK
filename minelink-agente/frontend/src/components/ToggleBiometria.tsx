import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Fingerprint } from "lucide-react";
import { biometriaActivada, setBiometriaActivada } from "./BloqueoBiometrico";

/** Toggle OPCIONAL para pedir huella/Face ID al retomar la app (agosto
 * 2026, corrección tras probar en un celular real: la primera versión la
 * pedía siempre, sin forma de desactivarla, y atrapaba al usuario en un
 * loop). Apagado por defecto — el usuario decide prenderlo. Solo aparece
 * en la app nativa; en la web no se renderiza nada. */
export function ToggleBiometria() {
  const [activa, setActiva] = useState(biometriaActivada);

  if (!Capacitor.isNativePlatform()) return null;

  function alternar() {
    const nuevo = !activa;
    setBiometriaActivada(nuevo);
    setActiva(nuevo);
  }

  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 border border-black/10 bg-tarjeta px-4 py-3 text-sm dark:border-white/10 dark:bg-tarjeta-dark">
      <span className="flex items-center gap-2">
        <Fingerprint size={16} strokeWidth={1.75} className="text-acento" aria-hidden />
        Pedir huella o Face ID al abrir la app
      </span>
      <input type="checkbox" checked={activa} onChange={alternar} className="h-5 w-5 accent-acento" />
    </label>
  );
}

import { useEffect, useRef, useState } from "react";
import { useMineroAuth } from "../context/MineroAuthContext";
import type { MineroPerfil } from "../types/minero";

interface Props {
  perfil: MineroPerfil;
  onGuardado: (perfil: MineroPerfil) => void;
}

function esEnlaceMaps(valor: string): boolean {
  const v = valor.trim();
  if (!v.startsWith("http://") && !v.startsWith("https://")) return false;
  return (
    v.includes("google.com/maps") ||
    v.includes("maps.google.") ||
    v.includes("maps.app.goo.gl") ||
    v.includes("goo.gl/maps")
  );
}

/** Ubicación de la mina para inversionistas — es lo único que quedó de
 * este formulario (julio 2026): capital buscado y producción/reservas se
 * editan ahora junto a la respuesta correspondiente en "Tu perfil de
 * inversión" (ResumenInversionRespuestas.tsx), "para qué buscas el
 * dinero" ya se pregunta en el Módulo INV y la descripción de la
 * operación se genera sola con los datos reales (ver Resumen Ejecutivo en
 * ProyectoDetalle.tsx). */
export function PerfilInversionForm({ perfil, onGuardado }: Props) {
  const { authFetch } = useMineroAuth();
  const [ubicacionMaps, setUbicacionMaps] = useState(perfil.ubicacion_maps ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const mapsInvalido = ubicacionMaps.trim().length > 0 && !esEnlaceMaps(ubicacionMaps);

  /** Guardado automático (sin botón, julio 2026): en cuanto el enlace
   *  pegado es un Google Maps válido, se guarda solo tras una pausa
   *  corta — igual que el resto de campos de la cuenta. */
  function onCambiar(valor: string) {
    setUbicacionMaps(valor);
    setGuardadoOk(false);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!valor.trim() || !esEnlaceMaps(valor)) return;
    debounceRef.current = setTimeout(async () => {
      try {
        const resp = await authFetch("/mineros/perfil-inversion", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ubicacion_maps: valor.trim() }),
        });
        if (!resp.ok) throw new Error();
        onGuardado(await resp.json());
        setGuardadoOk(true);
      } catch {
        setError("No pudimos guardar la ubicación. Intenta de nuevo.");
      }
    }, 800);
  }

  return (
    <div className="rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Ubicación de tu mina</h2>
        {guardadoOk && <span className="text-xs font-semibold text-emerald-500">Guardado ✓</span>}
      </div>
      <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
        Obligatoria para que tu proyecto se muestre completo en la sección Proyectos.
      </p>

      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium">
          Enlace de Google Maps
          <span className="ml-1 text-red-500">*</span>
        </label>
        <input
          className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 text-sm dark:border-white/10"
          placeholder="Ej: https://maps.app.goo.gl/abc123"
          value={ubicacionMaps}
          onChange={(e) => onCambiar(e.target.value)}
        />
        <p className="mt-1 text-xs text-texto-suave dark:text-texto-suave-dark">
          En la app de Google Maps: mantén presionado el punto de tu mina → Compartir → Copiar
          enlace, y pégalo aquí. Se guarda solo.
        </p>
        {mapsInvalido && (
          <p className="mt-1 text-xs text-red-500">
            Ese enlace no parece de Google Maps. Debe empezar con https:// y venir de
            maps.google.com o maps.app.goo.gl.
          </p>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}

import { useState } from "react";
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
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState(false);

  const mapsInvalido = ubicacionMaps.trim().length > 0 && !esEnlaceMaps(ubicacionMaps);
  const valido = ubicacionMaps.trim().length > 0 && !mapsInvalido;

  async function guardar() {
    setGuardando(true);
    setError(null);
    setGuardadoOk(false);
    try {
      const resp = await authFetch("/mineros/perfil-inversion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ubicacion_maps: ubicacionMaps.trim() || undefined }),
      });
      if (!resp.ok) throw new Error();
      const actualizado = await resp.json();
      onGuardado(actualizado);
      setGuardadoOk(true);
    } catch {
      setError("No pudimos guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
      <h2 className="font-semibold">Ubicación de tu mina</h2>
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
          onChange={(e) => setUbicacionMaps(e.target.value)}
        />
        <p className="mt-1 text-xs text-texto-suave dark:text-texto-suave-dark">
          En la app de Google Maps: mantén presionado el punto de tu mina → Compartir → Copiar
          enlace, y pégalo aquí.
        </p>
        {mapsInvalido && (
          <p className="mt-1 text-xs text-red-500">
            Ese enlace no parece de Google Maps. Debe empezar con https:// y venir de
            maps.google.com o maps.app.goo.gl.
          </p>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {guardadoOk && <p className="mt-2 text-sm text-emerald-500">Guardado.</p>}

      <button
        onClick={guardar}
        disabled={guardando || !valido}
        className="mt-3 min-h-[44px] rounded-lg bg-acento px-6 font-semibold text-white disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}

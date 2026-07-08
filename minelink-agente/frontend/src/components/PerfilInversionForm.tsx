import { useState } from "react";
import { useMineroAuth } from "../context/MineroAuthContext";
import { CampoMonto } from "./CampoMonto";
import type { MineroPerfil } from "../types/minero";

interface Props {
  perfil: MineroPerfil;
  onGuardado: (perfil: MineroPerfil) => void;
  /** Ruta 2 (concesionario) no opera todavía: no tiene producción/reservas
   * que declarar. */
  ocultarCapacidadProduccion?: boolean;
}

type Campo =
  | "descripcion_operacion"
  | "capacidad_produccion"
  | "capital_buscado"
  | "uso_fondos"
  | "ubicacion_maps";

const CAMPOS: {
  campo: Campo;
  etiqueta: string;
  placeholder: string;
  obligatorio: boolean;
  unaLinea?: boolean;
}[] = [
  {
    campo: "ubicacion_maps",
    etiqueta: "Ubicación de tu mina (enlace de Google Maps)",
    placeholder: "Ej: https://maps.app.goo.gl/abc123",
    obligatorio: true,
    unaLinea: true,
  },
  {
    campo: "uso_fondos",
    etiqueta: "¿Para qué buscas el dinero? (motivo)",
    placeholder: "Ej: comprar chancadora, planta de beneficio, capital de trabajo",
    obligatorio: true,
  },
  {
    campo: "capital_buscado",
    etiqueta: "¿Cuánto capital buscas?",
    placeholder: "",
    obligatorio: true,
    unaLinea: true,
  },
  {
    campo: "descripcion_operacion",
    etiqueta: "Cuéntanos sobre tu operación",
    placeholder: "Ej: mina de oro a tajo abierto, 3 años operando, 8 trabajadores...",
    obligatorio: false,
  },
  {
    campo: "capacidad_produccion",
    etiqueta: "¿Cuánto produces y cuánto mineral te queda (reservas)?",
    placeholder: "Ej: 50 toneladas/mes, reservas estimadas para 5 años",
    obligatorio: false,
  },
];

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

export function PerfilInversionForm({ perfil, onGuardado, ocultarCapacidadProduccion }: Props) {
  const { authFetch } = useMineroAuth();
  const [valores, setValores] = useState<Record<Campo, string>>({
    descripcion_operacion: perfil.descripcion_operacion ?? "",
    capacidad_produccion: perfil.capacidad_produccion ?? "",
    capital_buscado: perfil.capital_buscado ?? "",
    uso_fondos: perfil.uso_fondos ?? "",
    ubicacion_maps: perfil.ubicacion_maps ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState(false);

  const campos = ocultarCapacidadProduccion
    ? CAMPOS.filter((c) => c.campo !== "capacidad_produccion")
    : CAMPOS;

  const faltantes = campos.filter(
    (c) => c.obligatorio && !valores[c.campo].trim()
  );
  const mapsInvalido =
    valores.ubicacion_maps.trim().length > 0 && !esEnlaceMaps(valores.ubicacion_maps);
  const valido = faltantes.length === 0 && !mapsInvalido;

  async function guardar() {
    setGuardando(true);
    setError(null);
    setGuardadoOk(false);
    try {
      const resp = await authFetch("/mineros/perfil-inversion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion_operacion: valores.descripcion_operacion.trim() || undefined,
          capacidad_produccion: valores.capacidad_produccion.trim() || undefined,
          capital_buscado: valores.capital_buscado.trim() || undefined,
          uso_fondos: valores.uso_fondos.trim() || undefined,
          ubicacion_maps: valores.ubicacion_maps.trim() || undefined,
        }),
      });
      if (!resp.ok) throw new Error();
      const actualizado = await resp.json();
      onGuardado(actualizado);
      setGuardadoOk(true);
    } catch {
      setError("No pudimos guardar tus respuestas. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
      <h2 className="font-semibold">Perfil para inversionistas</h2>
      <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
        Los campos con <span className="text-red-500">*</span> son obligatorios
        para que tu proyecto se muestre completo a los inversionistas en la
        sección Proyectos.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {campos.map(({ campo, etiqueta, placeholder, obligatorio, unaLinea }) => (
          <div key={campo}>
            <label className="mb-1 block text-sm font-medium">
              {etiqueta}
              {obligatorio && <span className="ml-1 text-red-500">*</span>}
            </label>
            {campo === "capital_buscado" ? (
              <CampoMonto
                value={valores[campo]}
                onChange={(v) => setValores({ ...valores, [campo]: v })}
              />
            ) : unaLinea ? (
              <input
                className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 text-sm dark:border-white/10"
                placeholder={placeholder}
                value={valores[campo]}
                onChange={(e) => setValores({ ...valores, [campo]: e.target.value })}
              />
            ) : (
              <textarea
                className="min-h-[70px] w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10"
                placeholder={placeholder}
                value={valores[campo]}
                onChange={(e) => setValores({ ...valores, [campo]: e.target.value })}
              />
            )}
            {campo === "ubicacion_maps" && (
              <p className="mt-1 text-xs text-texto-suave dark:text-texto-suave-dark">
                En la app de Google Maps: mantén presionado el punto de tu mina →
                Compartir → Copiar enlace, y pégalo aquí.
              </p>
            )}
            {campo === "ubicacion_maps" && mapsInvalido && (
              <p className="mt-1 text-xs text-red-500">
                Ese enlace no parece de Google Maps. Debe empezar con https:// y
                venir de maps.google.com o maps.app.goo.gl.
              </p>
            )}
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {guardadoOk && <p className="mt-2 text-sm text-emerald-500">Guardado.</p>}
      {!valido && faltantes.length > 0 && (
        <p className="mt-2 text-xs text-texto-suave dark:text-texto-suave-dark">
          Te falta completar: {faltantes.map((c) => c.etiqueta.split(" (")[0]).join(", ")}.
        </p>
      )}

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

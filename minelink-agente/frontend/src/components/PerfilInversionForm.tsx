import { useState } from "react";
import { useMineroAuth } from "../context/MineroAuthContext";
import type { MineroPerfil } from "../types/minero";

interface Props {
  perfil: MineroPerfil;
  onGuardado: (perfil: MineroPerfil) => void;
}

const CAMPOS: {
  campo: "descripcion_operacion" | "capacidad_produccion" | "capital_buscado" | "uso_fondos";
  etiqueta: string;
  placeholder: string;
}[] = [
  {
    campo: "descripcion_operacion",
    etiqueta: "Cuéntanos sobre tu operación",
    placeholder: "Ej: mina de oro a tajo abierto, 3 años operando, 8 trabajadores...",
  },
  {
    campo: "capacidad_produccion",
    etiqueta: "¿Cuánto produces y cuánto mineral te queda (reservas)?",
    placeholder: "Ej: 50 toneladas/mes, reservas estimadas para 5 años",
  },
  {
    campo: "capital_buscado",
    etiqueta: "¿Cuánto capital buscas?",
    placeholder: "Ej: USD 80,000",
  },
  {
    campo: "uso_fondos",
    etiqueta: "¿En qué lo usarías?",
    placeholder: "Ej: comprar chancadora, planta de beneficio, capital de trabajo",
  },
];

export function PerfilInversionForm({ perfil, onGuardado }: Props) {
  const { authFetch } = useMineroAuth();
  const [valores, setValores] = useState({
    descripcion_operacion: perfil.descripcion_operacion ?? "",
    capacidad_produccion: perfil.capacidad_produccion ?? "",
    capital_buscado: perfil.capital_buscado ?? "",
    uso_fondos: perfil.uso_fondos ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState(false);

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
        Responde esto cuando quieras — todas son opcionales. Junto con tus
        fotos y documentos, es lo que se les mostrará más adelante a
        inversionistas interesados en operaciones formalizadas.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {CAMPOS.map(({ campo, etiqueta, placeholder }) => (
          <div key={campo}>
            <label className="mb-1 block text-sm font-medium">{etiqueta}</label>
            <textarea
              className="min-h-[70px] w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10"
              placeholder={placeholder}
              value={valores[campo]}
              onChange={(e) => setValores({ ...valores, [campo]: e.target.value })}
            />
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {guardadoOk && <p className="mt-2 text-sm text-emerald-500">Guardado.</p>}

      <button
        onClick={guardar}
        disabled={guardando}
        className="mt-3 min-h-[44px] rounded-lg bg-acento px-6 font-semibold text-white disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}

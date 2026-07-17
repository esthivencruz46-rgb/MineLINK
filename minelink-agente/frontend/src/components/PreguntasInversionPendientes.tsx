import { useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { useMineroAuth } from "../context/MineroAuthContext";
import { POR_ID_INV } from "../data/preguntasInversion";
import type { MineroPerfil } from "../types/minero";

interface Props {
  perfil: MineroPerfil;
  onGuardado: (perfil: MineroPerfil) => void;
}

/** Preguntas del Módulo INV agregadas al catálogo DESPUÉS de que este
 *  minero ya había enviado su cuestionario (ej. INV_C0 "mapeo geológico",
 *  agregado a perfil C en julio 2026) — antes quedaban invisibles para
 *  siempre porque el wizard completo (CuestionarioInversionInline) solo se
 *  muestra si `!perfil.inv_enviado`. Se responden acá, aparte, sin rehacer
 *  todo el cuestionario — ver POST /mineros/inversion/completar. */
export function PreguntasInversionPendientes({ perfil, onGuardado }: Props) {
  const { authFetch } = useMineroAuth();
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Solo tipo "opcion" por ahora (es el único caso real: INV_C0). Si el
  // catálogo agrega una pregunta pendiente de otro tipo (multi_opcion/
  // texto_corto), extender este componente — quedaría invisible igual que
  // antes de este fix si se deja pasar en silencio.
  const pendientes = (perfil.inv_preguntas_pendientes ?? [])
    .map((id) => POR_ID_INV[id])
    .filter((p): p is NonNullable<typeof p> => Boolean(p) && p.tipo === "opcion");

  if (pendientes.length === 0) return null;

  const puedeEnviar = pendientes.every((p) => Boolean(respuestas[p.id]));

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const resp = await authFetch("/mineros/inversion/completar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respuestas }),
      });
      if (!resp.ok) {
        const detalle = await resp.json().catch(() => null);
        throw new Error(detalle?.detail ?? "No pudimos guardar tu respuesta.");
      }
      onGuardado(await resp.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar tu respuesta.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-5">
      <div className="flex items-center gap-2">
        <AlertCircle size={18} strokeWidth={2.25} className="shrink-0 text-amber-500" aria-hidden />
        <h2 className="font-semibold">
          {pendientes.length === 1 ? "Tienes una pregunta nueva" : "Tienes preguntas nuevas"}
        </h2>
      </div>
      <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
        Se agregó{pendientes.length === 1 ? "" : "n"} después de que enviaste tu perfil de
        inversión — respóndela{pendientes.length === 1 ? "" : "s"} para completarlo.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {pendientes.map((pregunta) => (
          <div key={pregunta.id}>
            <p className="text-sm font-medium">{pregunta.texto}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(pregunta.opciones ?? []).map((op) => {
                const seleccionada = respuestas[pregunta.id] === op.valor;
                return (
                  <button
                    key={op.valor}
                    onClick={() =>
                      setRespuestas((r) => ({ ...r, [pregunta.id]: op.valor }))
                    }
                    className={`flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors ${
                      seleccionada
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "border-black/10 hover:bg-acento/10 dark:border-white/10"
                    }`}
                  >
                    {seleccionada && (
                      <Check size={14} strokeWidth={2.5} className="shrink-0" aria-hidden />
                    )}
                    {op.etiqueta}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <button
        onClick={enviar}
        disabled={!puedeEnviar || enviando}
        className="mt-4 min-h-[40px] rounded-lg bg-acento px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {enviando ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}

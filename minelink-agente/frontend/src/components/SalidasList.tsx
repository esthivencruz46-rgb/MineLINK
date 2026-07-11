import { ChevronRight } from "lucide-react";
import { TEXTO_SALIDA } from "../data/salidas";

/** Salidas que en realidad llevan a algún lado (buscar ayuda) — las demás
 *  son solo informativas (alertas, checklists de lectura). */
const CODIGOS_ACCIONABLES = new Set(["completar_tramites_petitorio"]);

/** Tarjetas "¿Qué sigue?" (scoring.salidas_de) — compartidas entre
 *  /resultado y las ventanas de cuenta. */
export function SalidasList({
  salidas,
  onBuscarAyuda,
}: {
  salidas: string[];
  /** Si se pasa, las salidas accionables (ver CODIGOS_ACCIONABLES) se
   *  vuelven clicables y redirigen a donde puedan ayudar. */
  onBuscarAyuda?: () => void;
}) {
  if (salidas.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-lg font-bold">¿Qué sigue?</h3>
      <div className="flex flex-col gap-2">
        {salidas.map((codigo) => {
          const info = TEXTO_SALIDA[codigo];
          const accionable = Boolean(onBuscarAyuda) && CODIGOS_ACCIONABLES.has(codigo);
          return (
            <button
              key={codigo}
              type="button"
              disabled={!accionable}
              onClick={accionable ? onBuscarAyuda : undefined}
              className={`flex w-full items-center justify-between gap-3 rounded-lg bg-tarjeta p-4 text-left dark:bg-tarjeta-dark ${
                accionable ? "active:opacity-90" : "cursor-default"
              }`}
            >
              <div>
                <p className="font-semibold">{info?.titulo ?? codigo}</p>
                {info?.descripcion && (
                  <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
                    {info.descripcion}
                  </p>
                )}
                {accionable && (
                  <p className="mt-1 text-sm font-semibold text-acento">
                    Buscar quién me ayuda →
                  </p>
                )}
              </div>
              <ChevronRight size={18} className="shrink-0 text-texto-suave" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TEXTO_SALIDA } from "../data/salidas";

/** Salidas que en realidad llevan a algún lado (buscar ayuda) — las demás
 *  son solo informativas (alertas, checklists de lectura). */
const CODIGOS_ACCIONABLES = new Set(["completar_tramites_petitorio"]);

/** Tarjetas "¿Qué sigue?" (scoring.salidas_de) — compartidas entre
 *  /resultado y las ventanas de cuenta.
 *
 *  julio 2026 (reportado por el dueño): las salidas con `pasos` en el
 *  catálogo prometían "te explicamos los pasos" sin mostrar nada — ahora
 *  se expanden con la lista numerada al hacer clic. */
export function SalidasList({
  salidas,
  onBuscarAyuda,
}: {
  salidas: string[];
  /** Si se pasa, las salidas accionables (ver CODIGOS_ACCIONABLES) se
   *  vuelven clicables y redirigen a donde puedan ayudar. */
  onBuscarAyuda?: () => void;
}) {
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());

  if (salidas.length === 0) return null;

  function alternar(codigo: string) {
    setAbiertas((previas) => {
      const nuevas = new Set(previas);
      if (nuevas.has(codigo)) nuevas.delete(codigo);
      else nuevas.add(codigo);
      return nuevas;
    });
  }

  return (
    <div>
      <h3 className="mb-3 text-lg font-semibold">¿Qué sigue?</h3>
      <div className="flex flex-col gap-2">
        {salidas.map((codigo) => {
          const info = TEXTO_SALIDA[codigo];
          const accionable = Boolean(onBuscarAyuda) && CODIGOS_ACCIONABLES.has(codigo);
          const conPasos = (info?.pasos?.length ?? 0) > 0;
          const abierta = abiertas.has(codigo);
          return (
            <button
              key={codigo}
              type="button"
              disabled={!accionable && !conPasos}
              onClick={
                accionable ? onBuscarAyuda : conPasos ? () => alternar(codigo) : undefined
              }
              className={`flex w-full items-start justify-between gap-3 border border-black/10 p-4 text-left dark:border-white/10 ${
                accionable || conPasos ? "active:opacity-90" : "cursor-default"
              }`}
            >
              <div className="min-w-0">
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
                {conPasos && !abierta && (
                  <p className="mt-1 text-sm font-semibold text-acento">Ver los pasos</p>
                )}
                {conPasos && abierta && (
                  <ol className="mt-3 flex flex-col gap-2.5 border-t border-black/10 pt-3 dark:border-white/10">
                    {info!.pasos!.map((paso, i) => (
                      <li key={i} className="flex gap-2.5 text-sm">
                        <span className="shrink-0 font-semibold text-acento">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-texto-suave dark:text-texto-suave-dark">
                          {paso}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              {conPasos ? (
                <ChevronDown
                  size={18}
                  className={`mt-1 shrink-0 text-texto-suave transition-transform ${
                    abierta ? "rotate-180" : ""
                  }`}
                  aria-hidden
                />
              ) : (
                <ChevronRight size={18} className="mt-1 shrink-0 text-texto-suave" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

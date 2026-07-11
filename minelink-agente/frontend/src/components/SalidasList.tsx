import { ChevronRight } from "lucide-react";
import { TEXTO_SALIDA } from "../data/salidas";

/** Tarjetas "¿Qué sigue?" (scoring.salidas_de) — compartidas entre
 *  /resultado y las ventanas de cuenta. */
export function SalidasList({ salidas }: { salidas: string[] }) {
  if (salidas.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-lg font-bold">¿Qué sigue?</h3>
      <div className="flex flex-col gap-2">
        {salidas.map((codigo) => {
          const info = TEXTO_SALIDA[codigo];
          return (
            <div
              key={codigo}
              className="flex items-center justify-between rounded-lg bg-tarjeta p-4 dark:bg-tarjeta-dark"
            >
              <div>
                <p className="font-semibold">{info?.titulo ?? codigo}</p>
                {info?.descripcion && (
                  <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
                    {info.descripcion}
                  </p>
                )}
              </div>
              <ChevronRight size={18} className="shrink-0 text-texto-suave" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

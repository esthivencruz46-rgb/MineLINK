import type { Dimension, NombreDimension } from "../types/diagnostico";
import { INFO_BRECHA } from "../data/brechas";
import { DIMENSION_POR_ESTUDIO } from "../data/estudioDimension";

interface Props {
  brechas: string[];
  // Partial: una brecha solo aparece si su dimensión fue evaluada, así que
  // dimensiones[dim] siempre existe para las brechas recibidas — pero el
  // tipo se declara flexible porque Ruta 2 no trae las 5 dimensiones.
  dimensiones: Partial<Record<NombreDimension, Dimension>>;
  onBuscarAyuda: () => void;
}

export function ListaBrechas({ brechas, dimensiones, onBuscarAyuda }: Props) {
  if (brechas.length === 0) {
    return (
      <p className="rounded-lg bg-tarjeta p-4 text-center dark:bg-tarjeta-dark">
        No te falta ningún estudio. ¡Vas muy bien!
      </p>
    );
  }

  const porcentajeDimension = (etiqueta: string) => {
    const dim = DIMENSION_POR_ESTUDIO[etiqueta];
    const info = dimensiones[dim];
    return info ? info.puntaje / info.maximo : 0;
  };

  const ordenadas = [...brechas].sort(
    (a, b) => porcentajeDimension(a) - porcentajeDimension(b)
  );

  return (
    <div className="flex flex-col gap-3">
      {ordenadas.map((etiqueta) => {
        const info = INFO_BRECHA[etiqueta];
        return (
          <div
            key={etiqueta}
            className="rounded-lg bg-tarjeta p-4 dark:bg-tarjeta-dark"
          >
            <p className="font-semibold">{info?.texto ?? etiqueta}</p>
            {info?.resuelve && (
              <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
                {info.resuelve}
              </p>
            )}
          </div>
        );
      })}
      <button
        onClick={onBuscarAyuda}
        className="mt-2 min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white active:opacity-90"
      >
        Buscar quién me ayuda con esto
      </button>
    </div>
  );
}

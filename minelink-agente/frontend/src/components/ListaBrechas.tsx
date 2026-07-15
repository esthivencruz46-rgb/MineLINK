import type { Dimension, NombreDimension } from "../types/diagnostico";
import { INFO_BRECHA } from "../data/brechas";
import { DIMENSION_POR_ESTUDIO } from "../data/estudioDimension";

interface Props {
  brechas: string[];
  // Estudios "Presentado (en evaluación)" — ya tramitados, no son brecha
  // accionable pero tampoco están resueltos (julio 2026, ver Resultado.tsx).
  brechasEnProceso?: string[];
  // Partial: una brecha solo aparece si su dimensión fue evaluada, así que
  // dimensiones[dim] siempre existe para las brechas recibidas — pero el
  // tipo se declara flexible porque Ruta 2 no trae las 5 dimensiones.
  dimensiones: Partial<Record<NombreDimension, Dimension>>;
  onBuscarAyuda: () => void;
}

export function ListaBrechas({
  brechas,
  brechasEnProceso = [],
  dimensiones,
  onBuscarAyuda,
}: Props) {
  if (brechas.length === 0 && brechasEnProceso.length === 0) {
    return (
      <p className="rounded-lg bg-tarjeta p-4 text-center dark:bg-tarjeta-dark">
        No te falta ningún estudio. ¡Vas muy bien!
      </p>
    );
  }

  const tieneDimensiones = Object.keys(dimensiones).length > 0;

  const ordenadas = tieneDimensiones
    ? [...brechas].sort((a, b) => {
        const dimA = DIMENSION_POR_ESTUDIO[a];
        const dimB = DIMENSION_POR_ESTUDIO[b];
        const infoA = dimA ? dimensiones[dimA] : undefined;
        const infoB = dimB ? dimensiones[dimB] : undefined;
        const pctA = infoA ? infoA.puntaje / infoA.maximo : 0;
        const pctB = infoB ? infoB.puntaje / infoB.maximo : 0;
        return pctA - pctB;
      })
    : [...brechas];

  return (
    <div className="flex flex-col gap-3">
      {/* Sin brechas pero SÍ hay trámites presentados: nunca decir "vas muy
          bien" — eso es exactamente lo que tiene el Track Legal en
          amarillo (ya se presentaron, están en evaluación de la entidad). */}
      {brechas.length === 0 && brechasEnProceso.length > 0 && (
        <p className="rounded-lg bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          No te falta iniciar ningún estudio — ya presentaste{" "}
          {brechasEnProceso.length === 1 ? "el que faltaba" : "todos"}. Por eso tu Track
          Legal está en amarillo: siguen en evaluación de la entidad, no resueltos aún.
        </p>
      )}
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
      {brechasEnProceso.map((etiqueta) => {
        const info = INFO_BRECHA[etiqueta];
        return (
          <div
            key={etiqueta}
            className="rounded-lg bg-tarjeta p-4 dark:bg-tarjeta-dark"
          >
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              {info?.texto ?? etiqueta}
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                Presentado — en evaluación
              </span>
            </p>
            <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
              Ya lo tramitaste. No necesitas ayuda para esto, solo esperar la respuesta de
              la entidad.
            </p>
          </div>
        );
      })}
      {brechas.length > 0 && (
        <button
          onClick={onBuscarAyuda}
          className="mt-2 min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white active:opacity-90"
        >
          Buscar quién me ayuda con esto
        </button>
      )}
    </div>
  );
}

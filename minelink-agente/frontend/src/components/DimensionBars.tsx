import type { Dimension, NombreDimension } from "../types/diagnostico";
import { NOMBRES_DIMENSION } from "../data/preguntas";
import { calcularSemaforo } from "../utils/semaforo";

interface Props {
  dimensiones: Record<NombreDimension, Dimension>;
}

const ORDEN: NombreDimension[] = [
  "legal",
  "ambiental",
  "operativo",
  "tecnico",
  "seguridad",
];

export function DimensionBars({ dimensiones }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {ORDEN.map((dim) => {
        const { puntaje, maximo } = dimensiones[dim];
        const porcentaje = Math.round((puntaje / maximo) * 100);
        const semaforo = calcularSemaforo(porcentaje, false);

        return (
          <div key={dim}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium">{NOMBRES_DIMENSION[dim]}</span>
              <span className="font-mono text-texto-suave dark:text-texto-suave-dark">
                {puntaje}/{maximo}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-700 ${semaforo.claseBarra}`}
                style={{ width: `${porcentaje}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

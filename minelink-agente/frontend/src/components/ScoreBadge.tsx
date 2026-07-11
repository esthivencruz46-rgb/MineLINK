import { calcularSemaforo, semaforoDesdeColor } from "../utils/semaforo";
import type { ColorSemaforo as ColorNuevo } from "../types/diagnostico";

interface PropsLegacy {
  /** Score numérico 0-100 (Score de Atractivo de Inversión / legacy). */
  scoreTotal: number;
  bloqueado: boolean;
  modo?: "legacy";
}

interface PropsNuevo {
  /** Color del semáforo de formalización ("verde" | "amarillo" | "rojo"). */
  color: ColorNuevo | null;
  etiqueta?: string;
  modo: "nuevo";
}

type Props = PropsLegacy | PropsNuevo;

/** Badge de score semáforo — soporta tanto el score numérico legacy
 *  (admin/proyectos) como el color string del nuevo diagnóstico. */
export function ScoreBadge(props: Props) {
  if (props.modo === "nuevo") {
    const semaforo = semaforoDesdeColor(props.color);
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <div
          className={`h-4 w-4 rounded-full ${
            props.color === "verde"
              ? "bg-emerald-500"
              : props.color === "amarillo"
                ? "bg-amber-500"
                : props.color === "rojo"
                  ? "bg-red-500"
                  : "bg-gray-400"
          }`}
        />
        <span className={`text-lg font-semibold ${semaforo.claseTexto}`}>
          {props.etiqueta ?? semaforo.etiqueta}
        </span>
      </div>
    );
  }

  const semaforo = calcularSemaforo(props.scoreTotal, props.bloqueado);
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      {props.bloqueado && (
        <span className="rounded-full bg-red-900 px-4 py-1 text-sm font-semibold text-white">
          {semaforo.etiqueta}
        </span>
      )}
      <span
        className={`font-mono text-[56px] font-bold leading-none md:text-[72px] ${
          props.bloqueado ? "text-texto-suave dark:text-texto-suave-dark" : semaforo.claseTexto
        }`}
      >
        {props.scoreTotal}
      </span>
      {!props.bloqueado && (
        <span className={`text-lg font-semibold ${semaforo.claseTexto}`}>
          {semaforo.etiqueta}
        </span>
      )}
    </div>
  );
}

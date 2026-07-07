import { calcularSemaforo } from "../utils/semaforo";

interface Props {
  scoreTotal: number;
  bloqueado: boolean;
}

export function ScoreBadge({ scoreTotal, bloqueado }: Props) {
  const semaforo = calcularSemaforo(scoreTotal, bloqueado);

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      {bloqueado && (
        <span className="rounded-full bg-red-900 px-4 py-1 text-sm font-semibold text-white">
          {semaforo.etiqueta}
        </span>
      )}
      <span
        className={`font-mono text-[56px] font-bold leading-none md:text-[72px] ${
          bloqueado ? "text-texto-suave dark:text-texto-suave-dark" : semaforo.claseTexto
        }`}
      >
        {scoreTotal}
      </span>
      {!bloqueado && (
        <span className={`text-lg font-semibold ${semaforo.claseTexto}`}>
          {semaforo.etiqueta}
        </span>
      )}
    </div>
  );
}

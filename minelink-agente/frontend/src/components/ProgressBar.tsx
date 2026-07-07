interface Props {
  actual: number;
  total: number;
}

export function ProgressBar({ actual, total }: Props) {
  const porcentaje = Math.round((actual / total) * 100);

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-texto-suave dark:text-texto-suave-dark">
        <span>
          Pregunta {actual} de {total}
        </span>
        <span>{porcentaje}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-acento transition-all duration-300"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}

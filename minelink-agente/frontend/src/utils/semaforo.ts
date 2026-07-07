export type ColorSemaforo = "rojo-oscuro" | "rojo" | "ambar" | "verde";

export interface Semaforo {
  color: ColorSemaforo;
  etiqueta: string;
  claseTexto: string;
  claseBarra: string;
}

export function calcularSemaforo(score: number, bloqueado: boolean): Semaforo {
  if (bloqueado) {
    return {
      color: "rojo-oscuro",
      etiqueta: "Necesitas tu REINFO primero",
      claseTexto: "text-red-900 dark:text-red-400",
      claseBarra: "bg-red-900",
    };
  }
  if (score <= 49) {
    return {
      color: "rojo",
      etiqueta: "En desarrollo",
      claseTexto: "text-red-500",
      claseBarra: "bg-red-500",
    };
  }
  if (score <= 79) {
    return {
      color: "ambar",
      etiqueta: "En progreso",
      claseTexto: "text-amber-500",
      claseBarra: "bg-amber-500",
    };
  }
  return {
    color: "verde",
    etiqueta: "Casi formal",
    claseTexto: "text-emerald-500",
    claseBarra: "bg-emerald-500",
  };
}

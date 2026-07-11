export type ColorSemaforo = "rojo-oscuro" | "rojo" | "ambar" | "verde";

export interface Semaforo {
  color: ColorSemaforo;
  etiqueta: string;
  claseTexto: string;
  claseBarra: string;
}

/** Semaforo legacy basado en score numérico (0-100) — usado por admin,
 *  proyectos y cuenta para el Score de Atractivo de Inversión (Fase 2)
 *  que sigue siendo numérico. */
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

/** Semaforo del nuevo diagnóstico de formalización basado en color string
 *  ("verde" | "amarillo" | "rojo") — usado por Cuestionario, Resultado,
 *  y las pantallas que muestran el Track Legal / Track Técnico. */
export function semaforoDesdeColor(color: string | null | undefined): Semaforo {
  if (color === "verde") {
    return {
      color: "verde",
      etiqueta: "Cumplido",
      claseTexto: "text-emerald-500",
      claseBarra: "bg-emerald-500",
    };
  }
  if (color === "amarillo") {
    return {
      color: "ambar",
      etiqueta: "Pendiente",
      claseTexto: "text-amber-500",
      claseBarra: "bg-amber-500",
    };
  }
  if (color === "rojo") {
    return {
      color: "rojo",
      etiqueta: "Bloqueado",
      claseTexto: "text-red-500",
      claseBarra: "bg-red-500",
    };
  }
  // Sin dato (perfil A que no tiene semáforo técnico, por ejemplo)
  return {
    color: "ambar",
    etiqueta: "Sin dato",
    claseTexto: "text-gray-400",
    claseBarra: "bg-gray-400",
  };
}

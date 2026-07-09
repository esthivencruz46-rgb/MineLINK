import type { NombreDimension } from "../types/diagnostico";
import { INFO_BRECHA } from "./brechas";
import { DIMENSION_POR_ESTUDIO } from "./estudioDimension";

export const ORDEN_DIMENSIONES: NombreDimension[] = [
  "legal",
  "ambiental",
  "operativo",
  "tecnico",
  "seguridad",
  "social",
];

export const ESTUDIOS_POR_DIMENSION: Record<NombreDimension, string[]> =
  ORDEN_DIMENSIONES.reduce((acc, dim) => {
    acc[dim] = Object.keys(INFO_BRECHA).filter((e) => DIMENSION_POR_ESTUDIO[e] === dim);
    return acc;
  }, {} as Record<NombreDimension, string[]>);

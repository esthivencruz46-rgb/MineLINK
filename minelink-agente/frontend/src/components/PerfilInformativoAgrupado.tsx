// ⏸️ EN PAUSA (julio 2026) — no borrar. Mostraba el perfil informativo del
// modelo viejo en la ficha pública; la ficha renovada usa las tarjetas
// "Oportunidad de inversión" y "Datos de la operación" (ProyectoDetalle.tsx).
import { CATEGORIAS_PERFIL_INFORMATIVO, CAMPOS_PERFIL_INFORMATIVO } from "../data/perfilInformativo";
import { NOMBRES_DIMENSION_INVERSION } from "../types/proyecto";
import { formatearMonto } from "../utils/formato";
import type { DimensionScore } from "../types/proyecto";

interface Props {
  /** Objeto con los campos del perfil informativo (mismos nombres que
   * ProyectoDetalle). */
  datos: Record<string, unknown>;
  /** Score de Atractivo de Inversión por dimensión — se muestra como
   * insignia junto al título de cada categoría, en el mismo orden y con
   * el mismo puntaje que las barras del panel lateral. */
  dimensiones?: Record<string, DimensionScore>;
}

/** Agrupa el perfil informativo (~40 campos) en las 5 dimensiones del Score
 * de Atractivo de Inversión (todas menos "formalizacion", que tiene su
 * propia tarjeta con el checklist del diagnóstico) — cada categoría es su
 * propia tarjeta, no una lista plana, y una categoría sin ningún campo con
 * valor no se muestra. Usado solo en la ficha pública del proyecto. */
export function PerfilInformativoAgrupado({ datos, dimensiones }: Props) {
  const trabajosExploracion = Array.isArray(datos.trabajos_exploracion_json)
    ? (datos.trabajos_exploracion_json as string[])
    : [];

  return (
    <>
      {CATEGORIAS_PERFIL_INFORMATIVO.map((categoria) => {
        const camposDeCategoria = CAMPOS_PERFIL_INFORMATIVO.filter((c) => c.categoria === categoria);
        const camposConValor = camposDeCategoria.filter((c) => {
          const valor = datos[c.campo];
          return valor && !(Array.isArray(valor) && valor.length === 0);
        });
        const tieneExtrasTecnicos =
          categoria === "viabilidad_tecnica" &&
          Boolean(datos.ley_promedio || datos.especie_mineral || trabajosExploracion.length > 0);
        const tieneExtrasCapital =
          categoria === "claridad_oportunidad" && Boolean(datos.capital_buscado);
        if (camposConValor.length === 0 && !tieneExtrasTecnicos && !tieneExtrasCapital) return null;

        const info = dimensiones?.[categoria];
        const porcentaje =
          info && info.maximo > 0 ? Math.round((info.puntaje / info.maximo) * 100) : null;

        return (
          <div key={categoria} className="rounded-lg bg-tarjeta p-6 shadow-sm dark:bg-tarjeta-dark">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{NOMBRES_DIMENSION_INVERSION[categoria]}</h2>
              {porcentaje !== null && (
                <span className="text-sm font-semibold text-texto-suave dark:text-texto-suave-dark">
                  {porcentaje}/100
                </span>
              )}
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {tieneExtrasCapital && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-texto-suave dark:text-texto-suave-dark">Capital buscado</dt>
                  <dd className="text-sm font-medium">
                    {formatearMonto(String(datos.capital_buscado))}
                    {datos.uso_fondos ? ` — ${String(datos.uso_fondos)}` : ""}
                  </dd>
                </div>
              )}
              {categoria === "viabilidad_tecnica" && Boolean(datos.ley_promedio) && (
                <div>
                  <dt className="text-xs text-texto-suave dark:text-texto-suave-dark">Ley promedio</dt>
                  <dd className="text-sm font-medium">
                    {String(datos.ley_promedio)}
                    {datos.ley_como_obtenida ? ` (${String(datos.ley_como_obtenida)})` : ""}
                  </dd>
                </div>
              )}
              {categoria === "viabilidad_tecnica" && Boolean(datos.especie_mineral) && (
                <div>
                  <dt className="text-xs text-texto-suave dark:text-texto-suave-dark">Especie mineralógica</dt>
                  <dd className="text-sm font-medium">{String(datos.especie_mineral)}</dd>
                </div>
              )}
              {categoria === "viabilidad_tecnica" && trabajosExploracion.length > 0 && (
                <div>
                  <dt className="text-xs text-texto-suave dark:text-texto-suave-dark">Trabajos de exploración</dt>
                  <dd className="text-sm font-medium">{trabajosExploracion.join(", ")}</dd>
                </div>
              )}
              {camposConValor.map(({ campo, etiqueta }) => (
                <div key={campo}>
                  <dt className="text-xs text-texto-suave dark:text-texto-suave-dark">{etiqueta}</dt>
                  <dd className="text-sm font-medium">{formatearMonto(String(datos[campo]))}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </>
  );
}

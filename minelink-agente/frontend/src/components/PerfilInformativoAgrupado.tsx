import {
  CATEGORIAS_PERFIL_INFORMATIVO,
  CAMPOS_PERFIL_INFORMATIVO,
  NOMBRES_CATEGORIA_PERFIL_INFORMATIVO,
} from "../data/perfilInformativo";

interface Props {
  /** Objeto con los campos del perfil informativo (ProyectoDetalle o
   * MineroPerfil — ambos comparten los mismos nombres de campo). */
  datos: Record<string, unknown>;
}

/** Agrupa el perfil informativo (~40 campos) en 9 categorías con subtítulo,
 * en vez de una lista plana — usado tanto en la ficha pública del proyecto
 * (ProyectoDetalle.tsx) como en la cuenta del propio minero (MiCuenta.tsx /
 * MiConcesion.tsx). Una categoría sin ningún campo con valor no se muestra. */
export function PerfilInformativoAgrupado({ datos }: Props) {
  const trabajosExploracion = Array.isArray(datos.trabajos_exploracion_json)
    ? (datos.trabajos_exploracion_json as string[])
    : [];

  return (
    <div className="flex flex-col gap-5">
      {CATEGORIAS_PERFIL_INFORMATIVO.map((categoria) => {
        const camposDeCategoria = CAMPOS_PERFIL_INFORMATIVO.filter((c) => c.categoria === categoria);
        const camposConValor = camposDeCategoria.filter((c) => {
          const valor = datos[c.campo];
          return valor && !(Array.isArray(valor) && valor.length === 0);
        });
        const tieneExtrasGeologia =
          categoria === "geologia" &&
          Boolean(datos.ley_promedio || datos.especie_mineral || trabajosExploracion.length > 0);
        if (camposConValor.length === 0 && !tieneExtrasGeologia) return null;

        return (
          <div key={categoria}>
            <h3 className="text-sm font-semibold uppercase text-texto-suave dark:text-texto-suave-dark">
              {NOMBRES_CATEGORIA_PERFIL_INFORMATIVO[categoria]}
            </h3>
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {categoria === "geologia" && Boolean(datos.ley_promedio) && (
                <div>
                  <dt className="text-xs text-texto-suave dark:text-texto-suave-dark">Ley promedio</dt>
                  <dd className="text-sm font-medium">
                    {String(datos.ley_promedio)}
                    {datos.ley_como_obtenida ? ` (${String(datos.ley_como_obtenida)})` : ""}
                  </dd>
                </div>
              )}
              {categoria === "geologia" && Boolean(datos.especie_mineral) && (
                <div>
                  <dt className="text-xs text-texto-suave dark:text-texto-suave-dark">Especie mineralógica</dt>
                  <dd className="text-sm font-medium">{String(datos.especie_mineral)}</dd>
                </div>
              )}
              {categoria === "geologia" && trabajosExploracion.length > 0 && (
                <div>
                  <dt className="text-xs text-texto-suave dark:text-texto-suave-dark">Trabajos de exploración</dt>
                  <dd className="text-sm font-medium">{trabajosExploracion.join(", ")}</dd>
                </div>
              )}
              {camposConValor.map(({ campo, etiqueta }) => (
                <div key={campo}>
                  <dt className="text-xs text-texto-suave dark:text-texto-suave-dark">{etiqueta}</dt>
                  <dd className="text-sm font-medium">{String(datos[campo])}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}

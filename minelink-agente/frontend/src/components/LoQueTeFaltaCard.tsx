import { useNavigate } from "react-router-dom";
import { INFO_BRECHA } from "../data/brechas";
import type { MineroPerfil } from "../types/minero";

/** Un solo "Lo que te falta" para toda la cuenta (julio 2026 — antes había
 *  uno en cada columna y se veía repetido): agrupa las brechas de
 *  Formalización (del diagnóstico + seguimiento del admin) y las de
 *  Inversión (lo que declaró NO tener en el Módulo INV), cada grupo con su
 *  etiqueta, y todas con el mismo "¿Quién me ayuda? →" que lleva a
 *  /empresas ya filtrado por ese estudio. */
export function LoQueTeFaltaCard({
  perfil,
  mostrarFormalizacion = true,
}: {
  perfil: MineroPerfil;
  /** false para perfil A/A_avanzado en MiConcesion — aún no tienen
   *  concesión, no hay brechas de formalización que medir. */
  mostrarFormalizacion?: boolean;
}) {
  const navigate = useNavigate();

  const brechasFormalizacion = mostrarFormalizacion ? perfil.brechas_pendientes : [];
  // Si una brecha ya está listada en formalización, no se repite en
  // inversión (ej. analisis_laboratorio puede salir de ambos cuestionarios).
  const brechasInversion = (perfil.brechas_inversion ?? []).filter(
    (b) => !brechasFormalizacion.includes(b)
  );
  const resueltas = mostrarFormalizacion ? perfil.brechas_resueltas : [];

  if (brechasFormalizacion.length === 0 && brechasInversion.length === 0 && resueltas.length === 0) {
    if (!mostrarFormalizacion) return null;
    return (
      <div className="rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
        <h2 className="font-semibold">Lo que te falta</h2>
        <p className="mt-2 text-sm text-texto-suave dark:text-texto-suave-dark">
          No tienes brechas pendientes.
        </p>
      </div>
    );
  }

  function itemBrecha(b: string) {
    return (
      <li key={b}>
        <button
          onClick={() =>
            navigate("/empresas", {
              state: {
                region: perfil.region,
                estudios: [b],
                operacionId: perfil.operacion_id,
              },
            })
          }
          className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
        >
          <span>• {INFO_BRECHA[b]?.texto ?? b}</span>
          <span className="shrink-0 text-xs font-semibold text-acento">¿Quién me ayuda? →</span>
        </button>
      </li>
    );
  }

  return (
    <div className="rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
      <h2 className="font-semibold">Lo que te falta</h2>

      {brechasFormalizacion.length > 0 && (
        <>
          <h3 className="mt-3 text-xs font-semibold uppercase text-texto-suave dark:text-texto-suave-dark">
            Formalización
          </h3>
          <ul className="mt-1 flex flex-col gap-1">{brechasFormalizacion.map(itemBrecha)}</ul>
        </>
      )}

      {brechasInversion.length > 0 && (
        <>
          <h3 className="mt-3 text-xs font-semibold uppercase text-texto-suave dark:text-texto-suave-dark">
            Inversión
          </h3>
          <ul className="mt-1 flex flex-col gap-1">{brechasInversion.map(itemBrecha)}</ul>
        </>
      )}

      {resueltas.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold text-texto-suave dark:text-texto-suave-dark">
            Ya resuelto
          </h3>
          <ul className="mt-1 flex flex-col gap-1 text-sm text-texto-suave line-through dark:text-texto-suave-dark">
            {resueltas.map((b) => (
              <li key={b}>{INFO_BRECHA[b]?.texto ?? b}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

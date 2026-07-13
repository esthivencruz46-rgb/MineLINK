import { useNavigate } from "react-router-dom";
import { INFO_BRECHA } from "../data/brechas";
import type { MineroPerfil } from "../types/minero";

/** "Lo que te falta" de la columna de Inversión — espejo de la tarjeta del
 *  mismo nombre en Formalización: lista los estudios que el minero declaró
 *  NO tener en el Módulo INV (ver MineroPerfil.brechas_inversion) y lleva
 *  a /empresas con el filtro puesto para encontrar quién se lo hace. */
export function BrechasInversionCard({ perfil }: { perfil: MineroPerfil }) {
  const navigate = useNavigate();

  if (perfil.brechas_inversion.length === 0) return null;

  return (
    <div className="rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
      <h2 className="font-semibold">Lo que te falta</h2>
      <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
        En tus respuestas de inversión marcaste que aún no tienes esto — te mostramos quién puede
        ayudarte.
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {perfil.brechas_inversion.map((b) => (
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
              <span className="shrink-0 text-xs font-semibold text-acento">
                ¿Quién me ayuda? →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

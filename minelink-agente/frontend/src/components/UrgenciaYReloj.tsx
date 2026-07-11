import { Clock } from "lucide-react";

interface Urgencia {
  dias_restantes: number;
  docs_completados: number;
  docs_totales: number;
  dias_necesarios: number;
  alerta_roja: boolean;
}

interface RelojProduccion {
  anios_titulo: number;
  vencido: boolean;
  anios_restantes: number;
}

/** Reloj REINFO (perfil C) y reloj de producción mínima (perfil B) —
 *  compartidos entre /resultado y las ventanas de cuenta, que recalculan
 *  lo mismo en cada lectura (los días restantes cambian con el tiempo). */
export function UrgenciaYReloj({
  urgencia,
  relojProduccion,
}: {
  urgencia?: Urgencia | null;
  relojProduccion?: RelojProduccion | null;
}) {
  return (
    <>
      {urgencia && (
        <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <Clock size={18} /> Reloj REINFO
          </h3>
          <p className="text-sm">
            Quedan <strong>{urgencia.dias_restantes}</strong> días al
            31/12/2026. Tienes {urgencia.docs_completados}/
            {urgencia.docs_totales} documentos listos.
          </p>
          {urgencia.alerta_roja && (
            <p className="mt-2 text-sm font-semibold text-red-600">
              ¡No alcanzas al ritmo actual! Necesitas{" "}
              {urgencia.dias_necesarios} días y solo quedan{" "}
              {urgencia.dias_restantes}.
            </p>
          )}
        </div>
      )}

      {relojProduccion && (
        <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <Clock size={18} /> Reloj de producción mínima
          </h3>
          <p className="text-sm">
            Tu título tiene {relojProduccion.anios_titulo} años.{" "}
            {relojProduccion.vencido
              ? "El plazo ya venció — debes poner tu mina en producción o pagar la penalidad."
              : `Te quedan ${relojProduccion.anios_restantes} años para cumplir la producción mínima.`}
          </p>
        </div>
      )}
    </>
  );
}

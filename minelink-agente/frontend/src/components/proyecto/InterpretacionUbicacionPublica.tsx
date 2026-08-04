import { AlertTriangle, Sparkles } from "lucide-react";

/** Lectura de IA de la ubicación (litología/fallas de GEOCATMIN + ASTER
 * 9-3-1 + Anomalías Espectrales de GEOCATMIN + las 6 capas de Copernicus
 * cruzadas — ver backend/interpretacion_ubicacion.py), pública desde
 * agosto 2026 (antes solo el admin la veía). El disclaimer es una caja
 * propia con su propio color y borde, SIEMPRE arriba del texto — pedido
 * explícito de Esthiven al reversar la regla "nunca público": si esto se
 * muestra a un inversionista, tiene que quedar clarísimo que es una
 * hipótesis de IA sin confirmar en campo, nunca un hallazgo probado (la
 * letra chica no alcanza para algo que puede sonar a "hay mineral acá"). */
export function InterpretacionUbicacionPublica({
  texto,
  generadoEn,
}: {
  texto: string;
  generadoEn?: string | null;
}) {
  return (
    <div className="border border-black/10 bg-tarjeta p-4 dark:border-white/10 dark:bg-tarjeta-dark sm:p-6">
      <div className="flex items-center gap-2">
        <Sparkles size={18} strokeWidth={2} className="text-acento" aria-hidden />
        <h2 className="text-lg font-semibold">Lectura satelital (IA)</h2>
      </div>

      <div className="mt-3 flex items-start gap-2 border border-amber-500/40 bg-amber-500/10 p-3">
        <AlertTriangle
          size={16}
          strokeWidth={2.25}
          className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden
        />
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
          Hipótesis generada por inteligencia artificial a partir de imágenes satelitales — NO
          es un hallazgo confirmado de mineral ni un estudio geológico. Cualquier señal acá
          descrita debe verificarse siempre con muestreo en campo.
        </p>
      </div>

      <p className="mt-3 text-sm leading-relaxed">{texto}</p>

      {generadoEn && (
        <p className="mt-3 text-xs text-texto-suave dark:text-texto-suave-dark">
          Generado el {generadoEn}
        </p>
      )}
    </div>
  );
}

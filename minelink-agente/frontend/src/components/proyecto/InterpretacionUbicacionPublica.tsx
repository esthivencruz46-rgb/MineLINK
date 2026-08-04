import { Info, Sparkles } from "lucide-react";

/** Lectura de IA de la ubicación (litología/fallas de GEOCATMIN + ASTER
 * 9-3-1 + Anomalías Espectrales de GEOCATMIN + las 6 capas de Copernicus
 * cruzadas — ver backend/interpretacion_ubicacion.py), pública desde
 * agosto 2026 (antes solo el admin la veía). El aviso quedó como una
 * línea chica DEBAJO del texto (agosto 2026, pedido explícito tras ver
 * el análisis funcionando bien en proyectos reales: "no pongas mucho de
 * eso de advertencia porque está analizando bien") — bajado de una caja
 * grande con ícono de alerta arriba del texto a esto; sigue dejando
 * constancia de que es una hipótesis sin confirmar, solo sin tratarla
 * como el mensaje principal. */
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

      <p className="mt-3 text-justify text-sm leading-relaxed">{texto}</p>

      <p className="mt-3 flex items-start gap-1.5 text-xs text-texto-suave dark:text-texto-suave-dark">
        <Info size={13} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
        Hipótesis generada por IA a partir de imágenes satelitales — señal a verificar en
        campo, no un hallazgo confirmado.
      </p>

      {generadoEn && (
        <p className="mt-1.5 text-xs text-texto-suave dark:text-texto-suave-dark">
          Generado el {generadoEn}
        </p>
      )}
    </div>
  );
}

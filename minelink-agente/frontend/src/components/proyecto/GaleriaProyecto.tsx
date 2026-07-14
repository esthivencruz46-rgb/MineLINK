import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { BASE_URL } from "../../services/api";
import type { FotoPublica, GeocatminInfo } from "../../types/proyecto";

/** Mosaico superior de la ficha (julio 2026): a la izquierda el bloque de
 * UBICACIÓN — mapa satelital vertical con el panel GEOCATMIN (concesión
 * del catastro minero + geología) pegado debajo, un solo bloque visual —
 * y a la derecha 2 fotos grandes del proyecto (mina, mineral...) que
 * llenan exactamente la misma altura. Sin ubicación, las fotos ocupan
 * todo el rectángulo; sin nada, un placeholder compacto. */
export function GaleriaProyecto({
  fotos,
  ubicacionCoords,
  geocatmin,
}: {
  fotos: FotoPublica[];
  ubicacionCoords?: string | null;
  geocatmin?: GeocatminInfo | null;
}) {
  const [indiceAbierto, setIndiceAbierto] = useState<number | null>(null);

  if (fotos.length === 0 && !ubicacionCoords) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-black/10 bg-tarjeta text-sm text-texto-suave dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-suave-dark">
        Aún no hay fotos ni ubicación de este proyecto
      </div>
    );
  }

  const concesion = geocatmin?.concesion;
  const geologia = geocatmin?.geologia;
  // Resumen GEOCATMIN dentro del propio bloque de ubicación — el dato
  // oficial al lado del mapa, no perdido más abajo. El detalle completo
  // (titular, código, disclaimer) sigue en "Cotejo con registros públicos".
  const panelGeocatmin =
    geocatmin && (concesion || geologia) ? (
      <div className="rounded-xl bg-tarjeta p-3 shadow-sm dark:bg-tarjeta-dark">
        {concesion ? (
          <p className="flex items-start gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <BadgeCheck size={14} strokeWidth={2.5} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Concesión {concesion.nombre}
              {concesion.leyenda ? ` · ${concesion.leyenda.toLowerCase()}` : ""}
              {concesion.hectareas != null ? ` · ${Math.round(concesion.hectareas)} ha` : ""}
            </span>
          </p>
        ) : (
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            Pin fuera de una concesión registrada (referencial)
          </p>
        )}
        {geologia?.unidad && (
          <p className="mt-1 text-xs text-texto-suave dark:text-texto-suave-dark">
            Geología: {geologia.unidad}
          </p>
        )}
        <p className="mt-1 text-[10px] uppercase tracking-wide text-texto-suave dark:text-texto-suave-dark">
          GEOCATMIN · INGEMMET
        </p>
      </div>
    ) : null;

  const mapa = ubicacionCoords ? (
    <div className="h-64 overflow-hidden rounded-xl shadow-sm md:min-h-0 md:h-auto md:flex-1">
      <iframe
        title="Ubicación del proyecto (vista satelital)"
        src={`https://maps.google.com/maps?q=${ubicacionCoords}&z=15&t=k&output=embed`}
        className="h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  ) : null;

  const bloqueUbicacion = mapa ? (
    <div className="flex flex-col gap-3 md:h-full">
      {mapa}
      {panelGeocatmin}
    </div>
  ) : null;

  const miniatura = (foto: FotoPublica, indice: number, alto: string) => (
    <button
      key={foto.id}
      onClick={() => setIndiceAbierto(indice)}
      className={`group overflow-hidden rounded-xl shadow-sm transition duration-200 ${alto}`}
    >
      <img
        src={`${BASE_URL}${foto.url}`}
        alt="Foto del proyecto"
        loading="lazy"
        className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
      />
    </button>
  );

  return (
    <>
      {bloqueUbicacion ? (
        fotos.length > 0 ? (
          // Alto fijo compartido (md:h-[30rem]): el bloque de ubicación
          // (mapa vertical + panel GEOCATMIN) y las 2 fotos apiladas
          // terminan exactamente en la misma línea.
          <div className="grid grid-cols-1 gap-3 md:h-[30rem] md:grid-cols-[2fr_3fr]">
            {bloqueUbicacion}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:grid-rows-2">
              {fotos.slice(0, 2).map((foto, i) => miniatura(foto, i, "h-32 md:h-full"))}
            </div>
          </div>
        ) : (
          <div className="md:h-[30rem]">{bloqueUbicacion}</div>
        )
      ) : (
        // Sin ubicación: las fotos ocupan todo el rectángulo.
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[7fr_3fr]">
          {miniatura(fotos[0], 0, "h-64 md:h-96")}
          {fotos.length > 1 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
              {fotos
                .slice(1, 3)
                .map((foto, i) => miniatura(foto, i + 1, "h-32 md:h-[186px]"))}
            </div>
          )}
        </div>
      )}

      {indiceAbierto !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
          onClick={() => setIndiceAbierto(null)}
        >
          <img
            src={`${BASE_URL}${fotos[indiceAbierto].url}`}
            alt="Foto del proyecto"
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
          />
          <div className="mt-4 flex gap-2">
            {fotos.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setIndiceAbierto(i);
                }}
                className={`h-2 w-2 rounded-full ${i === indiceAbierto ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

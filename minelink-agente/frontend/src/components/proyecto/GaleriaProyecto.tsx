import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { BASE_URL } from "../../services/api";
import { MapaGeocatmin } from "./MapaGeocatmin";
import type { FotoPublica, GeocatminInfo } from "../../types/proyecto";

const MAX_MINIATURAS_VISIBLES = 6;

/** Cabecera de la ficha (julio 2026, rediseño pedido explícitamente):
 * UBICACIÓN y FOTOS DE PRESENTACIÓN son dos bloques separados, cada uno
 * con su propio tamaño natural — antes compartían una sola fila de
 * altura fija (mapa a la izquierda, fotos apretadas a la derecha) y
 * cualquier combinación de fotos generaba desbordes o huecos feos. El
 * mapa (con su panel GEOCATMIN debajo) ocupa todo el ancho por sí solo;
 * las fotos van abajo en una tira de miniaturas pequeñas, con "+N" si
 * hay más de las que caben. */
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

  // Más reciente primero (julio 2026, a pedido de Esthiven): el backend
  // devuelve las fotos en orden de subida (la más vieja primero) — se
  // invierte acá para que la última foto subida aparezca primero en la
  // tira y en el visor, sin tocar el orden real de subida en la BD.
  const fotosOrdenadas = [...fotos].reverse();

  const concesion = geocatmin?.concesion;
  const geologia = geocatmin?.geologia;
  const geologia50k = geocatmin?.geologia_50k;
  // Resumen GEOCATMIN dentro del propio bloque de ubicación — el dato
  // oficial al lado del mapa, no perdido más abajo. El detalle completo
  // (titular, código, disclaimer) sigue en "Cotejo con registros públicos".
  // Geología en las DOS escalas cuando existen — 1:50,000 (más detalle)
  // solo aparece donde INGEMMET tiene carta a esa escala.
  const panelGeocatmin =
    geocatmin && (concesion || geologia) ? (
      <div className="h-full rounded-xl bg-tarjeta p-3 shadow-sm dark:bg-tarjeta-dark">
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
            Geología a escala 1:100,000: {geologia.unidad}
          </p>
        )}
        {geologia50k?.unidad && (
          <p className="mt-0.5 text-xs text-texto-suave dark:text-texto-suave-dark">
            Geología a escala 1:50,000: {geologia50k.unidad}
          </p>
        )}
        <p className="mt-1 text-[10px] uppercase tracking-wide text-texto-suave dark:text-texto-suave-dark">
          GEOCATMIN · INGEMMET
        </p>
      </div>
    ) : null;

  // Bloque de UBICACIÓN: el mapa a todo lo ancho, con altura propia fija
  // (no depende de cuántas fotos haya).
  const bloqueUbicacion = ubicacionCoords ? (
    <div className="h-72 overflow-hidden rounded-xl shadow-sm sm:h-96 md:h-[28rem]">
      <MapaGeocatmin coords={ubicacionCoords} poligonoConcesion={concesion?.poligono} />
    </div>
  ) : null;

  // Tira de miniaturas pequeñas (fotos de presentación) — nunca intenta
  // igualar la altura del panel: cada una mide lo mismo (cuadrada) sin
  // importar cuántas haya. La última visible lleva el sello "+N" si sobran.
  const tiraFotos =
    fotosOrdenadas.length > 0 ? (
      <div className="grid flex-1 grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {fotosOrdenadas.slice(0, MAX_MINIATURAS_VISIBLES).map((foto, i) => {
          const esUltimaVisible = i === MAX_MINIATURAS_VISIBLES - 1;
          const restantes = esUltimaVisible
            ? fotosOrdenadas.length - MAX_MINIATURAS_VISIBLES
            : 0;
          return (
            <button
              key={foto.id}
              onClick={() => setIndiceAbierto(i)}
              className="group relative aspect-square overflow-hidden rounded-lg shadow-sm transition duration-200"
            >
              <img
                src={`${BASE_URL}${foto.url}`}
                alt="Foto del proyecto"
                loading="lazy"
                className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
              />
              {restantes > 0 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-base font-bold text-white">
                  +{restantes}
                </span>
              )}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      {bloqueUbicacion}
      {/* Panel GEOCATMIN al costado de las fotos de presentación (pedido
          explícito, julio 2026) — no una debajo de la otra. En móvil se
          apilan (el panel primero) porque no entran lado a lado. */}
      {(panelGeocatmin || tiraFotos) && (
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-stretch">
          {panelGeocatmin && <div className="md:w-2/5">{panelGeocatmin}</div>}
          {tiraFotos}
        </div>
      )}

      {indiceAbierto !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
          onClick={() => setIndiceAbierto(null)}
        >
          <img
            src={`${BASE_URL}${fotosOrdenadas[indiceAbierto].url}`}
            alt="Foto del proyecto"
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
          />
          <div className="mt-4 flex gap-2">
            {fotosOrdenadas.map((_, i) => (
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

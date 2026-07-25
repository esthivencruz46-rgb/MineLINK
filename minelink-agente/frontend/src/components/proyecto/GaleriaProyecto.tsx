import { useEffect, useState } from "react";
import { BadgeCheck, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
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
  anomaliasSatelitales,
}: {
  fotos: FotoPublica[];
  ubicacionCoords?: string | null;
  geocatmin?: GeocatminInfo | null;
  /** Anomalías espectrales de Copernicus sobre el polígono real de la
   * concesión — ver MapaGeocatmin. */
  anomaliasSatelitales?: {
    bbox: [number, number, number, number];
    capas: Record<string, string>;
  } | null;
}) {
  const [indiceAbierto, setIndiceAbierto] = useState<number | null>(null);

  // Más reciente primero (julio 2026, a pedido de Esthiven): el backend
  // devuelve las fotos en orden de subida (la más vieja primero) — se
  // invierte acá para que la última foto subida aparezca primero en la
  // tira y en el visor, sin tocar el orden real de subida en la BD.
  // Declarado ANTES del early return de abajo porque el useEffect de
  // navegación por teclado (también antes del return) lo necesita — los
  // hooks no pueden depender de un return condicional previo.
  const fotosOrdenadas = [...fotos].reverse();

  // Flechas ← → del teclado navegan el visor cuando está abierto (además
  // de los botones en pantalla, para desktop).
  useEffect(() => {
    if (indiceAbierto === null || fotosOrdenadas.length === 0) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        setIndiceAbierto((i) => (i === null ? i : (i - 1 + fotosOrdenadas.length) % fotosOrdenadas.length));
      } else if (e.key === "ArrowRight") {
        setIndiceAbierto((i) => (i === null ? i : (i + 1) % fotosOrdenadas.length));
      } else if (e.key === "Escape") {
        setIndiceAbierto(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [indiceAbierto, fotosOrdenadas.length]);

  if (fotos.length === 0 && !ubicacionCoords) {
    return (
      <div className="flex h-40 items-center justify-center border border-dashed border-black/10 bg-tarjeta text-sm text-texto-suave dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-suave-dark">
        Aún no hay fotos ni ubicación de este proyecto
      </div>
    );
  }

  const concesion = geocatmin?.concesion;
  const geologia = geocatmin?.geologia;
  const geologia50k = geocatmin?.geologia_50k;
  const fallas = geocatmin?.fallas;
  // Resumen GEOCATMIN dentro del propio bloque de ubicación — el dato
  // oficial al lado del mapa, no perdido más abajo. El detalle completo
  // (titular, código, disclaimer) sigue en "Cotejo con registros públicos".
  // Geología en las DOS escalas cuando existen — 1:50,000 (más detalle)
  // solo aparece donde INGEMMET tiene carta a esa escala.
  const panelGeocatmin =
    geocatmin && (concesion || geologia) ? (
      <div className="h-full rounded-lg border border-black/10 bg-fondo p-3 dark:border-white/10 dark:bg-fondo-dark">
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
        {fallas && fallas.items.length > 0 && (
          <p className="mt-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            {fallas.items.length} falla{fallas.items.length > 1 ? "s" : ""} geológica
            {fallas.items.length > 1 ? "s" : ""} cerca del pin (trazadas en el mapa)
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
    <div className="h-72 overflow-hidden rounded-lg border border-black/10 dark:border-white/10 sm:h-96 md:h-[28rem]">
      <MapaGeocatmin
        coords={ubicacionCoords}
        poligonoConcesion={concesion?.poligono}
        // Solo se pide la capa al mapa si de verdad hay una falla
        // confirmada — con items=[] (verificado, sin fallas cerca) no se
        // manda nada al mapa, para no insinuar un riesgo que no existe.
        escalaFallas={fallas && fallas.items.length > 0 ? fallas.escala : null}
        anomaliasSatelitales={anomaliasSatelitales}
      />
    </div>
  ) : null;

  // Tira de miniaturas pequeñas (fotos de presentación) — tamaño FIJO por
  // miniatura (no se estira para llenar el espacio libre) y pegada al
  // extremo derecho de la fila con `justify-end`: con pocas fotos (ej. 3)
  // quedan agrupadas contra el borde derecho, dejando el espacio vacío
  // junto al panel de la izquierda, en vez de empezar pegadas a él
  // (pedido explícito, julio 2026).
  const tiraFotos =
    fotosOrdenadas.length > 0 ? (
      <div className="flex flex-1 flex-wrap justify-end gap-3">
        {fotosOrdenadas.slice(0, MAX_MINIATURAS_VISIBLES).map((foto, i) => {
          const esUltimaVisible = i === MAX_MINIATURAS_VISIBLES - 1;
          const restantes = esUltimaVisible
            ? fotosOrdenadas.length - MAX_MINIATURAS_VISIBLES
            : 0;
          return (
            <button
              key={foto.id}
              onClick={() => setIndiceAbierto(i)}
              className="group relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg shadow-sm transition duration-200 sm:w-24 md:w-28"
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

  // Encabezado "Ubicación" solo cuando de verdad hay mapa que mostrar —
  // con fotos pero sin coordenadas (caso raro) no tiene sentido un
  // título que no corresponde a nada debajo.
  const hayUbicacion = Boolean(bloqueUbicacion);

  return (
    <>
      {/* Todo el bloque envuelto en una tarjeta institucional (julio
          2026, pedido explícito: "mejora la estética de ubicación") —
          antes flotaba suelto, sin borde ni encabezado, desconectado del
          resto de la ficha (Resumen Ejecutivo, Formalización, etc. sí
          usan esta misma tarjeta con borde fino). */}
      <div className="border border-black/10 bg-tarjeta p-4 dark:border-white/10 dark:bg-tarjeta-dark sm:p-6">
        {hayUbicacion && (
          <>
            <div className="flex items-center gap-2">
              <MapPin size={18} strokeWidth={2} className="text-acento" aria-hidden />
              <h2 className="text-lg font-semibold">Ubicación</h2>
            </div>
            <div className="mt-3">{bloqueUbicacion}</div>
          </>
        )}
        {/* Panel GEOCATMIN al costado de las fotos de presentación (pedido
            explícito, julio 2026) — no una debajo de la otra. En móvil se
            apilan (el panel primero) porque no entran lado a lado. */}
        {(panelGeocatmin || tiraFotos) && (
          <div
            className={`flex flex-col gap-3 md:flex-row md:items-stretch ${hayUbicacion ? "mt-3" : ""}`}
          >
            {panelGeocatmin && <div className="md:w-2/5">{panelGeocatmin}</div>}
            {tiraFotos}
          </div>
        )}
      </div>

      {indiceAbierto !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
          onClick={() => setIndiceAbierto(null)}
        >
          {fotosOrdenadas.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIndiceAbierto((i) =>
                  i === null ? i : (i - 1 + fotosOrdenadas.length) % fotosOrdenadas.length
                );
              }}
              aria-label="Foto anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70 sm:left-6"
            >
              <ChevronLeft size={28} />
            </button>
          )}
          <img
            src={`${BASE_URL}${fotosOrdenadas[indiceAbierto].url}`}
            alt="Foto del proyecto"
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
          />
          {fotosOrdenadas.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIndiceAbierto((i) => (i === null ? i : (i + 1) % fotosOrdenadas.length));
              }}
              aria-label="Foto siguiente"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70 sm:right-6"
            >
              <ChevronRight size={28} />
            </button>
          )}
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

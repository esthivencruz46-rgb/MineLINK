import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
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
  const fallas = geocatmin?.fallas;

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
  // miniatura (no se estira para llenar el espacio libre). Alineadas a la
  // izquierda (antes iban a la derecha, `justify-end`, para no pegarse al
  // panel GEOCATMIN que vivía a su izquierda -- ese panel se quitó, ver
  // arriba, así que ya no hay nada de qué alejarse).
  const tiraFotos =
    fotosOrdenadas.length > 0 ? (
      <div className="flex flex-wrap gap-3">
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
        {/* julio 2026, pedido explícito: se quitó el panel GEOCATMIN que
            iba al costado de estas fotos (repetía, aunque resumido, lo
            mismo que ya dice completo "Cotejo con registros públicos"
            más abajo en la misma ficha) — las fotos de presentación
            quedan solas, a todo el ancho disponible. */}
        {tiraFotos && <div className={hayUbicacion ? "mt-3" : ""}>{tiraFotos}</div>}
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

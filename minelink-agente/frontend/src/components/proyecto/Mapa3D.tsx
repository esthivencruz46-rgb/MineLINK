import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { TERRENO_TILES } from "./terreno3D";
import { BASE_URL } from "../../services/api";

// Vista 3D de la ficha (MapLibre GL): el polígono de la concesión sobre
// un terreno con relieve real, en vez del plano 2D de Leaflet. Cargado
// con React.lazy desde MapaGeocatmin — sus ~250 KB gzipped solo se
// descargan cuando el visitante pulsa "3D" (o se precargan en segundo
// plano al abrir la ficha, ver MapaGeocatmin).
//
// Terreno: tiles "terrarium" del dataset abierto de Terrain Tiles de
// AWS (elevation-tiles-prod, sin token/API key). MapLibre los consume
// con `raster-dem` + `encoding: "terrarium"` (convierte los 3 canales
// RGB a metros sobre el mar). Exageración 1.5x: el relieve se siente
// sin volverse una caricatura.
//
// Basemap: la MISMA base satelital de Esri World Imagery que ya usa el
// mapa 2D de Leaflet (server.arcgisonline.com) — MapLibre acepta tiles
// raster XYZ, así que no se depende de ningún servicio nuevo pago.
//
// Estrategia de carga (agosto 2026, tras reporte "demora mucho / no
// aparece nada"): el mapa arranca PLANO (pitch 0 y SIN terreno) para que
// el satélite se pinte de inmediato — la misma base rápida del mapa 2D.
// El relieve + la inclinación de cámara se activan recién cuando el mapa
// queda estable (`load` + primer `idle`), en vez de exigir los tiles DEM
// desde el primer frame. Sin esto, MapLibre NO dibuja nada hasta tener
// el DEM del viewport (necesita la elevación para posicionar la cámara),
// y si esos tiles tardan o fallan, el área queda en blanco aun con el
// satélite disponible. El terreno es cosmético: si falla al activarse,
// el mapa 2D satelital queda igual de útil.

const SATELITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

// Mismo margen que backend/geocatmin.py (_MARGEN_ANALISIS): el overlay de
// geología/fallas/catastro de la vista 3D debe encuadrar EXACTAMENTE el
// mismo terreno que la galería "catastro/geología/fallas" del PDF, o la
// capa no calzaría con el polígono que el propio mapa 3D dibuja encima.
const MARGEN_OVERLAY = 2.5;

// Replica de geocatmin._bbox_y_tamano_ajustado_poligono (solo el bbox):
// [oeste, sur, este, norte] en la sintaxis que espera MapLibre, centrado
// en el polígono con el margen de arriba. Sin polígono, cae a la misma
// caja fija chica y cuadrada alrededor del pin que usa el backend.
function bboxOverlay(
  poligono: number[][][] | null | undefined,
  coords: string
): [number, number, number, number] | null {
  if (poligono && poligono.length > 0 && poligono[0].length > 0) {
    const anillo = poligono[0];
    const lngs = anillo.map((p) => p[0]);
    const lats = anillo.map((p) => p[1]);
    const cx = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const cy = (Math.min(...lats) + Math.max(...lats)) / 2;
    const medioLng = Math.max((Math.max(...lngs) - Math.min(...lngs)) / 2, 0.0008) * MARGEN_OVERLAY;
    const medioLat = Math.max((Math.max(...lats) - Math.min(...lats)) / 2, 0.0008) * MARGEN_OVERLAY;
    return [cx - medioLng, cy - medioLat, cx + medioLng, cy + medioLat];
  }
  const [lat, lng] = coords.split(",").map((p) => Number(p.trim()));
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  const medio = 0.006 * MARGEN_OVERLAY;
  return [lng - medio, lat - medio, lng + medio, lat + medio];
}

export function Mapa3D({
  coords,
  poligonoConcesion,
  proyectoId,
}: {
  coords: string;
  /** Anillos [lng, lat] de la concesión (de GEOCATMIN, vía backend) —
   * se proyectan sobre el terreno en 3D. */
  poligonoConcesion?: number[][][] | null;
  /** Id del proyecto: con él la vista 3D superpone las mismas capas que el
   * mapa 2D muestra encendidas por defecto (geología + fallas + catastro)
   * sobre el terreno, vía `GET /proyectos/{id}/overlay-3d.png` (PNG
   * transparente, mismo bbox que la galería "catastro/geología/fallas"
   * del PDF). Sin id (p. ej. en el visor de otra página) se omite. */
  proyectoId?: string;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [relieveActivo, setRelieveActivo] = useState(false);

  useEffect(() => {
    const div = contenedorRef.current;
    if (!div) return;
    const [lat, lng] = coords.split(",").map((p) => Number(p.trim()));
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;

    // WebGL2 es OBLIGATORIO para MapLibre v5+ (v6 lo exige, sin
    // fallback a WebGL1). Si falta, `new Map()` lanza una excepción y el
    // área quedaría en blanco sin explicación — se detecta antes y se
    // muestra un mensaje accionable en vez de eso.
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) {
      setError(
        "Tu navegador no soporta la vista 3D (WebGL2 no disponible). Usá el botón \"Mapa 2D\"."
      );
      return;
    }

    let mapa: maplibregl.Map;
    try {
      mapa = new maplibregl.Map({
        container: div,
        center: [lng, lat],
        zoom: 14,
        // Arranca PLANO: la cámara horizontal muestra el satélite apenas
        // sus tiles llegan, sin esperar el DEM. La inclinación 3D llega
        // después con easeTo (ver abajo).
        pitch: 0,
        style: {
          version: 8,
          sources: {
            satelite: {
              type: "raster",
              tiles: [SATELITE_TILES],
              tileSize: 256,
              maxzoom: 19,
              attribution: "Esri, Maxar",
            },
            dem: {
              type: "raster-dem",
              tiles: [TERRENO_TILES],
              tileSize: 256,
              maxzoom: 15,
              encoding: "terrarium",
            },
          },
          layers: [
            {
              id: "satelite",
              type: "raster",
              source: "satelite",
            },
          ],
        },
        scrollZoom: false,
      });
    } catch {
      setError(
        "No se pudo iniciar el mapa 3D. Usá el botón \"Mapa 2D\"."
      );
      return;
    }

    let desmontado = false;

    mapa.on("load", () => {
      // Overlay de las capas 2D por defecto (geología 100K + fallas + catastro
      // minero) sobre el terreno: PNG transparente servido por el backend con
      // el MISMO bbox que la galería del PDF. Se agrega ANTES del polígono y
      // del pin para que el borde verde de la concesión y el pin queden
      // siempre encima de las capas. Es cosmético: si el overlay falla
      // (404/red), el mapa sigue con satélite + polígono sin problema.
      if (proyectoId) {
        const bbox = bboxOverlay(poligonoConcesion, coords);
        if (bbox) {
          try {
            mapa.addSource("overlay-catastro", {
              type: "raster",
              tiles: [`${BASE_URL}/proyectos/${proyectoId}/overlay-3d.png`],
              tileSize: 1000,
              bounds: bbox,
              maxzoom: 24,
            });
            mapa.addLayer({
              id: "overlay-catastro",
              type: "raster",
              source: "overlay-catastro",
            });
          } catch {
            // cosmético, no tumba el mapa
          }
        }
      }

      // Polígono de la concesión: borde verde de marca + relleno
      // semitransparente muy tenue (el satélite de abajo sigue
      // leyéndose). Mismo verde (#10b981) que el borde 2D de Leaflet.
      if (poligonoConcesion && poligonoConcesion.length > 0) {
        try {
          mapa.addSource("concesion", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "Polygon",
                coordinates: poligonoConcesion as number[][][],
              },
            },
          });
          mapa.addLayer({
            id: "concesion-borde",
            type: "line",
            source: "concesion",
            paint: {
              "line-color": "#10b981",
              "line-width": 3,
            },
          });
          mapa.addLayer({
            id: "concesion-relleno",
            type: "fill",
            source: "concesion",
            paint: {
              "fill-color": "#10b981",
              "fill-opacity": 0.15,
            },
          });

          // Encuadre a la concesión completa. La cámara está plana acá;
          // al inclinarse después, el punto focal ya apunta al proyecto.
          const bounds = new maplibregl.LngLatBounds();
          for (const anillo of poligonoConcesion) {
            for (const punto of anillo) {
              if (Array.isArray(punto) && punto.length >= 2) {
                bounds.extend([punto[0], punto[1]]);
              }
            }
          }
          if (!bounds.isEmpty()) {
            mapa.fitBounds(bounds, { padding: 50, maxZoom: 16 });
          }
        } catch {
          // Polígono malformado: no debe tumbar el mapa, sigue el satélite.
        }
      }

      // Pin de la operación (circleLayer, sin iconos PNG que Vite no
      // sirva solo) — mismo rojo del pin 2D.
      try {
        mapa.addSource("pin", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: [lng, lat] },
          },
        });
        mapa.addLayer({
          id: "pin-borde",
          type: "circle",
          source: "pin",
          paint: {
            "circle-radius": 10,
            "circle-color": "#ffffff",
            "circle-stroke-width": 0,
          },
        });
        mapa.addLayer({
          id: "pin",
          type: "circle",
          source: "pin",
          paint: {
            "circle-radius": 8,
            "circle-color": "#e11d48",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
      } catch {
        // cosmético, no tumba el mapa
      }

      // Ahora sí, con el mapa ya estable (satélite visible), se enciende
      // el terreno y se inclina la cámara a ~55° — el "efecto 3D". Si el
      // DEM tarda en llegar, el satélite plano ya se está viendo; si
      // falla, el mapa plano queda igual de utilizable.
      mapa.once("idle", () => {
        if (desmontado) return;
        try {
          mapa.setTerrain({ source: "dem", exaggeration: 1.5 });
          mapa.easeTo({ pitch: 55, duration: 1200 });
        } finally {
          if (!desmontado) setRelieveActivo(true);
        }
      });
    });

    mapa.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        visualizePitch: true,
      }),
      "top-right"
    );

    return () => {
      desmontado = true;
      mapa.remove();
    };
  }, [coords, poligonoConcesion, proyectoId]);

  return (
    <div
      className="relative h-full w-full"
      style={{ minHeight: "16rem" }}
    >
      <div ref={contenedorRef} className="h-full w-full" />

      {error ? (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 border-t border-black/10 bg-white px-3 py-2 text-xs text-texto-suave dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-suave-dark">
          <span className="text-amber-600 dark:text-amber-400">⚠</span>
          {error}
        </div>
      ) : (
        !relieveActivo && (
          <div className="absolute right-2 bottom-2 rounded-md border border-black/10 bg-white px-2 py-1 text-[11px] text-texto-suave dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-suave-dark">
            Cargando relieve 3D…
          </div>
        )
      )}
    </div>
  );
}

export default Mapa3D;

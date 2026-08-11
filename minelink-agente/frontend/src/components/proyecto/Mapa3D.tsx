import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Vista 3D de la ficha (MapLibre GL): el polígono de la concesión sobre
// un terreno con relieve real, en vez del plano 2D de Leaflet. Cargado
// con React.lazy desde MapaGeocatmin — sus ~270 KB gzipped solo se
// descargan cuando el visitante pulsa "3D".
//
// Terreno: tiles "terrarium" del dataset abierto de Terrain Tiles de
// AWS (elevation-tiles-prod, sin token/API key — verificado en vivo
// agosto 2026 que el bucket responde 200 para Perú). MapLibre los
// consume con `raster-dem` + `encoding: "terrarium"` (convierte los 3
// canales RGB a metros sobre el mar). Exageración 1.5x: el relieve se
// siente sin volverse una caricatura.
//
// Basemap: la MISMA base satelital de Esri World Imagery que ya usa el
// mapa 2D de Leaflet (server.arcgisonline.com) — MapLibre acepta tiles
// raster XYZ, así que no se depende de ningún servicio nuevo pago.

const TERRENO_TILES =
  "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png";
const SATELITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export function Mapa3D({
  coords,
  poligonoConcesion,
}: {
  coords: string;
  /** Anillos [lng, lat] de la concesión (de GEOCATMIN, vía backend) —
   * se proyectan sobre el terreno en 3D. */
  poligonoConcesion?: number[][][] | null;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const div = contenedorRef.current;
    if (!div) return;
    const [lat, lng] = coords.split(",").map((p) => Number(p.trim()));
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;

    const mapa = new maplibregl.Map({
      container: div,
      center: [lng, lat],
      zoom: 14,
      // La cámara inclinada ~55° es lo que convierte el plano en una
      // escena 3D — el terreno se ve en relieve desde el arranque.
      pitch: 55,
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
    // El terreno se activa después de crear el mapa (en v6+ el option
    // `terrain` ya no va en el constructor, se llama setTerrain).
    mapa.setTerrain({ source: "dem", exaggeration: 1.5 });

    mapa.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        visualizePitch: true,
      }),
      "top-right"
    );

    mapa.on("load", () => {
      // Polígono de la concesión proyectado sobre el terreno: borde
      // verde de marca + relleno semitransparente muy tenue (el satélite
      // de abajo sigue leyéndose). Mismo verde (#10b981) que el borde
      // 2D de Leaflet.
      if (poligonoConcesion && poligonoConcesion.length > 0) {
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

        // Encuadre a la concesión completa, manteniendo la inclinación
        // 3D — la cámara queda apuntando al proyecto, no solo al pin.
        const bounds = new maplibregl.LngLatBounds();
        for (const anillo of poligonoConcesion) {
          for (const [x, y] of anillo) bounds.extend([x, y]);
        }
        mapa.fitBounds(bounds, { padding: 50, maxZoom: 16 });
      }

      // Pin de la operación (circleLayer, sin iconos PNG que Vite no
      // sirva solo) — mismo rojo del pin 2D.
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
    });

    return () => mapa.remove();
  }, [coords, poligonoConcesion]);

  return (
    <div
      ref={contenedorRef}
      className="h-full w-full"
      style={{ minHeight: "16rem" }}
    />
  );
}

export default Mapa3D;

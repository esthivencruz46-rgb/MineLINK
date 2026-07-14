import { useEffect, useRef } from "react";
import L from "leaflet";
import { dynamicMapLayer } from "esri-leaflet";
import "leaflet/dist/leaflet.css";

const GEOCATMIN = "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services";

/** Mapa de la ficha pública (julio 2026): base satelital (Esri World
 * Imagery) + las capas OFICIALES de GEOCATMIN/INGEMMET encima —
 * "Catastro minero" (polígonos de concesiones, encendida por defecto) y
 * "Geología 1:100K" (apagada por defecto, se activa en el control de
 * capas). Reemplaza al embed de Google Maps, que no acepta capas
 * externas. Los servicios ArcGIS se consumen como imágenes dinámicas
 * (mismo backend REST que usa backend/geocatmin.py para el cotejo). */
export function MapaGeocatmin({ coords }: { coords: string }) {
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const [lat, lng] = coords.split(",").map((p) => Number(p.trim()));
    const div = contenedorRef.current;
    if (!div || Number.isNaN(lat) || Number.isNaN(lng)) return;

    const mapa = L.map(div, {
      center: [lat, lng],
      zoom: 14,
      // La rueda no secuestra el scroll de la página; se hace zoom con
      // los botones +/- o con gesto de dos dedos en celular.
      scrollWheelZoom: false,
    });

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "Esri, Maxar" }
    ).addTo(mapa);

    const catastro = dynamicMapLayer({
      url: `${GEOCATMIN}/SERV_CATASTRO_MINERO_WGS84/MapServer`,
      layers: [0],
      opacity: 0.8,
      attribution: "GEOCATMIN · INGEMMET",
    }).addTo(mapa);

    const geologia = dynamicMapLayer({
      url: `${GEOCATMIN}/SERV_GEOLOGIA_100K_INTEGRADA/MapServer`,
      layers: [6],
      opacity: 0.45,
    });

    L.control
      .layers(
        undefined,
        { "Catastro minero": catastro, "Geología 1:100K": geologia },
        { collapsed: false, position: "topright" }
      )
      .addTo(mapa);

    // Pin de la operación (circleMarker: no depende de los PNG del icono
    // por defecto de Leaflet, que Vite no sirve solo).
    L.circleMarker([lat, lng], {
      radius: 8,
      color: "#ffffff",
      weight: 2.5,
      fillColor: "#e11d48",
      fillOpacity: 1,
    }).addTo(mapa);

    return () => {
      mapa.remove();
    };
  }, [coords]);

  return <div ref={contenedorRef} className="z-0 h-full min-h-64 w-full" />;
}

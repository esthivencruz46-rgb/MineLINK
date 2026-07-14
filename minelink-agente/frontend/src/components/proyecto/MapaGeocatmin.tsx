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
export function MapaGeocatmin({
  coords,
  poligonoConcesion,
}: {
  coords: string;
  /** Anillos [lng, lat] de la concesión donde cae el pin (de GEOCATMIN,
   * vía backend — el servidor de INGEMMET no permite pedirla directo
   * desde el navegador por CORS). */
  poligonoConcesion?: number[][][] | null;
}) {
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

    // Pila visual definida por el dueño (julio 2026): satélite al fondo →
    // geología encima con 60% de transparencia (opacity 0.4) → el polígono
    // de la concesión solo con su borde. El catastro completo (todas las
    // concesiones vecinas, con etiquetas) queda disponible en el control
    // de capas, apagado por defecto.
    // f: "image" es OBLIGATORIO con GEOCATMIN: su servidor no envía
    // cabeceras CORS (verificado julio 2026), así que el modo por defecto
    // de esri-leaflet (XHR f=json) sería bloqueado por el navegador. En
    // modo imagen el export se carga como <img>, exento de CORS.
    const catastro = dynamicMapLayer({
      url: `${GEOCATMIN}/SERV_CATASTRO_MINERO_WGS84/MapServer`,
      layers: [0],
      opacity: 0.8,
      f: "image",
      attribution: "GEOCATMIN · INGEMMET",
    });

    const geologia = dynamicMapLayer({
      url: `${GEOCATMIN}/SERV_GEOLOGIA_100K_INTEGRADA/MapServer`,
      layers: [6],
      opacity: 0.4,
      f: "image",
      attribution: "GEOCATMIN · INGEMMET",
    }).addTo(mapa);

    L.control
      .layers(
        undefined,
        { "Catastro minero": catastro, "Geología 1:100K": geologia },
        { collapsed: false, position: "topright" }
      )
      .addTo(mapa);

    // Polígono EXACTO de la concesión del proyecto, resaltado sobre las
    // capas — anillos ArcGIS [lng, lat] → Leaflet [lat, lng]. El mapa se
    // encuadra a la concesión completa (el pin queda dentro).
    if (poligonoConcesion && poligonoConcesion.length > 0) {
      const anillos = poligonoConcesion.map((anillo) =>
        anillo.map(([x, y]) => [y, x] as [number, number])
      );
      // Solo el borde de color, sin relleno — la geología de abajo se ve
      // completa dentro de la concesión.
      const poligono = L.polygon(anillos, {
        color: "#10b981",
        weight: 3,
        fill: false,
      }).addTo(mapa);
      poligono.bindTooltip("Concesión del proyecto", { sticky: true });
      mapa.fitBounds(poligono.getBounds().pad(0.15));
    }

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
  }, [coords, poligonoConcesion]);

  return <div ref={contenedorRef} className="z-0 h-full min-h-64 w-full" />;
}

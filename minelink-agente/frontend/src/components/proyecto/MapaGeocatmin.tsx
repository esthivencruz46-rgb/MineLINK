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
    // geología encima muy tenue en reposo (opacity 0.25 = 25% visible) →
    // al pasar el mouse sube a 100% (ver opacidadGeologia) → el polígono
    // de la concesión solo con su borde. El catastro completo (todas las
    // concesiones vecinas, con etiquetas) queda disponible en el control
    // de capas, apagado por defecto.
    // f: "image" + useCors: false son OBLIGATORIOS con GEOCATMIN: su
    // servidor no envía cabeceras CORS (verificado julio 2026). Sin
    // f:"image" el XHR de export muere por CORS; y sin useCors:false
    // esri-leaflet marca el <img> con crossorigin="anonymous", el
    // navegador vuelve a exigir CORS sobre la imagen, esta falla y el
    // manejador de error QUITA la capa en silencio (mapa solo-satélite).
    const catastro = dynamicMapLayer({
      url: `${GEOCATMIN}/SERV_CATASTRO_MINERO_WGS84/MapServer`,
      layers: [0],
      opacity: 0.8,
      f: "image",
      useCors: false,
      attribution: "GEOCATMIN · INGEMMET",
    });

    // Geología en dos escalas APILADAS bajo un solo interruptor: la 100K
    // cubre todo el país (base garantizada) y la 50K —más detallada— se
    // dibuja ENCIMA solo donde INGEMMET tiene cobertura; donde no existe,
    // su imagen sale transparente y se ve la 100K. El servicio 50K es
    // lento (verificado: >25s en algunas zonas): como cada capa carga
    // async e independiente, el detalle aparece cuando llega sin bloquear
    // nada. zIndex fija el orden aunque las imágenes se refresquen al
    // mover el mapa.
    const geologia100 = dynamicMapLayer({
      url: `${GEOCATMIN}/SERV_GEOLOGIA_100K_INTEGRADA/MapServer`,
      layers: [6],
      opacity: 0.25,
      f: "image",
      useCors: false,
      zIndex: 10,
      attribution: "GEOCATMIN · INGEMMET",
    });
    const geologia50 = dynamicMapLayer({
      url: `${GEOCATMIN}/SERV_GEOLOGIA_50K_INTEGRADA/MapServer`,
      layers: [7], // Litología
      opacity: 0.25,
      f: "image",
      useCors: false,
      zIndex: 11,
    });

    // Clic en el mapa → nombre de la unidad geológica en un popup (los
    // polígonos solo traen su código impreso, ej. "N-mz"). Se consulta la
    // 100K porque responde rápido; el identify viaja por JSONP gracias a
    // useCors:false (el servidor no da CORS).
    geologia100.bindPopup((_error: unknown, featureCollection: any) => {
      const props = featureCollection?.features?.[0]?.properties;
      if (!props?.UNIDAD && !props?.DESCRIP) return false;
      const titulo = props.UNIDAD || props.NAME;
      const detalle =
        props.DESCRIP && props.DESCRIP !== titulo ? `<br/>${props.DESCRIP}` : "";
      return `<strong>${titulo}</strong>${detalle}<br/><span style="font-size:11px;color:#64748b">Geología INGEMMET · carta 1:100,000</span>`;
    });

    // La 50K arranca FUERA del grupo: es pesada, así que solo se pide en
    // una zona acotada (ver actualizarGeologia50 más abajo).
    const geologia = L.layerGroup([geologia100]).addTo(mapa);

    L.control
      .layers(
        undefined,
        { "Catastro minero": catastro, "Geología (50K si existe / 100K)": geologia },
        { collapsed: false, position: "topright" }
      )
      .addTo(mapa);

    // Polígono EXACTO de la concesión del proyecto, resaltado sobre las
    // capas — anillos ArcGIS [lng, lat] → Leaflet [lat, lng]. El mapa se
    // encuadra a la concesión completa (el pin queda dentro).
    let zona50: L.LatLngBounds | null = null;
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
      // Zona de ~10 veces el ÁREA de la concesión (pedido del dueño):
      // pad(1.1) ≈ ×3.2 por lado ≈ ×10 en área.
      zona50 = poligono.getBounds().pad(1.1);
    }

    // La 50K solo se solicita con la vista DENTRO de la zona acotada (o,
    // sin concesión, con zoom cercano) — así nunca se le pide a INGEMMET
    // un render 50K de media región, que es lo que lo vuelve lentísimo.
    const actualizarGeologia50 = () => {
      const dentro = zona50
        ? zona50.contains(mapa.getBounds())
        : mapa.getZoom() >= 12;
      if (dentro && !geologia.hasLayer(geologia50)) {
        geologia.addLayer(geologia50);
      } else if (!dentro && geologia.hasLayer(geologia50)) {
        geologia.removeLayer(geologia50);
      }
    };
    mapa.on("moveend", actualizarGeologia50);
    actualizarGeologia50();

    // Con el mouse ENCIMA del mapa la geología se ve al 100% (pedido del
    // dueño, julio 2026); al salir vuelve a su transparencia normal para
    // que el satélite siga leyéndose de un vistazo.
    const opacidadGeologia = (llena: boolean) => {
      geologia100.setOpacity(llena ? 1 : 0.25);
      geologia50.setOpacity(llena ? 1 : 0.25);
    };
    const alEntrar = () => opacidadGeologia(true);
    const alSalir = () => opacidadGeologia(false);
    div.addEventListener("mouseenter", alEntrar);
    div.addEventListener("mouseleave", alSalir);

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
      div.removeEventListener("mouseenter", alEntrar);
      div.removeEventListener("mouseleave", alSalir);
      mapa.remove();
    };
  }, [coords, poligonoConcesion]);

  return <div ref={contenedorRef} className="mapa-geocatmin z-0 h-full min-h-64 w-full" />;
}

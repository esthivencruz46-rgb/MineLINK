import { useEffect, useRef } from "react";
import L from "leaflet";
import { dynamicMapLayer, imageMapLayer } from "esri-leaflet";
import "leaflet/dist/leaflet.css";

const GEOCATMIN = "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services";

/** Mapa de la ficha pública (julio 2026): base satelital (Esri World
 * Imagery) + las capas OFICIALES de GEOCATMIN/INGEMMET encima —
 * "Catastro minero" (polígonos de concesiones, encendida por defecto),
 * "Geología 1:100K" (apagada por defecto, se activa en el control de
 * capas), si el backend encontró alguna "Fallas geológicas cercanas"
 * (encendida por defecto — antes solo se listaban como texto en "Cotejo
 * con registros públicos", pedido explícito de Esthiven de mostrarlas
 * también trazadas sobre el mapa) y 3 capas satelitales ASTER de
 * INGEMMET (julio 2026, pedido explícito de Esthiven tras preguntar qué
 * más ofrece INGEMMET de imágenes satelitales — el DEM se probó
 * (Hillshade incluido) y se quitó a pedido suyo), cada una con su
 * PROPIO interruptor: "ASTER 9-3-1" y "Índices minerales QICIMI"
 * —productos ya procesados por el laboratorio de teledetección de
 * INGEMMET que resaltan zonas de alteración hidrotermal, indicio de
 * mineralización— y "Anomalías espectrales" (polígonos). Las 3 apagadas
 * por defecto y con `minZoom: 12` (equivalente a la vista local de unos
 * 10km alrededor del pin) para no pedirle a INGEMMET un render de medio
 * país si alguien hace zoom out con alguna marcada. Reemplaza al embed
 * de Google Maps, que no acepta capas externas. Los servicios ArcGIS se
 * consumen como imágenes dinámicas (mismo backend REST que usa
 * backend/geocatmin.py para el cotejo). */
export function MapaGeocatmin({
  coords,
  poligonoConcesion,
  escalaFallas,
}: {
  coords: string;
  /** Anillos [lng, lat] de la concesión donde cae el pin (de GEOCATMIN,
   * vía backend — el servidor de INGEMMET no permite pedirla directo
   * desde el navegador por CORS). */
  poligonoConcesion?: number[][][] | null;
  /** Escala a la que se encontraron fallas cercanas al pin (julio 2026):
   * "50k" | "100k" | null/undefined si no hay ninguna que dibujar. Nunca
   * ambas juntas — mismo criterio que backend/geocatmin.py. */
  escalaFallas?: "50k" | "100k" | null;
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

    // Panes propios para garantizar el orden visual con CSS real (el
    // `zIndex` que acepta esri-leaflet en el constructor no siempre se
    // respeta de forma confiable entre capas creadas en momentos
    // distintos). Orden pedido por Esthiven, de abajo hacia arriba:
    // geología → fallas (siempre sobre la geología) → catastro minero
    // (los límites de la concesión por ENCIMA de todo lo demás) → el pin
    // rojo de la operación, SIEMPRE arriba de TODO (pedido explícito de
    // Esthiven) — L.circleMarker es un layer vectorial y por defecto usa
    // el "overlayPane" de Leaflet (z-index 400), que queda POR DEBAJO de
    // catastroPane (430): sin este pane propio el pin podía quedar
    // tapado por cualquiera de las capas de arriba.
    mapa.createPane("geologiaPane").style.zIndex = "410";
    mapa.createPane("fallasPane").style.zIndex = "420";
    mapa.createPane("catastroPane").style.zIndex = "430";
    mapa.createPane("pinPane").style.zIndex = "440";

    // Pila visual definida por el dueño (julio 2026): satélite al fondo →
    // geología encima muy tenue en reposo (opacity 0.25 = 25% visible) →
    // al pasar el mouse sube a 100% (ver opacidadGeologia) → fallas
    // geológicas si las hay → catastro minero SIEMPRE arriba de todo
    // (los límites de la concesión nunca deben quedar tapados). El
    // catastro completo (todas las concesiones vecinas, con etiquetas)
    // queda disponible en el control de capas, apagado por defecto; el
    // polígono resaltado de la concesión del proyecto (borde sin
    // relleno) se dibuja aparte, ver más abajo.
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
      pane: "catastroPane",
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
      pane: "geologiaPane",
      attribution: "GEOCATMIN · INGEMMET",
    });
    const geologia50 = dynamicMapLayer({
      url: `${GEOCATMIN}/SERV_GEOLOGIA_50K_INTEGRADA/MapServer`,
      layers: [7], // Litología
      opacity: 0.25,
      f: "image",
      useCors: false,
      zIndex: 11,
      pane: "geologiaPane",
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

    // Fallas geológicas cercanas al pin (julio 2026, pedido explícito de
    // Esthiven: la lista de texto en "Cotejo con registros públicos" no
    // bastaba, había que verlas trazadas sobre el mapa). Una sola escala
    // a la vez (2 = Fallas en la 50K, 3 = Fallas en la 100K) — cuál usar
    // ya lo decidió el backend (`geocatmin._fallas_cercanas`, prioriza
    // 50K), acá solo se dibuja. Encendida por defecto: es información de
    // riesgo, no un detalle opcional que haya que saber buscar.
    const fallas = escalaFallas
      ? dynamicMapLayer({
          url: `${GEOCATMIN}/SERV_GEOLOGIA_${escalaFallas === "50k" ? "50K" : "100K"}_INTEGRADA/MapServer`,
          layers: [escalaFallas === "50k" ? 2 : 3],
          opacity: 0.9,
          f: "image",
          useCors: false,
          pane: "fallasPane",
          attribution: "GEOCATMIN · INGEMMET",
        }).addTo(mapa)
      : null;

    // Capas satelitales/ASTER de INGEMMET (julio 2026, pedido explícito de
    // Esthiven): productos ya procesados por su laboratorio de
    // teledetección — ASTER 9-3-1 y QICIMI resaltan zonas de alteración
    // hidrotermal (indicio de mineralización), y "Anomalías espectrales"
    // es una capa propia de polígonos. (El DEM se probó y se quitó a
    // pedido explícito de Esthiven.) Cada una con su PROPIO interruptor
    // (a pedido explícito de Esthiven:
    // "sepárame ese grupo") — son pesadas, así que en vez de un
    // add/removeLayer manual por zona (que desincroniza el checkbox del
    // control de Leaflet cuando se saca una capa YA registrada como
    // overlay independiente), se usa `minZoom` propio de esri-leaflet:
    // Leaflet mismo deja de pedirlas si el mapa se aleja más allá de
    // zoom 12 (~equivalente a la vista local de unos 10km alrededor del
    // pin, mismo umbral que ya usa geología 50K más abajo) sin tocar su
    // membresía en el mapa, así el checkbox nunca se desmarca solo.
    const aster931 = imageMapLayer({
      url: `${GEOCATMIN}/PRODUCTO_SATELITAL/MD_ASTER_931/ImageServer`,
      opacity: 0.7,
      f: "image",
      useCors: false,
      pane: "geologiaPane",
      minZoom: 12,
      attribution: "GEOCATMIN · INGEMMET",
    });
    const qicimi = imageMapLayer({
      url: `${GEOCATMIN}/PRODUCTO_SATELITAL/MD_QICIMI/ImageServer`,
      opacity: 0.7,
      f: "image",
      useCors: false,
      pane: "geologiaPane",
      minZoom: 12,
    });
    const anomalias = dynamicMapLayer({
      url: `${GEOCATMIN}/SERV_ANOMALIA_ESPECTRAL/MapServer`,
      layers: [0],
      // 0.7 se veía apagado, sobre todo el verde de "Arcillas" contra el
      // satélite (julio 2026, reportado por Esthiven al corroborar
      // contra INGEMMET) — a diferencia de geología (fondo continuo,
      // necesita ser tenue), esta es una capa de polígonos dispersos que
      // debe destacar; mismo nivel que "fallas".
      opacity: 0.9,
      f: "image",
      useCors: false,
      pane: "geologiaPane",
      minZoom: 12,
    });
    // Sin `layerDefs`/`where`: se piden los 3 tipos tal cual los define el
    // renderer del propio servicio (verificado en vivo julio 2026) —
    // Óxidos en rojo, Arcillas en verde, Óxidos y Arcillas en amarillo.
    // Popup igual que geología: clic en un polígono → qué tipo es (los
    // colores solos no bastan para saber cuál es cuál).
    anomalias.bindPopup((_error: unknown, featureCollection: any) => {
      const tipo = featureCollection?.features?.[0]?.properties?.TIPO;
      if (!tipo) return false;
      return `<strong>Anomalía espectral: ${tipo}</strong><br/><span style="font-size:11px;color:#64748b">GEOCATMIN · INGEMMET</span>`;
    });

    L.control
      .layers(
        undefined,
        {
          "Catastro minero": catastro,
          "Geología (50K si existe / 100K)": geologia,
          ...(fallas ? { "Fallas geológicas cercanas": fallas } : {}),
          "ASTER 9-3-1 (alteración hidrotermal)": aster931,
          "Índices minerales QICIMI": qicimi,
          "Anomalías espectrales": anomalias,
        },
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
      // completa dentro de la concesión. Mismo pane que "catastro" (el
      // más alto): es el límite de ESTA concesión, nunca debe quedar
      // tapado por ninguna otra capa.
      const poligono = L.polygon(anillos, {
        color: "#10b981",
        weight: 3,
        fill: false,
        pane: "catastroPane",
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
    // por defecto de Leaflet, que Vite no sirve solo). Pane propio con
    // el z-index más alto de todos — siempre visible, nunca tapado.
    L.circleMarker([lat, lng], {
      radius: 8,
      color: "#ffffff",
      weight: 2.5,
      fillColor: "#e11d48",
      fillOpacity: 1,
      pane: "pinPane",
    }).addTo(mapa);

    return () => {
      div.removeEventListener("mouseenter", alEntrar);
      div.removeEventListener("mouseleave", alSalir);
      mapa.remove();
    };
  }, [coords, poligonoConcesion, escalaFallas]);

  return <div ref={contenedorRef} className="mapa-geocatmin z-0 h-full min-h-64 w-full" />;
}

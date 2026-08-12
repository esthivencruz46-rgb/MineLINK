import { lazy, Suspense, useEffect, useRef, useState } from "react";
import L from "leaflet";
import { dynamicMapLayer, identifyFeatures, imageMapLayer } from "esri-leaflet";
import "leaflet/dist/leaflet.css";
import { BASE_URL } from "../../services/api";
import { precargarRelieve } from "./terreno3D";

// Vista 3D de la concesión (MapLibre GL, ver Mapa3D.tsx): se carga con
// React.lazy — sus ~270 KB gzipped solo bajan cuando el visitante pulsa
// el botón "3D", la carga inicial de la ficha no paga ese peso.
// El import se reutiliza tanto para React.lazy como para precargar el
// chunk en segundo plano (ver useEffect de abajo) — así el clic en "3D"
// no espera la descarga+parseo de ~250 KB de MapLibre.
const cargarMapa3D = () => import("./Mapa3D");
const Mapa3DLazy = lazy(cargarMapa3D);

// Nombre tecnico -> etiqueta legible para el control de capas (mismo
// orden/nombres que backend/copernicus.py NOMBRES_CAPAS). Sin el prefijo
// "Anomalía:" en los 4 índices porque ya van dentro de su sub-grupo de
// alteración ("Alteración férrica"/"Alteración argílica", agosto 2026 —
// pedido explícito de Esthiven).
const TITULOS_ANOMALIAS: Record<string, string> = {
  oxidos_de_hierro: "Óxidos de hierro",
  arcillas: "Arcillas",
  hierro_ferroso: "Hierro ferroso",
  arcilla_sulfatos_mica: "Arcilla / sulfatos / mica",
  combinado: "Anomalías combinadas (todas)",
  // Píxeles donde 2 o más de los 4 índices coinciden a la vez (julio
  // 2026, pedido explícito de Esthiven) — ver backend/copernicus.py.
  coincidencias: "Coincidencia de 2+ anomalías (más confiable)",
};

const GEOCATMIN = "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services";

/** Mapa de la ficha pública (julio 2026): base satelital (Esri World
 * Imagery) + un ÚNICO panel de capas propio (`PanelCapas`, más abajo),
 * en vez del control nativo de Leaflet + un control aparte apilado
 * debajo — ese esquema de dos cajas con dos estilos visuales distintos
 * fue el motivo del pedido "mejóralo, se ve feo" (julio 2026); ahora
 * todo vive en un solo panel con tipografía y colores de marca. El
 * panel entero arranca plegado a un botón chico "Capas" (pedido
 * explícito: "al igual que el botón Leyenda se vuelve pequeño, quiero
 * que sea lo mismo con Capas") — clic en el título lo despliega, mismo
 * patrón que la Leyenda de abajo. Ya desplegado, tiene 3 apartados
 * colapsables:
 * - "Catastro y geología" (Catastro minero, Geología, Fallas cercanas
 *   si el backend encontró alguna) — el único grupo que arranca
 *   EXPANDIDO dentro del panel, es la referencia base de toda ficha.
 * - "Sensores satelitales · INGEMMET" (ASTER 9-3-1, índices QICIMI,
 *   Anomalías espectrales, Libre denuncio/aviso de retiro) — colapsado
 *   por defecto, son capas pesadas y de uso puntual.
 * - "Sentinel-2 · Copernicus" (4 índices minerales + 1 combinado sobre
 *   el polígono REAL de la concesión, `L.imageOverlay` georreferenciado
 *   con el bbox que manda el backend — ver `backend/copernicus.py`) —
 *   colapsado por defecto, solo aparece si esa capa ya se generó.
 * De paso (julio 2026) se corrigió un bug real encontrado al rediseñar
 * este panel: "Catastro minero" nunca llegaba a `.addTo(mapa)` pese a
 * que el código y la documentación decían "encendida por defecto" — el
 * checkbox aparecía sin marcar y la capa jamás se veía hasta que
 * alguien la activaba a mano.
 * Reemplaza al embed de Google Maps, que no acepta capas externas. */
export function MapaGeocatmin({
  coords,
  poligonoConcesion,
  escalaFallas,
  geologiaEscala,
  anomaliasSatelitales,
  proyectoId,
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
  /** Escala a la que INGEMMET tiene carta de GEOLOGÍA en el punto (agosto
   * 2026): "50k" solo si el backend confirmó cobertura a esa escala. La
   * vista 3D la usa para alternar 100K ↔ 50K con el zoom (mismo
   * comportamiento que las dos capas apiladas del 2D). */
  geologiaEscala?: "50k" | "100k";
  /** Anomalías espectrales minerales de Copernicus sobre el polígono real
   * de la concesión (julio 2026, ver backend/copernicus.py) — bbox +
   * URLs de las 5 capas (4 índices + combinado). null/undefined = sin
   * polígono de concesión o todavía no se generó. */
  anomaliasSatelitales?: {
    bbox: [number, number, number, number];
    capas: Record<string, string>;
  } | null;
  /** Id del proyecto — la vista 3D superpone el catálogo de capas vía
   * `GET /proyectos/{id}/capa-3d/{capa}.png`. */
  proyectoId?: string;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  // Vista 3D (MapLibre) vs. la vista 2D clásica de Leaflet — el botón
  // alterna entre ambas; la 3D se monta lazy solo al activarse.
  const [en3D, setEn3D] = useState(false);

  // Capas activas COMPARTIDAS entre la vista 2D y la 3D (agosto 2026,
  // pedido explícito de Esthiven: "lo que está en 2D que aparezca en 3D y
  // viceversa"). Un solo estado con las mismas ids que el catálogo 3D
  // (catastro/geologia/fallas/aster_931/qicimi/anomalia_espectral/
  // libre_denuncio + los nombres de anomalías de Copernicus). La vista 2D
  // lo aplica a las capas de Leaflet (effect de sincronización de abajo);
  // la 3D (Mapa3D.tsx) lo recibe como prop controlada. Arranca con las
  // mismas capas encendidas por defecto que el mapa 2D clásico.
  const [capasActivas, setCapasActivas] = useState<Record<string, boolean>>({
    catastro: true,
    geologia: true,
    fallas: true,
  });
  const capasActivasRef = useRef(capasActivas);
  capasActivasRef.current = capasActivas;
  // Capas de Leaflet por id (las del panel 2D) y sus checkboxes — se
  // llenan al crear el mapa (ver effect de abajo) y el effect de
  // sincronización las lee para aplicar el estado compartido.
  const capasLeafletRef = useRef<Record<string, L.Layer>>({});
  const capasCheckboxRef = useRef<Record<string, HTMLInputElement>>({});
  // Encabezados de sub-grupo ("Alteración férrica"/"Alteración argílica",
  // agosto 2026) y sus ids por título — el effect de sincronización los
  // repinta (verde si todas sus capas están activas) cuando el cambio de
  // capa viene de la vista 3D, igual que repinta los checkboxes.
  const subgrupoTituloRef = useRef<Record<string, HTMLElement>>({});
  const subgrupoIdsRef = useRef<Record<string, string[]>>({});

  function cambiarCapa(id: string, activa: boolean) {
    setCapasActivas((p) => ({ ...p, [id]: activa }));
  }

  // Escala de la geología (agosto 2026, mismo selector que el panel 3D):
  // "auto" = la cámara decide (100K alejado, 50K dentro de la zona de la
  // concesión); "100k"/"50k" fijan la escala de una. Aquí solo el ref
  // basta: el panel 2D es DOM de Leaflet (no JSX), y el estado de los
  // botones se repinta a mano (`pintarBotones` más abajo).
  const escalaGeologiaRef = useRef<"auto" | "100k" | "50k">("auto");
  // `actualizarGeologia50` vive dentro del effect que crea el mapa (necesita
  // el mapa, la zona y las capas Leaflet) — se expone por ref para que el
  // selector del panel pueda aplicarla de inmediato, sin mover la cámara.
  const actualizarGeologia50Ref = useRef<() => void>(() => {});

  function seleccionarEscalaGeologia(escala: "auto" | "100k" | "50k") {
    escalaGeologiaRef.current = escala;
    actualizarGeologia50Ref.current();
  }

  // Precarga del chunk de MapLibre (~250 KB gzip) unos segundos después
  // de montar la ficha, en segundo plano y sin bloquear nada: el chunk
  // solo se descarga+parsea, no se crea ningún mapa. Cuando el visitante
  // pulsa "Vista 3D", React.lazy reutiliza la misma promesa ya cargada y
  // el mapa arranca casi al instante (agosto 2026, reporte "demora mucho").
  useEffect(() => {
    const t = setTimeout(() => {
      cargarMapa3D().catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  // Relieve del proyecto en segundo plano (agosto 2026, pedido de
  // Esthiven): se calienta la caché HTTP del navegador con los tiles de
  // elevación de la zona (terreno3D.ts). Así, al pulsar "Vista 3D",
  // MapLibre encuentra el DEM ya cacheado y el relieve no espera la red.
  useEffect(() => {
    const [lat, lng] = coords.split(",").map((p) => Number(p.trim()));
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    const t = setTimeout(() => precargarRelieve(lat, lng), 2000);
    return () => clearTimeout(t);
  }, [coords]);

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
    mapaRef.current = mapa;

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
    }).addTo(mapa); // encendida por defecto — ver nota de bug corregido arriba

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
    // polígonos solo traen su código impreso, ej. "N-mz"). El identify
    // viaja por JSONP gracias a useCors:false (el servidor no da CORS).
    // Se consulta la escala VISIBLE — 50K si está encima (modo manual
    // "50k" o modo auto con la vista dentro de la zona), si no la 100K —
    // y si la 50K no tiene carta en el punto, se cae a la 100K (cubre todo
    // el país). Antes el popup SIEMPRE consultaba la 100K y en una zona
    // con carta 50K seguía mostrando el nombre de la 100K (bug real agosto
    // 2026, reportado por Esthiven: en 50K se veía roca plutónica pero el
    // popup decía "Fm Jumasha"). La 50K trae `LITOLOGIA` (p.ej. "Roca
    // plutónica") además de `UNIDAD`; la 100K solo `UNIDAD`/`DESCRIP`.
    // Un contador por click descarta respuestas de clicks viejos (la 50K
    // es lenta, >25s verificado en el backend) para que no se abra el
    // popup de un click anterior sobre otro punto.
    let ultimoClickId = 0;
    mapa.on("click", (e: L.LeafletMouseEvent) => {
      const clickId = ++ultimoClickId;
      const abrirPopup = (props: any, escala: "50k" | "100k") => {
        if (clickId !== ultimoClickId) return;
        const titulo =
          escala === "50k"
            ? props?.LITOLOGIA || props?.UNIDAD || props?.DESCRIP
            : props?.UNIDAD || props?.NAME || props?.DESCRIP;
        if (!titulo) {
          mapa.closePopup();
          return;
        }
        const detalle =
          props?.DESCRIP && props?.DESCRIP !== titulo ? `<br/>${props.DESCRIP}` : "";
        L.popup()
          .setLatLng(e.latlng)
          .setContent(
            `<strong>${titulo}</strong>${detalle}<br/><span style="font-size:11px;color:#64748b">Geología INGEMMET · carta 1:${escala === "50k" ? "50,000" : "100,000"}</span>`
          )
          .openOn(mapa);
      };
      const consultar = (escala: "50k" | "100k") => {
        const servicio =
          escala === "50k"
            ? "SERV_GEOLOGIA_50K_INTEGRADA"
            : "SERV_GEOLOGIA_100K_INTEGRADA";
        identifyFeatures({
          url: `${GEOCATMIN}/${servicio}/MapServer`,
          useCors: false,
        })
          .on(mapa)
          .at(e.latlng)
          .layers([escala === "50k" ? "7" : "6"])
          .tolerance(5)
          .run((error: unknown, geo: any) => {
            if (clickId !== ultimoClickId) return;
            const props = geo?.features?.[0]?.properties;
            if (error || !props) {
              // Sin cobertura en la 50K → se cae a la 100K, que cubre todo
              // el país. Si la propia 100K no responde, se cierra el popup.
              if (escala === "50k") {
                consultar("100k");
              } else {
                mapa.closePopup();
              }
              return;
            }
            abrirPopup(props, escala);
          });
      };
      const manual = escalaGeologiaRef.current;
      const usar50 =
        manual === "50k" || (manual === "auto" && geologia.hasLayer(geologia50));
      consultar(usar50 ? "50k" : "100k");
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
    // `zIndex` >= 20 (julio 2026, pedido explícito: "quiero que las
    // anomalías, sea cualquiera, puedan sobreponerse a la capa de
    // geología") — comparten el pane "geologiaPane" con geología, y
    // geología ya usa zIndex 10/11 (ver más abajo); sin un zIndex propio
    // acá, esri-leaflet las deja en su default (más bajo que 10/11), así
    // que con ambas activas geología SIEMPRE quedaba pintada encima,
    // aunque fuera semitransparente — apagaba el color de la anomalía en
    // vez de dejarla resaltar.
    const aster931 = imageMapLayer({
      url: `${GEOCATMIN}/PRODUCTO_SATELITAL/MD_ASTER_931/ImageServer`,
      opacity: 0.7,
      f: "image",
      useCors: false,
      pane: "geologiaPane",
      zIndex: 20,
      minZoom: 12,
      attribution: "GEOCATMIN · INGEMMET",
    });
    const qicimi = imageMapLayer({
      url: `${GEOCATMIN}/PRODUCTO_SATELITAL/MD_QICIMI/ImageServer`,
      opacity: 0.7,
      f: "image",
      useCors: false,
      pane: "geologiaPane",
      zIndex: 21,
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
      zIndex: 22,
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

    // Libre denunciabilidad / aviso de retiro (julio 2026, pedido
    // explícito de Esthiven): concesiones extinguidas que quedaron en
    // proceso de liberarse para un petitorio nuevo — ámbar = "Libre
    // Denunciabilidad" (ya se puede pedir), morado = "Aviso de Retiro"
    // (Ley 30428, todavía en plazo de aviso antes de abrirse). Sin
    // `layerDefs`: se muestran ambos estados tal cual los define el
    // renderer del propio servicio. `minZoom: 11` (un paso más lejos que
    // las demás capas de este grupo, ~20km de vista) porque Esthiven
    // pidió un radio más amplio que el resto — es información de
    // oportunidad, no de riesgo puntual, tiene sentido verla en un área
    // más grande alrededor del pin.
    const libreDenuncio = dynamicMapLayer({
      url: `${GEOCATMIN}/SERV_LIBREDENUNCIABILIDAD/MapServer`,
      layers: [0],
      opacity: 0.85,
      f: "image",
      useCors: false,
      pane: "geologiaPane",
      zIndex: 23,
      minZoom: 11,
    });
    libreDenuncio.bindPopup((_error: unknown, featureCollection: any) => {
      const props = featureCollection?.features?.[0]?.properties;
      if (!props?.LEYENDA) return false;
      const concesion = props.CONCESION ? `<br/>Antigua concesión: ${props.CONCESION}` : "";
      return `<strong>${props.LEYENDA}</strong>${concesion}<br/><span style="font-size:11px;color:#64748b">GEOCATMIN · INGEMMET</span>`;
    });

    // Anomalías espectrales minerales de Copernicus sobre el polígono REAL
    // de la concesión (julio 2026, pedido explícito de Esthiven tras el
    // experimento aislado con Sentinel-2) — 4 índices + 1 combinado. A
    // diferencia de las capas de arriba (servicios ArcGIS en vivo), esto
    // es un PNG ya generado y cacheado por el backend con su propio bbox
    // conocido, así que se superpone con L.imageOverlay (georeferenciado
    // directo), no con un dynamicMapLayer.
    const overlaysAnomalias: Record<string, L.ImageOverlay> = {};
    if (anomaliasSatelitales) {
      const [xmin, ymin, xmax, ymax] = anomaliasSatelitales.bbox;
      const bounds = L.latLngBounds([ymin, xmin], [ymax, xmax]);
      // zIndex >= 30, mismo motivo que aster931/qicimi/anomalias arriba:
      // sin esto, `L.imageOverlay` cae en su default (zIndex:1) — muy por
      // debajo de geología (10/11) — y quedaba tapada por ella.
      let zIndexAnomalia = 30;
      for (const [nombre, url] of Object.entries(anomaliasSatelitales.capas)) {
        // KEY IMPORTANTE (sync 2D↔3D, agosto 2026): la clave es el id
        // TÉCNICO (ej. "oxidos_de_hierro"), el mismo que usa el catálogo
        // 3D (Mapa3D.catalogoCapas), NO el título legible — el estado
        // compartido capasActivas usa ids únicos entre ambas vistas.
        overlaysAnomalias[nombre] = L.imageOverlay(
          `${BASE_URL}${url}`,
          bounds,
          { pane: "geologiaPane", zIndex: zIndexAnomalia++ }
        );
      }
    }

    // Panel de capas ÚNICO (julio 2026, rediseño pedido explícitamente:
    // "mejora la estética de ubicación y las capas") — antes había dos
    // controles apilados con look distinto (el nativo de Leaflet arriba,
    // el agrupado propio debajo); ahora es un solo control con estilo
    // propio de principio a fin (clases `capas-*`, ver overrides en
    // index.css) y 3 apartados colapsables — checkbox propio que agrega
    // o quita la capa del mapa al hacer clic (mismo patrón que la
    // Leyenda de abajo). El panel entero arranca plegado a un botón
    // chico "Capas" (pedido explícito, julio 2026: "al igual que el
    // botón Leyenda se vuelve pequeño, quiero que sea lo mismo con
    // Capas") — antes el panel completo (con "Catastro y geología" ya
    // expandido) ocupaba espacio de entrada; ahora, igual que la
    // Leyenda, hay que hacer clic en el título para verlo.
    const PanelCapas = L.Control.extend({
      options: { position: "topright" },
      onAdd: function () {
        const div = L.DomUtil.create(
          "div",
          "leaflet-control-layers leaflet-control-layers-expanded"
        );

        const titulo = L.DomUtil.create("div", "capas-panel-titulo", div);
        titulo.innerHTML = `<span class="capas-panel-flecha">▾</span>Capas`;

        const contenido = L.DomUtil.create("div", "capas-panel-contenido", div);
        contenido.style.display = "none";
        titulo.addEventListener("click", () => {
          const expandido = contenido.style.display !== "none";
          contenido.style.display = expandido ? "none" : "block";
          const flecha = titulo.querySelector<HTMLElement>(".capas-panel-flecha");
          if (flecha) flecha.style.transform = expandido ? "rotate(-90deg)" : "rotate(0deg)";
        });

        // Cada capa se identifica por `id` (el mismo id técnico que usa
        // el catálogo 3D) + su etiqueta legible. El checkbox ya NO toca
        // el mapa directamente: lee/escribe el estado compartido
        // `capasActivas` (ver effect de sincronización abajo) — la
        // membresía de Leaflet la aplica ese effect, que es el que
        // mantiene el control en sync cuando el cambio viene de la 3D.
        // El grupo Copernicus se subdivide (agosto 2026, pedido explícito
        // de Esthiven): los índices van bajo "Alteración férrica" (óxidos
        // de hierro + hierro ferroso) y "Alteración argílica" (arcillas +
        // arcilla/sulfatos/mica). "Combinado" y "coincidencias" van
        // APARTE, sin sub-título (aclarado en vivo por Esthiven agosto
        // 2026: al plegar "Alteración argílica" con "−" no deben arrastrar
        // esas dos capas — son su propia cosa, no parte de la argílica).
        const grupos: {
          titulo: string;
          expandido: boolean;
          secciones: { titulo?: string; capas: [string, string][] }[];
        }[] = [
          {
            titulo: "Catastro y geología",
            expandido: true,
            secciones: [
              {
                capas: [
                  ["catastro", "Catastro minero"],
                  ["geologia", "Geología (50K si existe / 100K)"],
                  ...(fallas ? ([["fallas", "Fallas geológicas cercanas"]] as [string, string][]) : []),
                ],
              },
            ],
          },
          {
            titulo: "Sensores satelitales · INGEMMET",
            expandido: false,
            secciones: [
              {
                capas: [
                  ["aster_931", "ASTER 9-3-1 (falso color, roca/vegetación)"],
                  ["qicimi", "Índices minerales QICIMI"],
                  ["anomalia_espectral", "Anomalías espectrales"],
                  ["libre_denuncio", "Libre denuncio / aviso de retiro (~20km)"],
                ],
              },
            ],
          },
        ];
        if (Object.keys(overlaysAnomalias).length > 0) {
          const ids = Object.keys(overlaysAnomalias);
          const titulo = (id: string) => TITULOS_ANOMALIAS[id] ?? id;
          const en = (lista: string[]) =>
            ids
              .filter((id) => lista.includes(id))
              .map((id) => [id, titulo(id)] as [string, string]);
          grupos.push({
            titulo: "Sentinel-2 · Copernicus",
            expandido: false,
            secciones: [
              {
                titulo: "Alteración férrica",
                capas: en(["oxidos_de_hierro", "hierro_ferroso"]),
              },
              {
                titulo: "Alteración argílica",
                capas: en(["arcillas", "arcilla_sulfatos_mica"]),
              },
              // combinado / coincidencias van aparte, sin sub-título
              { capas: en(["combinado", "coincidencias"]) },
            ],
          });
        }

        // Cada grupo es colapsable (pedido explícito de Esthiven, con una
        // captura del panel de capas de ArcGIS Online como referencia):
        // solo "Catastro y geología" arranca expandido — el resto son
        // capas pesadas de uso puntual, no hace falta mostrarlas todas
        // de entrada (antes SÍ arrancaban expandidas, 9 checkboxes de
        // golpe encima del mapa).
        // `pintarSubgrupos` pinta los títulos de sub-grupo (verde si todas
        // sus capas están activas, gris si no) y se reusa tanto al
        // construir el panel como en el effect de sincronización 2D↔3D
        // (no es JSX, no hay re-render automático).
        const pintarSubgrupos = () => {
          for (const [titulo, el] of Object.entries(subgrupoTituloRef.current)) {
            const ids = subgrupoIdsRef.current[titulo] ?? [];
            if (ids.length === 0) continue;
            const activas = ids.filter((id) => capasActivasRef.current[id] === true).length;
            const todas = activas === ids.length;
            el.style.color = todas ? "#10b981" : "#64748b";
            el.style.fontWeight = todas ? "700" : "600";
          }
        };
        grupos.forEach((grupo, i) => {
          if (i > 0) {
            L.DomUtil.create("div", "leaflet-control-layers-separator", contenido);
          }
          const encabezado = L.DomUtil.create("div", "capas-grupo-encabezado", contenido);
          encabezado.style.display = "flex";
          encabezado.style.alignItems = "center";
          encabezado.style.gap = "4px";
          encabezado.style.cursor = "pointer";
          encabezado.style.userSelect = "none";
          encabezado.style.fontWeight = "600";
          encabezado.style.fontSize = "12px";
          encabezado.style.textTransform = "uppercase";
          encabezado.style.letterSpacing = "0.02em";
          encabezado.style.margin = "0 0 4px";

          const flecha = L.DomUtil.create("span", "", encabezado);
          flecha.textContent = "▾";
          flecha.style.fontSize = "10px";
          flecha.style.display = "inline-block";
          flecha.style.transition = "transform 0.15s";
          if (!grupo.expandido) flecha.style.transform = "rotate(-90deg)";

          L.DomUtil.create("span", "", encabezado).textContent = grupo.titulo;

          const listaCapas = L.DomUtil.create("div", "", contenido);
          if (!grupo.expandido) listaCapas.style.display = "none";
          encabezado.addEventListener("click", () => {
            const expandido = listaCapas.style.display !== "none";
            listaCapas.style.display = expandido ? "none" : "block";
            flecha.style.transform = expandido ? "rotate(-90deg)" : "rotate(0deg)";
          });

          // Las secciones con sub-título (hoy solo las de Copernicus:
          // "Alteración férrica"/"Alteración argílica") pintan un
          // encabezado PROPIO con dos zonas de clic (agosto 2026, pedido
          // de Esthiven): el "+"/"−" colapsa o expande la lista de capas
          // del sub-grupo, y el TÍTULO es un interruptor maestro que
          // activa o desactiva TODAS sus capas de una ("clic en Alteración
          // argílica → se encienden las 4; otro clic las apaga"). Las
          // capas sin sub-título van sueltas, sin encabezado. Se salta una
          // sección vacía (el backend no siempre incluye todos los índices).
          grupo.secciones.forEach((seccion) => {
            if (seccion.capas.length === 0) return;
            const contenedorSub = seccion.titulo
              ? L.DomUtil.create("div", "", listaCapas)
              : listaCapas;
            let listaSub = listaCapas;
            if (seccion.titulo) {
              const sub = L.DomUtil.create("div", "capas-subgrupo", contenedorSub);
              sub.style.display = "flex";
              sub.style.alignItems = "center";
              sub.style.gap = "4px";
              sub.style.cursor = "default";
              sub.style.margin = "6px 0 2px 12px";
              sub.style.userSelect = "none";

              const indicador = L.DomUtil.create("span", "", sub);
              indicador.textContent = "−";
              indicador.title = "Mostrar / ocultar las capas de este grupo";
              indicador.style.fontSize = "11px";
              indicador.style.lineHeight = "1";
              indicador.style.width = "13px";
              indicador.style.textAlign = "center";
              indicador.style.color = "#64748b";
              indicador.style.cursor = "pointer";
              indicador.style.border = "1px solid rgba(0,0,0,0.15)";
              indicador.style.borderRadius = "3px";
              indicador.style.background = "transparent";
              indicador.addEventListener("click", (ev) => {
                ev.stopPropagation();
                const expandido = listaSub.style.display !== "none";
                listaSub.style.display = expandido ? "none" : "block";
                indicador.textContent = expandido ? "+" : "−";
              });

              const titulo = L.DomUtil.create("span", "", sub);
              titulo.textContent = seccion.titulo;
              titulo.title = "Clic: activa o desactiva todas las capas de este grupo";
              titulo.style.fontSize = "11px";
              titulo.style.fontWeight = "600";
              titulo.style.textTransform = "uppercase";
              titulo.style.letterSpacing = "0.02em";
              titulo.style.color = "#64748b";
              titulo.style.cursor = "pointer";
              titulo.addEventListener("click", (ev) => {
                ev.stopPropagation();
                const ids = seccion.capas.map(([id]) => id);
                const algunaActiva = ids.some(
                  (id) => capasActivasRef.current[id] === true
                );
                const nuevo = !algunaActiva;
                ids.forEach((id) => {
                  const cb = capasCheckboxRef.current[id];
                  if (cb) cb.checked = nuevo;
                  cambiarCapa(id, nuevo);
                });
                pintarSubgrupos();
              });

              subgrupoTituloRef.current[seccion.titulo] = titulo;
              subgrupoIdsRef.current[seccion.titulo] = seccion.capas.map(([id]) => id);
              listaSub = L.DomUtil.create("div", "", contenedorSub);
            }

            seccion.capas.forEach(([id, label]) => {
              const fila = L.DomUtil.create("label", "capas-fila", listaSub);
              fila.style.display = "flex";
              fila.style.alignItems = "center";
              fila.style.gap = "6px";
              fila.style.cursor = "pointer";
              fila.style.marginLeft = "12px"; // indentado bajo el grupo
              const checkbox = L.DomUtil.create("input", "", fila) as HTMLInputElement;
              checkbox.type = "checkbox";
              checkbox.checked = capasActivasRef.current[id] === true;
              capasCheckboxRef.current[id] = checkbox;
              checkbox.addEventListener("change", () => {
                cambiarCapa(id, checkbox.checked);
              });
              const texto = L.DomUtil.create("span", "", fila);
              texto.textContent = label;
              texto.style.fontSize = "13px";

              // Selector de escala de la geología (agosto 2026, mismo que el
              // panel 3D): solo cuando INGEMMET tiene carta 50K además de la
              // 100K. "Auto" = la cámara decide (100K alejado, 50K dentro de
              // la zona de la concesión); "100K"/"50K" fijan la escala de una.
              if (id === "geologia" && geologiaEscala === "50k") {
                const caja = L.DomUtil.create("div", "capas-escala", listaCapas);
                caja.style.display = "flex";
                caja.style.alignItems = "center";
                caja.style.gap = "4px";
                caja.style.margin = "2px 0 6px 30px";
                caja.style.fontSize = "11px";
                caja.style.color = "#64748b";
                L.DomUtil.create("span", "", caja).textContent = "Escala:";
                const pintarBotones = () => {
                  const actual = escalaGeologiaRef.current;
                  for (const b of Array.from(
                    caja.querySelectorAll<HTMLButtonElement>("button")
                  )) {
                    const activo = b.dataset.escala === actual;
                    b.style.border =
                      "1px solid " + (activo ? "#10b981" : "rgba(0,0,0,0.15)");
                    b.style.color = activo ? "#10b981" : "#334155";
                    b.style.fontWeight = activo ? "600" : "400";
                  }
                };
                const botonEscala = (
                  escala: "auto" | "100k" | "50k",
                  etiqueta: string,
                  titulo: string
                ) => {
                  const b = L.DomUtil.create("button", "", caja) as HTMLButtonElement;
                  b.type = "button";
                  b.dataset.escala = escala;
                  b.title = titulo;
                  b.textContent = etiqueta;
                  b.style.background = "transparent";
                  b.style.borderRadius = "4px";
                  b.style.padding = "1px 8px";
                  b.style.cursor = "pointer";
                  b.style.fontSize = "11px";
                  b.style.lineHeight = "1.4";
                  b.addEventListener("click", () => {
                    seleccionarEscalaGeologia(escala);
                    pintarBotones();
                  });
                  return b;
                };
                botonEscala("auto", "Auto", "Automático: cambia con el zoom");
                botonEscala("100k", "100K", "Carta 1:100,000");
                botonEscala("50k", "50K", "Carta 1:50,000");
                pintarBotones();
              }
            });
          });
        });
        pintarSubgrupos();

        L.DomEvent.disableClickPropagation(div);
        return div;
      },
    });

    // Registro id → capa de Leaflet (sync 2D↔3D): el effect de abajo usa
    // estas capas para aplicar el estado compartido `capasActivas`, y se
    // limpian al desmontar el mapa (al ir a 3D) para que el map nuevo al
    // volver registre sus propias instancias.
    capasLeafletRef.current = {
      catastro,
      geologia,
      ...(fallas ? { fallas } : {}),
      aster_931: aster931,
      qicimi,
      anomalia_espectral: anomalias,
      libre_denuncio: libreDenuncio,
      ...overlaysAnomalias,
    };

    new PanelCapas().addTo(mapa);

    // Leyenda de colores (julio 2026, pedido explícito de Esthiven: "que
    // expliques qué es el color de las capas satelitales" — y luego,
    // rediseñada, "la veo engorrosa" con la versión de puros párrafos de
    // texto corrido) — un control propio, plegado por defecto. Ahora es
    // una lista real de muestras de color (cuadradito + etiqueta corta),
    // agrupada en los mismos 2 apartados que el panel de Capas, en vez
    // de 5 párrafos de prosa con puntos separando colores en el medio
    // del texto. QICIMI SÍ tiene un color = un mineral exacto (confirmado
    // con la metadata oficial de INGEMMET/GEOIDEP); ASTER 9-3-1 es falso
    // color de bandas crudas, no una tabla 1 a 1 — esa y otras
    // aclaraciones que no son "color = significado" van en una sola nota
    // al pie, no repartidas en cada grupo.
    const Leyenda = L.Control.extend({
      options: { position: "bottomleft" },
      onAdd: function () {
        // Antes fijaba fondo blanco + texto oscuro por estilo inline sin
        // importar el tema — en modo oscuro quedaba un recuadro blanco
        // brillante rompiendo el resto de la página. Ahora usa la clase
        // "mapa-leyenda" (ver overrides de tema en index.css), igual que
        // el panel de capas.
        const div = L.DomUtil.create("div", "leaflet-bar mapa-leyenda");
        const muestra = (color: string, etiqueta: string) => `
          <div class="leyenda-fila">
            <span class="leyenda-punto" style="background:${color}"></span>${etiqueta}
          </div>`;
        div.innerHTML = `
          <div class="mapa-leyenda-titulo">
            <span class="mapa-leyenda-flecha">▾</span>ℹ️ Leyenda de colores
          </div>
          <div class="leyenda-detalle" style="display:none;">
            <p class="leyenda-grupo-titulo">Sensores satelitales · INGEMMET</p>
            ${muestra("#c0392b", "QICIMI: cuarzo / sílice")}
            ${muestra("#16a34a", "QICIMI: carbonatos")}
            ${muestra("#2563eb", "QICIMI: máficos")}
            ${muestra("red", "Anomalía espectral: óxidos")}
            ${muestra("#16a34a", "Anomalía espectral: arcillas")}
            ${muestra("#ca8a04", "Anomalía espectral: óxidos y arcillas")}
            ${muestra("#f6c567", "Libre denunciabilidad")}
            ${muestra("#df73ff", "Aviso de retiro (Ley 30428)")}

            <p class="leyenda-grupo-titulo">Sentinel-2 · Copernicus</p>
            <p class="leyenda-subgrupo">Alteración férrica</p>
            ${muestra("rgb(220,20,20)", "Óxidos de hierro")}
            ${muestra("rgb(255,140,0)", "Hierro ferroso")}
            <p class="leyenda-subgrupo">Alteración argílica</p>
            ${muestra("rgb(0,102,204)", "Arcillas")}
            ${muestra("rgb(204,204,0)", "Arcilla / sulfatos / mica")}

            <div class="leyenda-fila" style="margin-top:6px">
              <span class="leyenda-punto" style="background:linear-gradient(90deg, rgb(220,20,20), rgb(0,102,204), rgb(255,140,0), rgb(204,204,0))"></span>
              Anomalías combinadas (las 4 superpuestas)
            </div>
            ${muestra("rgb(155,0,200)", "Coincidencia de 2+ índices")}

            <p class="leyenda-nota">Cada índice de Sentinel-2 solo pinta el 10% más alto de
            ese valor — el resto queda transparente. ASTER 9-3-1 es falso color de bandas
            crudas, sin tabla de colores: verde ≈ vegetación, rojo/rosa/naranja ≈ roca
            expuesta. Ninguna es una clasificación fina de alteración hidrotermal
            (propilítica/argílica/filítica).</p>
          </div>
        `;
        L.DomEvent.disableClickPropagation(div);
        div.addEventListener("click", () => {
          const detalle = div.querySelector<HTMLElement>(".leyenda-detalle");
          const flecha = div.querySelector<HTMLElement>(".mapa-leyenda-flecha");
          const expandido = detalle?.style.display !== "none";
          if (detalle) detalle.style.display = expandido ? "none" : "block";
          if (flecha) flecha.style.transform = expandido ? "rotate(-90deg)" : "rotate(0deg)";
        });
        return div;
      },
    });
    new Leyenda().addTo(mapa);

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
      // En modo manual (selector del panel) la escala queda fija: la 50K
      // siempre encima en "50k", siempre fuera en "100k" — la cámara no
      // la vuelve a cambiar hasta que se toca "Auto".
      const manual = escalaGeologiaRef.current;
      if (manual === "50k") {
        if (!geologia.hasLayer(geologia50)) geologia.addLayer(geologia50);
        return;
      }
      if (manual === "100k") {
        if (geologia.hasLayer(geologia50)) geologia.removeLayer(geologia50);
        return;
      }
      const dentro = zona50
        ? zona50.contains(mapa.getBounds())
        : mapa.getZoom() >= 12;
      if (dentro && !geologia.hasLayer(geologia50)) {
        geologia.addLayer(geologia50);
      } else if (!dentro && geologia.hasLayer(geologia50)) {
        geologia.removeLayer(geologia50);
      }
    };
    actualizarGeologia50Ref.current = actualizarGeologia50;
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
      mapaRef.current = null;
      capasLeafletRef.current = {};
      capasCheckboxRef.current = {};
      subgrupoTituloRef.current = {};
      subgrupoIdsRef.current = {};
      mapa.remove();
    };
    // `en3D` en las deps a propósito: al alternar 2D↔3D el contenedor de
    // Leaflet se desmonta/remonta (ver return), y sin esto el effect NO
    // volvería a correr al volver a 2D (las otras deps no cambian) —
    // dejaría el mapa vacío hasta recargar. Al ir a 3D, `div` es null
    // (contenedor desmontado) y el effect hace early return; al volver a
    // 2D, recrea el mapa.
  }, [coords, poligonoConcesion, escalaFallas, anomaliasSatelitales, en3D]);

  // Sincroniza el estado compartido de capas con el mapa 2D (y sus
  // checkboxes) — agosto 2026, pedido explícito de Esthiven: "lo que
  // está en 2D que aparezca en 3D y viceversa". Cada vez que cambia
  // `capasActivas` (desde el panel 2D o desde la vista 3D) se
  // agregan/quitan las capas de Leaflet correspondientes y se refleja
  // el estado en los checkboxes. `en3D` en las deps: al volver a 2D el
  // mapa se recrea (effect de arriba) y este corre de nuevo para aplicar
  // el estado que dejó la 3D.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    for (const [id, capa] of Object.entries(capasLeafletRef.current)) {
      if (!capa) continue;
      const activa = capasActivas[id] === true;
      const presente = mapa.hasLayer(capa);
      if (activa && !presente) mapa.addLayer(capa);
      else if (!activa && presente) mapa.removeLayer(capa);
    }
    for (const [id, checkbox] of Object.entries(capasCheckboxRef.current)) {
      if (checkbox) checkbox.checked = capasActivas[id] === true;
    }
    // Repinta los encabezados de sub-grupo (interruptor maestro): verde y
    // en negrita cuando TODAS sus capas están activas, gris si no.
    for (const [titulo, el] of Object.entries(subgrupoTituloRef.current)) {
      const ids = subgrupoIdsRef.current[titulo] ?? [];
      if (ids.length === 0) continue;
      const activas = ids.filter((id) => capasActivas[id] === true).length;
      const todas = activas === ids.length;
      el.style.color = todas ? "#10b981" : "#64748b";
      el.style.fontWeight = todas ? "700" : "600";
    }
  }, [capasActivas, en3D]);

  return (
    <div className="relative h-full w-full">
      {/* Vista 2D (Leaflet) — se desmonta del DOM mientras está activa la
          3D para que MapLibre ocupe el contenedor sin compartirlo. Al
          volver, el useEffect de arriba recrea el mapa Leaflet. */}
      {!en3D ? (
        <div ref={contenedorRef} className="mapa-geocatmin z-0 h-full min-h-64 w-full" />
      ) : (
        <Suspense
          fallback={
            <div className="flex h-full min-h-64 w-full items-center justify-center border border-black/10 bg-tarjeta text-sm text-texto-suave dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-suave-dark">
              Cargando vista 3D…
            </div>
          }
        >
          <Mapa3DLazy
            coords={coords}
            poligonoConcesion={poligonoConcesion}
            proyectoId={proyectoId}
            escalaFallas={escalaFallas}
            geologiaEscala={geologiaEscala}
            anomaliasSatelitales={anomaliasSatelitales}
            capasActivas={capasActivas}
            onCambiarCapa={cambiarCapa}
          />
        </Suspense>
      )}

      {/* Botón para alternar 2D/3D — estilo consistente con el panel de
          capas y la leyenda (borde fino, esquinas suaves). */}
      <button
        type="button"
        onClick={() => setEn3D((v) => !v)}
        className="mapa-3d-boton"
        aria-pressed={en3D}
        title={en3D ? "Volver a la vista 2D" : "Ver la concesión en 3D con relieve"}
      >
        {en3D ? "Mapa 2D" : "Vista 3D"}
      </button>
    </div>
  );
}

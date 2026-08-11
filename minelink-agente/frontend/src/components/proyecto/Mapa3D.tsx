import { useEffect, useMemo, useRef, useState } from "react";
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
// RGB a metros sobre el mar). Exageración 2.5x + una capa `hillshade`
// (source propia, issue maplibre#2035) + pitch 60: la concesión chica en
// zoom alto tiene poco desnivel en metros y con 1.5x se veía plano
// (reporte explícito de Esthiven, agosto 2026) — la exageración y el
// sombreado de laderas hacen que el relieve se lea al primer golpe de
// vista sin volverse una caricatura.
//
// Basemap: la MISMA base satelital de Esri World Imagery que ya usa el
// mapa 2D de Leaflet (server.arcgisonline.com) — MapLibre acepta tiles
// raster XYZ, así que no se depende de ningún servicio nuevo pago.
//
// Estrategia de carga (agosto 2026): el mapa arranca PLANO (pitch 0 y SIN
// terreno) para que el satélite se pinte de inmediato. El relieve + la
// inclinación se activan en el PRIMER `idle` o por un temporizador de
// respaldo de 8s — corrección de un bug real reportado en vivo: un source
// que falla (un overlay que devuelve 404, o tiles DEM inalcanzables) puede
// impedir que `idle` se dispare (bug conocido de MapLibre GL, issue #5430),
// y el código anterior — que esperaba `idle` adentro de `load` — dejaba el
// mapa en "Cargando relieve 3D…" para siempre, sin polígono ni terreno.
// Además, cada capa del catálogo se PRECARGA (Image + onload) antes de
// agregar su source a MapLibre: si la capa falla, simplemente no se agrega,
// y así un overlay roto no puede colgar tampoco la carga del mapa.
//
// Panel de capas (agosto 2026, pedido explícito: "las capas de 2D y todo su
// catálogo también en 3D"): replica el catálogo del mapa 2D — Catastro y
// geología (catastro, geología 100K, fallas si el backend confirmó alguna),
// Sensores satelitales · INGEMMET (ASTER 9-3-1, QICIMI, anomalías
// espectrales, libre denuncio) y Sentinel-2 · Copernicus (si ya se generó,
// mismas URLs que el 2D). Cada capa es un PNG transparente servido por
// `GET /proyectos/{id}/capa-3d/{capa}.png` sobre el MISMO bbox que la
// galería de análisis del PDF, superpuesto como source raster de MapLibre
// con su propio `raster-opacity` (el backend exporta opacidad plena).
// Capas y geometría: satélite (base) → capas del panel → borde verde de la
// concesión → pin. El catálogo/UI replica el panel 2D reusando sus mismas
// clases CSS (`.capas-*`, `.mapa-geocatmin`).
//
// Estado de capas COMPARTIDO con el 2D (agosto 2026, pedido explícito de
// Esthiven: "lo que está en 2D que aparezca en 3D y viceversa"): este
// componente es CONTROLADO — recibe `capasActivas` como prop y reporta los
// cambios con `onCambiarCapa(id, activa)`; no tiene estado interno de capas
// (el viejo `capasOn` se eliminó). Al montar carga las capas que estén
// activas en el estado compartido (no solo las "por defecto"), así lo
// prendido en 2D aparece en 3D, y lo que se prenda/apague acá se refleja
// en el 2D al volver. La habilitación del panel NO depende de `load`/
// `isStyleLoaded` (ver "Estrategia de carga"): un arranque forzado por
// temporizador de respaldo la garantiza — corrección del bug real donde
// los checkboxes quedaban muertos y el clic "no hacía nada".

const SATELITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

// Mismo margen que backend/geocatmin.py (_MARGEN_ANALISIS): las capas de la
// vista 3D deben encuadrar EXACTAMENTE el mismo terreno que la galería
// "catastro/geología/fallas" del PDF, o no calzarían con el polígono que el
// propio mapa 3D dibuja encima.
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
    const medioLng =
      Math.max((Math.max(...lngs) - Math.min(...lngs)) / 2, 0.0008) * MARGEN_OVERLAY;
    const medioLat =
      Math.max((Math.max(...lats) - Math.min(...lats)) / 2, 0.0008) * MARGEN_OVERLAY;
    return [cx - medioLng, cy - medioLat, cx + medioLng, cy + medioLat];
  }
  const [lat, lng] = coords.split(",").map((p) => Number(p.trim()));
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  const medio = 0.006 * MARGEN_OVERLAY;
  return [lng - medio, lat - medio, lng + medio, lat + medio];
}

// Nombre tecnico -> etiqueta legible para el panel de capas (mismo
// orden/nombres que backend/copernicus.py NOMBRES_CAPAS y que el panel del
// mapa 2D — duplicado acá a propósito, ver MapaGeocatmin.tsx).
const TITULOS_ANOMALIAS: Record<string, string> = {
  oxidos_de_hierro: "Anomalía: óxidos de hierro",
  arcillas: "Anomalía: arcillas",
  hierro_ferroso: "Anomalía: hierro ferroso",
  arcilla_sulfatos_mica: "Anomalía: arcilla/sulfatos/mica",
  combinado: "Anomalías combinadas (todas)",
  coincidencias: "Coincidencia de 2+ anomalías (más confiable)",
};

interface AnomaliasSatelitales {
  bbox: [number, number, number, number];
  capas: Record<string, string>;
}

interface CapaDef {
  id: string;
  grupo: string;
  etiqueta: string;
  url: string;
  bbox: [number, number, number, number];
  opacidad: number;
  porDefecto: boolean;
}

// Catálogo completo de capas 3D — espejo del panel "Capas" del mapa 2D.
function catalogoCapas(opts: {
  proyectoId?: string;
  bbox?: [number, number, number, number] | null;
  escalaFallas?: "50k" | "100k" | null;
  anomaliasSatelitales?: AnomaliasSatelitales | null;
}): CapaDef[] {
  const capas: CapaDef[] = [];
  const base = opts.proyectoId ? `${BASE_URL}/proyectos/${opts.proyectoId}` : "";
  const push = (
    id: string,
    grupo: string,
    etiqueta: string,
    url: string | undefined,
    bbox: [number, number, number, number] | undefined,
    opacidad: number,
    porDefecto: boolean
  ) => {
    if (!url || !bbox) return;
    capas.push({ id, grupo, etiqueta, url, bbox, opacidad, porDefecto });
  };
  if (opts.bbox) {
    push("catastro", "Catastro y geología", "Catastro minero", `${base}/capa-3d/catastro.png`, opts.bbox, 0.9, true);
    push("geologia", "Catastro y geología", "Geología (100K)", `${base}/capa-3d/geologia.png`, opts.bbox, 0.6, true);
    push("fallas", "Catastro y geología", "Fallas geológicas cercanas", `${base}/capa-3d/fallas.png`, opts.bbox, 0.9, true);
    push("aster_931", "Sensores satelitales · INGEMMET", "ASTER 9-3-1 (falso color, roca/vegetación)", `${base}/capa-3d/aster_931.png`, opts.bbox, 0.7, false);
    push("qicimi", "Sensores satelitales · INGEMMET", "Índices minerales QICIMI", `${base}/capa-3d/qicimi.png`, opts.bbox, 0.7, false);
    push("anomalia_espectral", "Sensores satelitales · INGEMMET", "Anomalías espectrales", `${base}/capa-3d/anomalia_espectral.png`, opts.bbox, 0.9, false);
    push("libre_denuncio", "Sensores satelitales · INGEMMET", "Libre denuncio / aviso de retiro", `${base}/capa-3d/libre_denuncio.png`, opts.bbox, 0.85, false);
  }
  if (opts.anomaliasSatelitales) {
    const [xmin, ymin, xmax, ymax] = opts.anomaliasSatelitales.bbox;
    const bboxAnomalias: [number, number, number, number] = [xmin, ymin, xmax, ymax];
    for (const [nombre, url] of Object.entries(opts.anomaliasSatelitales.capas)) {
      push(
        nombre,
        "Sentinel-2 · Copernicus",
        TITULOS_ANOMALIAS[nombre] ?? nombre,
        `${BASE_URL}${url}`,
        bboxAnomalias,
        1,
        false
      );
    }
  }
  return capas;
}

// Precarga la imagen antes de agregar el source: si la URL falla (404/red),
// la capa no se agrega y el mapa nunca queda "colgado" esperando un tile que
// no llega (bug conocido de MapLibre: un source roto puede impedir `idle`).
function precargarImagen(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`no se pudo cargar ${url}`));
    img.src = url;
  });
}

export function Mapa3D({
  coords,
  poligonoConcesion,
  proyectoId,
  escalaFallas,
  anomaliasSatelitales,
  capasActivas,
  onCambiarCapa,
}: {
  coords: string;
  /** Anillos [lng, lat] de la concesión (de GEOCATMIN, vía backend) —
   * se proyectan sobre el terreno en 3D. */
  poligonoConcesion?: number[][][] | null;
  /** Id del proyecto: con él se arma el catálogo de capas 3D
   * (`GET /proyectos/{id}/capa-3d/{capa}.png`). Sin id (p. ej. en el visor
   * de otra página) se omite el grupo GEOCATMIN y solo quedan Copernicus. */
  proyectoId?: string;
  /** Escala a la que el backend confirmó fallas cercanas — solo entonces se
   * ofrece la capa "Fallas", mismo criterio que el panel 2D. */
  escalaFallas?: "50k" | "100k" | null;
  /** Anomalías espectrales de Copernicus sobre el polígono real — mismas
   * URLs/bbox que el mapa 2D (ver MapaGeocatmin). */
  anomaliasSatelitales?: AnomaliasSatelitales | null;
  /** Estado COMPARTIDO de capas activas con el mapa 2D (ver
   * MapaGeocatmin): la 3D es controlada — si una capa está encendida acá
   * es porque también lo está (o lo estuvo) en 2D, y viceversa. */
  capasActivas: Record<string, boolean>;
  /** Reporta un cambio de capa hacia el estado compartido (el padre lo
   * refleja en el 2D). Se llama solo cuando la capa YA se cargó bien. */
  onCambiarCapa: (id: string, activa: boolean) => void;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<maplibregl.Map | null>(null);
  const capasRef = useRef<CapaDef[]>([]);
  // Espejo de `capasActivas` para leerlo dentro del effect del mapa sin
  // meterlo en sus deps (cambiar capas no debe recrear el mapa).
  const capasActivasRef = useRef(capasActivas);
  capasActivasRef.current = capasActivas;

  const [error, setError] = useState<string | null>(null);
  const [relieveActivo, setRelieveActivo] = useState(false);
  const [relieveError, setRelieveError] = useState(false);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({
    "Catastro y geología": true,
  });
  const [capasCargando, setCapasCargando] = useState<Record<string, boolean>>({});
  const [capasError, setCapasError] = useState<Record<string, string>>({});
  const [capasListas, setCapasListas] = useState(false);

  const bbox = useMemo(() => bboxOverlay(poligonoConcesion, coords), [poligonoConcesion, coords]);
  const capas = useMemo(
    () =>
      catalogoCapas({
        proyectoId,
        bbox,
        escalaFallas,
        anomaliasSatelitales,
      }),
    [proyectoId, bbox, escalaFallas, anomaliasSatelitales]
  );
  capasRef.current = capas;

  const grupos = useMemo(() => {
    const resultado: { titulo: string; capas: CapaDef[] }[] = [];
    for (const c of capas) {
      let g = resultado.find((x) => x.titulo === c.grupo);
      if (!g) {
        g = { titulo: c.grupo, capas: [] };
        resultado.push(g);
      }
      g.capas.push(c);
    }
    return resultado;
  }, [capas]);

  // Quita la capa del mapa (layer y source). Inofensivo si no está.
  function quitarCapa(id: string) {
    const mapa = mapaRef.current;
    if (!mapa) return;
    const layerId = `capa-${id}`;
    try {
      if (mapa.getLayer(layerId)) mapa.removeLayer(layerId);
    } catch {
      /* cosmético */
    }
    try {
      if (mapa.getSource(id)) mapa.removeSource(id);
    } catch {
      /* cosmético */
    }
  }

  // Agrega la capa al mapa, SIEMPRE después de precargar la imagen (ver
  // arriba). El `beforeId: "pin"` la deja por debajo del polígono y el pin.
  async function cargarCapa(id: string): Promise<boolean> {
    const mapa = mapaRef.current;
    if (!mapa) return false;
    const capa = capasRef.current.find((c) => c.id === id);
    if (!capa) return false;
    if (mapa.getSource(id)) return true;
    try {
      await precargarImagen(capa.url);
    } catch {
      return false;
    }
    try {
      mapa.addSource(id, {
        type: "raster",
        tiles: [capa.url],
        tileSize: 1000,
        bounds: capa.bbox,
        maxzoom: 24,
      });
      try {
        mapa.addLayer(
          {
            id: `capa-${id}`,
            type: "raster",
            source: id,
            paint: { "raster-opacity": capa.opacidad },
          },
          // Debajo del pin y del borde de la concesión: esas van encima de
          // todas las capas del catálogo, igual que en el 2D.
          "pin"
        );
      } catch {
        // Si el pin no llegó a crearse, se agrega encima de todo igual.
        mapa.addLayer({
          id: `capa-${id}`,
          type: "raster",
          source: id,
          paint: { "raster-opacity": capa.opacidad },
        });
      }
      return true;
    } catch {
      quitarCapa(id);
      return false;
    }
  }

  function alternarCapa(id: string) {
    if (capasActivas[id]) {
      quitarCapa(id);
      onCambiarCapa(id, false);
      return;
    }
    setCapasCargando((p) => ({ ...p, [id]: true }));
    setCapasError((p) => ({ ...p, [id]: "" }));
    cargarCapa(id).then((ok) => {
      setCapasCargando((p) => ({ ...p, [id]: false }));
      if (ok) onCambiarCapa(id, true);
      else setCapasError((p) => ({ ...p, [id]: "No se pudo cargar esta capa" }));
    });
  }

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
          // Cielo (agosto 2026): con la cámara inclinada a 60° el mapa
          // queda en perspectiva y la atmósfera pinta el espacio sobre el
          // horizonte — sin ella, el vacío por encima del terreno se ve
          // negro/transparente y rompe la ilusión de "montañas reales".
          // En MapLibre v6 `sky` es propiedad raíz del estilo (no una
          // capa) y usa la API de atmósfera; el blend 0.9 lo hace notable
          // pero leve, para que el mapa sea siempre lo que manda.
          sky: {
            "sky-color": "#8ec9ff",
            "horizon-color": "#ffffff",
            "atmosphere-blend": 0.9,
          },
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
            // Source PROPIA para el hillshade (agosto 2026): MapLibre
            // renderiza mejor el sombreado con un source separado del de
            // terreno (issue maplibre#2035 — compartir el source los
            // degradaba). Mismos tiles, misma URL: la precarga en segundo
            // plano (terreno3D.ts) calienta la caché HTTP para ambos.
            demSombreado: {
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
            // Hillshade (agosto 2026, pedido explícito de Esthiven: el
            // terreno "se ve algo plano"): sombreado de relieve calculado
            // del DEM que les da profundidad a las laderas y quebradas
            // incluso antes de que el terreno 3D se active. Va encima del
            // satélite y debajo de todo lo demás (polígono, pin, capas).
            // Colores con canal alfa para que la foto satelital siga
            // leyéndose de fondo.
            {
              id: "sombreado",
              type: "hillshade",
              source: "demSombreado",
              paint: {
                // Subido a 0.8 (agosto 2026, "más relieve"): junto a la
                // exageración 4.0 del terreno, las laderas se ven con
                // sombra y luz marcadas. 0.6 resultaba demasiado sutil.
                "hillshade-exaggeration": 0.8,
                "hillshade-illumination-direction": 315,
                "hillshade-shadow-color": "rgba(15, 23, 42, 0.65)",
                "hillshade-highlight-color": "rgba(255, 255, 255, 0.35)",
              },
            },
          ],
        },
        scrollZoom: false,
      });
    } catch {
      setError("No se pudo iniciar el mapa 3D. Usá el botón \"Mapa 2D\".");
      return;
    }
    mapaRef.current = mapa;
    let desmontado = false;

    // Relieve + inclinación de cámara. Se activan en el primer `load` o
    // por el temporizador de respaldo (2.5s), lo que llegue primero —
    // agosto 2026: antes esperaba `idle`, pero un source de capa que falla
    // (ej. una capa-3d que el backend no puede generar, 404) mantiene el
    // mapa ocupado para siempre, `idle` nunca llega y el relieve recién
    // aparecía por el respaldo de 8s — el usuario veía un mapa plano "sin
    // cambios". El gate de abajo solo espera al source `dem`, jamás a las
    // capas: así un source roto no puede colgar el relieve.
    const activarRelieve = () => {
      if (desmontado) return;
      let tieneDem = false;
      try {
        tieneDem = !!mapa.getSource("dem");
      } catch {
        tieneDem = false;
      }
      if (!tieneDem) {
        // El source dem aún no está en el estilo (red lenta): reintentar en
        // 400ms. OJO: NO gatear con `isStyleLoaded()` — en MapLibre ese
        // método espera a que TODAS las fuentes terminen de cargar, así que
        // una capa rota (ej. capa-3d 404) lo deja en false PARA SIEMPRE y
        // el relieve quedaba en "Cargando relieve 3D…" sin activarse nunca
        // (bug real agosto 2026, reportado en vivo: "dice que carga el
        // relieve pero no veo diferencias"). El source dem existe apenas el
        // estilo se aplica, sin esperar a ninguna capa.
        timerRelieve = setTimeout(activarRelieve, 400);
        return;
      }
      let relieveOk = false;
      try {
        // Exageración 4.0 (agosto 2026, pedido de Esthiven: "hazlo con más
        // relieve"): el desnivel real de una concesión en zoom alto son
        // pocos metros en pantalla. 4x lo vuelve inconfundible — se baja
        // fácil si se ve exagerado. Las capas raster (catastro, geología,
        // INGEMMET, Copernicus) se DRAPEAAN automáticamente sobre esta
        // malla: con el relieve prominente se nota que siguen el terreno.
        mapa.setTerrain({ source: "dem", exaggeration: 4 });
        relieveOk = true;
      } catch {
        /* el mapa plano queda utilizable */
      }
      try {
        // Sube el tope de inclinación (el default es 60) para que el
        // control de navegación permita inclinar más y se aprecie mejor
        // el relieve.
        mapa.setMaxPitch(85);
      } catch {
        /* cosmético */
      }
      try {
        // Pitch 60 (antes 55): la cámara más baja muestra más relieve en
        // perspectiva.
        mapa.easeTo({ pitch: 60, duration: 1200 });
      } catch {
        /* cosmético */
      }
      try {
        // Refuerza el re-render inmediato para que las capas ya cargadas
        // se redrapeen sobre la malla en el mismo frame.
        mapa.triggerRepaint();
      } catch {
        /* cosmético */
      }
      if (!desmontado && relieveOk) setRelieveActivo(true);
    };
    let timerRelieve = setTimeout(activarRelieve, 2500);
    let idled = false;
    mapa.once("load", () => {
      if (idled || desmontado) return;
      idled = true;
      clearTimeout(timerRelieve);
      activarRelieve();
    });
    // Si los tiles de elevación fallan de verdad, se avisa (el terreno se
    // muestra plano) en vez de dejar el "Cargando…" colgado.
    mapa.on("error", (e) => {
      const ev = e as unknown as { sourceId?: string; tile?: { sourceID?: string } };
      const fuente = ev.sourceId || ev.tile?.sourceID;
      if ((fuente === "dem" || fuente === "demSombreado") && !desmontado) setRelieveError(true);
    });

    // Arranque del mapa 3D (polígono + pin + capas activas). NO depende de
    // que `load`/`idle` disparen — un source roto puede impedir `load` y
    // `idle` (ver comentario de cabecera, issue MapLibre #5430), y el bug
    // real reportado en vivo era exactamente ese: el panel de capas aparecía
    // pero "al hacer clic nada", porque `capasListas` se ponía en true solo
    // adentro de `load` y nunca llegaba. Ahora hay tres vías redundantes:
    // 1) el evento `load`, 2) un poll de `isStyleLoaded()` cada 300ms, 3) un
    // temporizador de respaldo a los 4s que fuerza el arranque igual
    // (MapLibre encola sources/layers agregados antes de tener estilo
    // listo, y acá todo está en try/catch de todos modos). La primera que
    // llegue gana; `iniciado` evita doble trabajo.
    let timerEstilo: ReturnType<typeof setTimeout> | undefined;
    let timerRespaldo: ReturnType<typeof setTimeout> | undefined;
    let iniciado = false;
    const iniciar = () => {
      if (desmontado || iniciado) return;
      iniciado = true;
      if (timerEstilo) clearTimeout(timerEstilo);
      if (timerRespaldo) clearTimeout(timerRespaldo);

      // Polígono de la concesión: borde verde de marca + relleno
      // semitransparente muy tenue (el satélite de abajo sigue leyéndose).
      // Mismo verde (#10b981) que el borde 2D de Leaflet.
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
            id: "concesion-casco",
            type: "line",
            source: "concesion",
            paint: {
              // Borde blanco de contraste debajo del verde: sobre el
              // satélite, el hillshade o la nieve, el límite de la
              // concesión se identifica SIEMPRE (agosto 2026, pedido de
              // Esthiven: "no puedo identificar el polígono").
              "line-color": "#ffffff",
              "line-width": 6,
              "line-opacity": 0.9,
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
              // Subido de 0.15 a 0.25: el área de la concesión se distingue
              // del terreno que la rodea sin tapar el satélite.
              "fill-color": "#10b981",
              "fill-opacity": 0.25,
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

      // Pin de la operación (circleLayer, sin iconos PNG que Vite no sirva
      // solo) — mismo rojo del pin 2D. Se agrega ANTES de las capas del
      // panel: esas usan `beforeId: "pin"` para quedar debajo del pin.
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
            // Halo blanco más grande que el punto rojo: el pin se ve contra
            // cualquier fondo (satélite oscuro, hillshade, nieve).
            "circle-radius": 13,
            "circle-color": "#ffffff",
            "circle-stroke-width": 0,
          },
        });
        mapa.addLayer({
          id: "pin",
          type: "circle",
          source: "pin",
          paint: {
            "circle-radius": 10,
            "circle-color": "#e11d48",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
      } catch {
        // cosmético, no tumba el mapa
      }

      // Capas activas del catálogo (estado COMPARTIDO con el 2D, no solo
      // las "por defecto"): si en 2D estaba encendida aster_931 o una de
      // Copernicus, acá también se carga. Se cargan en paralelo y van
      // apareciendo sobre el terreno cuando llegan. Si una falla, no se
      // enciende (y su checkbox queda con el aviso correspondiente) — nunca
      // cuelga el mapa.
      for (const capa of capasRef.current.filter((c) => capasActivasRef.current[c.id])) {
        cargarCapa(capa.id).then((ok) => {
          if (desmontado) return;
          if (!ok) setCapasError((p) => ({ ...p, [capa.id]: "No se pudo cargar esta capa" }));
        });
      }
      setCapasListas(true);
    };
    const esperarEstilo = () => {
      if (desmontado || iniciado) return;
      if (mapa.isStyleLoaded()) iniciar();
      else timerEstilo = setTimeout(esperarEstilo, 300);
    };
    mapa.on("load", iniciar);
    timerEstilo = setTimeout(esperarEstilo, 900);
    timerRespaldo = setTimeout(iniciar, 4000);

    mapa.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        visualizePitch: true,
      }),
      // Abajo a la derecha: arriba vive el panel de capas 3D, igual que el
      // de 2D (Leaflet lo pone en topright).
      "bottom-right"
    );

    return () => {
      desmontado = true;
      clearTimeout(timerRelieve);
      if (timerEstilo) clearTimeout(timerEstilo);
      if (timerRespaldo) clearTimeout(timerRespaldo);
      mapa.remove();
      mapaRef.current = null;
      setCapasListas(false);
      setCapasError({});
      setCapasCargando({});
    };
  }, [coords, poligonoConcesion, proyectoId, escalaFallas, anomaliasSatelitales]);

  return (
    <div className="mapa-geocatmin relative h-full w-full" style={{ minHeight: "16rem" }}>
      <div ref={contenedorRef} className="h-full w-full" />

      {/* Panel de capas 3D — replica el catálogo del mapa 2D reusando sus
          mismas clases CSS (.capas-*). Plegado a un botón chico "Capas",
          mismo patrón que el panel 2D. */}
      {!error && (
        <div className="absolute top-2.5 right-2.5 z-[1000] leaflet-control-layers leaflet-control-layers-expanded">
          <div
            className="capas-panel-titulo"
            role="button"
            tabIndex={0}
            onClick={() => setPanelAbierto((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setPanelAbierto((v) => !v);
            }}
          >
            <span
              className="capas-panel-flecha"
              style={{ transform: panelAbierto ? "rotate(0deg)" : "rotate(-90deg)" }}
            >
              ▾
            </span>
            Capas
          </div>

          {panelAbierto && (
            <div className="capas-panel-contenido">
              {grupos.map((grupo, i) => {
                const abierto = !!gruposAbiertos[grupo.titulo];
                return (
                  <div key={grupo.titulo}>
                    {i > 0 && <div className="leaflet-control-layers-separator" />}
                    <div
                      className="capas-grupo-encabezado"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        cursor: "pointer",
                        userSelect: "none",
                        fontWeight: "600",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.02em",
                        margin: "0 0 4px",
                      }}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setGruposAbiertos((p) => ({ ...p, [grupo.titulo]: !abierto }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          setGruposAbiertos((p) => ({ ...p, [grupo.titulo]: !abierto }));
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          display: "inline-block",
                          transition: "transform 0.15s",
                          transform: abierto ? "rotate(0deg)" : "rotate(-90deg)",
                        }}
                      >
                        ▾
                      </span>
                      {grupo.titulo}
                    </div>
                    {abierto &&
                      grupo.capas.map((capa) => (
                        <div key={capa.id}>
                          <label className="capas-fila" style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", marginLeft: "12px" }}>
                            <input
                              type="checkbox"
                              checked={!!capasActivas[capa.id]}
                              disabled={!capasListas || !!capasCargando[capa.id]}
                              onChange={() => alternarCapa(capa.id)}
                            />
                            <span style={{ fontSize: "13px" }}>{capa.etiqueta}</span>
                            {capasCargando[capa.id] && <span style={{ fontSize: "11px", color: "#64748b" }}>…</span>}
                          </label>
                          {capasError[capa.id] && (
                            <div
                              style={{
                                margin: "0 0 4px 30px",
                                fontSize: "11px",
                                color: "#b45309",
                              }}
                            >
                              {capasError[capa.id]}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {error ? (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 border-t border-black/10 bg-white px-3 py-2 text-xs text-texto-suave dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-suave-dark">
          <span className="text-amber-600 dark:text-amber-400">⚠</span>
          {error}
        </div>
      ) : relieveError ? (
        <div className="absolute bottom-2 left-2 max-w-[70%] rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
          No se pudo cargar el relieve en tu conexión; el mapa se muestra plano.
        </div>
      ) : (
        !relieveActivo && (
          <div className="absolute bottom-2 left-2 rounded-md border border-black/10 bg-white px-2 py-1 text-[11px] text-texto-suave dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-suave-dark">
            Cargando relieve 3D…
          </div>
        )
      )}
    </div>
  );
}

export default Mapa3D;

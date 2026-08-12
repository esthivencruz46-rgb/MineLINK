import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
// RGB a metros sobre el mar). Exageración 1.5x + una capa `hillshade`
// (source propia, issue maplibre#2035) + pitch 60: el terreno se ve en
// perspectiva real sin volverse una caricatura — se probó a 4x y quedaba
// "muy alzado" (reporte de Esthiven, agosto 2026); 1.5x es el valor
// natural de MapLibre y el sombreado de laderas hace que el relieve se
// lea igual al primer golpe de vista.
//
// Basemap: la MISMA base satelital de Esri World Imagery que ya usa el
// mapa 2D de Leaflet (server.arcgisonline.com) — MapLibre acepta tiles
// raster XYZ, así que no se depende de ningún servicio nuevo pago.
//
// Estrategia de carga (agosto 2026): el mapa arranca PLANO (pitch 0 y SIN
// terreno) para que el satélite se pinte de inmediato. El relieve se activa
// en el primer `load` o por un temporizador de respaldo de 2.5s, y la
// cámara se inclina a 60° con el propio `fitBounds` (pitch dentro de sus
// opciones — en MapLibre v6 el fitBounds cancela el easeTo y lo dejaba
// plano, ver abajo). Esto corrige un bug real reportado en vivo: un source
// que falla (un overlay que devuelve 404, o tiles DEM inalcanzables) puede
// impedir que `idle` se dispare (bug conocido de MapLibre GL, issue #5430),
// y el código anterior — que esperaba `idle` adentro de `load` — dejaba el
// mapa en "Cargando relieve 3D…" para siempre, sin polígono ni terreno.
// Además, cada capa del catálogo se PRECARGA (Image + onload) antes de
// agregar su source a MapLibre: si la capa falla, simplemente no se agrega,
// y así un overlay roto no puede colgar tampoco la carga del mapa.
//
// Panel de capas (agosto 2026, pedido explícito: "las capas de 2D y todo su
// catálogo también en 3D"): replica el catálogo del mapa 2D, pero SOLO las
// que importan en 3D (agosto 2026, pedido de Esthiven: "solo las capas de
// Geología, fallas y las de copernicus puedan verse en el 3D Map") —
// Geología y fallas (geología 100K, fallas si el backend confirmó alguna)
// y Sentinel-2 · Copernicus (si ya se generó, mismas URLs que el 2D).
// Catastro minero, ASTER, QICIMI, anomalías espectrales y libre denuncio
// quedan solo en el mapa 2D. Cada capa es un PNG transparente servido por
// `GET /proyectos/{id}/capa-3d/{capa}.png` sobre el MISMO bbox que la
// galería de análisis del PDF, superpuesto como source raster de MapLibre
// con su propio `raster-opacity` (el backend exporta opacidad plena).
// Capas y geometría: satélite (base) → capas del panel → borde de la
// concesión (sin relleno) → pin. El catálogo/UI replica el panel 2D
// reusando sus mismas clases CSS (`.capas-*`, `.mapa-geocatmin`).
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

// Zona acotada donde se muestra la geología 50K, espejo del mapa 2D
// (MapaGeocatmin: `poligono.getBounds().pad(1.1)`, ≈ ×10 el área de la
// concesión): con la cámara DENTRO de esa zona se usa la 50K; fuera, la
// 100K. Sin polígono cae a un umbral de zoom (igual que el 2D sin
// concesión usa `mapa.getZoom() >= 12`). MapLibre no trae `pad()` de
// LngLatBounds (ese es Leaflet), así que el margen se calcula a mano.
function zona50DePoligono(
  poligono?: number[][][] | null
): maplibregl.LngLatBounds | null {
  if (!poligono || poligono.length === 0) return null;
  const bounds = new maplibregl.LngLatBounds();
  for (const anillo of poligono) {
    for (const punto of anillo) {
      if (Array.isArray(punto) && punto.length >= 2) {
        bounds.extend([punto[0], punto[1]]);
      }
    }
  }
  if (bounds.isEmpty()) return null;
  const lngSpan = bounds.getEast() - bounds.getWest();
  const latSpan = bounds.getNorth() - bounds.getSouth();
  return new maplibregl.LngLatBounds(
    [bounds.getWest() - lngSpan * 1.1, bounds.getSouth() - latSpan * 1.1],
    [bounds.getEast() + lngSpan * 1.1, bounds.getNorth() + latSpan * 1.1]
  );
}

// ¿La vista del mapa cabe COMPLETA dentro de la zona 50K? (misma semántica
// que `zona50.contains(mapa.getBounds())` de Leaflet en el 2D — MapLibre
// no acepta un LngLatBounds en `contains`).
function vistaDentroDe(
  zona50: maplibregl.LngLatBounds,
  vista: maplibregl.LngLatBounds
): boolean {
  return (
    vista.getNorth() <= zona50.getNorth() &&
    vista.getSouth() >= zona50.getSouth() &&
    vista.getEast() <= zona50.getEast() &&
    vista.getWest() >= zona50.getWest()
  );
}

// Nombre tecnico -> etiqueta legible para el panel de capas (mismo
// orden/nombres que backend/copernicus.py NOMBRES_CAPAS y que el panel del
// mapa 2D — duplicado acá a propósito, ver MapaGeocatmin.tsx). Sin el
// prefijo "Anomalía:" en los 4 índices porque ya van dentro de su
// sub-grupo de alteración ("Alteración férrica"/"Alteración argílica",
// agosto 2026 — pedido explícito de Esthiven).
const TITULOS_ANOMALIAS: Record<string, string> = {
  oxidos_de_hierro: "Óxidos de hierro",
  arcillas: "Arcillas",
  hierro_ferroso: "Hierro ferroso",
  arcilla_sulfatos_mica: "Arcilla / sulfatos / mica",
  combinado: "Anomalías combinadas (todas)",
  coincidencias: "Coincidencia de 2+ anomalías (más confiable)",
};

// Sub-grupo de alteración de cada índice de Copernicus (agosto 2026, pedido
// explícito de Esthiven: agrupar en "Alteración férrica" y "Alteración
// argílica"). "Combinado" y "coincidencias" NO están acá a propósito —
// quedan en la sección suelta, aparte de la argílica (aclarado en vivo
// agosto 2026: al plegar "Alteración argílica" con "−" no deben arrastrar
// esas dos capas). Espejo de la sección Copernicus del panel 2D.
const SUBGRUPOS_ANOMALIAS: Record<string, string> = {
  oxidos_de_hierro: "Alteración férrica",
  hierro_ferroso: "Alteración férrica",
  arcillas: "Alteración argílica",
  arcilla_sulfatos_mica: "Alteración argílica",
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
  /** Variante 50K (solo geología): la capa alterna entre `url` (100K) y
   * esta según la cámara — dentro de la zona de la concesión → 50K;
   * alejada → 100K. Espejo del apilado 100K+50K del mapa 2D. */
  url50k?: string;
  /** Sub-grupo dentro del grupo (agosto 2026): los índices de Copernicus
   * se agrupan en "Alteración férrica"/"Alteración argílica". Sin valor =
   * la capa va suelta en el grupo. */
  subgrupo?: string;
}

// Versión de las URLs de capas 3D: subirla cada vez que cambie la forma de
// servirlas (CORS/caché). Necesario porque el backend manda
// `Cache-Control: max-age=86400` y una visita previa con el flujo viejo
// (precarga sin crossOrigin, agosto 2026) dejaba cacheada la variante SIN
// `Access-Control-Allow-Origin`; con la misma URL el navegador la reusa y el
// preload con crossOrigin choca contra ella — "No se pudo cargar esta capa" —
// aunque el servidor ya responda con ACAO. El parámetro cambia la cache key y
// fuerza una descarga fresca para TODOS los usuarios, sin depender de que
// limpien su caché.
const VER_CAPAS_3D = "2";
const conVersion = (url: string): string =>
  `${url}${url.includes("?") ? "&" : "?"}v=${VER_CAPAS_3D}`;

// Catálogo completo de capas 3D — espejo del panel "Capas" del mapa 2D.
function catalogoCapas(opts: {
  proyectoId?: string;
  bbox?: [number, number, number, number] | null;
  escalaFallas?: "50k" | "100k" | null;
  geologiaEscala?: "50k" | "100k";
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
    porDefecto: boolean,
    subgrupo?: string
  ) => {
    if (!url || !bbox) return;
    capas.push({ id, grupo, etiqueta, url, bbox, opacidad, porDefecto, subgrupo });
  };
  if (opts.bbox) {
    // SOLO geología, fallas y Copernicus en el 3D (pedido de Esthiven,
    // agosto 2026): catastro minero, ASTER, QICIMI, anomalías espectrales
    // y libre denuncio quedan solo en el mapa 2D — en 3D lo importante son
    // las capas geológicas y las anomalías de Copernicus.
    push("geologia", "Geología y fallas", "Geología", conVersion(`${base}/capa-3d/geologia.png`), opts.bbox, 0.6, true);
    // Si INGEMMET tiene carta 50K en el punto, la geología alterna con la
    // 100K según la cámara (mismo comportamiento que el 2D apilado). La
    // etiqueta es "Geología" a secas porque la escala cambia sola.
    const ultima = capas[capas.length - 1];
    if (ultima && ultima.id === "geologia" && opts.geologiaEscala === "50k") {
      ultima.url50k = conVersion(`${base}/capa-3d/geologia_50k.png`);
    }
    // Las fallas solo se ofrecen si el backend confirmó que hay cerca a
    // alguna escala (mismo criterio que el panel 2D, MapaGeocatmin) — si
    // no, el endpoint devuelve 404 y el panel 3D mostraría la capa rota.
    if (opts.escalaFallas) {
      push("fallas", "Geología y fallas", "Fallas geológicas cercanas", conVersion(`${base}/capa-3d/fallas.png`), opts.bbox, 0.9, true);
    }
  }
  if (opts.anomaliasSatelitales) {
    const [xmin, ymin, xmax, ymax] = opts.anomaliasSatelitales.bbox;
    const bboxAnomalias: [number, number, number, number] = [xmin, ymin, xmax, ymax];
    for (const [nombre, url] of Object.entries(opts.anomaliasSatelitales.capas)) {
      push(
        nombre,
        "Sentinel-2 · Copernicus",
        TITULOS_ANOMALIAS[nombre] ?? nombre,
        conVersion(`${BASE_URL}${url}`),
        bboxAnomalias,
        1,
        false,
        SUBGRUPOS_ANOMALIAS[nombre]
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
    // crossOrigin obligatorio: sin él el preload se hace como petición NO-CORS
    // (sin header Origin) y el backend no emite Access-Control-Allow-Origin, así
    // que el navegador cachea la respuesta SIN headers CORS y el fetch posterior
    // de MapLibre choca contra esa variante cacheada: "No ACAO header present"
    // aunque el servidor sí la enviaría a una petición con Origin (bug real de
    // producción, agosto 2026 — las capas 3D no cargaban en la web pública).
    img.crossOrigin = "anonymous";
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`no se pudo cargar ${url}`));
    img.src = url;
  });
}

// Precarga la imagen y responde si trae algo PINTADO (algún píxel no
// transparente). Para el swap 100K→50K de la geología: si INGEMMET no
// tiene carta 50K en esa zona el export sale transparente (vacío), y
// cambiarla dejaría la geología en blanco — mejor quedarse con la 100K.
// Best-effort: si no se puede inspeccionar (CORS/canvas tainted), asume
// que sí hay contenido.
function imagenTieneContenido(url: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 1;
        canvas.height = img.naturalHeight || 1;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(true);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const datos = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        // Se muestrea el canal alfa cada ~64 píxeles: suficiente para saber
        // si hay contenido y barato para una imagen de ~1 MP.
        for (let i = 3; i < datos.length; i += 256) {
          if (datos[i] > 0) {
            resolve(true);
            return;
          }
        }
        resolve(false);
      } catch {
        resolve(true);
      }
    };
    img.onerror = () => reject(new Error(`no se pudo cargar ${url}`));
    img.src = url;
  });
}

export function Mapa3D({
  coords,
  poligonoConcesion,
  proyectoId,
  escalaFallas,
  geologiaEscala,
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
  /** Escala a la que INGEMMET tiene carta de GEOLOGÍA en el punto (agosto
   * 2026): con "50k" la capa de geología alterna 100K↔50K según la cámara
   * (dentro de la zona de la concesión → 50K; alejada → 100K) — espejo
   * del apilado 100K+50K del mapa 2D. Con "100k" queda la 100K única. */
  geologiaEscala?: "50k" | "100k";
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
  // Zona de la concesión donde vale la 50K (polígono pad 1.1) — se llena en
  // el effect del mapa, se lee desde `cargarCapa` (carga inicial de la capa)
  // y desde el listener de `moveend` (swap 100K↔50K al mover la cámara).
  const zona50Ref = useRef<maplibregl.LngLatBounds | null>(null);
  // URL de geología activa en el source (100K o 50K) — se actualiza en cada
  // swap para no volver a cambiar la misma imagen.
  const urlGeologiaRef = useRef<string>("");
  // Espejo de `geologiaEscala` para leerlo en callbacks que no son effects
  // (no debe recrear el mapa).
  const geologiaEscalaRef = useRef(geologiaEscala);
  geologiaEscalaRef.current = geologiaEscala;
  // Espejo de `capasActivas` para leerlo dentro del effect del mapa sin
  // meterlo en sus deps (cambiar capas no debe recrear el mapa).
  const capasActivasRef = useRef(capasActivas);
  capasActivasRef.current = capasActivas;

  const [error, setError] = useState<string | null>(null);
  const [relieveActivo, setRelieveActivo] = useState(false);
  const [relieveError, setRelieveError] = useState(false);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({
    "Geología y fallas": true,
  });
  // Sub-grupos plegados (agosto 2026): el encabezado "+"/"−" de
  // "Alteración férrica"/"Alteración argílica" oculta la lista de sus
  // capas. Ausente del objeto = expandido.
  const [subgruposCerrados, setSubgruposCerrados] = useState<Record<string, boolean>>({});
  const [capasCargando, setCapasCargando] = useState<Record<string, boolean>>({});
  const [capasError, setCapasError] = useState<Record<string, string>>({});
  const [capasListas, setCapasListas] = useState(false);
  // Escala de geología elegida a mano en el panel 3D (agosto 2026): "auto"
  // = la cámara decide (100K alejada, 50K dentro de la zona, lo de
  // siempre); "100k"/"50k" la fija sin depender de la cámara. Solo tiene
  // sentido cuando hay carta 50K (el selector ni se muestra si no).
  const [escalaGeologia, setEscalaGeologia] = useState<"auto" | "100k" | "50k">("auto");
  const escalaGeologiaRef = useRef(escalaGeologia);
  escalaGeologiaRef.current = escalaGeologia;

  const bbox = useMemo(() => bboxOverlay(poligonoConcesion, coords), [poligonoConcesion, coords]);
  const capas = useMemo(
    () =>
      catalogoCapas({
        proyectoId,
        bbox,
        escalaFallas,
        geologiaEscala,
        anomaliasSatelitales,
      }),
    [proyectoId, bbox, escalaFallas, geologiaEscala, anomaliasSatelitales]
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

  // Corta las capas de un grupo en secciones por `subgrupo` (agosto 2026):
  // los índices de Copernicus van bajo "Alteración férrica" / "Alteración
  // argílica"; combinado y coincidencias caen en la sección sin título
  // (aparte, por decisión de Esthiven). Se agrupa por subgrupo sobre TODO
  // el grupo, no solo capas consecutivas: el catálogo 3D sale en el orden
  // de `capas` del backend (oxidos, arcillas, hierro_ferroso,
  // arcilla_sulfatos_mica, combinado, coincidencias), y agrupar solo lo
  // consecutivo intercalaría las dos secciones de alteración. El
  // encabezado de sub-grupo solo se pinta si la sección tiene capas.
  const seccionesDeGrupo = useCallback(
    (grupo: { titulo: string; capas: CapaDef[] }): { titulo?: string; capas: CapaDef[] }[] => {
      const secciones: { titulo?: string; capas: CapaDef[] }[] = [];
      const indice = new Map<string, number>();
      for (const c of grupo.capas) {
        const clave = c.subgrupo ?? "";
        const pos = indice.get(clave);
        if (pos !== undefined) {
          secciones[pos].capas.push(c);
        } else {
          indice.set(clave, secciones.length);
          secciones.push({ titulo: c.subgrupo, capas: [c] });
        }
      }
      return secciones;
    },
    []
  );

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

  // URL de geología según la selección del panel y la cámara: en modo
  // manual ("100k"/"50k") la fija el botón; en "auto" la decide la vista —
  // con carta 50K disponible y la cámara DENTRO de la zona de la concesión
  // → 50K; fuera → 100K. Espejo del `actualizarGeologia50` del mapa 2D
  // (zona pad 1.1 o zoom ≥ 12 sin concesión).
  function urlGeologiaActiva(): string {
    const capa = capasRef.current.find((c) => c.id === "geologia");
    if (!capa) return "";
    const manual = escalaGeologiaRef.current;
    if (capa.url50k && geologiaEscalaRef.current === "50k") {
      if (manual === "50k") return capa.url50k;
      if (manual === "100k") return capa.url;
      const mapa = mapaRef.current;
      if (mapa) {
        const zona50 = zona50Ref.current;
        const dentro = zona50 ? vistaDentroDe(zona50, mapa.getBounds()) : mapa.getZoom() >= 12;
        if (dentro) return capa.url50k;
      }
    }
    return capa.url;
  }

  // Cambia la imagen del source de geología (100K↔50K) sin recrear la capa.
  // Devuelve true si quedó en la URL pedida.
  function cambiarImagenGeologia(url: string, bbox: [number, number, number, number]): boolean {
    const mapa = mapaRef.current;
    if (!mapa) return false;
    if (url === urlGeologiaRef.current) return true;
    try {
      const source = mapa.getSource<maplibregl.ImageSource>("geologia");
      if (!source) return false;
      const [oeste, sur, este, norte] = bbox;
      source.updateImage({
        url,
        coordinates: [
          [oeste, norte],
          [este, norte],
          [este, sur],
          [oeste, sur],
        ],
      });
      urlGeologiaRef.current = url;
      return true;
    } catch {
      return false;
    }
  }

  // Aplica la escala que corresponda según el botón del panel ("100k"/"50k")
  // o la cámara en modo "auto", cambiando la imagen del source de geología
  // sin recrear la capa. La 50K se precarga y se verifica que traiga algo
  // pintado (si el export salió transparente —sin carta ahí— o falló, se
  // queda con la 100K). No-op si ya está en esa URL.
  function aplicarEscalaGeologia(): void {
    const capa = capasRef.current.find((c) => c.id === "geologia");
    const mapa = mapaRef.current;
    if (!capa?.url50k || !mapa) return;
    let tieneSource = false;
    try {
      tieneSource = !!mapa.getSource("geologia");
    } catch {
      tieneSource = false;
    }
    if (!tieneSource) return;
    const nueva = urlGeologiaActiva();
    if (!nueva || nueva === urlGeologiaRef.current) return;
    const aplicar = () => {
      const m = mapaRef.current;
      const c = capasRef.current.find((x) => x.id === "geologia");
      if (!m || !c) return;
      if (urlGeologiaRef.current === nueva) return;
      cambiarImagenGeologia(nueva, c.bbox);
    };
    if (nueva === capa.url) {
      precargarImagen(nueva).then(aplicar).catch(() => {});
    } else {
      imagenTieneContenido(nueva).then((tiene) => { if (tiene) aplicar(); }).catch(() => {});
    }
  }

  // Botones del panel 3D: "Auto" vuelve al comportamiento de cámara;
  // "100k"/"50k" fijan la escala de una. Aplica de inmediato, no espera
  // a que el usuario mueva la cámara.
  function seleccionarEscalaGeologia(escala: "auto" | "100k" | "50k") {
    setEscalaGeologia(escala);
    escalaGeologiaRef.current = escala;
    aplicarEscalaGeologia();
  }

  // Agrega la capa al mapa, SIEMPRE después de precargar la imagen (ver
  // arriba). El `beforeId: "pin"` la deja por debajo del polígono y el pin.
  // Se usa `type: "image"` con las 4 esquinas del bbox (no un raster con
  // `tiles: [url]`): con MapLibre ≥5 el source de imagen se drapea sobre
  // la malla de terreno y queda confinado a su bbox. El patrón raster con
  // URL única (sin {z}/{x}/{y}) estiraba la imagen por TODO el terreno
  // visible en 3D y por toda la pantalla en 2D (bug real agosto 2026,
  // verificado por píxeles) — no hay forma de colocarla bien así.
  async function cargarCapa(id: string): Promise<boolean> {
    const mapa = mapaRef.current;
    if (!mapa) return false;
    const capa = capasRef.current.find((c) => c.id === id);
    if (!capa) return false;
    if (mapa.getSource(id)) return true;
    // La geología arranca con la escala que le corresponda a la cámara
    // actual (100K o 50K) — el swap posterior lo hace `moveend`. La 50K
    // inicial se verifica igual que el swap: si el export salió
    // transparente (sin carta ahí) se cae a la 100K en vez de arrancar
    // con una geología en blanco.
    let urlInicial = id === "geologia" ? urlGeologiaActiva() : capa.url;
    if (!urlInicial) return false;
    try {
      if (id === "geologia" && capa.url50k && urlInicial === capa.url50k) {
        // La 50K falla (404) o sale transparente (sin carta ahí) → respaldo
        // a la 100K; nunca dejar la geología sin cargar por culpa de la 50K.
        let tiene = false;
        try {
          tiene = await imagenTieneContenido(urlInicial);
        } catch {
          tiene = false;
        }
        if (!tiene) {
          urlInicial = capa.url;
          await precargarImagen(urlInicial);
        }
      } else {
        await precargarImagen(urlInicial);
      }
      urlGeologiaRef.current = urlInicial;
    } catch {
      return false;
    }
    try {
      // bbox es [oeste, sur, este, norte] — las 4 esquinas en el orden que
      // MapLibre espera (top-left, top-right, bottom-right, bottom-left).
      const [oeste, sur, este, norte] = capa.bbox;
      mapa.addSource(id, {
        type: "image",
        url: urlInicial,
        coordinates: [
          [oeste, norte],
          [este, norte],
          [este, sur],
          [oeste, sur],
        ],
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

  // Interruptor maestro de un sub-grupo (agosto 2026, pedido de Esthiven):
  // clic en "Alteración argílica" enciende o apaga TODAS sus capas de una
  // ("si le quitas, igual" — un clic apaga las 4). Enciende solo las que
  // están apagadas (alternarCapa carga la imagen 3D antes de reportar el
  // cambio) y apaga solo las activas.
  function alternarSubgrupo(seccion: { titulo?: string; capas: CapaDef[] }) {
    const ids = seccion.capas.map((c) => c.id);
    const algunaActiva = ids.some((id) => capasActivas[id] === true);
    const objetivo = !algunaActiva;
    ids.forEach((id) => {
      if (!!capasActivas[id] !== objetivo) alternarCapa(id);
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
        // sus tiles llegan, sin esperar el DEM. La inclinación 3D llega con
        // el `fitBounds` de `iniciar`, que lleva `pitch: 60` (ver allá —
        // se usa fitBounds, no easeTo, porque en MapLibre v6 el fitBounds
        // cancela la animación del easeTo).
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
                // Junto a la exageración 1.5 del terreno, las laderas se
                // ven con sombra y luz marcadas sin dominar la foto.
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

    // Zona donde se muestra la geología 50K (polígono pad 1.1, espejo del
    // 2D) — la leen `urlGeologiaActiva` (carga de la capa) y el listener de
    // `moveend` (swap 100K↔50K al mover la cámara).
    zona50Ref.current = zona50DePoligono(poligonoConcesion);

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
        // Exageración 1.5 (agosto 2026): a 4.0 el relieve se veía "muy
        // alzado" (reporte de Esthiven: "se ve aumentado x2.5" con 4x en
        // código). 1.5 deja la altura en ~1x real — montañas naturales,
        // no caricatura. Las capas raster (catastro, geología, INGEMMET,
        // Copernicus) se DRAPEAAN sobre esta malla y siguen el terreno.
        mapa.setTerrain({ source: "dem", exaggeration: 1.5 });
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
      // NOTA: el pitch 60 se aplica en el `fitBounds` de `iniciar`
      // ({ padding, maxZoom, pitch: 60 }), NO con easeTo. En MapLibre v6
      // `fitBounds` → `jumpTo` llama a `stop()` y CANCELA cualquier
      // easeTo en vuelo; como `activarRelieve` se registra antes que
      // `iniciar` en `load`, la animación moría a los pocos frames y la
      // cámara quedaba en pitch 0 (top-down, terreno invisible) —
      // "dice que carga el relieve pero no se ve 3D" (bug real agosto
      // 2026, verificado con MapLibre 6.3.0: easeTo+fitBounds = pitch
      // 0.0; fitBounds con pitch 60 = pitch 60.0).
      try {
        // Red de seguridad instantánea: si por cualquier motivo el
        // fitBounds no llegó a correr (ej. proyecto sin polígono), el tilt
        // se aplica igual acá. jumpTo no compite con el fitBounds (ambos
        // terminan en pitch 60) y NO se usa easeTo, que es lo que el
        // fitBounds cancela.
        if (mapa.getPitch() < 45) mapa.jumpTo({ pitch: 60 });
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

      // Polígono de la concesión: SOLO borde, sin relleno (pedido de
      // Esthiven, agosto 2026) — el terreno de abajo se ve completo dentro
      // de la concesión. Borde blanco de contraste debajo del verde de
      // marca, mismo #10b981 que el borde 2D de Leaflet.
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

          // Encuadre a la concesión completa, YA con pitch 60 para que la
          // morfología se lea desde el primer frame (ver arriba). El punto
          // focal queda apuntando al proyecto.
          const bounds = new maplibregl.LngLatBounds();
          for (const anillo of poligonoConcesion) {
            for (const punto of anillo) {
              if (Array.isArray(punto) && punto.length >= 2) {
                bounds.extend([punto[0], punto[1]]);
              }
            }
          }
          if (!bounds.isEmpty()) {
            // `pitch: 60` va DENTRO del fitBounds (no con easeTo): en
            // MapLibre v6 el fitBounds cancela cualquier easeTo en vuelo y
            // la cámara quedaba plana (pitch 0) aunque el terreno estuviera
            // activo. Con el pitch aquí, el encuadre se calcula ya con la
            // perspectiva y el relieve se lee al primer frame.
            mapa.fitBounds(bounds, { padding: 50, maxZoom: 16, pitch: 60 });
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

    // Swap 100K↔50K de la geología con la cámara (agosto 2026, espejo del
    // `actualizarGeologia50` del mapa 2D): con la vista DENTRO de la zona
    // de la concesión se usa la carta 50K (más detalle); fuera, la 100K.
    // Solo actúa en modo "auto" del panel (en manual la URL ya está fija y
    // `urlGeologiaActiva` devuelve lo mismo, así que es un no-op). Se
    // evalúa en `moveend` (fin del pan/zoom), no en cada frame.
    const actualizarGeologia50 = () => {
      if (desmontado) return;
      aplicarEscalaGeologia();
    };
    mapa.on("moveend", actualizarGeologia50);

    return () => {
      desmontado = true;
      clearTimeout(timerRelieve);
      if (timerEstilo) clearTimeout(timerEstilo);
      if (timerRespaldo) clearTimeout(timerRespaldo);
      mapa.off("moveend", actualizarGeologia50);
      mapa.remove();
      mapaRef.current = null;
      setCapasListas(false);
      setCapasError({});
      setCapasCargando({});
    };
  }, [coords, poligonoConcesion, proyectoId, escalaFallas, geologiaEscala, anomaliasSatelitales]);

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
                      seccionesDeGrupo(grupo).map((seccion, si) => {
                        const subCerrado = seccion.titulo
                          ? subgruposCerrados[seccion.titulo] === true
                          : false;
                        const todasActivas =
                          seccion.capas.length > 0 &&
                          seccion.capas.every((c) => capasActivas[c.id]);
                        return (
                        <div key={seccion.titulo ?? `seccion-${si}`}>
                          {seccion.titulo && (
                            <div
                              className="capas-subgrupo"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                cursor: "default",
                                userSelect: "none",
                                margin: "6px 0 2px 12px",
                                fontSize: "11px",
                                fontWeight: "600",
                                textTransform: "uppercase",
                                letterSpacing: "0.02em",
                                color: "#64748b",
                              }}
                            >
                              {/* "+"/"−": colapsa o expande la lista de capas
                                  del sub-grupo. */}
                              <span
                                role="button"
                                tabIndex={0}
                                title="Mostrar / ocultar las capas de este grupo"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSubgruposCerrados((p) => ({
                                    ...p,
                                    [seccion.titulo as string]: !subCerrado,
                                  }));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.stopPropagation();
                                    setSubgruposCerrados((p) => ({
                                      ...p,
                                      [seccion.titulo as string]: !subCerrado,
                                    }));
                                  }
                                }}
                                style={{
                                  fontSize: "11px",
                                  lineHeight: "1",
                                  width: "13px",
                                  textAlign: "center",
                                  color: "#64748b",
                                  cursor: "pointer",
                                  border: "1px solid rgba(0,0,0,0.15)",
                                  borderRadius: "3px",
                                  background: "transparent",
                                }}
                              >
                                {subCerrado ? "+" : "−"}
                              </span>
                              {/* El título es un interruptor maestro: clic
                                  enciende/apaga todas las capas del grupo. */}
                              <span
                                role="button"
                                tabIndex={0}
                                title="Clic: activa o desactiva todas las capas de este grupo"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  alternarSubgrupo(seccion);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.stopPropagation();
                                    alternarSubgrupo(seccion);
                                  }
                                }}
                                style={{
                                  cursor: "pointer",
                                  color: todasActivas ? "#10b981" : "#64748b",
                                  fontWeight: todasActivas ? "700" : "600",
                                }}
                              >
                                {seccion.titulo}
                              </span>
                            </div>
                          )}
                          {!subCerrado &&
                            seccion.capas.map((capa) => (
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
                          {/* Selector de escala de la geología (agosto 2026):
                              solo cuando INGEMMET tiene carta 50K además de la
                              100K. "Auto" = la cámara decide (100K alejada,
                              50K dentro de la zona); "100K"/"50K" fijan la
                              escala de una, sin depender del zoom. */}
                          {capa.id === "geologia" && geologiaEscala === "50k" && (
                            <div
                              className="capas-escala"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                margin: "2px 0 6px 30px",
                                fontSize: "11px",
                                color: "#64748b",
                              }}
                            >
                              <span style={{ marginRight: "2px" }}>Escala:</span>
                              {(["auto", "100k", "50k"] as const).map((opcion) => (
                                <button
                                  key={opcion}
                                  type="button"
                                  title={
                                    opcion === "auto"
                                      ? "Automático: cambia con el zoom"
                                      : opcion === "100k"
                                        ? "Carta 1:100,000"
                                        : "Carta 1:50,000"
                                  }
                                  onClick={() => seleccionarEscalaGeologia(opcion)}
                                  style={{
                                    border:
                                      "1px solid " +
                                      (escalaGeologia === opcion
                                        ? "#10b981"
                                        : "rgba(0,0,0,0.15)"),
                                    color: escalaGeologia === opcion ? "#10b981" : "#334155",
                                    fontWeight: escalaGeologia === opcion ? "600" : "400",
                                    background: "transparent",
                                    borderRadius: "4px",
                                    padding: "1px 8px",
                                    cursor: "pointer",
                                    fontSize: "11px",
                                    lineHeight: "1.4",
                                  }}
                                >
                                  {opcion === "auto" ? "Auto" : opcion}
                                </button>
                              ))}
                            </div>
                          )}
                            </div>
                          ))}
                        </div>
                        );
                      })}
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
